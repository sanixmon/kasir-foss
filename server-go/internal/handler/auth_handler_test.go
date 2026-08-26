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

func TestAuthHandler_LoginCashier_Success(t *testing.T) {
	h, mock := setupTestHandler(t)
	defer mock.Close()

	now := time.Now()
	// GetUserByUsername
	mock.ExpectQuery(`SELECT id, username, password, role, COALESCE\(outlet_id, ''\), created_at FROM users WHERE LOWER\(username\) = LOWER\(\$1\)`).
		WithArgs("kasir1").
		WillReturnRows(mock.NewRows([]string{
			"id", "username", "password", "role", "outlet_id", "created_at",
		}).AddRow(1, "kasir1", "secret123", "cashier", "outlet-1", &now))

	// IssueToken
	mock.ExpectExec(`INSERT INTO auth_tokens`).
		WithArgs(pgxmock.AnyArg(), "kasir1", "cashier", "outlet-1", pgxmock.AnyArg(), pgxmock.AnyArg()).
		WillReturnResult(pgxmock.NewResult("INSERT", 1))
	mock.ExpectExec(`DELETE FROM auth_tokens WHERE expires_at <= \$1`).
		WithArgs(pgxmock.AnyArg()).
		WillReturnResult(pgxmock.NewResult("DELETE", 0))

	body, _ := json.Marshal(LoginCashierRequest{
		Username: "kasir1",
		Password: "secret123",
	})

	router := NewRouter(h)
	req := httptest.NewRequest(http.MethodPost, "/api/login/cashier", bytes.NewReader(body))
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
	if resp["success"] != true || resp["token"] == nil || resp["token"] == "" {
		t.Errorf("unexpected login cashier response: %+v", resp)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet mock expectations: %v", err)
	}
}

func TestAuthHandler_LoginAdmin_Success(t *testing.T) {
	h, mock := setupTestHandler(t)
	defer mock.Close()

	// VerifyAdminPassword
	mock.ExpectQuery(`SELECT value FROM settings WHERE key = 'admin_pass' AND outlet_id = 'global'`).
		WillReturnRows(mock.NewRows([]string{"value"}).AddRow("admin123"))

	// IssueToken
	mock.ExpectExec(`INSERT INTO auth_tokens`).
		WithArgs(pgxmock.AnyArg(), "admin", "admin", "global", pgxmock.AnyArg(), pgxmock.AnyArg()).
		WillReturnResult(pgxmock.NewResult("INSERT", 1))
	mock.ExpectExec(`DELETE FROM auth_tokens WHERE expires_at <= \$1`).
		WithArgs(pgxmock.AnyArg()).
		WillReturnResult(pgxmock.NewResult("DELETE", 0))

	body, _ := json.Marshal(LoginAdminRequest{
		Password: "admin123",
	})

	router := NewRouter(h)
	req := httptest.NewRequest(http.MethodPost, "/api/login/admin", bytes.NewReader(body))
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
		t.Errorf("unexpected login admin response: %+v", resp)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet mock expectations: %v", err)
	}
}

func TestAuthHandler_VerifyAdmin(t *testing.T) {
	h, mock := setupTestHandler(t)
	defer mock.Close()

	mock.ExpectQuery(`SELECT value FROM settings WHERE key = 'admin_pass' AND outlet_id = 'global'`).
		WillReturnRows(mock.NewRows([]string{"value"}).AddRow("admin123"))

	mock.ExpectExec(`INSERT INTO auth_tokens`).
		WithArgs(pgxmock.AnyArg(), "admin", "admin", "global", pgxmock.AnyArg(), pgxmock.AnyArg()).
		WillReturnResult(pgxmock.NewResult("INSERT", 1))
	mock.ExpectExec(`DELETE FROM auth_tokens WHERE expires_at <= \$1`).
		WithArgs(pgxmock.AnyArg()).
		WillReturnResult(pgxmock.NewResult("DELETE", 0))

	body, _ := json.Marshal(VerifyAdminRequest{
		Password: "admin123",
	})

	router := NewRouter(h)
	req := httptest.NewRequest(http.MethodPost, "/api/verify-admin", bytes.NewReader(body))
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
	if resp["valid"] != true || resp["token"] == nil {
		t.Errorf("unexpected verify admin response: %+v", resp)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet mock expectations: %v", err)
	}
}

func TestAuthHandler_UsersCRUD(t *testing.T) {
	h, mock := setupTestHandler(t)
	defer mock.Close()

	now := time.Now()
	// 1. GetUsers
	mockAuthSession(mock, "admin-token", "admin", "admin", "global")
	mock.ExpectQuery(`SELECT id, username, password, role, COALESCE\(outlet_id, ''\), created_at FROM users WHERE outlet_id = \$1 OR outlet_id IS NULL ORDER BY username ASC`).
		WithArgs("outlet-1").
		WillReturnRows(mock.NewRows([]string{
			"id", "username", "password", "role", "outlet_id", "created_at",
		}).AddRow(1, "kasir1", "pwd", "cashier", "outlet-1", &now))

	router := NewRouter(h)
	getReq := httptest.NewRequest(http.MethodGet, "/api/users?outlet_id=outlet-1", nil)
	getReq.Header.Set("Authorization", "Bearer admin-token")
	getRR := httptest.NewRecorder()
	router.ServeHTTP(getRR, getReq)

	if getRR.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", getRR.Code)
	}

	// 2. SaveUser
	mockAuthSession(mock, "admin-token", "admin", "admin", "global")
	mock.ExpectExec(`INSERT INTO users \(username, password, role, outlet_id\)`).
		WithArgs("kasir2", pgxmock.AnyArg(), "cashier", "outlet-1").
		WillReturnResult(pgxmock.NewResult("INSERT", 1))

	saveBody, _ := json.Marshal(model.User{
		Username: "kasir2",
		Password: "newpass",
		Role:     "cashier",
		OutletID: "outlet-1",
	})
	saveReq := httptest.NewRequest(http.MethodPost, "/api/users", bytes.NewReader(saveBody))
	saveReq.Header.Set("Content-Type", "application/json")
	saveReq.Header.Set("Authorization", "Bearer admin-token")
	saveRR := httptest.NewRecorder()
	router.ServeHTTP(saveRR, saveReq)

	if saveRR.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", saveRR.Code)
	}

	// 3. DeleteUser
	mockAuthSession(mock, "admin-token", "admin", "admin", "global")
	mock.ExpectExec(`DELETE FROM users WHERE LOWER\(username\) = LOWER\(\$1\)`).
		WithArgs("kasir2").
		WillReturnResult(pgxmock.NewResult("DELETE", 1))

	delReq := httptest.NewRequest(http.MethodDelete, "/api/users/kasir2", nil)
	delReq.Header.Set("Authorization", "Bearer admin-token")
	delRR := httptest.NewRecorder()
	router.ServeHTTP(delRR, delReq)

	if delRR.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", delRR.Code)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet mock expectations: %v", err)
	}
}

func TestAuthHandler_Middleware(t *testing.T) {
	h, mock := setupTestHandler(t)
	defer mock.Close()

	// Protected handler
	protected := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	authMiddleware := h.RequireAuth(protected)
	adminMiddleware := h.RequireAdmin(protected)

	// Case 1: No token on requireAuth -> 401
	req1 := httptest.NewRequest(http.MethodGet, "/protected", nil)
	rr1 := httptest.NewRecorder()
	authMiddleware.ServeHTTP(rr1, req1)
	if rr1.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr1.Code)
	}

	// Case 2: Cashier token on requireAdmin -> 403
	mock.ExpectQuery(`SELECT token, username, role, COALESCE\(outlet_id, ''\), expires_at, COALESCE\(ttl_ms, 0\) FROM auth_tokens WHERE token = \$1`).
		WithArgs("cashier-token").
		WillReturnRows(mock.NewRows([]string{
			"token", "username", "role", "outlet_id", "expires_at", "ttl_ms",
		}).AddRow("cashier-token", "kasir1", "cashier", "outlet-1", time.Now().UnixMilli()+10000, int64(10000)))

	mock.ExpectExec(`UPDATE auth_tokens SET expires_at = \$1 WHERE token = \$2`).
		WithArgs(pgxmock.AnyArg(), "cashier-token").
		WillReturnResult(pgxmock.NewResult("UPDATE", 1))

	req2 := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req2.Header.Set("Authorization", "Bearer cashier-token")
	rr2 := httptest.NewRecorder()
	adminMiddleware.ServeHTTP(rr2, req2)
	if rr2.Code != http.StatusForbidden {
		t.Errorf("expected 403 for cashier on admin route, got %d", rr2.Code)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet mock expectations: %v", err)
	}
}
