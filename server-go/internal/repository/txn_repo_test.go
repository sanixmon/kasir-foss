package repository

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/pashagolub/pgxmock/v4"
	"kasir-backend/internal/model"
)

func TestTxnRepository_GetTransactions(t *testing.T) {
	mock, err := pgxmock.NewPool()
	if err != nil {
		t.Fatalf("failed to create pgxmock: %v", err)
	}
	defer mock.Close()

	now := time.Now()
	cols := []string{
		"id", "outlet_id", "no", "queue_no", "nama", "tanggal",
		"start_time", "end_time", "items", "ot", "ot_dur",
		"total_base", "total_ot", "total_tol", "grand_total", "total_all",
		"pay_awal", "cash", "qris", "shift", "created_at",
	}

	mock.ExpectQuery(`SELECT id, outlet_id, no, queue_no, COALESCE\(nama, ''\), COALESCE\(tanggal, ''\),`).
		WithArgs("outlet-1", "2026-08-26").
		WillReturnRows(mock.NewRows(cols).AddRow(
			"t-1", "outlet-1", 1, 1, "Pelanggan 1", "2026-08-26",
			int64(1000), int64(2000), "items", "-", "-",
			float64(10000), float64(0), float64(0), float64(10000), float64(10000),
			"cash", float64(10000), float64(0), "Shift 1", &now,
		))

	repo := NewTxnRepository(mock)
	txns, err := repo.GetTransactions(context.Background(), "outlet-1", "2026-08-26")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(txns) != 1 {
		t.Fatalf("expected 1 txn, got %d", len(txns))
	}
	if txns[0].ID != "t-1" || txns[0].TotalAll != 10000 {
		t.Errorf("unexpected txn: %+v", txns[0])
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet mock expectations: %v", err)
	}
}

func TestTxnRepository_ClaimSession_AtomicSuccess(t *testing.T) {
	mock, err := pgxmock.NewPool()
	if err != nil {
		t.Fatalf("failed to create pgxmock: %v", err)
	}
	defer mock.Close()

	now := time.Now()

	// 1. Begin Tx
	mock.ExpectBegin()

	// 2. Query session for update
	mock.ExpectQuery(`SELECT outlet_id FROM active_sessions WHERE id = \$1 FOR UPDATE`).
		WithArgs("s-123").
		WillReturnRows(mock.NewRows([]string{"outlet_id"}).AddRow("outlet-1"))

	// 3. Delete session (no remaining items)
	mock.ExpectExec(`DELETE FROM active_sessions WHERE id = \$1`).
		WithArgs("s-123").
		WillReturnResult(pgxmock.NewResult("DELETE", 1))

	// 4. Query next max no
	mock.ExpectQuery(`SELECT COALESCE\(MAX\(no\), 0\) \+ 1 FROM transactions`).
		WillReturnRows(mock.NewRows([]string{"next_no"}).AddRow(5))

	// 5. Insert transaction
	cols := []string{
		"id", "outlet_id", "no", "queue_no", "nama", "tanggal",
		"start_time", "end_time", "items", "ot", "ot_dur",
		"total_base", "total_ot", "total_tol", "grand_total", "total_all",
		"pay_awal", "cash", "qris", "shift", "created_at",
	}
	mock.ExpectQuery(`INSERT INTO transactions`).
		WithArgs(
			"t-123", "outlet-1", 5, 2, "Andi", "2026-08-26",
			int64(1000), int64(2000), "items-json", "-", "-",
			float64(50000), float64(0), float64(0), float64(50000), float64(50000),
			"cash", float64(50000), float64(0), "Pagi",
		).
		WillReturnRows(mock.NewRows(cols).AddRow(
			"t-123", "outlet-1", 5, 2, "Andi", "2026-08-26",
			int64(1000), int64(2000), "items-json", "-", "-",
			float64(50000), float64(0), float64(0), float64(50000), float64(50000),
			"cash", float64(50000), float64(0), "Pagi", &now,
		))

	// 6. Commit
	mock.ExpectCommit()

	repo := NewTxnRepository(mock)
	txn, err := repo.ClaimSession(context.Background(), model.ClaimSessionPayload{
		SessionID:  "s-123",
		OutletID:   "outlet-1",
		QueueNo:    2,
		Nama:       "Andi",
		Tanggal:    "2026-08-26",
		StartTime:  1000,
		EndTime:    2000,
		Items:      "items-json",
		TotalBase:  50000,
		GrandTotal: 50000,
		TotalAll:   50000,
		Cash:       50000,
		Shift:      "Pagi",
	})
	if err != nil {
		t.Fatalf("unexpected error during claim: %v", err)
	}
	if txn.ID != "t-123" || txn.No != 5 {
		t.Errorf("unexpected claimed transaction: %+v", txn)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet mock expectations: %v", err)
	}
}

func TestTxnRepository_ClaimSession_PartialRemaining(t *testing.T) {
	mock, err := pgxmock.NewPool()
	if err != nil {
		t.Fatalf("failed to create pgxmock: %v", err)
	}
	defer mock.Close()

	now := time.Now()

	mock.ExpectBegin()

	mock.ExpectQuery(`SELECT outlet_id FROM active_sessions WHERE id = \$1 FOR UPDATE`).
		WithArgs("s-456").
		WillReturnRows(mock.NewRows([]string{"outlet_id"}).AddRow("outlet-2"))

	remaining := json.RawMessage(`[{"id":"rem-1"}]`)
	mock.ExpectExec(`UPDATE active_sessions SET items = \$1 WHERE id = \$2`).
		WithArgs(remaining, "s-456").
		WillReturnResult(pgxmock.NewResult("UPDATE", 1))

	mock.ExpectQuery(`SELECT COALESCE\(MAX\(no\), 0\) \+ 1 FROM transactions`).
		WillReturnRows(mock.NewRows([]string{"next_no"}).AddRow(10))

	cols := []string{
		"id", "outlet_id", "no", "queue_no", "nama", "tanggal",
		"start_time", "end_time", "items", "ot", "ot_dur",
		"total_base", "total_ot", "total_tol", "grand_total", "total_all",
		"pay_awal", "cash", "qris", "shift", "created_at",
	}
	mock.ExpectQuery(`INSERT INTO transactions`).
		WithArgs(
			pgxmock.AnyArg(), "outlet-2", 10, 1, "Rina", "2026-08-26",
			int64(1000), int64(2000), "claimed-item", "-", "-",
			float64(25000), float64(0), float64(0), float64(25000), float64(25000),
			"cash", float64(25000), float64(0), "Malam",
		).
		WillReturnRows(mock.NewRows(cols).AddRow(
			"t-custom", "outlet-2", 10, 1, "Rina", "2026-08-26",
			int64(1000), int64(2000), "claimed-item", "-", "-",
			float64(25000), float64(0), float64(0), float64(25000), float64(25000),
			"cash", float64(25000), float64(0), "Malam", &now,
		))

	mock.ExpectCommit()

	repo := NewTxnRepository(mock)
	txn, err := repo.ClaimSession(context.Background(), model.ClaimSessionPayload{
		SessionID:      "s-456",
		OutletID:       "outlet-2",
		QueueNo:        1,
		Nama:           "Rina",
		Tanggal:        "2026-08-26",
		StartTime:      1000,
		EndTime:        2000,
		Items:          "claimed-item",
		TotalBase:      25000,
		GrandTotal:     25000,
		TotalAll:       25000,
		Cash:           25000,
		Shift:          "Malam",
		RemainingItems: remaining,
	})
	if err != nil {
		t.Fatalf("unexpected error during partial claim: %v", err)
	}
	if txn.No != 10 {
		t.Errorf("expected txn no 10, got %d", txn.No)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet mock expectations: %v", err)
	}
}

func TestTxnRepository_DeleteTxn_And_DeletionLogs(t *testing.T) {
	mock, err := pgxmock.NewPool()
	if err != nil {
		t.Fatalf("failed to create pgxmock: %v", err)
	}
	defer mock.Close()

	// DeleteTxn
	mock.ExpectExec(`DELETE FROM transactions WHERE \(\(id = \$1 AND \$1 != ''\) OR \(no = \$2 AND \$2 > 0\)\) AND outlet_id = \$3`).
		WithArgs("t-123", 0, "outlet-1").
		WillReturnResult(pgxmock.NewResult("DELETE", 1))

	// AddDeletionLog
	mock.ExpectExec(`INSERT INTO deletion_logs`).
		WithArgs("outlet-1", "t-123", 5, "Andi", "2026-08-26", float64(50000), int64(1700000000), "admin").
		WillReturnResult(pgxmock.NewResult("INSERT", 1))

	// GetDeletionLogs
	mock.ExpectQuery(`SELECT id, COALESCE\(outlet_id, ''\), COALESCE\(txn_id, ''\), COALESCE\(txn_no, 0\), COALESCE\(txn_nama, ''\), COALESCE\(txn_tanggal, ''\), COALESCE\(txn_total_all, 0\), COALESCE\(deleted_at, 0\), COALESCE\(deleted_by, 'admin'\) FROM deletion_logs WHERE outlet_id = \$1 ORDER BY deleted_at DESC LIMIT \$2`).
		WithArgs("outlet-1", 100).
		WillReturnRows(mock.NewRows([]string{
			"id", "outlet_id", "txn_id", "txn_no", "txn_nama", "txn_tanggal", "txn_total_all", "deleted_at", "deleted_by",
		}).AddRow(1, "outlet-1", "t-123", 5, "Andi", "2026-08-26", float64(50000), int64(1700000000), "admin"))

	repo := NewTxnRepository(mock)
	err = repo.DeleteTxn(context.Background(), "t-123", 0, "outlet-1")
	if err != nil {
		t.Fatalf("unexpected delete error: %v", err)
	}

	err = repo.AddDeletionLog(context.Background(), model.DeletionLog{
		OutletID:    "outlet-1",
		TxnID:       "t-123",
		TxnNo:       5,
		TxnNama:     "Andi",
		TxnTanggal:  "2026-08-26",
		TxnTotalAll: 50000,
		DeletedAt:   1700000000,
		DeletedBy:   "admin",
	})
	if err != nil {
		t.Fatalf("unexpected add deletion log error: %v", err)
	}

	logs, err := repo.GetDeletionLogs(context.Background(), "outlet-1", 100)
	if err != nil {
		t.Fatalf("unexpected get logs error: %v", err)
	}
	if len(logs) != 1 || logs[0].TxnID != "t-123" {
		t.Errorf("unexpected logs: %+v", logs)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet mock expectations: %v", err)
	}
}
