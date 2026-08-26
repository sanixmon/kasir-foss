package repository

import (
	"context"
	"testing"
	"time"

	"github.com/pashagolub/pgxmock/v4"
	"kasir-backend/internal/model"
)

func TestOutletRepository_GetOutlets(t *testing.T) {
	mock, err := pgxmock.NewPool()
	if err != nil {
		t.Fatalf("failed to create pgxmock: %v", err)
	}
	defer mock.Close()

	now := time.Now()
	rows := mock.NewRows([]string{"id", "nama", "alamat", "created_at"}).
		AddRow("outlet-1", "Outlet Pusat", "Jl. Utama No. 1", &now).
		AddRow("outlet-2", "Outlet Cabang 2", "Jl. Cabang No. 2", &now)

	mock.ExpectQuery(`SELECT id, nama, COALESCE\(alamat, ''\), created_at FROM outlets ORDER BY nama ASC`).
		WillReturnRows(rows)

	repo := NewOutletRepository(mock)
	outlets, err := repo.GetOutlets(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(outlets) != 2 {
		t.Fatalf("expected 2 outlets, got %d", len(outlets))
	}
	if outlets[0].ID != "outlet-1" || outlets[1].ID != "outlet-2" {
		t.Errorf("unexpected outlets: %+v", outlets)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet mock expectations: %v", err)
	}
}

func TestOutletRepository_GetOutletByID(t *testing.T) {
	mock, err := pgxmock.NewPool()
	if err != nil {
		t.Fatalf("failed to create pgxmock: %v", err)
	}
	defer mock.Close()

	now := time.Now()
	mock.ExpectQuery(`SELECT id, nama, COALESCE\(alamat, ''\), created_at FROM outlets WHERE id = \$1`).
		WithArgs("outlet-1").
		WillReturnRows(mock.NewRows([]string{"id", "nama", "alamat", "created_at"}).AddRow("outlet-1", "Outlet Pusat", "Jl. Utama No. 1", &now))

	repo := NewOutletRepository(mock)
	outlet, err := repo.GetOutletByID(context.Background(), "outlet-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if outlet == nil || outlet.ID != "outlet-1" {
		t.Fatalf("expected outlet-1, got %+v", outlet)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet mock expectations: %v", err)
	}
}

func TestOutletRepository_CreateOutlet(t *testing.T) {
	mock, err := pgxmock.NewPool()
	if err != nil {
		t.Fatalf("failed to create pgxmock: %v", err)
	}
	defer mock.Close()

	mock.ExpectExec(`INSERT INTO outlets`).
		WithArgs("outlet-3", "Outlet 3", "Jl. 3").
		WillReturnResult(pgxmock.NewResult("INSERT", 1))

	repo := NewOutletRepository(mock)
	err = repo.CreateOutlet(context.Background(), model.Outlet{
		ID:     "outlet-3",
		Nama:   "Outlet 3",
		Alamat: "Jl. 3",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet mock expectations: %v", err)
	}
}

func TestOutletRepository_UpdateOutlet(t *testing.T) {
	mock, err := pgxmock.NewPool()
	if err != nil {
		t.Fatalf("failed to create pgxmock: %v", err)
	}
	defer mock.Close()

	mock.ExpectExec(`UPDATE outlets SET nama = \$1, alamat = \$2 WHERE id = \$3`).
		WithArgs("Outlet Baru", "Jl. Baru", "outlet-1").
		WillReturnResult(pgxmock.NewResult("UPDATE", 1))

	repo := NewOutletRepository(mock)
	err = repo.UpdateOutlet(context.Background(), model.Outlet{
		ID:     "outlet-1",
		Nama:   "Outlet Baru",
		Alamat: "Jl. Baru",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet mock expectations: %v", err)
	}
}

func TestOutletRepository_DeleteOutlet(t *testing.T) {
	mock, err := pgxmock.NewPool()
	if err != nil {
		t.Fatalf("failed to create pgxmock: %v", err)
	}
	defer mock.Close()

	mock.ExpectExec(`DELETE FROM outlets WHERE id = \$1`).
		WithArgs("outlet-1").
		WillReturnResult(pgxmock.NewResult("DELETE", 1))

	repo := NewOutletRepository(mock)
	err = repo.DeleteOutlet(context.Background(), "outlet-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet mock expectations: %v", err)
	}
}
