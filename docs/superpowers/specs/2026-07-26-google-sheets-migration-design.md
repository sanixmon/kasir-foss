# Design Spec: Google Sheets + Apps Script Migration for kasir-trial

**Date:** 2026-07-26  
**Status:** Approved  
**Target:** Replace Supabase database & offline-first localStorage sync engine with a Google Sheets database powered by a Google Apps Script (GAS) Web App backend.

---

## 1. Overview & Goals

The `kasir-trial` POS application currently uses Supabase (PostgreSQL + Realtime) paired with a complex `localStorage` sync engine (`src/lib/sync.js`). This design replaces Supabase and the offline-first sync engine with:
1. **Google Sheets** as the centralized flat-file database.
2. **Google Apps Script Web App (`Code.gs`)** acting as the serverless REST-like API gateway handling atomic locks and sheet read/writes.
3. **HTTP Polling** (every 3–5 seconds) from the React client to synchronize active sessions and transactions across cashier terminals.

---

## 2. Architecture & System Flow

```
+-------------------------------------------------------------------+
|                        Client Browser (React)                     |
|  +---------------------+   +----------------------------------+  |
|  |  React Components   |   |   Polling Service (5s interval)  |  |
|  +----------+----------+   +----------------+-----------------+  |
+-------------|-------------------------------+---------------------+
              | (Actions: add, claim, etc.)   | (fetch_data)
              v                               v
+-------------------------------------------------------------------+
|               Google Apps Script Web App (Code.gs)                |
|  +--------------------+  +-------------------+  +---------------+ |
|  |   doPost Entrypoint|  | LockService (Mutex|  | CacheService  | |
|  +---------+----------+  +---------+---------+  +-------+-------+ |
+------------|-----------------------|--------------------|---------+
             v                       v                    v
+-------------------------------------------------------------------+
|                      Google Spreadsheet Data                      |
|  +-------------------+  +------------------+  +---------------+  |
|  |  ActiveSessions   |  |   Transactions   |  | Settings/Users|  |
|  +-------------------+  +------------------+  +---------------+  |
+-------------------------------------------------------------------+
```

---

## 3. Spreadsheet Data Schema

Spreadsheet name: `kasir-db` (4 Sheet tabs)

### 3.1 Tab: `ActiveSessions`
| Column Index | Column Name | Data Type | Description |
|---|---|---|---|
| A | `id` | string (UUID) | Unique session ID |
| B | `nama` | string | Renter name |
| C | `items` | string (JSON) | Array of items `[{"code": "...", "qty": 1}]` |
| D | `start_time` | number | Start time timestamp in milliseconds |
| E | `tanggal` | string | Date in `YYYY-MM-DD` |
| F | `queue_no` | number | Daily queue sequence number |
| G | `pay_awal` | string | Initial payment method (`cash` / `qris`) |
| H | `created_at` | string | ISO timestamp |

### 3.2 Tab: `Transactions`
| Column Index | Column Name | Data Type | Description |
|---|---|---|---|
| A | `id` | string (UUID) | Transaction ID |
| B | `no` | number | Transaction sequence number |
| C | `queue_no` | number | Daily queue number |
| D | `nama` | string | Renter name |
| E | `tanggal` | string | Date `YYYY-MM-DD` |
| F | `start_time` | number | Start timestamp ms |
| G | `end_time` | number | End timestamp ms |
| H | `items` | string (JSON) | Rented items JSON |
| I | `ot` | string | Overtime label |
| J | `ot_dur` | string | Overtime duration string |
| K | `total_base` | number | Base rate total |
| L | `total_ot` | number | Overtime total |
| M | `total_tol` | number | Tolerance total |
| N | `grand_total` | number | Subtotal + OT |
| O | `total_all` | number | Total payment |
| P | `pay_awal` | string | Base payment method |
| Q | `cash` | number | Cash amount paid |
| R | `qris` | number | QRIS amount paid |
| S | `shift` | string | Shift identifier |

### 3.3 Tab: `Settings`
Key-value store (`Key` in Col A, `Value` in Col B).
- `admin_password`: hashed/plain admin password
- `shift_config`: JSON string for shift settings

### 3.4 Tab: `Users`
- `username` (Col A), `password` (Col B), `role` (Col C)

---

## 4. Google Apps Script Backend (`Code.gs`)

### Key Operations
- **`doPost(e)`**: Central router parsing `{ action, payload, token }`.
- **Atomic Locks**: All write operations wrap Sheet updates inside `lock.waitLock(10000)` and call `lock.releaseLock()`.
- **Cache Management**: `CacheService.getScriptCache()` caches `fetchAllData` JSON for 4 seconds to protect Google API quotas during multi-client polling.

### Actions API Matrix
1. `fetch_data`: Returns `{ sessions: [...], transactions: [...], serverTime: Date.now() }`.
2. `add_session`: Generates daily `queue_no`, appends row to `ActiveSessions`, invalidates cache.
3. `edit_session`: Finds row by `id` in `ActiveSessions`, updates `nama`, `pay_awal`, `items`, invalidates cache.
4. `claim_session`: Removes session from `ActiveSessions` (or updates if partial), calculates next transaction `no`, appends row to `Transactions`, invalidates cache.
5. `delete_session`: Removes row from `ActiveSessions`, invalidates cache.

---

## 5. React Frontend Architecture

### 5.1 API Client (`src/api.js`)
Centralized HTTP client executing POST requests to `APPS_SCRIPT_URL`.

### 5.2 App.jsx Modifications
1. **Remove Supabase & Offline Sync**:
   - Delete `src/supabase.js` and `src/lib/sync.js`.
   - Remove `safeSetItem`, `mergeSyncData`, `cleanZombieSessions`, and Supabase Realtime channel subscriptions.
2. **Polling Engine**:
   - `useEffect` running every 5 seconds executing `fetchAllData()`.
   - UI status indicator showing connection state (`Online`, `Syncing`, `Offline/Error`).
3. **Preserve Business Logic**:
   - `src/lib/ot.js` and `src/lib/history.js` remain intact for frontend calculations.

---

## 6. Migration Sequence & Verification

1. **GAS Code Generation**: Provide complete `Code.gs` script for deployment.
2. **Frontend Layer (`src/api.js`)**: Create standalone API wrapper.
3. **App.jsx Refactoring**: Replace all Supabase operations with `api.js` calls + add polling.
4. **Cleanup & Verification**: Remove obsolete files, verify build with `npm run build` or Vite build tool.
