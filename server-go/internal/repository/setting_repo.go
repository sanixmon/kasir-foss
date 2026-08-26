package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
)

type SettingRepository struct {
	db DBPool
}

func NewSettingRepository(db DBPool) *SettingRepository {
	return &SettingRepository{db: db}
}

func (r *SettingRepository) GetSettings(ctx context.Context, outletID string) (map[string]string, error) {
	var rows pgx.Rows
	var err error

	if outletID == "" || outletID == "all" {
		query := `SELECT key, value FROM settings WHERE key != 'admin_pass'`
		rows, err = r.db.Query(ctx, query)
	} else {
		query := `SELECT key, value FROM settings WHERE (outlet_id = 'global' OR outlet_id = $1) AND key != 'admin_pass'`
		rows, err = r.db.Query(ctx, query, outletID)
	}

	if err != nil {
		return nil, fmt.Errorf("error querying settings: %w", err)
	}
	defer rows.Close()

	settings := make(map[string]string)
	for rows.Next() {
		var k, v string
		if err := rows.Scan(&k, &v); err != nil {
			return nil, fmt.Errorf("error scanning setting: %w", err)
		}
		settings[k] = v
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("row iteration error: %w", err)
	}
	return settings, nil
}

func (r *SettingRepository) GetSetting(ctx context.Context, key, outletID string) (string, error) {
	key = strings.TrimSpace(key)
	if outletID == "" {
		outletID = "global"
	}

	// Try outlet specific first, fallback to global
	query := `
		SELECT value FROM settings
		WHERE key = $1 AND (outlet_id = $2 OR outlet_id = 'global')
		ORDER BY CASE WHEN outlet_id = $2 THEN 0 ELSE 1 END
		LIMIT 1
	`
	var val string
	err := r.db.QueryRow(ctx, query, key, outletID).Scan(&val)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", nil
		}
		return "", fmt.Errorf("error querying setting %s: %w", key, err)
	}
	return val, nil
}

func (r *SettingRepository) SaveSetting(ctx context.Context, key, outletID, value string) error {
	key = strings.TrimSpace(key)
	if outletID == "" {
		outletID = "global"
	}
	query := `
		INSERT INTO settings (key, outlet_id, value)
		VALUES ($1, $2, $3)
		ON CONFLICT (key, outlet_id) DO UPDATE SET value = EXCLUDED.value
	`
	_, err := r.db.Exec(ctx, query, key, outletID, value)
	if err != nil {
		return fmt.Errorf("error saving setting %s: %w", key, err)
	}
	return nil
}
