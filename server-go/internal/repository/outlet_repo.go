package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"kasir-backend/internal/model"
)

type OutletRepository struct {
	db DBPool
}

func NewOutletRepository(db DBPool) *OutletRepository {
	return &OutletRepository{db: db}
}

func (r *OutletRepository) GetOutlets(ctx context.Context) ([]model.Outlet, error) {
	query := `SELECT id, nama, COALESCE(alamat, ''), created_at FROM outlets ORDER BY nama ASC`
	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("error querying outlets: %w", err)
	}
	defer rows.Close()

	var outlets []model.Outlet
	for rows.Next() {
		var o model.Outlet
		if err := rows.Scan(&o.ID, &o.Nama, &o.Alamat, &o.CreatedAt); err != nil {
			return nil, fmt.Errorf("error scanning outlet: %w", err)
		}
		outlets = append(outlets, o)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("row iteration error: %w", err)
	}
	if outlets == nil {
		outlets = []model.Outlet{}
	}
	return outlets, nil
}

func (r *OutletRepository) GetOutletByID(ctx context.Context, id string) (*model.Outlet, error) {
	query := `SELECT id, nama, COALESCE(alamat, ''), created_at FROM outlets WHERE id = $1`
	var o model.Outlet
	err := r.db.QueryRow(ctx, query, id).Scan(&o.ID, &o.Nama, &o.Alamat, &o.CreatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("error getting outlet by id %s: %w", id, err)
	}
	return &o, nil
}

func (r *OutletRepository) CreateOutlet(ctx context.Context, o model.Outlet) error {
	query := `
		INSERT INTO outlets (id, nama, alamat)
		VALUES ($1, $2, $3)
		ON CONFLICT (id) DO UPDATE SET nama = EXCLUDED.nama, alamat = EXCLUDED.alamat
	`
	_, err := r.db.Exec(ctx, query, o.ID, o.Nama, o.Alamat)
	if err != nil {
		return fmt.Errorf("error creating/updating outlet: %w", err)
	}
	return nil
}

func (r *OutletRepository) UpdateOutlet(ctx context.Context, o model.Outlet) error {
	query := `UPDATE outlets SET nama = $1, alamat = $2 WHERE id = $3`
	_, err := r.db.Exec(ctx, query, o.Nama, o.Alamat, o.ID)
	if err != nil {
		return fmt.Errorf("error updating outlet: %w", err)
	}
	return nil
}

func (r *OutletRepository) DeleteOutlet(ctx context.Context, id string) error {
	query := `DELETE FROM outlets WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("error deleting outlet: %w", err)
	}
	return nil
}
