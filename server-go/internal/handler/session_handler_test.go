package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/pashagolub/pgxmock/v4"
	"kasir-backend/internal/model"
)

func TestSessionHandler_GetSessions(t *testing.T) {
	h, mock := setupTestHandler(t)
	defer mock.Close()

	now := time.Now()
	rows := mock.NewRows([]string{
		"id", "outlet_id", "queue_no", "nama", "items", "start_time", "tanggal", "pay_awal", "created_at",
	}).AddRow("s-1", "outlet-1", 1, "Customer 1", json.RawMessage(`[]`), int64(1000), "2026-08-26", "cash", &now)

	mock.ExpectQuery(`SELECT id, outlet_id, queue_no, COALESCE\(nama, ''\), items, COALESCE\(start_time, 0\), COALESCE\(tanggal, ''\), COALESCE\(pay_awal, 'cash'\), created_at FROM active_sessions WHERE outlet_id = \$1`).
		WithArgs("outlet-1").
		WillReturnRows(rows)

	router := NewRouter(h)
	req := httptest.NewRequest(http.MethodGet, "/api/sessions?outlet_id=outlet-1", nil)
	rr := httptest.NewRecorder()

	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}

	var sessions []model.ActiveSession
	if err := json.Unmarshal(rr.Body.Bytes(), &sessions); err != nil {
		t.Fatalf("failed to unmarshal sessions: %v", err)
	}
	if len(sessions) != 1 || sessions[0].ID != "s-1" {
		t.Errorf("unexpected sessions: %+v", sessions)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet mock expectations: %v", err)
	}
}

func TestSessionHandler_AddSession(t *testing.T) {
	h, mock := setupTestHandler(t)
	defer mock.Close()

	now := time.Now()
	client := h.Hub.Register("outlet-1")

	// Step 1: Check existing queue
	mock.ExpectQuery(`SELECT queue_no FROM active_sessions WHERE id = \$1`).
		WithArgs("s-101").
		WillReturnRows(mock.NewRows([]string{"queue_no"}))

	// Step 2: Next queue
	mock.ExpectQuery(`SELECT COALESCE\(MAX\(q\), 0\) \+ 1 AS next_q FROM`).
		WithArgs("outlet-1", "2026-08-26").
		WillReturnRows(mock.NewRows([]string{"next_q"}).AddRow(2))

	// Step 3: Insert
	mock.ExpectQuery(`INSERT INTO active_sessions`).
		WithArgs("s-101", "outlet-1", 2, "Andi", json.RawMessage(`[]`), int64(1700000000), "2026-08-26", "cash").
		WillReturnRows(mock.NewRows([]string{
			"id", "outlet_id", "queue_no", "nama", "items", "start_time", "tanggal", "pay_awal", "created_at",
		}).AddRow("s-101", "outlet-1", 2, "Andi", json.RawMessage(`[]`), int64(1700000000), "2026-08-26", "cash", &now))

	body := `{"id":"s-101","outletId":"outlet-1","nama":"Andi","startTime":1700000000,"tanggal":"2026-08-26","payAwal":"cash","items":[]}`

	router := NewRouter(h)
	req := httptest.NewRequest(http.MethodPost, "/api/sessions", bytes.NewReader([]byte(body)))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	router.ServeHTTP(rr, req)

	t.Logf("Response: %s", rr.Body.String())

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rr.Code, rr.Body.String())
	}

	// Verify realtime event received on client channel
	select {
	case ev := <-client.Send:
		if ev.Type != "SESSION_ADDED" || ev.OutletID != "outlet-1" {
			t.Errorf("unexpected broadcast event: %+v", ev)
		}
	case <-time.After(500 * time.Millisecond):
		t.Errorf("timed out waiting for SESSION_ADDED broadcast")
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet mock expectations: %v", err)
	}
}

func TestSessionHandler_DeleteSession(t *testing.T) {
	h, mock := setupTestHandler(t)
	defer mock.Close()

	now := time.Now()
	// Mock lookup for outlet_id
	mock.ExpectQuery(`SELECT id, outlet_id, queue_no, COALESCE\(nama, ''\), items, COALESCE\(start_time, 0\), COALESCE\(tanggal, ''\), COALESCE\(pay_awal, 'cash'\), created_at FROM active_sessions WHERE id = \$1`).
		WithArgs("s-101").
		WillReturnRows(mock.NewRows([]string{
			"id", "outlet_id", "queue_no", "nama", "items", "start_time", "tanggal", "pay_awal", "created_at",
		}).AddRow("s-101", "outlet-1", 2, "Andi", json.RawMessage(`[]`), int64(1700000000), "2026-08-26", "cash", &now))

	mock.ExpectExec(`DELETE FROM active_sessions WHERE id = \$1`).
		WithArgs("s-101").
		WillReturnResult(pgxmock.NewResult("DELETE", 1))

	router := NewRouter(h)
	req := httptest.NewRequest(http.MethodDelete, "/api/sessions/s-101", nil)
	rr := httptest.NewRecorder()

	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet mock expectations: %v", err)
	}
}

func TestSessionHandler_ClaimSession(t *testing.T) {
	h, mock := setupTestHandler(t)
	defer mock.Close()

	now := time.Now()
	client := h.Hub.Register("outlet-1")

	mock.ExpectBegin()

	// FOR UPDATE lookup
	mock.ExpectQuery(`SELECT outlet_id FROM active_sessions WHERE id = \$1 FOR UPDATE`).
		WithArgs("s-200").
		WillReturnRows(mock.NewRows([]string{"outlet_id"}).AddRow("outlet-1"))

	// DELETE active session (no remaining items)
	mock.ExpectExec(`DELETE FROM active_sessions WHERE id = \$1`).
		WithArgs("s-200").
		WillReturnResult(pgxmock.NewResult("DELETE", 1))

	// MAX(no)
	mock.ExpectQuery(`SELECT COALESCE\(MAX\(no\), 0\) \+ 1 FROM transactions`).
		WillReturnRows(mock.NewRows([]string{"max"}).AddRow(10))

	// INSERT transaction
	mock.ExpectQuery(`INSERT INTO transactions`).
		WithArgs(
			"t-200", "outlet-1", 10, 1, "Rian", "2026-08-26",
			int64(1000), int64(2000), "item-1", "-", "-",
			float64(50000), float64(0), float64(0), float64(50000), float64(50000),
			"cash", float64(50000), float64(0), "pagi",
		).
		WillReturnRows(mock.NewRows([]string{
			"id", "outlet_id", "no", "queue_no", "nama", "tanggal",
			"start_time", "end_time", "items", "ot", "ot_dur",
			"total_base", "total_ot", "total_tol", "grand_total",
			"total_all", "pay_awal", "cash", "qris", "shift", "created_at",
		}).AddRow(
			"t-200", "outlet-1", 10, 1, "Rian", "2026-08-26",
			int64(1000), int64(2000), "item-1", "-", "-",
			float64(50000), float64(0), float64(0), float64(50000), float64(50000),
			"cash", float64(50000), float64(0), "pagi", &now,
		))

	mock.ExpectCommit()

	body, _ := json.Marshal(model.ClaimSessionPayload{
		SessionID:  "s-200",
		OutletID:   "outlet-1",
		QueueNo:    1,
		Nama:       "Rian",
		Tanggal:    "2026-08-26",
		StartTime:  1000,
		EndTime:    2000,
		Items:      "item-1",
		TotalBase:  50000,
		GrandTotal: 50000,
		TotalAll:   50000,
		Cash:       50000,
		Shift:      "pagi",
	})

	router := NewRouter(h)
	req := httptest.NewRequest(http.MethodPost, "/api/claim", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rr.Code, rr.Body.String())
	}

	// Verify SESSION_CLAIMED broadcast
	select {
	case ev := <-client.Send:
		if ev.Type != "SESSION_CLAIMED" {
			t.Errorf("expected SESSION_CLAIMED, got %s", ev.Type)
		}
	case <-time.After(500 * time.Millisecond):
		t.Errorf("timed out waiting for SESSION_CLAIMED broadcast")
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet mock expectations: %v", err)
	}
}

func TestSessionHandler_TrackSession(t *testing.T) {
	h, mock := setupTestHandler(t)
	defer mock.Close()

	now := time.Now()
	// Active session found
	mock.ExpectQuery(`SELECT id, outlet_id, queue_no, COALESCE\(nama, ''\), items, COALESCE\(start_time, 0\), COALESCE\(tanggal, ''\), COALESCE\(pay_awal, 'cash'\), created_at FROM active_sessions WHERE id = \$1`).
		WithArgs("s-500").
		WillReturnRows(mock.NewRows([]string{
			"id", "outlet_id", "queue_no", "nama", "items", "start_time", "tanggal", "pay_awal", "created_at",
		}).AddRow("s-500", "outlet-1", 5, "Doni", json.RawMessage(`[]`), int64(1000), "2026-08-26", "cash", &now))

	router := NewRouter(h)
	req := httptest.NewRequest(http.MethodGet, "/api/track/s-500", nil)
	rr := httptest.NewRecorder()

	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}

	var resp map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if resp["session"] == nil {
		t.Errorf("expected session object in response, got: %+v", resp)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet mock expectations: %v", err)
	}
}
