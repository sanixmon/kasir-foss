# Golang + PostgreSQL Realtime Multi-Outlet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a robust, scalable Golang backend with PostgreSQL, featuring real-time Server-Sent Events (SSE) streaming per outlet and aggregated for admin, containerized alongside the React frontend using Docker Compose.

**Architecture:** 
- A modular Go backend (`server-go/`) with `pgxpool` for PostgreSQL connection management and a goroutine-based SSE Hub multiplexer for instant change propagation.
- Multi-tenant data model scoped by `outlet_id` across sessions, transactions, users, settings, and logs.
- Docker Compose orchestrating `postgres:16-alpine`, `backend` (Go multi-stage), and `frontend` (React + Nginx reverse proxy).

**Tech Stack:** 
- Backend: Go 1.22+, `github.com/go-chi/chi/v5`, `github.com/jackc/pgx/v5`, `github.com/google/uuid`
- Database: PostgreSQL 16 (local container)
- Frontend: React 19, Vite 8, EventSource SSE API
- Container: Docker & Docker Compose

---

### Task 1: Initialize Go Backend Module, Config, & Database Schema

**Files:**
- Create: `server-go/go.mod`
- Create: `server-go/internal/config/config.go`
- Create: `server-go/internal/database/postgres.go`
- Create: `server-go/internal/database/schema.sql`
- Test: `server-go/internal/config/config_test.go`

**Interfaces:**
- Consumes: Environment variables (`DATABASE_URL`, `PORT`, `CORS_ORIGIN`)
- Produces: `*pgxpool.Pool`, `config.Config`, SQL schema definition

- [ ] **Step 1: Write failing test for config loader**

```go
// server-go/internal/config/config_test.go
package config

import (
	"os"
	"testing"
)

func TestLoadConfig(t *testing.T) {
	os.Setenv("PORT", "9090")
	os.Setenv("DATABASE_URL", "postgres://test:test@localhost:5432/testdb")
	cfg := Load()
	if cfg.Port != "9090" {
		t.Errorf("expected port 9090, got %s", cfg.Port)
	}
	if cfg.DatabaseURL != "postgres://test:test@localhost:5432/testdb" {
		t.Errorf("unexpected database URL: %s", cfg.DatabaseURL)
	}
}
```

- [ ] **Step 2: Run test to verify failure**

Run: `cd server-go && go test ./internal/config/...`
Expected: FAIL (missing package/module)

- [ ] **Step 3: Create go.mod, config.go, and database schema**

```go
// server-go/internal/config/config.go
package config

import "os"

type Config struct {
	Port        string
	DatabaseURL string
	AdminPass   string
}

func Load() *Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://kasir:kasir_password@localhost:5432/kasir_db?sslmode=disable"
	}
	adminPass := os.Getenv("ADMIN_PASSWORD")
	if adminPass == "" {
		adminPass = "admin123"
	}
	return &Config{
		Port:        port,
		DatabaseURL: dbURL,
		AdminPass:   adminPass,
	}
}
```

```sql
-- server-go/internal/database/schema.sql
CREATE TABLE IF NOT EXISTS outlets (
    id VARCHAR(64) PRIMARY KEY,
    nama VARCHAR(128) NOT NULL,
    alamat TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(64) UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role VARCHAR(32) NOT NULL,
    outlet_id VARCHAR(64) REFERENCES outlets(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS active_sessions (
    id VARCHAR(64) PRIMARY KEY,
    outlet_id VARCHAR(64) NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    queue_no INT DEFAULT 0,
    nama VARCHAR(128),
    items JSONB DEFAULT '[]',
    start_time BIGINT,
    tanggal VARCHAR(32),
    pay_awal VARCHAR(32) DEFAULT 'cash',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(64) PRIMARY KEY,
    outlet_id VARCHAR(64) NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    no INT NOT NULL,
    queue_no INT DEFAULT 0,
    nama VARCHAR(128),
    tanggal VARCHAR(32),
    start_time BIGINT,
    end_time BIGINT,
    items TEXT,
    ot VARCHAR(32) DEFAULT '-',
    ot_dur VARCHAR(32) DEFAULT '-',
    total_base NUMERIC(12, 2) DEFAULT 0,
    total_ot NUMERIC(12, 2) DEFAULT 0,
    total_tol NUMERIC(12, 2) DEFAULT 0,
    grand_total NUMERIC(12, 2) DEFAULT 0,
    total_all NUMERIC(12, 2) DEFAULT 0,
    pay_awal VARCHAR(32) DEFAULT 'cash',
    cash NUMERIC(12, 2) DEFAULT 0,
    qris NUMERIC(12, 2) DEFAULT 0,
    shift VARCHAR(64) DEFAULT '-',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(64) NOT NULL,
    outlet_id VARCHAR(64) DEFAULT 'global',
    value TEXT,
    PRIMARY KEY (key, outlet_id)
);

CREATE TABLE IF NOT EXISTS deletion_logs (
    id SERIAL PRIMARY KEY,
    outlet_id VARCHAR(64) REFERENCES outlets(id) ON DELETE SET NULL,
    txn_id VARCHAR(64),
    txn_no INT,
    txn_nama VARCHAR(128),
    txn_tanggal VARCHAR(32),
    txn_total_all NUMERIC(12, 2) DEFAULT 0,
    deleted_at BIGINT,
    deleted_by VARCHAR(64) DEFAULT 'admin'
);

CREATE TABLE IF NOT EXISTS auth_tokens (
    token VARCHAR(128) PRIMARY KEY,
    username VARCHAR(64),
    role VARCHAR(32),
    outlet_id VARCHAR(64),
    expires_at BIGINT,
    ttl_ms BIGINT
);

CREATE INDEX IF NOT EXISTS idx_active_sessions_outlet ON active_sessions(outlet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_outlet_tanggal ON transactions(outlet_id, tanggal);

-- Default Outlets Seed
INSERT INTO outlets (id, nama, alamat) VALUES 
    ('outlet-1', 'Outlet Pusat', 'Jl. Utama No. 1'),
    ('outlet-2', 'Outlet Cabang 2', 'Jl. Cabang No. 2')
ON CONFLICT (id) DO NOTHING;

-- Default Settings Seed
INSERT INTO settings (key, outlet_id, value) VALUES
    ('admin_pass', 'global', 'admin123'),
    ('hourly_rate', 'global', '10000')
ON CONFLICT (key, outlet_id) DO NOTHING;
```

```go
// server-go/internal/database/postgres.go
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
	config.MaxConns = 25
	config.MinConns = 2
	config.MaxConnLifetime = 30 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("unable to connect to database: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("database ping failed: %w", err)
	}

	// Auto run schema
	if _, err := pool.Exec(ctx, SchemaSQL); err != nil {
		return nil, fmt.Errorf("error applying schema: %w", err)
	}

	return pool, nil
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server-go && go test ./internal/config/... -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server-go/
git commit -m "feat(backend-go): initialize go module, config, and postgresql schema"
```

---

### Task 2: Implement Domain Models & Repositories

**Files:**
- Create: `server-go/internal/model/models.go`
- Create: `server-go/internal/repository/outlet_repo.go`
- Create: `server-go/internal/repository/session_repo.go`
- Create: `server-go/internal/repository/txn_repo.go`
- Create: `server-go/internal/repository/auth_repo.go`

**Interfaces:**
- Consumes: `*pgxpool.Pool`
- Produces: `Repository` methods: `GetOutlets`, `GetSessionsByOutlet`, `AddSession`, `EditSession`, `ClaimSession`, `GetTransactions`, `DeleteTxn`, `AuthenticateUser`, `IssueToken`, `ResolveToken`

- [ ] **Step 1: Define domain structs in `models.go`**

```go
// server-go/internal/model/models.go
package model

import "encoding/json"

type Outlet struct {
	ID        string `json:"id"`
	Nama      string `json:"nama"`
	Alamat    string `json:"alamat"`
	CreatedAt string `json:"createdAt,omitempty"`
}

type ActiveSession struct {
	ID        string          `json:"id"`
	OutletID  string          `json:"outletId"`
	QueueNo   int             `json:"queueNo"`
	Nama      string          `json:"nama"`
	Items     json.RawMessage `json:"items"`
	StartTime int64           `json:"startTime"`
	Tanggal   string          `json:"tanggal"`
	PayAwal   string          `json:"payAwal"`
}

type Transaction struct {
	ID         string  `json:"id"`
	OutletID   string  `json:"outletId"`
	No         int     `json:"no"`
	QueueNo    int     `json:"queueNo"`
	Nama       string  `json:"nama"`
	Tanggal    string  `json:"tanggal"`
	StartTime  int64   `json:"startTime"`
	EndTime    int64   `json:"endTime"`
	Items      string  `json:"items"`
	OT         string  `json:"ot"`
	OTDur      string  `json:"otDur"`
	TotalBase  float64 `json:"totalBase"`
	TotalOT    float64 `json:"totalOT"`
	TotalTol   float64 `json:"totalTol"`
	GrandTotal float64 `json:"grandTotal"`
	TotalAll   float64 `json:"totalAll"`
	PayAwal    string  `json:"payAwal"`
	Cash       float64 `json:"cash"`
	QRIS       float64 `json:"qris"`
	Shift      string  `json:"shift"`
}

type User struct {
	ID       int    `json:"id,omitempty"`
	Username string `json:"username"`
	Password string `json:"password,omitempty"`
	Role     string `json:"role"`
	OutletID string `json:"outletId,omitempty"`
}

type AuthToken struct {
	Token     string `json:"token"`
	Username  string `json:"username"`
	Role      string `json:"role"`
	OutletID  string `json:"outletId"`
	ExpiresAt int64  `json:"expiresAt"`
	TTLMs     int64  `json:"ttlMs"`
}
```

- [ ] **Step 2: Implement Repositories for DB access**
- Implement `OutletRepository`, `SessionRepository`, `TxnRepository`, and `AuthRepository` with full multi-outlet query support (`WHERE outlet_id = $1` or optional filter for all outlets).

- [ ] **Step 3: Run build check**

Run: `cd server-go && go build ./internal/...`
Expected: SUCCESS

- [ ] **Step 4: Commit**

```bash
git add server-go/internal/model/ server-go/internal/repository/
git commit -m "feat(backend-go): implement multi-outlet domain models and repositories"
```

---

### Task 3: Implement Realtime SSE Hub (Multi-Room / Scoped Outlets)

**Files:**
- Create: `server-go/internal/realtime/event.go`
- Create: `server-go/internal/realtime/hub.go`
- Test: `server-go/internal/realtime/hub_test.go`

**Interfaces:**
- Consumes: Go Channels, Mutexes
- Produces: `Hub` with `Register(client)`, `Unregister(client)`, `Broadcast(event)`

- [ ] **Step 1: Write failing test for Hub room routing**

```go
// server-go/internal/realtime/hub_test.go
package realtime

import (
	"testing"
	"time"
)

func TestHubMultiOutletBroadcast(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	c1 := hub.Register("outlet-1")
	c2 := hub.Register("outlet-2")
	cAll := hub.Register("all")

	event := Event{
		Type:     "SESSION_ADDED",
		OutletID: "outlet-1",
		Payload:  map[string]string{"id": "s-123"},
	}

	hub.Broadcast(event)

	select {
	case msg := <-c1.Send:
		if msg.Type != "SESSION_ADDED" {
			t.Errorf("c1 received wrong event: %+v", msg)
		}
	case <-time.After(500 * time.Millisecond):
		t.Errorf("c1 timeout waiting for event")
	}

	select {
	case msg := <-cAll.Send:
		if msg.Type != "SESSION_ADDED" {
			t.Errorf("cAll received wrong event: %+v", msg)
		}
	case <-time.After(500 * time.Millisecond):
		t.Errorf("cAll timeout waiting for event")
	}

	select {
	case <-c2.Send:
		t.Errorf("c2 should NOT receive outlet-1 event")
	default:
		// success
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server-go && go test ./internal/realtime/...`
Expected: FAIL

- [ ] **Step 3: Implement `event.go` and `hub.go`**

```go
// server-go/internal/realtime/event.go
package realtime

type Event struct {
	Type     string      `json:"type"`
	OutletID string      `json:"outletId"`
	Payload  interface{} `json:"payload"`
}

type Client struct {
	OutletID string
	Send     chan Event
}
```

```go
// server-go/internal/realtime/hub.go
package realtime

import "sync"

type Hub struct {
	clients    map[*Client]bool
	broadcast  chan Event
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan Event, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.Send)
			}
			h.mu.Unlock()
		case event := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				// Broadcast to clients in matching outlet or subscribed to "all"
				if client.OutletID == event.OutletID || client.OutletID == "all" || event.OutletID == "all" {
					select {
					case client.Send <- event:
					default:
						close(client.Send)
						delete(h.clients, client)
					}
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *Hub) Register(outletID string) *Client {
	c := &Client{
		OutletID: outletID,
		Send:     make(chan Event, 64),
	}
	h.register <- c
	return c
}

func (h *Hub) Unregister(client *Client) {
	h.unregister <- client
}

func (h *Hub) Broadcast(event Event) {
	h.broadcast <- event
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server-go && go test ./internal/realtime/... -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server-go/internal/realtime/
git commit -m "feat(backend-go): implement multi-room realtime SSE hub"
```

---

### Task 4: Implement HTTP Handlers, SSE Endpoint, and Router

**Files:**
- Create: `server-go/internal/handler/auth_handler.go`
- Create: `server-go/internal/handler/outlet_handler.go`
- Create: `server-go/internal/handler/session_handler.go`
- Create: `server-go/internal/handler/txn_handler.go`
- Create: `server-go/internal/handler/sse_handler.go`
- Create: `server-go/cmd/api/main.go`

**Interfaces:**
- Consumes: Chi router, Repositories, Realtime Hub
- Produces: REST API routes (`/api/outlets`, `/api/login`, `/api/sessions`, `/api/transactions`, `/api/stream`), HTTP middleware (CORS, Auth)

- [ ] **Step 1: Implement SSE Handler (`/api/stream`)**
- Implement `http.Flusher` streaming handler that subscribes client to `Hub` based on `?outlet_id=` query param.
- Send heartbeat comment (`: ping\n\n`) every 15 seconds to prevent client timeout.

- [ ] **Step 2: Implement REST API Endpoints with Realtime Triggering**
- Every mutating request (`POST /api/sessions`, `POST /api/claim`, etc.) triggers `hub.Broadcast(event)`.
- Support query filtering: `GET /api/transactions?outlet_id=all` vs `GET /api/transactions?outlet_id=outlet-1`.

- [ ] **Step 3: Wire Router and Entry point in `main.go`**
- Set up Chi router with CORS, JSON recovery, logger, and route groups.

- [ ] **Step 4: Build and verify compilation**

Run: `cd server-go && go build -o /dev/null cmd/api/main.go`
Expected: SUCCESS

- [ ] **Step 5: Commit**

```bash
git add server-go/internal/handler/ server-go/cmd/
git commit -m "feat(backend-go): implement REST handlers, SSE endpoint, and server entrypoint"
```

---

### Task 5: Setup Docker Compose & Production Dockerfiles

**Files:**
- Create: `server-go/Dockerfile`
- Create: `Dockerfile.frontend`
- Create: `nginx.conf`
- Create: `docker-compose.yml`

**Interfaces:**
- Consumes: Go source, React source, PostgreSQL container
- Produces: Unified container orchestration running on ports 3000 (Web + Reverse Proxy) and 5432 (Postgres)

- [ ] **Step 1: Create `server-go/Dockerfile`**
- Multi-stage build: `golang:1.22-alpine` builder -> `alpine:latest` runner (~20MB total image).

- [ ] **Step 2: Create `nginx.conf` and `Dockerfile.frontend`**
- Configures Nginx to serve static React build and reverse proxy `/api/stream` (with `proxy_buffering off;`) and `/api/` to `backend:8080`.

- [ ] **Step 3: Create `docker-compose.yml`**
- Configures `postgres`, `backend`, and `frontend` with network bridge and volume persistence.

- [ ] **Step 4: Validate docker compose config**

Run: `docker compose config`
Expected: SUCCESS (valid YAML syntax)

- [ ] **Step 5: Commit**

```bash
git add server-go/Dockerfile Dockerfile.frontend nginx.conf docker-compose.yml
git commit -m "feat(docker): configure multi-stage dockerfiles and docker-compose for go, postgres, and frontend"
```

---

### Task 6: Frontend Integration (Outlet Selector, SSE Stream Hook & Admin Multi-Outlet Filter)

**Files:**
- Create: `src/features/realtime/useRealtimeStream.js`
- Create: `src/features/realtime/__tests__/useRealtimeStream.test.js`
- Modify: `src/features/auth/components/LoginPage.jsx`
- Modify: `src/features/auth/components/RoleSelection.jsx`
- Modify: `src/components/DashboardTab.jsx`
- Modify: `src/features/transactions/components/HistoryTab.jsx`
- Modify: `src/api.js`

**Interfaces:**
- Consumes: `/api/outlets`, `/api/stream`, `EventSource`
- Produces: Realtime multi-outlet React state sync without 5s polling

- [ ] **Step 1: Write unit test for `useRealtimeStream`**

```javascript
// src/features/realtime/__tests__/useRealtimeStream.test.js
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRealtimeStream } from '../useRealtimeStream';

describe('useRealtimeStream', () => {
  it('subscribes to EventSource with active outlet_id', () => {
    const onEvent = vi.fn();
    const { unmount } = renderHook(() => useRealtimeStream('outlet-1', onEvent));
    expect(global.EventSource).toHaveBeenCalledWith(expect.stringContaining('outlet_id=outlet-1'));
    unmount();
  });
});
```

- [ ] **Step 2: Implement `useRealtimeStream` Hook**
- Handles `EventSource` connection, parses incoming JSON events, triggers callbacks, and auto-cleans on unmount.

- [ ] **Step 3: Update Login & Role Selection to Select Outlet**
- Fetch outlets from `/api/outlets` and let user choose active outlet upon login.

- [ ] **Step 4: Update Admin Dashboard & History Tabs**
- Add Outlet Filter Dropdown (`[Semua Outlet]`, `[Outlet Pusat]`, etc.) to view separate or aggregated revenue & transaction metrics.

- [ ] **Step 5: Run frontend test suite to ensure no regressions**

Run: `npm test`
Expected: PASS (All tests passing)

- [ ] **Step 6: Commit**

```bash
git add src/
git commit -m "feat(frontend): integrate multi-outlet selector, realtime SSE hook, and admin outlet filtering"
```

---

### Task 7: End-to-End Verification

**Files:**
- Test all components end-to-end (Docker build, DB connection, SSE stream, Multi-outlet isolation).

- [ ] **Step 1: Run Docker Compose Build & Start**
Run: `docker compose build && docker compose up -d`
Expected: All 3 containers (`kasir-postgres`, `kasir-go-api`, `kasir-web`) healthy and running.

- [ ] **Step 2: Test API and Realtime Stream Endpoint**
Run curl tests against `http://localhost:3000/api/outlets` and verify SSE heartbeat.

- [ ] **Step 3: Commit and update documentation**
```bash
git add README.md
git commit -m "docs: document docker compose setup and golang postgres realtime backend"
```
