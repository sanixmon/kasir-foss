package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"kasir-backend/internal/model"
)

type SessionRepository struct {
	db DBPool
}

func NewSessionRepository(db DBPool) *SessionRepository {
	return &SessionRepository{db: db}
}

func (r *SessionRepository) GetSessionsByOutlet(ctx context.Context, outletID string) ([]model.ActiveSession, error) {
	var rows pgx.Rows
	var err error

	if outletID == "" || outletID == "all" {
		query := `
			SELECT id, outlet_id, queue_no, COALESCE(nama, ''), items, COALESCE(start_time, 0), COALESCE(tanggal, ''), COALESCE(pay_awal, 'cash'), created_at
			FROM active_sessions
			ORDER BY queue_no ASC, start_time ASC
		`
		rows, err = r.db.Query(ctx, query)
	} else {
		query := `
			SELECT id, outlet_id, queue_no, COALESCE(nama, ''), items, COALESCE(start_time, 0), COALESCE(tanggal, ''), COALESCE(pay_awal, 'cash'), created_at
			FROM active_sessions
			WHERE outlet_id = $1
			ORDER BY queue_no ASC, start_time ASC
		`
		rows, err = r.db.Query(ctx, query, outletID)
	}

	if err != nil {
		return nil, fmt.Errorf("error querying active sessions: %w", err)
	}
	defer rows.Close()

	var sessions []model.ActiveSession
	for rows.Next() {
		var s model.ActiveSession
		if err := rows.Scan(&s.ID, &s.OutletID, &s.QueueNo, &s.Nama, &s.Items, &s.StartTime, &s.Tanggal, &s.PayAwal, &s.CreatedAt); err != nil {
			return nil, fmt.Errorf("error scanning active session: %w", err)
		}
		sessions = append(sessions, s)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("row iteration error: %w", err)
	}
	if sessions == nil {
		sessions = []model.ActiveSession{}
	}
	return sessions, nil
}

func (r *SessionRepository) GetSessionByID(ctx context.Context, id string) (*model.ActiveSession, error) {
	query := `
		SELECT id, outlet_id, queue_no, COALESCE(nama, ''), items, COALESCE(start_time, 0), COALESCE(tanggal, ''), COALESCE(pay_awal, 'cash'), created_at
		FROM active_sessions
		WHERE id = $1
	`
	var s model.ActiveSession
	err := r.db.QueryRow(ctx, query, id).Scan(&s.ID, &s.OutletID, &s.QueueNo, &s.Nama, &s.Items, &s.StartTime, &s.Tanggal, &s.PayAwal, &s.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("error querying session by id %s: %w", id, err)
	}
	return &s, nil
}

func (r *SessionRepository) AddSession(ctx context.Context, s model.ActiveSession) (*model.ActiveSession, error) {
	if s.ID == "" {
		s.ID = "s-" + GenerateRandomID(3)
	}
	if s.OutletID == "" {
		s.OutletID = "outlet-1"
	}
	if s.StartTime <= 0 {
		s.StartTime = time.Now().UnixMilli()
	}
	if s.Tanggal == "" {
		s.Tanggal = model.ShiftDateStr(s.StartTime, model.DefaultShiftRolloverHour)
	}
	if s.PayAwal == "" {
		s.PayAwal = "cash"
	}
	if len(s.Items) == 0 {
		s.Items = json.RawMessage("[]")
	}

	if s.QueueNo <= 0 {
		var existingQueueNo int
		err := r.db.QueryRow(ctx, `SELECT queue_no FROM active_sessions WHERE id = $1`, s.ID).Scan(&existingQueueNo)
		if err == nil && existingQueueNo > 0 {
			s.QueueNo = existingQueueNo
		} else {
			queueQuery := `
				SELECT COALESCE(MAX(q), 0) + 1 AS next_q FROM (
					SELECT queue_no AS q FROM active_sessions WHERE outlet_id = $1 AND tanggal = $2
					UNION ALL
					SELECT queue_no AS q FROM transactions WHERE outlet_id = $1 AND tanggal = $2
				) sq
			`
			var nextQ int
			if err := r.db.QueryRow(ctx, queueQuery, s.OutletID, s.Tanggal).Scan(&nextQ); err != nil {
				nextQ = 1
			}
			s.QueueNo = nextQ
		}
	}

	insertQuery := `
		INSERT INTO active_sessions (id, outlet_id, queue_no, nama, items, start_time, tanggal, pay_awal)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (id) DO UPDATE SET
			outlet_id = EXCLUDED.outlet_id,
			queue_no = EXCLUDED.queue_no,
			nama = EXCLUDED.nama,
			items = EXCLUDED.items,
			start_time = EXCLUDED.start_time,
			tanggal = EXCLUDED.tanggal,
			pay_awal = EXCLUDED.pay_awal
		RETURNING id, outlet_id, queue_no, COALESCE(nama, ''), items, COALESCE(start_time, 0), COALESCE(tanggal, ''), COALESCE(pay_awal, 'cash'), created_at
	`
	var result model.ActiveSession
	err := r.db.QueryRow(ctx, insertQuery, s.ID, s.OutletID, s.QueueNo, s.Nama, s.Items, s.StartTime, s.Tanggal, s.PayAwal).Scan(
		&result.ID, &result.OutletID, &result.QueueNo, &result.Nama, &result.Items, &result.StartTime, &result.Tanggal, &result.PayAwal, &result.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("error adding active session: %w", err)
	}
	return &result, nil
}

func (r *SessionRepository) EditSession(ctx context.Context, s model.ActiveSession) (*model.ActiveSession, error) {
	if s.ID == "" {
		return nil, errors.New("session id required")
	}

	existing, err := r.GetSessionByID(ctx, s.ID)
	if err != nil {
		return nil, fmt.Errorf("error fetching existing session: %w", err)
	}
	if existing == nil {
		return nil, errors.New("session not found")
	}

	if s.Nama != "" {
		existing.Nama = s.Nama
	}
	if len(s.Items) > 0 {
		existing.Items = s.Items
	}
	if s.StartTime > 0 {
		existing.StartTime = s.StartTime
	}
	if s.Tanggal != "" {
		existing.Tanggal = s.Tanggal
	}
	if s.PayAwal != "" {
		existing.PayAwal = s.PayAwal
	}
	if s.QueueNo > 0 {
		existing.QueueNo = s.QueueNo
	}

	updateQuery := `
		UPDATE active_sessions
		SET queue_no = $1, nama = $2, items = $3, start_time = $4, tanggal = $5, pay_awal = $6
		WHERE id = $7
		RETURNING id, outlet_id, queue_no, COALESCE(nama, ''), items, COALESCE(start_time, 0), COALESCE(tanggal, ''), COALESCE(pay_awal, 'cash'), created_at
	`
	var result model.ActiveSession
	err = r.db.QueryRow(ctx, updateQuery, existing.QueueNo, existing.Nama, existing.Items, existing.StartTime, existing.Tanggal, existing.PayAwal, existing.ID).Scan(
		&result.ID, &result.OutletID, &result.QueueNo, &result.Nama, &result.Items, &result.StartTime, &result.Tanggal, &result.PayAwal, &result.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("error updating active session: %w", err)
	}
	return &result, nil
}

func (r *SessionRepository) DeleteSession(ctx context.Context, id string) error {
	query := `DELETE FROM active_sessions WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("error deleting active session %s: %w", id, err)
	}
	return nil
}
