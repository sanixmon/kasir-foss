package database

import (
	"context"
	_ "embed"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed schema.sql
var SchemaSQL string

func NewPool(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("error parsing db url: %w", err)
	}
	config.MaxConns = 50
	config.MinConns = 5
	config.MaxConnLifetime = 1 * time.Hour
	config.MaxConnIdleTime = 15 * time.Minute
	config.HealthCheckPeriod = 1 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("unable to connect to database: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("database ping failed: %w", err)
	}

	// Run automatic database migrations upon startup
	if err := Migrate(ctx, pool); err != nil {
		return nil, fmt.Errorf("startup migration failed: %w", err)
	}

	return pool, nil
}

// Migrate applies all pending schema migrations idempotently under an advisory lock
func Migrate(ctx context.Context, pool *pgxpool.Pool) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin migration transaction: %w", err)
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	// Acquire exclusive cluster-wide advisory lock for migration (ID: 987654321)
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(987654321)`); err != nil {
		return fmt.Errorf("failed to acquire migration advisory lock: %w", err)
	}

	// Ensure schema_migrations table exists
	createMigrationsTable := `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version VARCHAR(64) PRIMARY KEY,
			applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);
	`
	if _, err := tx.Exec(ctx, createMigrationsTable); err != nil {
		return fmt.Errorf("failed to create schema_migrations table: %w", err)
	}

	// Apply schema.sql
	if _, err := tx.Exec(ctx, SchemaSQL); err != nil {
		return fmt.Errorf("error applying schema.sql: %w", err)
	}

	// Record migration version
	recordVersion := `
		INSERT INTO schema_migrations (version)
		VALUES ('2026-08-26-initial-multi-outlet')
		ON CONFLICT (version) DO NOTHING;
	`
	if _, err := tx.Exec(ctx, recordVersion); err != nil {
		return fmt.Errorf("failed to record schema version: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit migration transaction: %w", err)
	}

	return nil
}
