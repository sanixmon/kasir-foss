# Spesifikasi Desain: Backend Golang, PostgreSQL Realtime Stream & Multi-Outlet

**Tanggal:** 2026-08-26  
**Status:** Approved by User  
**Target:** Arsitektur Baru Backend Go + PostgreSQL + Realtime SSE + Multi-Outlet + Docker Compose

---

## 1. Ringkasan & Tujuan

Membangun backend baru berbasis **Golang** dengan database **PostgreSQL** lokal yang dijalankan secara terpadu melalui **Docker Compose** (PostgreSQL, Go Backend, dan React Frontend via Nginx).

### Fitur Utama:
1. **Realtime Stream (Server-Sent Events / SSE)**: Menggantikan polling 5 detik dengan stream realtime satu arah berkecepatan tinggi dan auto-reconnect bawaan browser.
2. **Multi-Outlet Multi-Tenancy**:
   - Pemisahan data sesi aktif, riwayat transaksi, pengaturan, dan revenue per outlet.
   - Kasir memilih outlet saat login dan bekerja pada lingkup outlet tersebut.
   - Admin dapat memantau dashboard per outlet secara terpisah atau melihat agregasi seluruh outlet (Semua Cabang).
3. **Full Docker Compose**:
   - `postgres` (PostgreSQL 16) dengan persistent volume dan inisialisasi skema otomatis.
   - `backend` (Go API + SSE Hub, lightweight binary).
   - `frontend` (React + Nginx reverse proxy ke backend).

---

## 2. Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Compose Network                   │
│                                                             │
│  ┌────────────────┐       ┌───────────────┐                 │
│  │   frontend     │       │    backend    │                 │
│  │ (React+Nginx)  │──────>│ (Golang API & │                 │
│  │   Port: 3000   │       │   SSE Hub)    │                 │
│  └────────────────┘       │   Port: 8080  │                 │
│         │                 └───────┬───────┘                 │
│         │                         │ (pgxpool)               │
│         │                         ▼                         │
│         │                 ┌───────────────┐                 │
│         │                 │   postgres    │                 │
│         │                 │ (Postgres 16) │                 │
│         │                 │   Port: 5432  │                 │
│         │                 └───────────────┘                 │
└─────────┼───────────────────────────────────────────────────┘
          │
    Browser Client (Kasir & Admin)
    - SSE Stream: /api/stream?outlet_id=...
    - REST Endpoints: /api/...
```

---

## 3. Desain Database (PostgreSQL)

### 3.1 Skema Tabel

```sql
-- 1. Master Outlets
CREATE TABLE IF NOT EXISTS outlets (
    id VARCHAR(64) PRIMARY KEY,
    nama VARCHAR(128) NOT NULL,
    alamat TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Users / Kasir
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(64) UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role VARCHAR(32) NOT NULL,        -- 'admin' | 'cashier'
    outlet_id VARCHAR(64) REFERENCES outlets(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Active Rental Sessions (Per Outlet)
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

-- 4. Transactions (Per Outlet)
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

-- 5. Settings (Per Outlet / Global)
CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(64) NOT NULL,
    outlet_id VARCHAR(64) DEFAULT 'global',
    value TEXT,
    PRIMARY KEY (key, outlet_id)
);

-- 6. Deletion Logs
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

-- 7. Auth Tokens (Multi-outlet session tokens)
CREATE TABLE IF NOT EXISTS auth_tokens (
    token VARCHAR(128) PRIMARY KEY,
    username VARCHAR(64),
    role VARCHAR(32),
    outlet_id VARCHAR(64),
    expires_at BIGINT,
    ttl_ms BIGINT
);

-- Indeks untuk query performa tinggi
CREATE INDEX IF NOT EXISTS idx_active_sessions_outlet ON active_sessions(outlet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_outlet_tanggal ON transactions(outlet_id, tanggal);
```

---

## 4. Arsitektur Backend Go (`server-go/`)

### 4.1 Struktur Direktori
```
server-go/
├── cmd/
│   └── api/
│       └── main.go
├── internal/
│   ├── config/
│   │   └── config.go
│   ├── database/
│   │   ├── postgres.go
│   │   └── schema.sql
│   ├── realtime/
│   │   ├── hub.go            # Room multiplexer & Goroutine event dispatcher
│   │   └── event.go
│   ├── model/
│   │   └── models.go
│   ├── repository/
│   │   ├── outlet_repo.go
│   │   ├── session_repo.go
│   │   ├── txn_repo.go
│   │   └── user_repo.go
│   └── handler/
│       ├── auth_handler.go
│       ├── outlet_handler.go
│       ├── session_handler.go
│       ├── txn_handler.go
│       └── sse_handler.go
├── Dockerfile
├── go.mod
└── go.sum
```

### 4.2 SSE Realtime Hub Mechanism
* `Hub` mengelola map client terhubung berdasarkan `outlet_id` dan room `'all'`.
* Setiap ada perubahan data (mutasi) di handler Go:
  1. Eksekusi database transaction di PostgreSQL.
  2. Broadcast event:
     ```go
     hub.Broadcast(realtime.Event{
         Type:     "SESSION_UPDATED",
         OutletID: "outlet-1",
         Payload:  sessionData,
     })
     ```
  3. Client yang subscribe ke `outlet_id=outlet-1` dan `outlet_id=all` langsung menerima push pesan via SSE.

---

## 5. Docker Compose & Deployment

### 5.1 Service Definitions
* **`postgres`**:
  * PostgreSQL 16 Alpine.
  * Volume persistent `pgdata`.
  * Auto seed default outlet & admin user saat start pertama kali.
* **`backend`**:
  * Multi-stage build Go (Alpine/Scratch), target port `8080`.
  * Menghubungkan ke `postgres:5432`.
* **`frontend`**:
  * Multi-stage build (Node build Vite -> Nginx Alpine).
  * Reverse proxy konfigurasi:
    - `/api/stream` -> `http://backend:8080/api/stream` (dengan `proxy_buffering off;` untuk SSE).
    - `/api/` -> `http://backend:8080/api/`.
    - `/*` -> `index.html`.

---

## 6. Integrasi Frontend (React)

1. **Role & Outlet Selection**:
   - Mengambil daftar outlet aktif via `/api/outlets`.
   - Kasir memilih outlet saat login; token auth mengikat sesi ke outlet tersebut.
2. **Realtime Hook (`useRealtimeStream`)**:
   - Berlangganan ke `/api/stream?outlet_id=<active_outlet_id>`.
   - Mengupdate state lokal tanpa polling HTTP.
3. **Admin Dashboard Multi-Outlet**:
   - Filter dropdown: `[Semua Outlet]` atau spesifik `[Cabang A]`, `[Cabang B]`.
   - Menghitung breakdown omzet per outlet dan total omzet gabungan.
