package model

import (
	"encoding/json"
	"testing"
	"time"
)

func TestShiftDateStr(t *testing.T) {
	// 2026-08-26 05:00:00 UTC (before 6 AM rollover)
	t1 := time.Date(2026, 8, 26, 5, 0, 0, 0, time.UTC).UnixMilli()
	dateStr1 := ShiftDateStr(t1, 6)
	if dateStr1 != "2026-08-25" {
		t.Errorf("expected 2026-08-25, got %s", dateStr1)
	}

	// 2026-08-26 07:00:00 UTC (after 6 AM rollover)
	t2 := time.Date(2026, 8, 26, 7, 0, 0, 0, time.UTC).UnixMilli()
	dateStr2 := ShiftDateStr(t2, 6)
	if dateStr2 != "2026-08-26" {
		t.Errorf("expected 2026-08-26, got %s", dateStr2)
	}

	// 0 timestamp (defaults to current time without panic)
	dateStrNow := ShiftDateStr(0, 6)
	if dateStrNow == "" {
		t.Errorf("expected non-empty date string for now")
	}
}

func TestModelJSONSerialization(t *testing.T) {
	sess := ActiveSession{
		ID:        "s-123",
		OutletID:  "outlet-1",
		QueueNo:   1,
		Nama:      "Test User",
		Items:     json.RawMessage(`[{"id":"item-1","name":"Kopi"}]`),
		StartTime: 1724670000000,
		Tanggal:   "2026-08-26",
		PayAwal:   "cash",
	}

	data, err := json.Marshal(sess)
	if err != nil {
		t.Fatalf("failed to marshal session: %v", err)
	}

	var unmarshaled ActiveSession
	if err := json.Unmarshal(data, &unmarshaled); err != nil {
		t.Fatalf("failed to unmarshal session: %v", err)
	}

	if unmarshaled.ID != sess.ID || unmarshaled.OutletID != sess.OutletID || unmarshaled.QueueNo != 1 {
		t.Errorf("mismatch in unmarshaled struct: %+v", unmarshaled)
	}
}
