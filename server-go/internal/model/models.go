package model

import (
	"encoding/json"
	"time"
)

// Outlet represents a store location.
type Outlet struct {
	ID        string     `json:"id"`
	Nama      string     `json:"nama"`
	Alamat    string     `json:"alamat"`
	CreatedAt *time.Time `json:"createdAt,omitempty"`
}

// ActiveSession represents an in-progress customer session at a specific outlet.
type ActiveSession struct {
	ID        string          `json:"id"`
	OutletID  string          `json:"outletId"`
	QueueNo   int             `json:"queueNo"`
	Nama      string          `json:"nama"`
	Items     json.RawMessage `json:"items"`
	StartTime int64           `json:"startTime"`
	Tanggal   string          `json:"tanggal"`
	PayAwal   string          `json:"payAwal"`
	CreatedAt *time.Time      `json:"createdAt,omitempty"`
}

// Transaction represents a completed order/session at an outlet.
type Transaction struct {
	ID         string     `json:"id"`
	OutletID   string     `json:"outletId"`
	No         int        `json:"no"`
	QueueNo    int        `json:"queueNo"`
	Nama       string     `json:"nama"`
	Tanggal    string     `json:"tanggal"`
	StartTime  int64      `json:"startTime"`
	EndTime    int64      `json:"endTime"`
	Items      string     `json:"items"`
	OT         string     `json:"ot"`
	OTDur      string     `json:"otDur"`
	TotalBase  float64    `json:"totalBase"`
	TotalOT    float64    `json:"totalOT"`
	TotalTol   float64    `json:"totalTol"`
	GrandTotal float64    `json:"grandTotal"`
	TotalAll   float64    `json:"totalAll"`
	PayAwal    string     `json:"payAwal"`
	Cash       float64    `json:"cash"`
	QRIS       float64    `json:"qris"`
	Shift      string     `json:"shift"`
	CreatedAt  *time.Time `json:"createdAt,omitempty"`
}

// User represents an authorized user (cashier or admin).
type User struct {
	ID        int        `json:"id,omitempty"`
	Username  string     `json:"username"`
	Password  string     `json:"password,omitempty"`
	Role      string     `json:"role"`
	OutletID  string     `json:"outletId,omitempty"`
	CreatedAt *time.Time `json:"createdAt,omitempty"`
}

// AuthToken represents a persisted session token.
type AuthToken struct {
	Token     string `json:"token"`
	Username  string `json:"username"`
	Role      string `json:"role"`
	OutletID  string `json:"outletId"`
	ExpiresAt int64  `json:"expiresAt"`
	TTLMs     int64  `json:"ttlMs"`
}

// Setting represents a configuration key-value pair, scoped globally or per outlet.
type Setting struct {
	Key      string `json:"key"`
	OutletID string `json:"outletId"`
	Value    string `json:"value"`
}

// DeletionLog records deleted transactions for audit purposes.
type DeletionLog struct {
	ID          int     `json:"id,omitempty"`
	OutletID    string  `json:"outletId,omitempty"`
	TxnID       string  `json:"txnId,omitempty"`
	TxnNo       int     `json:"txnNo,omitempty"`
	TxnNama     string  `json:"txnNama,omitempty"`
	TxnTanggal  string  `json:"txnTanggal,omitempty"`
	TxnTotalAll float64 `json:"txnTotalAll,omitempty"`
	DeletedAt   int64   `json:"deletedAt,omitempty"`
	DeletedBy   string  `json:"deletedBy,omitempty"`
}

// ClaimSessionPayload represents input parameters when converting an active session into a transaction.
type ClaimSessionPayload struct {
	SessionID      string          `json:"sessionId,omitempty"`
	OutletID       string          `json:"outletId,omitempty"`
	QueueNo        int             `json:"queueNo"`
	Nama           string          `json:"nama"`
	Tanggal        string          `json:"tanggal"`
	StartTime      int64           `json:"startTime"`
	EndTime        int64           `json:"endTime"`
	Items          string          `json:"items"`
	OT             string          `json:"ot"`
	OTDur          string          `json:"otDur"`
	TotalBase      float64         `json:"totalBase"`
	TotalOT        float64         `json:"totalOT"`
	TotalTol       float64         `json:"totalTol"`
	GrandTotal     float64         `json:"grandTotal"`
	TotalAll       float64         `json:"totalAll"`
	PayAwal        string          `json:"payAwal"`
	Cash           float64         `json:"cash"`
	QRIS           float64         `json:"qris"`
	Shift          string          `json:"shift"`
	RemainingItems json.RawMessage `json:"remainingItems,omitempty"`
}

// DefaultShiftRolloverHour is 6 AM.
const DefaultShiftRolloverHour = 6

// ShiftDateStr returns the YYYY-MM-DD date representation adjusted for shift rollover hour.
func ShiftDateStr(ts int64, rolloverHour int) string {
	var t time.Time
	if ts <= 0 {
		t = time.Now()
	} else {
		t = time.UnixMilli(ts)
	}
	t = t.Add(-time.Duration(rolloverHour) * time.Hour)
	return t.Format("2006-01-02")
}
