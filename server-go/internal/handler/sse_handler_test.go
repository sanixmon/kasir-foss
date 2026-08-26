package handler

import (
	"bufio"
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/pashagolub/pgxmock/v4"
	"kasir-backend/internal/config"
	"kasir-backend/internal/realtime"
	"kasir-backend/internal/repository"
)

func TestSSEHandler_StreamAndBroadcast(t *testing.T) {
	mock, err := pgxmock.NewPool()
	if err != nil {
		t.Fatalf("failed to create pgxmock: %v", err)
	}
	defer mock.Close()

	hub := realtime.NewHub()
	go hub.Run()

	h := NewHandler(
		repository.NewOutletRepository(mock),
		repository.NewSessionRepository(mock),
		repository.NewTxnRepository(mock),
		repository.NewAuthRepository(mock),
		repository.NewSettingRepository(mock),
		hub,
		&config.Config{CorsOrigin: "*"},
	)

	router := NewRouter(h)
	ts := httptest.NewServer(router)
	defer ts.Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, ts.URL+"/api/stream?outlet_id=outlet-1", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("failed to connect to stream: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.StatusCode)
	}
	if ct := resp.Header.Get("Content-Type"); !strings.Contains(ct, "text/event-stream") {
		t.Fatalf("expected text/event-stream content type, got %s", ct)
	}

	reader := bufio.NewReader(resp.Body)

	// Read initial connected comment line
	line, err := reader.ReadString('\n')
	if err != nil {
		t.Fatalf("failed to read initial comment: %v", err)
	}
	if !strings.Contains(line, ": connected to outlet outlet-1") {
		t.Errorf("unexpected initial line: %s", line)
	}

	// Broadcast an event
	hub.Broadcast(realtime.Event{
		Type:     "SESSION_ADDED",
		OutletID: "outlet-1",
		Payload:  map[string]string{"id": "s-test"},
	})

	// Read the broadcast event
	eventLine, err := reader.ReadString('\n')
	if err != nil {
		t.Fatalf("failed to read event line: %v", err)
	}
	for strings.TrimSpace(eventLine) == "" {
		eventLine, _ = reader.ReadString('\n')
	}
	if !strings.Contains(eventLine, "event: SESSION_ADDED") {
		t.Errorf("expected 'event: SESSION_ADDED', got %s", eventLine)
	}

	dataLine, err := reader.ReadString('\n')
	if err != nil {
		t.Fatalf("failed to read data line: %v", err)
	}
	if !strings.Contains(dataLine, "data:") || !strings.Contains(dataLine, "s-test") {
		t.Errorf("unexpected data line: %s", dataLine)
	}

	// Unregister on cancel
	cancel()
	time.Sleep(50 * time.Millisecond)
}
