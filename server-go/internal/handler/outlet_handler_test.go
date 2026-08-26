package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/pashagolub/pgxmock/v4"
	"kasir-backend/internal/config"
	"kasir-backend/internal/model"
	"kasir-backend/internal/realtime"
	"kasir-backend/internal/repository"
)

func setupTestHandler(t *testing.T) (*Handler, pgxmock.PgxPoolIface) {
	mock, err := pgxmock.NewPool()
	if err != nil {
		t.Fatalf("failed to create pgxmock: %v", err)
	}

	hub := realtime.NewHub()
	go hub.Run()

	h := NewHandler(
		repository.NewOutletRepository(mock),
		repository.NewSessionRepository(mock),
		repository.NewTxnRepository(mock),
		repository.NewAuthRepository(mock),
		repository.NewSettingRepository(mock),
		hub,
		&config.Config{CorsOrigin: "*"},
	)

	return h, mock
}

func TestOutletHandler_GetOutlets(t *testing.T) {
	h, mock := setupTestHandler(t)
	defer mock.Close()

	now := time.Now()
	rows := mock.NewRows([]string{"id", "nama", "alamat", "created_at"}).
		AddRow("outlet-1", "Outlet Pusat", "Jl. Sudirman", &now).
		AddRow("outlet-2", "Outlet Cabang", "Jl. Thamrin", &now)

	mock.ExpectQuery(`SELECT id, nama, COALESCE\(alamat, ''\), created_at FROM outlets ORDER BY nama ASC`).
		WillReturnRows(rows)

	router := NewRouter(h)
	req := httptest.NewRequest(http.MethodGet, "/api/outlets", nil)
	rr := httptest.NewRecorder()

	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}

	var outlets []model.Outlet
	if err := json.Unmarshal(rr.Body.Bytes(), &outlets); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}
	if len(outlets) != 2 {
		t.Fatalf("expected 2 outlets, got %d", len(outlets))
	}
	if outlets[0].ID != "outlet-1" {
		t.Errorf("expected outlet-1, got %s", outlets[0].ID)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet mock expectations: %v", err)
	}
}

func TestOutletHandler_CreateOutlet(t *testing.T) {
	h, mock := setupTestHandler(t)
	defer mock.Close()

	mock.ExpectExec(`INSERT INTO outlets \(id, nama, alamat\)`).
		WithArgs("outlet-3", "Outlet Baru", "Jl. Baru").
		WillReturnResult(pgxmock.NewResult("INSERT", 1))

	body, _ := json.Marshal(model.Outlet{
		ID:     "outlet-3",
		Nama:   "Outlet Baru",
		Alamat: "Jl. Baru",
	})

	router := NewRouter(h)
	req := httptest.NewRequest(http.MethodPost, "/api/outlets", bytes.NewReader(body))
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
	if resp["success"] != true {
		t.Errorf("expected success true, got %v", resp)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet mock expectations: %v", err)
	}
}

func TestOutletHandler_GetOutletByID(t *testing.T) {
	h, mock := setupTestHandler(t)
	defer mock.Close()

	now := time.Now()
	rows := mock.NewRows([]string{"id", "nama", "alamat", "created_at"}).
		AddRow("outlet-1", "Outlet Pusat", "Jl. Sudirman", &now)

	mock.ExpectQuery(`SELECT id, nama, COALESCE\(alamat, ''\), created_at FROM outlets WHERE id = \$1`).
		WithArgs("outlet-1").
		WillReturnRows(rows)

	router := NewRouter(h)
	req := httptest.NewRequest(http.MethodGet, "/api/outlets/outlet-1", nil)
	rr := httptest.NewRecorder()

	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}

	var o model.Outlet
	if err := json.Unmarshal(rr.Body.Bytes(), &o); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}
	if o.ID != "outlet-1" || o.Nama != "Outlet Pusat" {
		t.Errorf("unexpected outlet: %+v", o)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet mock expectations: %v", err)
	}
}
