package repository

import (
	"context"
	"testing"

	"github.com/pashagolub/pgxmock/v4"
)

func TestSettingRepository_GetSettings(t *testing.T) {
	mock, err := pgxmock.NewPool()
	if err != nil {
		t.Fatalf("failed to create pgxmock: %v", err)
	}
	defer mock.Close()

	rows := mock.NewRows([]string{"key", "value"}).
		AddRow("hourly_rate", "10000").
		AddRow("printer_name", "Thermal 58mm")

	mock.ExpectQuery(`SELECT key, value FROM settings WHERE \(outlet_id = 'global' OR outlet_id = \$1\) AND key != 'admin_pass'`).
		WithArgs("outlet-1").
		WillReturnRows(rows)

	repo := NewSettingRepository(mock)
	settings, err := repo.GetSettings(context.Background(), "outlet-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if settings["hourly_rate"] != "10000" || settings["printer_name"] != "Thermal 58mm" {
		t.Errorf("unexpected settings map: %+v", settings)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet mock expectations: %v", err)
	}
}

func TestSettingRepository_GetAndSaveSetting(t *testing.T) {
	mock, err := pgxmock.NewPool()
	if err != nil {
		t.Fatalf("failed to create pgxmock: %v", err)
	}
	defer mock.Close()

	// GetSetting
	mock.ExpectQuery(`SELECT value FROM settings WHERE key = \$1 AND \(outlet_id = \$2 OR outlet_id = 'global'\)`).
		WithArgs("hourly_rate", "outlet-1").
		WillReturnRows(mock.NewRows([]string{"value"}).AddRow("15000"))

	// SaveSetting
	mock.ExpectExec(`INSERT INTO settings \(key, outlet_id, value\)`).
		WithArgs("hourly_rate", "outlet-1", "20000").
		WillReturnResult(pgxmock.NewResult("INSERT", 1))

	repo := NewSettingRepository(mock)
	val, err := repo.GetSetting(context.Background(), "hourly_rate", "outlet-1")
	if err != nil {
		t.Fatalf("unexpected get setting error: %v", err)
	}
	if val != "15000" {
		t.Errorf("expected 15000, got %s", val)
	}

	err = repo.SaveSetting(context.Background(), "hourly_rate", "outlet-1", "20000")
	if err != nil {
		t.Fatalf("unexpected save setting error: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet mock expectations: %v", err)
	}
}
