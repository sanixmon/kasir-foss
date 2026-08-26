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

func TestTxnHandler_GetTransactions(t *testing.T) {
	h, mock := setupTestHandler(t)
	defer mock.Close()

	now := time.Now()
	rows := mock.NewRows([]string{
		"id", "outlet_id", "no", "queue_no", "nama", "tanggal",
		"start_time", "end_time", "items", "ot", "ot_dur",
		"total_base", "total_ot", "total_tol", "grand_total",
		"total_all", "pay_awal", "cash", "qris", "shift", "created_at",
	}).AddRow(
		"t-1", "outlet-1", 1, 1, "Pelanggan", "2026-08-26",
		int64(1000), int64(2000), "items", "-", "-",
		float64(10000), float64(0), float64(0), float64(10000), float64(10000),
		"cash", float64(10000), float64(0), "pagi", &now,
	)

	mock.ExpectQuery(`SELECT id, outlet_id, no, queue_no, COALESCE\(nama, ''\), COALESCE\(tanggal, ''\), COALESCE\(start_time, 0\), COALESCE\(end_time, 0\), COALESCE\(items, ''\), COALESCE\(ot, '-'\), COALESCE\(ot_dur, '-'\), total_base, total_ot, total_tol, grand_total, total_all, COALESCE\(pay_awal, 'cash'\), cash, qris, COALESCE\(shift, '-'\), created_at FROM transactions WHERE outlet_id = \$1 AND tanggal = \$2 ORDER BY no ASC`).
		WithArgs("outlet-1", "2026-08-26").
		WillReturnRows(rows)

	router := NewRouter(h)
	req := httptest.NewRequest(http.MethodGet, "/api/transactions?outlet_id=outlet-1&tanggal=2026-08-26", nil)
	rr := httptest.NewRecorder()

	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}

	var txns []model.Transaction
	if err := json.Unmarshal(rr.Body.Bytes(), &txns); err != nil {
		t.Fatalf("failed to unmarshal transactions: %v", err)
	}
	if len(txns) != 1 || txns[0].ID != "t-1" {
		t.Errorf("unexpected transactions: %+v", txns)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet mock expectations: %v", err)
	}
}

func TestTxnHandler_DeleteTxn_Single(t *testing.T) {
	h, mock := setupTestHandler(t)
	defer mock.Close()

	client := h.Hub.Register("outlet-1")

	now := time.Now()
	// Lookup transaction for outlet
	mock.ExpectQuery(`SELECT id, outlet_id, no, queue_no, COALESCE\(nama, ''\), COALESCE\(tanggal, ''\), COALESCE\(start_time, 0\), COALESCE\(end_time, 0\), COALESCE\(items, ''\), COALESCE\(ot, '-'\), COALESCE\(ot_dur, '-'\), total_base, total_ot, total_tol, grand_total, total_all, COALESCE\(pay_awal, 'cash'\), cash, qris, COALESCE\(shift, '-'\), created_at FROM transactions WHERE id = \$1`).
		WithArgs("t-123").
		WillReturnRows(mock.NewRows([]string{
			"id", "outlet_id", "no", "queue_no", "nama", "tanggal",
			"start_time", "end_time", "items", "ot", "ot_dur",
			"total_base", "total_ot", "total_tol", "grand_total",
			"total_all", "pay_awal", "cash", "qris", "shift", "created_at",
		}).AddRow(
			"t-123", "outlet-1", 1, 1, "Budi", "2026-08-26",
			int64(1000), int64(2000), "items", "-", "-",
			float64(10000), float64(0), float64(0), float64(10000), float64(10000),
			"cash", float64(10000), float64(0), "pagi", &now,
		))

	mock.ExpectExec(`DELETE FROM transactions WHERE \(id = \$1 AND \$1 != ''\) OR \(no = \$2 AND \$2 > 0\)`).
		WithArgs("t-123", 0).
		WillReturnResult(pgxmock.NewResult("DELETE", 1))

	router := NewRouter(h)
	req := httptest.NewRequest(http.MethodDelete, "/api/transactions/t-123", nil)
	rr := httptest.NewRecorder()

	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}

	select {
	case ev := <-client.Send:
		if ev.Type != "TXN_DELETED" || ev.OutletID != "outlet-1" {
			t.Errorf("unexpected broadcast event: %+v", ev)
		}
	case <-time.After(500 * time.Millisecond):
		t.Errorf("timed out waiting for TXN_DELETED broadcast")
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet mock expectations: %v", err)
	}
}

func TestTxnHandler_ClearAllTxns(t *testing.T) {
	h, mock := setupTestHandler(t)
	defer mock.Close()

	client := h.Hub.Register("outlet-1")

	mock.ExpectExec(`DELETE FROM transactions WHERE outlet_id = \$1`).
		WithArgs("outlet-1").
		WillReturnResult(pgxmock.NewResult("DELETE", 5))

	router := NewRouter(h)
	req := httptest.NewRequest(http.MethodPost, "/api/transactions/clear-all?outlet_id=outlet-1", nil)
	rr := httptest.NewRecorder()

	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}

	select {
	case ev := <-client.Send:
		if ev.Type != "TXNS_CLEARED" || ev.OutletID != "outlet-1" {
			t.Errorf("unexpected broadcast event: %+v", ev)
		}
	case <-time.After(500 * time.Millisecond):
		t.Errorf("timed out waiting for TXNS_CLEARED broadcast")
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet mock expectations: %v", err)
	}
}

func TestTxnHandler_DeletionLogs(t *testing.T) {
	h, mock := setupTestHandler(t)
	defer mock.Close()

	// 1. Add deletion log
	mock.ExpectExec(`INSERT INTO deletion_logs`).
		WithArgs("outlet-1", "t-1", 1, "Rian", "2026-08-26", float64(50000), int64(1700000000), "admin").
		WillReturnResult(pgxmock.NewResult("INSERT", 1))

	body, _ := json.Marshal(model.DeletionLog{
		OutletID:    "outlet-1",
		TxnID:       "t-1",
		TxnNo:       1,
		TxnNama:     "Rian",
		TxnTanggal:  "2026-08-26",
		TxnTotalAll: 50000,
		DeletedAt:   1700000000,
		DeletedBy:   "admin",
	})

	router := NewRouter(h)
	req := httptest.NewRequest(http.MethodPost, "/api/deletion-logs", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rr.Code, rr.Body.String())
	}

	// 2. Get deletion logs
	mock.ExpectQuery(`SELECT id, COALESCE\(outlet_id, ''\), COALESCE\(txn_id, ''\), COALESCE\(txn_no, 0\), COALESCE\(txn_nama, ''\), COALESCE\(txn_tanggal, ''\), COALESCE\(txn_total_all, 0\), COALESCE\(deleted_at, 0\), COALESCE\(deleted_by, 'admin'\) FROM deletion_logs WHERE outlet_id = \$1 ORDER BY deleted_at DESC LIMIT \$2`).
		WithArgs("outlet-1", 200).
		WillReturnRows(mock.NewRows([]string{
			"id", "outlet_id", "txn_id", "txn_no", "txn_nama", "txn_tanggal", "txn_total_all", "deleted_at", "deleted_by",
		}).AddRow(1, "outlet-1", "t-1", 1, "Rian", "2026-08-26", float64(50000), int64(1700000000), "admin"))

	getReq := httptest.NewRequest(http.MethodGet, "/api/deletion-logs?outlet_id=outlet-1", nil)
	getRR := httptest.NewRecorder()

	router.ServeHTTP(getRR, getReq)

	if getRR.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", getRR.Code)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet mock expectations: %v", err)
	}
}
