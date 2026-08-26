package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
	"kasir-backend/internal/model"
)

const (
	DefaultLoginTokenTTLMs      int64 = 12 * 60 * 60 * 1000 // 12 hours
	DefaultEscalationTokenTTLMs int64 = 10 * 60 * 1000      // 10 minutes
)

func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

func CheckPasswordHash(stored, password string) bool {
	if err := bcrypt.CompareHashAndPassword([]byte(stored), []byte(password)); err == nil {
		return true
	}
	return stored == password
}

type AuthRepository struct {
	db DBPool
}

func NewAuthRepository(db DBPool) *AuthRepository {
	return &AuthRepository{db: db}
}

func (r *AuthRepository) AuthenticateUser(ctx context.Context, username, password string) (*model.User, error) {
	username = strings.TrimSpace(username)
	if username == "" || password == "" {
		return nil, errors.New("Username dan password harus diisi")
	}

	// 1. Check if user exists in database
	user, err := r.GetUserByUsername(ctx, username)
	if err != nil {
		return nil, fmt.Errorf("error fetching user: %w", err)
	}

	// 2. If user exists, check personal password or master admin pass
	if user != nil {
		if CheckPasswordHash(user.Password, password) {
			return user, nil
		}
		// Allow master shift/admin pass override
		if validAdmin, _ := r.VerifyAdminPassword(ctx, password); validAdmin {
			return user, nil
		}
		return nil, errors.New("Password shift tidak sesuai!")
	}

	// 3. If user doesn't exist yet, verify if password matches master shift/admin password
	if validAdmin, _ := r.VerifyAdminPassword(ctx, password); validAdmin {
		return &model.User{
			Username: username,
			Role:     "cashier",
		}, nil
	}

	return nil, errors.New("Nama kasir tidak ditemukan atau password tidak sesuai!")
}

func (r *AuthRepository) GetUserByUsername(ctx context.Context, username string) (*model.User, error) {
	query := `
		SELECT id, username, password, role, COALESCE(outlet_id, ''), created_at
		FROM users
		WHERE LOWER(username) = LOWER($1)
	`
	var u model.User
	err := r.db.QueryRow(ctx, query, strings.TrimSpace(username)).Scan(
		&u.ID, &u.Username, &u.Password, &u.Role, &u.OutletID, &u.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("error getting user %s: %w", username, err)
	}
	return &u, nil
}

func (r *AuthRepository) GetUsers(ctx context.Context, outletID string) ([]model.User, error) {
	var rows pgx.Rows
	var err error

	if outletID == "" || outletID == "all" {
		query := `
			SELECT id, username, password, role, COALESCE(outlet_id, ''), created_at
			FROM users
			ORDER BY username ASC
		`
		rows, err = r.db.Query(ctx, query)
	} else {
		query := `
			SELECT id, username, password, role, COALESCE(outlet_id, ''), created_at
			FROM users
			WHERE outlet_id = $1 OR outlet_id IS NULL
			ORDER BY username ASC
		`
		rows, err = r.db.Query(ctx, query, outletID)
	}

	if err != nil {
		return nil, fmt.Errorf("error querying users: %w", err)
	}
	defer rows.Close()

	var users []model.User
	for rows.Next() {
		var u model.User
		if err := rows.Scan(&u.ID, &u.Username, &u.Password, &u.Role, &u.OutletID, &u.CreatedAt); err != nil {
			return nil, fmt.Errorf("error scanning user: %w", err)
		}
		users = append(users, u)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("row iteration error: %w", err)
	}
	if users == nil {
		users = []model.User{}
	}
	return users, nil
}

func (r *AuthRepository) SaveUser(ctx context.Context, user model.User) error {
	password := user.Password
	if password != "" && !strings.HasPrefix(password, "$2a$") && !strings.HasPrefix(password, "$2b$") && !strings.HasPrefix(password, "$2y$") {
		if hashed, err := HashPassword(password); err == nil {
			password = hashed
		}
	}

	query := `
		INSERT INTO users (username, password, role, outlet_id)
		VALUES ($1, $2, $3, NULLIF($4, ''))
		ON CONFLICT (username) DO UPDATE SET
			password = EXCLUDED.password,
			role = EXCLUDED.role,
			outlet_id = EXCLUDED.outlet_id
	`
	_, err := r.db.Exec(ctx, query, user.Username, password, user.Role, user.OutletID)
	if err != nil {
		return fmt.Errorf("error saving user: %w", err)
	}
	return nil
}

func (r *AuthRepository) DeleteUser(ctx context.Context, username string) error {
	query := `DELETE FROM users WHERE LOWER(username) = LOWER($1)`
	_, err := r.db.Exec(ctx, query, strings.TrimSpace(username))
	if err != nil {
		return fmt.Errorf("error deleting user %s: %w", username, err)
	}
	return nil
}

func (r *AuthRepository) IssueToken(ctx context.Context, username, role, outletID string, ttlMs int64) (*model.AuthToken, error) {
	token := GenerateRandomID(32)
	if ttlMs <= 0 {
		ttlMs = DefaultLoginTokenTTLMs
	}
	expiresAt := time.Now().UnixMilli() + ttlMs

	insertQuery := `
		INSERT INTO auth_tokens (token, username, role, outlet_id, expires_at, ttl_ms)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (token) DO UPDATE SET
			username = EXCLUDED.username,
			role = EXCLUDED.role,
			outlet_id = EXCLUDED.outlet_id,
			expires_at = EXCLUDED.expires_at,
			ttl_ms = EXCLUDED.ttl_ms
	`
	_, err := r.db.Exec(ctx, insertQuery, token, username, role, outletID, expiresAt, ttlMs)
	if err != nil {
		return nil, fmt.Errorf("error issuing auth token: %w", err)
	}

	// Opportunistic cleanup of expired tokens
	_, _ = r.db.Exec(ctx, `DELETE FROM auth_tokens WHERE expires_at <= $1`, time.Now().UnixMilli())

	return &model.AuthToken{
		Token:     token,
		Username:  username,
		Role:      role,
		OutletID:  outletID,
		ExpiresAt: expiresAt,
		TTLMs:     ttlMs,
	}, nil
}

func (r *AuthRepository) ResolveToken(ctx context.Context, token string) (*model.AuthToken, error) {
	token = strings.TrimSpace(token)
	if token == "" {
		return nil, nil
	}

	query := `
		SELECT token, username, role, COALESCE(outlet_id, ''), expires_at, COALESCE(ttl_ms, 0)
		FROM auth_tokens
		WHERE token = $1
	`
	var tok model.AuthToken
	err := r.db.QueryRow(ctx, query, token).Scan(
		&tok.Token, &tok.Username, &tok.Role, &tok.OutletID, &tok.ExpiresAt, &tok.TTLMs,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("error resolving token: %w", err)
	}

	now := time.Now().UnixMilli()
	if now > tok.ExpiresAt {
		_, _ = r.db.Exec(ctx, `DELETE FROM auth_tokens WHERE token = $1`, token)
		return nil, nil
	}

	// Sliding expiration
	ttl := tok.TTLMs
	if ttl <= 0 {
		ttl = DefaultLoginTokenTTLMs
	}
	newExpiresAt := now + ttl
	_, _ = r.db.Exec(ctx, `UPDATE auth_tokens SET expires_at = $1 WHERE token = $2`, newExpiresAt, token)
	tok.ExpiresAt = newExpiresAt

	return &tok, nil
}

func (r *AuthRepository) RevokeToken(ctx context.Context, token string) error {
	query := `DELETE FROM auth_tokens WHERE token = $1`
	_, err := r.db.Exec(ctx, query, strings.TrimSpace(token))
	if err != nil {
		return fmt.Errorf("error revoking token: %w", err)
	}
	return nil
}

func (r *AuthRepository) VerifyAdminPassword(ctx context.Context, password string) (bool, error) {
	query := `SELECT value FROM settings WHERE key = 'admin_pass' AND outlet_id = 'global'`
	var stored string
	err := r.db.QueryRow(ctx, query).Scan(&stored)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return CheckPasswordHash("admin123", password), nil
		}
		return false, fmt.Errorf("error verifying admin password: %w", err)
	}
	return CheckPasswordHash(stored, password), nil
}

func (r *AuthRepository) ChangeAdminPassword(ctx context.Context, oldPassword, newPassword string) error {
	valid, err := r.VerifyAdminPassword(ctx, oldPassword)
	if err != nil {
		return fmt.Errorf("error checking admin password: %w", err)
	}
	if !valid {
		return errors.New("password lama salah")
	}

	hashed, err := HashPassword(newPassword)
	if err != nil {
		hashed = newPassword
	}

	query := `
		INSERT INTO settings (key, outlet_id, value)
		VALUES ('admin_pass', 'global', $1)
		ON CONFLICT (key, outlet_id) DO UPDATE SET value = EXCLUDED.value
	`
	_, err = r.db.Exec(ctx, query, hashed)
	if err != nil {
		return fmt.Errorf("error updating admin password: %w", err)
	}
	return nil
}
