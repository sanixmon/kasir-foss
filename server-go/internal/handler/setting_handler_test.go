package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/pashagolub/pgxmock/v4"
)

func TestSettingHandler_GetAndSaveSettings(t *testing.T) {
	h, mock := setupTestHandler(t)
	defer mock.Close()

	client := h.Hub.Register("outlet-1")

	// 1. GetSettings (Cashier auth)
	mockAuthSession(mock, "cashier-tok", "kasir1", "cashier", "outlet-1")
	mock.ExpectQuery(`SELECT key, value FROM settings WHERE \(outlet_id = 'global' OR outlet_id = \$1\) AND key != 'admin_pass'`).
		WithArgs("outlet-1").
		WillReturnRows(mock.NewRows([]string{"key", "value"}).
			AddRow("hourly_rate", "10000").
			AddRow("store_name", "Kasir Outlet 1"))

	router := NewRouter(h)
	req := httptest.NewRequest(http.MethodGet, "/api/settings?outlet_id=outlet-1", nil)
	req.Header.Set("Authorization", "Bearer cashier-tok")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}

	var settings map[string]string
	if err := json.Unmarshal(rr.Body.Bytes(), &settings); err != nil {
		t.Fatalf("failed to decode settings: %v", err)
	}
	if settings["hourly_rate"] != "10000" || settings["store_name"] != "Kasir Outlet 1" {
		t.Errorf("unexpected settings map: %+v", settings)
	}

	// 2. SaveSetting (Admin auth)
	mockAuthSession(mock, "admin-tok", "admin", "admin", "global")
	mock.ExpectExec(`INSERT INTO settings \(key, outlet_id, value\)`).
		WithArgs("hourly_rate", "outlet-1", "15000").
		WillReturnResult(pgxmock.NewResult("INSERT", 1))

	body, _ := json.Marshal(SaveSettingRequest{
		Key:      "hourly_rate",
		Value:    "15000",
		OutletID: "outlet-1",
	})
	saveReq := httptest.NewRequest(http.MethodPost, "/api/settings", bytes.NewReader(body))
	saveReq.Header.Set("Content-Type", "application/json")
	saveReq.Header.Set("Authorization", "Bearer admin-tok")
	saveRR := httptest.NewRecorder()
	router.ServeHTTP(saveRR, saveReq)

	if saveRR.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", saveRR.Code)
	}

	select {
	case ev := <-client.Send:
		if ev.Type != "SETTING_UPDATED" || ev.OutletID != "outlet-1" {
			t.Errorf("unexpected broadcast event: %+v", ev)
		}
	case <-time.After(500 * time.Millisecond):
		t.Errorf("timed out waiting for SETTING_UPDATED broadcast")
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet mock expectations: %v", err)
	}
}

func TestSettingHandler_FetchAllData(t *testing.T) {
	h, mock := setupTestHandler(t)
	defer mock.Close()

	now := time.Now()

	// Sessions
	mock.ExpectQuery(`SELECT id, outlet_id, queue_no, COALESCE\(nama, ''\), items, COALESCE\(start_time, 0\), COALESCE\(tanggal, ''\), COALESCE\(pay_awal, 'cash'\), created_at FROM active_sessions WHERE outlet_id = \$1`).
		WithArgs("outlet-1").
		WillReturnRows(mock.NewRows([]string{
			"id", "outlet_id", "queue_no", "nama", "items", "start_time", "tanggal", "pay_awal", "created_at",
		}).AddRow("s-1", "outlet-1", 1, "Customer 1", json.RawMessage(`[]`), int64(1000), "2026-08-26", "cash", &now))

	// Txns
	mock.ExpectQuery(`SELECT id, outlet_id, no, queue_no, COALESCE\(nama, ''\), COALESCE\(tanggal, ''\), COALESCE\(start_time, 0\), COALESCE\(end_time, 0\), COALESCE\(items, ''\), COALESCE\(ot, '-'\), COALESCE\(ot_dur, '-'\), total_base, total_ot, total_tol, grand_total, total_all, COALESCE\(pay_awal, 'cash'\), cash, qris, COALESCE\(shift, '-'\), created_at FROM transactions WHERE outlet_id = \$1 ORDER BY no ASC`).
		WithArgs("outlet-1").
		WillReturnRows(mock.NewRows([]string{
			"id", "outlet_id", "no", "queue_no", "nama", "tanggal",
			"start_time", "end_time", "items", "ot", "ot_dur",
			"total_base", "total_ot", "total_tol", "grand_total",
			"total_all", "pay_awal", "cash", "qris", "shift", "created_at",
		}))

	// Users
	mock.ExpectQuery(`SELECT id, username, password, role, COALESCE\(outlet_id, ''\), created_at FROM users WHERE outlet_id = \$1 OR outlet_id IS NULL ORDER BY username ASC`).
		WithArgs("outlet-1").
		WillReturnRows(mock.NewRows([]string{"id", "username", "password", "role", "outlet_id", "created_at"}))

	// Settings
	mock.ExpectQuery(`SELECT key, value FROM settings WHERE \(outlet_id = 'global' OR outlet_id = \$1\) AND key != 'admin_pass'`).
		WithArgs("outlet-1").
		WillReturnRows(mock.NewRows([]string{"key", "value"}).AddRow("hourly_rate", "10000"))

	// Outlets
	mock.ExpectQuery(`SELECT id, nama, COALESCE\(alamat, ''\), created_at FROM outlets ORDER BY nama ASC`).
		WillReturnRows(mock.NewRows([]string{"id", "nama", "alamat", "created_at"}).AddRow("outlet-1", "Outlet 1", "Alamat 1", &now))

	router := NewRouter(h)
	req := httptest.NewRequest(http.MethodGet, "/api/fetch-all?outlet_id=outlet-1", nil)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}

	var resp map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if resp["sessions"] == nil || resp["transactions"] == nil || resp["settings"] == nil || resp["outlets"] == nil {
		t.Errorf("missing keys in fetchAll response: %+v", resp)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet mock expectations: %v", err)
	}
}

func TestSettingHandler_LegacyAction(t *testing.T) {
	h, mock := setupTestHandler(t)
	defer mock.Close()

	// Public action: login_admin via legacy POST /api
	mock.ExpectQuery(`SELECT value FROM settings WHERE key = 'admin_pass' AND outlet_id = 'global'`).
		WillReturnRows(mock.NewRows([]string{"value"}).AddRow("admin123"))

	mock.ExpectExec(`INSERT INTO auth_tokens`).
		WithArgs(pgxmock.AnyArg(), "admin", "admin", "global", pgxmock.AnyArg(), pgxmock.AnyArg()).
		WillReturnResult(pgxmock.NewResult("INSERT", 1))
	mock.ExpectExec(`DELETE FROM auth_tokens WHERE expires_at <= \$1`).
		WithArgs(pgxmock.AnyArg()).
		WillReturnResult(pgxmock.NewResult("DELETE", 0))

	legacyPayload, _ := json.Marshal(map[string]any{
		"action": "login_admin",
		"payload": map[string]string{
			"password": "admin123",
		},
	})

	router := NewRouter(h)
	req := httptest.NewRequest(http.MethodPost, "/api", bytes.NewReader(legacyPayload))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var resp map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if resp["success"] != true || resp["token"] == nil {
		t.Errorf("unexpected legacy response: %+v", resp)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet mock expectations: %v", err)
	}
}
