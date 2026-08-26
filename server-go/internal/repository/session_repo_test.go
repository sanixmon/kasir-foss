package repository

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/pashagolub/pgxmock/v4"
	"kasir-backend/internal/model"
)

func TestSessionRepository_GetSessionsByOutlet(t *testing.T) {
	mock, err := pgxmock.NewPool()
	if err != nil {
		t.Fatalf("failed to create pgxmock: %v", err)
	}
	defer mock.Close()

	now := time.Now()
	rows := mock.NewRows([]string{
		"id", "outlet_id", "queue_no", "nama", "items", "start_time", "tanggal", "pay_awal", "created_at",
	}).AddRow("s-1", "outlet-1", 1, "Pelanggan 1", json.RawMessage(`[]`), int64(1000), "2026-08-26", "cash", &now)

	mock.ExpectQuery(`SELECT id, outlet_id, queue_no, COALESCE\(nama, ''\), items, COALESCE\(start_time, 0\), COALESCE\(tanggal, ''\), COALESCE\(pay_awal, 'cash'\), created_at FROM active_sessions WHERE outlet_id = \$1`).
		WithArgs("outlet-1").
		WillReturnRows(rows)

	repo := NewSessionRepository(mock)
	sessions, err := repo.GetSessionsByOutlet(context.Background(), "outlet-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(sessions) != 1 {
		t.Fatalf("expected 1 session, got %d", len(sessions))
	}
	if sessions[0].ID != "s-1" || sessions[0].OutletID != "outlet-1" {
		t.Errorf("unexpected session: %+v", sessions[0])
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet mock expectations: %v", err)
	}
}

func TestSessionRepository_AddSession(t *testing.T) {
	mock, err := pgxmock.NewPool()
	if err != nil {
		t.Fatalf("failed to create pgxmock: %v", err)
	}
	defer mock.Close()

	now := time.Now()
	// Step 1: check existing session queue_no
	mock.ExpectQuery(`SELECT queue_no FROM active_sessions WHERE id = \$1`).
		WithArgs("s-100").
		WillReturnRows(mock.NewRows([]string{"queue_no"})) // no rows -> calculate next_q

	// Step 2: calculate next_q
	mock.ExpectQuery(`SELECT COALESCE\(MAX\(q\), 0\) \+ 1 AS next_q FROM`).
		WithArgs("outlet-1", "2026-08-26").
		WillReturnRows(mock.NewRows([]string{"next_q"}).AddRow(3))

	// Step 3: insert & return
	mock.ExpectQuery(`INSERT INTO active_sessions`).
		WithArgs("s-100", "outlet-1", 3, "Budi", json.RawMessage(`[]`), int64(1700000000), "2026-08-26", "cash").
		WillReturnRows(mock.NewRows([]string{
			"id", "outlet_id", "queue_no", "nama", "items", "start_time", "tanggal", "pay_awal", "created_at",
		}).AddRow("s-100", "outlet-1", 3, "Budi", json.RawMessage(`[]`), int64(1700000000), "2026-08-26", "cash", &now))

	repo := NewSessionRepository(mock)
	sess, err := repo.AddSession(context.Background(), model.ActiveSession{
		ID:        "s-100",
		OutletID:  "outlet-1",
		Nama:      "Budi",
		StartTime: 1700000000,
		Tanggal:   "2026-08-26",
		PayAwal:   "cash",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if sess.QueueNo != 3 || sess.ID != "s-100" {
		t.Errorf("unexpected added session: %+v", sess)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet mock expectations: %v", err)
	}
}

func TestSessionRepository_EditSession(t *testing.T) {
	mock, err := pgxmock.NewPool()
	if err != nil {
		t.Fatalf("failed to create pgxmock: %v", err)
	}
	defer mock.Close()

	now := time.Now()
	// Step 1: Get existing
	mock.ExpectQuery(`SELECT id, outlet_id, queue_no, COALESCE\(nama, ''\), items, COALESCE\(start_time, 0\), COALESCE\(tanggal, ''\), COALESCE\(pay_awal, 'cash'\), created_at FROM active_sessions WHERE id = \$1`).
		WithArgs("s-100").
		WillReturnRows(mock.NewRows([]string{
			"id", "outlet_id", "queue_no", "nama", "items", "start_time", "tanggal", "pay_awal", "created_at",
		}).AddRow("s-100", "outlet-1", 1, "Budi Lama", json.RawMessage(`[]`), int64(1700000000), "2026-08-26", "cash", &now))

	// Step 2: Update
	mock.ExpectQuery(`UPDATE active_sessions SET queue_no = \$1, nama = \$2, items = \$3, start_time = \$4, tanggal = \$5, pay_awal = \$6 WHERE id = \$7`).
		WithArgs(1, "Budi Baru", json.RawMessage(`[]`), int64(1700000000), "2026-08-26", "cash", "s-100").
		WillReturnRows(mock.NewRows([]string{
			"id", "outlet_id", "queue_no", "nama", "items", "start_time", "tanggal", "pay_awal", "created_at",
		}).AddRow("s-100", "outlet-1", 1, "Budi Baru", json.RawMessage(`[]`), int64(1700000000), "2026-08-26", "cash", &now))

	repo := NewSessionRepository(mock)
	sess, err := repo.EditSession(context.Background(), model.ActiveSession{
		ID:   "s-100",
		Nama: "Budi Baru",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if sess.Nama != "Budi Baru" {
		t.Errorf("expected Budi Baru, got %s", sess.Nama)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet mock expectations: %v", err)
	}
}

func TestSessionRepository_DeleteSession(t *testing.T) {
	mock, err := pgxmock.NewPool()
	if err != nil {
		t.Fatalf("failed to create pgxmock: %v", err)
	}
	defer mock.Close()

	mock.ExpectExec(`DELETE FROM active_sessions WHERE id = \$1`).
		WithArgs("s-100").
		WillReturnResult(pgxmock.NewResult("DELETE", 1))

	repo := NewSessionRepository(mock)
	err = repo.DeleteSession(context.Background(), "s-100")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet mock expectations: %v", err)
	}
}
