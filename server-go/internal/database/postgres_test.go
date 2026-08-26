package database

import (
	"strings"
	"testing"
)

func TestSchemaSQLEmbedded(t *testing.T) {
	if SchemaSQL == "" {
		t.Fatal("expected SchemaSQL to be embedded and non-empty")
	}

	expectedTables := []string{
		"outlets",
		"users",
		"active_sessions",
		"transactions",
		"settings",
		"deletion_logs",
		"auth_tokens",
	}

	for _, table := range expectedTables {
		if !strings.Contains(SchemaSQL, table) {
			t.Errorf("expected SchemaSQL to contain table definition for %s", table)
		}
	}
}
