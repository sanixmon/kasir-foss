# 📖 Operations & Reliability Runbook (Kasir FOSS)

This Runbook contains standard operating procedures (SOP), troubleshooting workflows, disaster recovery instructions, and maintenance tasks for the **Kasir FOSS** Point of Sale backend.

---

## 1. 🩺 Monitoring & Probes

| Endpoint | Probe Type | Description | Expected Status |
|---|---|---|---|
| `GET /health` | Liveness | Fast check confirming Go process is responsive & memory is healthy | `200 OK` |
| `GET /ready` | Readiness | Deep check verifying PostgreSQL database ping & connection pool | `200 OK` (or `503 Service Unavailable` if DB down) |
| `GET /api/stream` | Realtime SSE | Persistent event streaming scoped by outlet | `200 OK` (Event stream) |

### Health Check Commands:
```bash
# Plaintext liveness check
curl -fsS http://localhost:8080/health?format=plain

# Plaintext readiness check
curl -fsS http://localhost:8080/ready?format=plain

# Full JSON metrics inspection
curl -s http://localhost:8080/ready | jq .
```

---

## 2. 📜 Structured Logging & Troubleshooting

Logs are emitted in **JSON format** via standard library `log/slog` on `stdout`.

### Viewing Logs with Docker Compose:
```bash
# Stream backend logs
docker compose logs -f backend

# Filter error level logs
docker compose logs backend | jq 'select(.level=="ERROR")'

# Filter requests with latency > 50ms
docker compose logs backend | jq 'select(.duration_ms > 50)'
```

---

## 3. 💾 Automated Backup & Disaster Recovery

### Daily Automatic Backup:
The backup script generates timestamped, gzipped PostgreSQL dumps:
```bash
# Run manual backup
./scripts/backup.sh

# Custom destination and retention:
BACKUP_DIR=/custom/path RETENTION_DAYS=30 ./scripts/backup.sh
```

### Database Restore / Recovery:
```bash
# Restore from a backup archive
./scripts/restore.sh /var/backups/kasir-db/kasir_kasir_db_20260826_120000.sql.gz --force
```

---

## 4. 🛑 Graceful Shutdown & Deployments

When deploying updates or restarting the server (`SIGINT` or `SIGTERM`):
1. The backend automatically broadcasts a `SYSTEM_SHUTDOWN` event to all connected SSE clients.
2. Frontend clients gracefully show a reconnection state.
3. The server provides a **30-second drain period** allowing all in-flight financial transactions and checkouts to complete safely before the process terminates.

---

## 5. ⚙️ Connection Pool Configuration

Configured in `internal/database/postgres.go`:
- **MaxConns:** `50`
- **MinConns:** `5`
- **MaxConnLifetime:** `1 Hour`
- **MaxConnIdleTime:** `15 Minutes`
- **Transaction Isolation:** `REPEATABLE READ` for checkout and rental claims.
