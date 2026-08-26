package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"kasir-backend/internal/model"
)

type TxnRepository struct {
	db DBPool
}

func NewTxnRepository(db DBPool) *TxnRepository {
	return &TxnRepository{db: db}
}

func (r *TxnRepository) GetTransactions(ctx context.Context, outletID string, tanggal string) ([]model.Transaction, error) {
	var rows pgx.Rows
	var err error

	isAllOutlets := outletID == "" || outletID == "all"

	switch {
	case isAllOutlets && tanggal == "":
		query := `
			SELECT id, outlet_id, no, queue_no, COALESCE(nama, ''), COALESCE(tanggal, ''),
			       COALESCE(start_time, 0), COALESCE(end_time, 0), COALESCE(items, ''),
			       COALESCE(ot, '-'), COALESCE(ot_dur, '-'),
			       total_base, total_ot, total_tol, grand_total, total_all,
			       COALESCE(pay_awal, 'cash'), cash, qris, COALESCE(shift, '-'), created_at
			FROM transactions
			ORDER BY no ASC
		`
		rows, err = r.db.Query(ctx, query)
	case isAllOutlets && tanggal != "":
		query := `
			SELECT id, outlet_id, no, queue_no, COALESCE(nama, ''), COALESCE(tanggal, ''),
			       COALESCE(start_time, 0), COALESCE(end_time, 0), COALESCE(items, ''),
			       COALESCE(ot, '-'), COALESCE(ot_dur, '-'),
			       total_base, total_ot, total_tol, grand_total, total_all,
			       COALESCE(pay_awal, 'cash'), cash, qris, COALESCE(shift, '-'), created_at
			FROM transactions
			WHERE tanggal = $1
			ORDER BY no ASC
		`
		rows, err = r.db.Query(ctx, query, tanggal)
	case !isAllOutlets && tanggal == "":
		query := `
			SELECT id, outlet_id, no, queue_no, COALESCE(nama, ''), COALESCE(tanggal, ''),
			       COALESCE(start_time, 0), COALESCE(end_time, 0), COALESCE(items, ''),
			       COALESCE(ot, '-'), COALESCE(ot_dur, '-'),
			       total_base, total_ot, total_tol, grand_total, total_all,
			       COALESCE(pay_awal, 'cash'), cash, qris, COALESCE(shift, '-'), created_at
			FROM transactions
			WHERE outlet_id = $1
			ORDER BY no ASC
		`
		rows, err = r.db.Query(ctx, query, outletID)
	default:
		query := `
			SELECT id, outlet_id, no, queue_no, COALESCE(nama, ''), COALESCE(tanggal, ''),
			       COALESCE(start_time, 0), COALESCE(end_time, 0), COALESCE(items, ''),
			       COALESCE(ot, '-'), COALESCE(ot_dur, '-'),
			       total_base, total_ot, total_tol, grand_total, total_all,
			       COALESCE(pay_awal, 'cash'), cash, qris, COALESCE(shift, '-'), created_at
			FROM transactions
			WHERE outlet_id = $1 AND tanggal = $2
			ORDER BY no ASC
		`
		rows, err = r.db.Query(ctx, query, outletID, tanggal)
	}

	if err != nil {
		return nil, fmt.Errorf("error querying transactions: %w", err)
	}
	defer rows.Close()

	var txns []model.Transaction
	for rows.Next() {
		var t model.Transaction
		if err := rows.Scan(
			&t.ID, &t.OutletID, &t.No, &t.QueueNo, &t.Nama, &t.Tanggal,
			&t.StartTime, &t.EndTime, &t.Items, &t.OT, &t.OTDur,
			&t.TotalBase, &t.TotalOT, &t.TotalTol, &t.GrandTotal, &t.TotalAll,
			&t.PayAwal, &t.Cash, &t.QRIS, &t.Shift, &t.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("error scanning transaction: %w", err)
		}
		txns = append(txns, t)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("row iteration error: %w", err)
	}
	if txns == nil {
		txns = []model.Transaction{}
	}
	return txns, nil
}

func (r *TxnRepository) GetTransactionByID(ctx context.Context, id string) (*model.Transaction, error) {
	query := `
		SELECT id, outlet_id, no, queue_no, COALESCE(nama, ''), COALESCE(tanggal, ''),
		       COALESCE(start_time, 0), COALESCE(end_time, 0), COALESCE(items, ''),
		       COALESCE(ot, '-'), COALESCE(ot_dur, '-'),
		       total_base, total_ot, total_tol, grand_total, total_all,
		       COALESCE(pay_awal, 'cash'), cash, qris, COALESCE(shift, '-'), created_at
		FROM transactions
		WHERE id = $1
	`
	var t model.Transaction
	err := r.db.QueryRow(ctx, query, id).Scan(
		&t.ID, &t.OutletID, &t.No, &t.QueueNo, &t.Nama, &t.Tanggal,
		&t.StartTime, &t.EndTime, &t.Items, &t.OT, &t.OTDur,
		&t.TotalBase, &t.TotalOT, &t.TotalTol, &t.GrandTotal, &t.TotalAll,
		&t.PayAwal, &t.Cash, &t.QRIS, &t.Shift, &t.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("error querying transaction %s: %w", id, err)
	}
	return &t, nil
}

func (r *TxnRepository) ClaimSession(ctx context.Context, payload model.ClaimSessionPayload) (*model.Transaction, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("error starting transaction: %w", err)
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	hasRemaining := len(payload.RemainingItems) > 0 && string(payload.RemainingItems) != "null" && string(payload.RemainingItems) != "[]"

	if payload.SessionID != "" {
		var sessOutletID string
		err := tx.QueryRow(ctx, `SELECT outlet_id FROM active_sessions WHERE id = $1 FOR UPDATE`, payload.SessionID).Scan(&sessOutletID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, errors.New("session not found or already claimed")
			}
			return nil, fmt.Errorf("error querying session for claim: %w", err)
		}
		if payload.OutletID == "" {
			payload.OutletID = sessOutletID
		}

		if hasRemaining {
			_, err := tx.Exec(ctx, `UPDATE active_sessions SET items = $1 WHERE id = $2`, payload.RemainingItems, payload.SessionID)
			if err != nil {
				return nil, fmt.Errorf("error updating remaining items in session: %w", err)
			}
		} else {
			_, err := tx.Exec(ctx, `DELETE FROM active_sessions WHERE id = $1`, payload.SessionID)
			if err != nil {
				return nil, fmt.Errorf("error deleting claimed session: %w", err)
			}
		}
	}

	if payload.OutletID == "" {
		payload.OutletID = "outlet-1"
	}

	txnID := ""
	if payload.SessionID != "" && !hasRemaining {
		txnID = "t-" + strings.TrimPrefix(payload.SessionID, "s-")
	} else {
		txnID = "t-" + GenerateRandomID(3)
	}

	if payload.EndTime <= 0 {
		payload.EndTime = time.Now().UnixMilli()
	}
	if payload.Shift == "" {
		payload.Shift = "-"
	}
	if payload.OT == "" {
		payload.OT = "-"
	}
	if payload.OTDur == "" {
		payload.OTDur = "-"
	}
	if payload.PayAwal == "" {
		payload.PayAwal = "cash"
	}

	var nextNo int
	err = tx.QueryRow(ctx, `SELECT nextval('txn_no_seq')`).Scan(&nextNo)
	if err != nil {
		err = tx.QueryRow(ctx, `SELECT COALESCE(MAX(no), 0) + 1 FROM transactions`).Scan(&nextNo)
		if err != nil {
			nextNo = 1
		}
	}

	insertQuery := `
		INSERT INTO transactions (
			id, outlet_id, no, queue_no, nama, tanggal, start_time, end_time,
			items, ot, ot_dur, total_base, total_ot, total_tol, grand_total,
			total_all, pay_awal, cash, qris, shift
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
		) RETURNING id, outlet_id, no, queue_no, COALESCE(nama, ''), COALESCE(tanggal, ''),
		            COALESCE(start_time, 0), COALESCE(end_time, 0), COALESCE(items, ''),
		            COALESCE(ot, '-'), COALESCE(ot_dur, '-'),
		            total_base, total_ot, total_tol, grand_total, total_all,
		            COALESCE(pay_awal, 'cash'), cash, qris, COALESCE(shift, '-'), created_at
	`
	var t model.Transaction
	err = tx.QueryRow(
		ctx, insertQuery,
		txnID, payload.OutletID, nextNo, payload.QueueNo, payload.Nama, payload.Tanggal,
		payload.StartTime, payload.EndTime, payload.Items, payload.OT, payload.OTDur,
		payload.TotalBase, payload.TotalOT, payload.TotalTol, payload.GrandTotal,
		payload.TotalAll, payload.PayAwal, payload.Cash, payload.QRIS, payload.Shift,
	).Scan(
		&t.ID, &t.OutletID, &t.No, &t.QueueNo, &t.Nama, &t.Tanggal,
		&t.StartTime, &t.EndTime, &t.Items, &t.OT, &t.OTDur,
		&t.TotalBase, &t.TotalOT, &t.TotalTol, &t.GrandTotal, &t.TotalAll,
		&t.PayAwal, &t.Cash, &t.QRIS, &t.Shift, &t.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("error inserting transaction: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("error committing claim transaction: %w", err)
	}

	return &t, nil
}

func (r *TxnRepository) DeleteTxn(ctx context.Context, id string, no int, outletID string) error {
	var err error
	if outletID == "" || outletID == "all" {
		query := `DELETE FROM transactions WHERE (id = $1 AND $1 != '') OR (no = $2 AND $2 > 0)`
		_, err = r.db.Exec(ctx, query, id, no)
	} else {
		query := `DELETE FROM transactions WHERE ((id = $1 AND $1 != '') OR (no = $2 AND $2 > 0)) AND outlet_id = $3`
		_, err = r.db.Exec(ctx, query, id, no, outletID)
	}
	if err != nil {
		return fmt.Errorf("error deleting transaction: %w", err)
	}
	return nil
}

func (r *TxnRepository) ClearAllTxns(ctx context.Context, outletID string) error {
	var err error
	if outletID == "" || outletID == "all" {
		query := `DELETE FROM transactions`
		_, err = r.db.Exec(ctx, query)
	} else {
		query := `DELETE FROM transactions WHERE outlet_id = $1`
		_, err = r.db.Exec(ctx, query, outletID)
	}
	if err != nil {
		return fmt.Errorf("error clearing transactions: %w", err)
	}
	return nil
}

func (r *TxnRepository) AddDeletionLog(ctx context.Context, log model.DeletionLog) error {
	if log.DeletedAt <= 0 {
		log.DeletedAt = time.Now().UnixMilli()
	}
	if log.DeletedBy == "" {
		log.DeletedBy = "admin"
	}
	query := `
		INSERT INTO deletion_logs (outlet_id, txn_id, txn_no, txn_nama, txn_tanggal, txn_total_all, deleted_at, deleted_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`
	_, err := r.db.Exec(
		ctx, query,
		log.OutletID, log.TxnID, log.TxnNo, log.TxnNama, log.TxnTanggal, log.TxnTotalAll, log.DeletedAt, log.DeletedBy,
	)
	if err != nil {
		return fmt.Errorf("error adding deletion log: %w", err)
	}
	return nil
}

func (r *TxnRepository) GetDeletionLogs(ctx context.Context, outletID string, limit int) ([]model.DeletionLog, error) {
	if limit <= 0 {
		limit = 200
	}

	var rows pgx.Rows
	var err error

	if outletID == "" || outletID == "all" {
		query := `
			SELECT id, COALESCE(outlet_id, ''), COALESCE(txn_id, ''), COALESCE(txn_no, 0),
			       COALESCE(txn_nama, ''), COALESCE(txn_tanggal, ''), COALESCE(txn_total_all, 0),
			       COALESCE(deleted_at, 0), COALESCE(deleted_by, 'admin')
			FROM deletion_logs
			ORDER BY deleted_at DESC
			LIMIT $1
		`
		rows, err = r.db.Query(ctx, query, limit)
	} else {
		query := `
			SELECT id, COALESCE(outlet_id, ''), COALESCE(txn_id, ''), COALESCE(txn_no, 0),
			       COALESCE(txn_nama, ''), COALESCE(txn_tanggal, ''), COALESCE(txn_total_all, 0),
			       COALESCE(deleted_at, 0), COALESCE(deleted_by, 'admin')
			FROM deletion_logs
			WHERE outlet_id = $1
			ORDER BY deleted_at DESC
			LIMIT $2
		`
		rows, err = r.db.Query(ctx, query, outletID, limit)
	}

	if err != nil {
		return nil, fmt.Errorf("error querying deletion logs: %w", err)
	}
	defer rows.Close()

	var logs []model.DeletionLog
	for rows.Next() {
		var l model.DeletionLog
		if err := rows.Scan(
			&l.ID, &l.OutletID, &l.TxnID, &l.TxnNo, &l.TxnNama, &l.TxnTanggal,
			&l.TxnTotalAll, &l.DeletedAt, &l.DeletedBy,
		); err != nil {
			return nil, fmt.Errorf("error scanning deletion log: %w", err)
		}
		logs = append(logs, l)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("row iteration error: %w", err)
	}
	if logs == nil {
		logs = []model.DeletionLog{}
	}
	return logs, nil
}
