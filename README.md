# 🛴 Kasir DB — Multi-Outlet Scooter & Stroller Rental POS System ⚡

[![Go Test](https://img.shields.io/badge/Go%20Backend-passing-brightgreen.svg)](server-go/)
[![Vitest](https://img.shields.io/badge/Vitest-140%20passed-brightgreen.svg)](src/)
[![React](https://img.shields.io/badge/React-19.0-61dafb.svg)](https://react.dev/)
[![Go](https://img.shields.io/badge/Go-1.22+-00ADD8.svg)](https://go.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1.svg)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED.svg)](docker-compose.yml)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A high-performance, real-time **Point of Sale (POS) & Rental Tracking System** designed for multi-outlet scooter, stroller, and equipment rental operations. Powered by a **Golang 1.22+ backend, PostgreSQL 16 database, Server-Sent Events (SSE) real-time streaming, and a responsive React 19 frontend** (with full backward compatibility for legacy Google Apps Script / Sheets deployment).

---

## ✨ Key Features

### 🏢 Multi-Outlet Architecture & Isolation
- **Tenant Isolation:** Every transaction, active session, cashier user, and outlet-specific configuration is scoped strictly by `outlet_id`.
- **Outlet Switcher & Management:** Seamlessly manage multiple branches/outlets from an administrative dashboard.
- **Role-Based Access Control:** Separate roles for Cashiers and Administrators with bcrypt password hashing and token-based escalation.

### ⚡ Real-Time Synchronization via Server-Sent Events (SSE)
- **Instant Client Broadcasts:** Instant synchronization across multiple cashiers and customer screens via `/api/stream?outlet_id=<outlet_id>`.
- **Zero Refresh Required:** Active rentals, checkout claims, and deletions reflect instantly across all connected terminals.
- **Heartbeat Keep-Alive:** Automated 15-second heartbeat ensures resilient connection management and auto-reconnect.

### ⏱️ Live Rental Tracking & Precise Overtime (OT) Engine
- **Real-Time Duration Timers:** Displays elapsed time for all active rentals with visual status badges (*Normal*, *Overtime*, *Grace Period*, and *Zombie Session* warning > 8 hrs).
- **Mathematical Grace Period:** Configurable 10-minute 59-second grace period before applying overtime penalties.
- **Tiered Overtime Calculation:** Automatically computes Half-Hour OT (11–40 mins) and Full-Hour OT (41–60 mins) across single or multi-hour overdue durations.
- **Manual Adjustments & Tolerances:** Cashiers can adjust or waive overtime items directly during checkout.

### 🔄 Dynamic Partial Returns & Split Billing
- Supports partial returns for group rentals (e.g., returning 1 scooter out of 3 rented).
- Calculates exact overtime and base costs for returned items while keeping the remaining items active on the rental timer.

### 🌅 Shift & Rollover Management
- **Deterministic 6 AM Shift Rollover:** Late-night transactions (00:00–05:59 AM) are automatically grouped into the correct shift date.
- **Daily Queue Numbering:** Automated queue numbering per shift day and outlet.

### 🧾 QR Code Receipts & Thermal Printing
- **Live Customer Tracking:** Generates shareable QR codes linked to live customer-facing tracking pages (`#track/<id>`).
- **Print Receipt Ready:** Instant HTML formatting tailored for thermal receipt printers (Start Receipt & Completion Receipt).

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19 + Vite 6 + Nginx (Docker) |
| **Backend API** | Golang 1.22+ (`net/http`, standard library + pgx/v5) |
| **Database** | PostgreSQL 16 (JSONB columns for item breakdowns) |
| **Realtime Engine** | Server-Sent Events (SSE) Pub/Sub Hub with outlet channel isolation |
| **Containerization** | Docker + Docker Compose multi-stage builds |
| **Testing** | Vitest + React Testing Library (140 tests) & Go Standard Tests |
| **Legacy Compatibility** | Google Apps Script (GAS) fallback mode supported |

---

## 🚀 Quick Start with Docker Compose

The fastest way to spin up the full production-ready stack (PostgreSQL, Go API Backend, and React Frontend via Nginx reverse proxy):

### 1. Start All Services
```bash
docker compose up --build -d
```

This starts:
- **`kasir-postgres`**: PostgreSQL database on `localhost:5432` with auto-migration schema.
- **`kasir-backend`**: Go REST API & SSE Server on `localhost:8080`.
- **`kasir-frontend`**: Nginx serving production React app + `/api` proxy on `http://localhost:3000`.

### 2. Verify Services
```bash
# Check status of containers
docker compose ps

# View API logs
docker compose logs -f backend
```

### 3. Stop All Services
```bash
docker compose down
```
*(Add `-v` flag if you want to wipe PostgreSQL database volumes: `docker compose down -v`)*

---

## 💻 Local Development Setup (Standalone)

### Prerequisites
- **Go**: 1.22 or higher
- **Node.js**: v18.0.0 or higher (`pnpm` recommended)
- **PostgreSQL**: 16 (or run PostgreSQL via Docker)

### 1. Start PostgreSQL
```bash
# You can run postgres via docker compose:
docker compose up postgres -d
```

### 2. Run Go Backend Standalone
```bash
cd server-go
export DATABASE_URL="postgres://kasir:kasir_password@localhost:5432/kasir_db?sslmode=disable"
export PORT="8080"
go run cmd/api/main.go
```
The Go API will automatically connect to PostgreSQL, apply all database migrations and default seed data, and start listening on `http://localhost:8080`.

### 3. Run React Frontend Standalone
```bash
# In the root repository directory:
pnpm install
pnpm dev
```
Open `http://localhost:5173` in your browser.

---

## 🧪 Running Tests

### Run Go Backend Unit & Integration Tests
```bash
cd server-go
go test -v ./...
```

### Run React Frontend Vitest Suite
```bash
npm test
```

---

## 📡 API & Realtime SSE Stream Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/stream?outlet_id=:id` | Real-time SSE stream for active sessions and updates |
| `GET` | `/api/outlets` | List all active outlets |
| `POST` | `/api/outlets` | Create or update outlet |
| `GET` | `/api/sessions?outlet_id=:id` | Fetch active rental sessions |
| `POST` | `/api/sessions` | Create new rental session (Broadcasts via SSE) |
| `DELETE` | `/api/sessions/:id` | Cancel/delete session (Broadcasts via SSE) |
| `POST` | `/api/claim` | Atomic rental return & settlement (Broadcasts via SSE) |
| `GET` | `/api/transactions?outlet_id=:id&tanggal=:date` | Query completed transactions |
| `GET` | `/api/track/:id` | Public customer-facing tracking data |
| `GET` | `/api/settings?outlet_id=:id` | Get outlet configuration |
| `POST` | `/api/settings` | Save outlet configuration |
| `POST` | `/api/auth/login` | Authenticate cashier / admin |
| `POST` | `/api/auth/verify-admin` | Admin privilege verification / escalation |

---

## ⚙️ Google Apps Script (Legacy Deployment)

If deploying to a serverless Google Sheets environment without Docker:
1. Open your Google Sheet (`ActiveSessions`, `Transactions`, `Users`, `Settings`).
2. Go to **Extensions > Apps Script** and copy the code in [`docs/google-apps-script/Code.gs`](docs/google-apps-script/Code.gs).
3. Deploy as Web App and configure the URL in the settings panel.

---

## 📁 Repository Structure

```
kasir-db/
├── docker-compose.yml          # Full stack Docker compose configuration
├── Dockerfile.frontend         # Multi-stage Nginx build for React app
├── nginx.conf                  # Nginx proxy routing to frontend and backend
├── server-go/                  # High-performance Golang backend
│   ├── cmd/api/main.go         # API entrypoint, router, and graceful shutdown
│   ├── internal/
│   │   ├── config/             # Environment & configuration loader
│   │   ├── handler/            # HTTP & SSE stream handlers
│   │   ├── model/              # Domain models, types & shift calculations
│   │   ├── realtime/           # Thread-safe SSE Pub/Sub Hub
│   │   └── repository/         # PostgreSQL persistence & atomic transactions
│   ├── migrations/             # Schema initialization & migration SQL
│   └── Dockerfile              # Production Go Alpine container
├── src/                        # React 19 Frontend
│   ├── features/               # Modular features (auth, pos, rentals, history, settings)
│   ├── components/             # Reusable UI components
│   └── __tests__/              # Comprehensive Vitest test suite
└── README.md
```

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
