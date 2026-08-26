package repository

import (
	"context"
	"testing"
	"time"

	"github.com/pashagolub/pgxmock/v4"
)

func TestAuthRepository_AuthenticateUser(t *testing.T) {
	mock, err := pgxmock.NewPool()
	if err != nil {
		t.Fatalf("failed to create pgxmock: %v", err)
	}
	defer mock.Close()

	now := time.Now()
	mock.ExpectQuery(`SELECT id, username, password, role, COALESCE\(outlet_id, ''\), created_at FROM users WHERE LOWER\(username\) = LOWER\(\$1\)`).
		WithArgs("kasir1").
		WillReturnRows(mock.NewRows([]string{
			"id", "username", "password", "role", "outlet_id", "created_at",
		}).AddRow(1, "kasir1", "secret123", "cashier", "outlet-1", &now))

	repo := NewAuthRepository(mock)
	user, err := repo.AuthenticateUser(context.Background(), "kasir1", "secret123")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if user.Username != "kasir1" || user.Role != "cashier" || user.OutletID != "outlet-1" {
		t.Errorf("unexpected authenticated user: %+v", user)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet mock expectations: %v", err)
	}
}

func TestAuthRepository_AuthenticateUser_Errors(t *testing.T) {
	mock, err := pgxmock.NewPool()
	if err != nil {
		t.Fatalf("failed to create pgxmock: %v", err)
	}
	defer mock.Close()

	repo := NewAuthRepository(mock)

	// Empty credentials
	_, err = repo.AuthenticateUser(context.Background(), "", "")
	if err == nil {
		t.Errorf("expected error for empty credentials")
	}

	// User not found
	mock.ExpectQuery(`SELECT id, username, password, role, COALESCE\(outlet_id, ''\), created_at FROM users WHERE LOWER\(username\) = LOWER\(\$1\)`).
		WithArgs("unknown").
		WillReturnRows(mock.NewRows([]string{"id", "username", "password", "role", "outlet_id", "created_at"}))

	_, err = repo.AuthenticateUser(context.Background(), "unknown", "pass")
	if err == nil {
		t.Errorf("expected error for unknown user")
	}

	// Wrong password
	now := time.Now()
	mock.ExpectQuery(`SELECT id, username, password, role, COALESCE\(outlet_id, ''\), created_at FROM users WHERE LOWER\(username\) = LOWER\(\$1\)`).
		WithArgs("kasir1").
		WillReturnRows(mock.NewRows([]string{
			"id", "username", "password", "role", "outlet_id", "created_at",
		}).AddRow(1, "kasir1", "secret123", "cashier", "outlet-1", &now))

	_, err = repo.AuthenticateUser(context.Background(), "kasir1", "wrongpass")
	if err == nil {
		t.Errorf("expected error for invalid password")
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet mock expectations: %v", err)
	}
}

func TestAuthRepository_IssueAndResolveToken(t *testing.T) {
	mock, err := pgxmock.NewPool()
	if err != nil {
		t.Fatalf("failed to create pgxmock: %v", err)
	}
	defer mock.Close()

	// 1. Issue token
	mock.ExpectExec(`INSERT INTO auth_tokens`).
		WithArgs(pgxmock.AnyArg(), "admin", "admin", "outlet-1", pgxmock.AnyArg(), int64(60000)).
		WillReturnResult(pgxmock.NewResult("INSERT", 1))

	// Prune expired
	mock.ExpectExec(`DELETE FROM auth_tokens WHERE expires_at <= \$1`).
		WithArgs(pgxmock.AnyArg()).
		WillReturnResult(pgxmock.NewResult("DELETE", 0))

	repo := NewAuthRepository(mock)
	tok, err := repo.IssueToken(context.Background(), "admin", "admin", "outlet-1", 60000)
	if err != nil {
		t.Fatalf("unexpected error issuing token: %v", err)
	}
	if tok.Token == "" || tok.Username != "admin" {
		t.Fatalf("unexpected token issued: %+v", tok)
	}

	// 2. Resolve token (active, sliding expiration)
	futureExpiry := time.Now().UnixMilli() + 50000
	mock.ExpectQuery(`SELECT token, username, role, COALESCE\(outlet_id, ''\), expires_at, COALESCE\(ttl_ms, 0\) FROM auth_tokens WHERE token = \$1`).
		WithArgs(tok.Token).
		WillReturnRows(mock.NewRows([]string{
			"token", "username", "role", "outlet_id", "expires_at", "ttl_ms",
		}).AddRow(tok.Token, "admin", "admin", "outlet-1", futureExpiry, int64(60000)))

	mock.ExpectExec(`UPDATE auth_tokens SET expires_at = \$1 WHERE token = \$2`).
		WithArgs(pgxmock.AnyArg(), tok.Token).
		WillReturnResult(pgxmock.NewResult("UPDATE", 1))

	resolved, err := repo.ResolveToken(context.Background(), tok.Token)
	if err != nil {
		t.Fatalf("unexpected error resolving token: %v", err)
	}
	if resolved == nil || resolved.Username != "admin" {
		t.Fatalf("expected resolved admin token, got %+v", resolved)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet mock expectations: %v", err)
	}
}

func TestAuthRepository_ResolveToken_Expired(t *testing.T) {
	mock, err := pgxmock.NewPool()
	if err != nil {
		t.Fatalf("failed to create pgxmock: %v", err)
	}
	defer mock.Close()

	pastExpiry := time.Now().UnixMilli() - 10000
	mock.ExpectQuery(`SELECT token, username, role, COALESCE\(outlet_id, ''\), expires_at, COALESCE\(ttl_ms, 0\) FROM auth_tokens WHERE token = \$1`).
		WithArgs("expired-token").
		WillReturnRows(mock.NewRows([]string{
			"token", "username", "role", "outlet_id", "expires_at", "ttl_ms",
		}).AddRow("expired-token", "admin", "admin", "outlet-1", pastExpiry, int64(60000)))

	mock.ExpectExec(`DELETE FROM auth_tokens WHERE token = \$1`).
		WithArgs("expired-token").
		WillReturnResult(pgxmock.NewResult("DELETE", 1))

	repo := NewAuthRepository(mock)
	resolved, err := repo.ResolveToken(context.Background(), "expired-token")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resolved != nil {
		t.Errorf("expected nil token for expired session, got %+v", resolved)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet mock expectations: %v", err)
	}
}

func TestAuthRepository_RevokeToken(t *testing.T) {
	mock, err := pgxmock.NewPool()
	if err != nil {
		t.Fatalf("failed to create pgxmock: %v", err)
	}
	defer mock.Close()

	mock.ExpectExec(`DELETE FROM auth_tokens WHERE token = \$1`).
		WithArgs("token-to-revoke").
		WillReturnResult(pgxmock.NewResult("DELETE", 1))

	repo := NewAuthRepository(mock)
	err = repo.RevokeToken(context.Background(), "token-to-revoke")
	if err != nil {
		t.Fatalf("unexpected revoke error: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet mock expectations: %v", err)
	}
}

func TestAuthRepository_VerifyAndChangeAdminPassword(t *testing.T) {
	mock, err := pgxmock.NewPool()
	if err != nil {
		t.Fatalf("failed to create pgxmock: %v", err)
	}
	defer mock.Close()

	// VerifyAdminPassword
	mock.ExpectQuery(`SELECT value FROM settings WHERE key = 'admin_pass' AND outlet_id = 'global'`).
		WillReturnRows(mock.NewRows([]string{"value"}).AddRow("oldpass123"))

	// ChangeAdminPassword -> verify again
	mock.ExpectQuery(`SELECT value FROM settings WHERE key = 'admin_pass' AND outlet_id = 'global'`).
		WillReturnRows(mock.NewRows([]string{"value"}).AddRow("oldpass123"))

	// ChangeAdminPassword -> update
	mock.ExpectExec(`INSERT INTO settings \(key, outlet_id, value\)`).
		WithArgs(pgxmock.AnyArg()).
		WillReturnResult(pgxmock.NewResult("INSERT", 1))

	repo := NewAuthRepository(mock)
	valid, err := repo.VerifyAdminPassword(context.Background(), "oldpass123")
	if err != nil || !valid {
		t.Fatalf("expected admin password to be valid: %v", err)
	}

	err = repo.ChangeAdminPassword(context.Background(), "oldpass123", "newpass456")
	if err != nil {
		t.Fatalf("unexpected error changing admin password: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet mock expectations: %v", err)
	}
}
