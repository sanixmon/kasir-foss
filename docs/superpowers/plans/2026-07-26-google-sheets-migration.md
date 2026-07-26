# Google Sheets Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `kasir-trial` POS application from Supabase database & offline localStorage sync to a Google Sheets database powered by a Google Apps Script Web App backend with 5s polling.

**Architecture:** A standalone Google Apps Script (`Code.gs`) handles data requests with `LockService` for concurrency safety and `CacheService` for API efficiency. React client uses `src/api.js` to send HTTP POST requests and polls server data every 5 seconds.

**Tech Stack:** React, Vite, Google Apps Script, JavaScript (ES6+), Vitest/Jest for unit tests.

## Global Constraints

- Backend endpoint: Google Apps Script Web App (`doPost`)
- Database: Google Spreadsheet with `ActiveSessions`, `Transactions`, `Settings`, `Users` sheets
- Polling: 5 seconds interval in `App.jsx`
- Business logic: `ot.js` and `history.js` remain unchanged in frontend

---

### Task 1: Create Google Apps Script Backend Code (`docs/google-apps-script/Code.gs`)

**Files:**
- Create: `docs/google-apps-script/Code.gs`
- Create: `docs/google-apps-script/README.md`

**Interfaces:**
- Consumes: Google Sheets API / SpreadsheetApp, LockService, CacheService
- Produces: Web App `doPost(e)` accepting JSON payload `{ action, payload, token }` and returning JSON `{ success, ... }`

- [ ] **Step 1: Write Google Apps Script `Code.gs`**

```javascript
const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
const SHEET_SESSIONS = 'ActiveSessions';
const SHEET_TRANSACTIONS = 'Transactions';
const SHEET_SETTINGS = 'Settings';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || '{}');
    const action = data.action;
    const payload = data.payload || {};

    switch (action) {
      case 'fetch_data':
        return fetchAllData();
      case 'add_session':
        return addSession(payload);
      case 'edit_session':
        return editSession(payload);
      case 'claim_session':
        return claimSession(payload);
      case 'delete_session':
        return deleteSession(payload);
      default:
        return respond({ error: 'Invalid action: ' + action });
    }
  } catch (err) {
    return respond({ error: err.message });
  }
}

function fetchAllData() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('allData');
  if (cached) {
    return respond(JSON.parse(cached));
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sessSheet = ss.getSheetByName(SHEET_SESSIONS);
  const txnSheet = ss.getSheetByName(SHEET_TRANSACTIONS);

  const sessions = sessSheet ? parseSheetRows(sessSheet) : [];
  const transactions = txnSheet ? parseSheetRows(txnSheet) : [];

  const responseData = { sessions, transactions, serverTime: Date.now() };
  cache.put('allData', JSON.stringify(responseData), 4);
  return respond(responseData);
}

function addSession(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_SESSIONS);
    
    const today = payload.tanggal || new Date().toISOString().slice(0, 10);
    const rows = sheet.getDataRange().getValues().slice(1);
    const todayRows = rows.filter(r => String(r[4]).slice(0, 10) === today);
    const queueNo = todayRows.length + 1;
    
    const id = payload.id || Utilities.getUuid();
    const newRow = [
      id,
      payload.nama || 'Penyewa',
      JSON.stringify(payload.items || []),
      payload.startTime || Date.now(),
      today,
      queueNo,
      payload.payAwal || 'cash',
      new Date().toISOString()
    ];
    
    sheet.appendRow(newRow);
    CacheService.getScriptCache().remove('allData');
    return respond({ success: true, session: rowToSessionObj(newRow) });
  } finally {
    lock.releaseLock();
  }
}

function editSession(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_SESSIONS);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === payload.id) {
        if (payload.nama !== undefined) sheet.getRange(i + 1, 2).setValue(payload.nama);
        if (payload.items !== undefined) sheet.getRange(i + 1, 3).setValue(JSON.stringify(payload.items));
        if (payload.payAwal !== undefined) sheet.getRange(i + 1, 7).setValue(payload.payAwal);
        break;
      }
    }
    
    CacheService.getScriptCache().remove('allData');
    return respond({ success: true });
  } finally {
    lock.releaseLock();
  }
}

function claimSession(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sessSheet = ss.getSheetByName(SHEET_SESSIONS);
    const txnSheet = ss.getSheetByName(SHEET_TRANSACTIONS);
    
    if (payload.sessionId) {
      const sessData = sessSheet.getDataRange().getValues();
      for (let i = 1; i < sessData.length; i++) {
        if (sessData[i][0] === payload.sessionId) {
          sessSheet.deleteRow(i + 1);
          break;
        }
      }
    }
    
    const txnRows = txnSheet.getLastRow();
    const nextNo = txnRows > 1 ? Number(txnSheet.getRange(txnRows, 2).getValue()) + 1 : 1;
    
    const txnId = payload.id || Utilities.getUuid();
    const txnRow = [
      txnId,
      nextNo,
      payload.queueNo || 0,
      payload.nama || 'Penyewa',
      payload.tanggal || new Date().toISOString().slice(0, 10),
      payload.startTime || Date.now(),
      payload.endTime || Date.now(),
      typeof payload.items === 'string' ? payload.items : JSON.stringify(payload.items || []),
      payload.ot || '-',
      payload.otDur || '-',
      payload.totalBase || 0,
      payload.totalOT || 0,
      payload.totalTol || 0,
      payload.grandTotal || 0,
      payload.totalAll || 0,
      payload.payAwal || 'cash',
      payload.cash || 0,
      payload.qris || 0,
      payload.shift || '-'
    ];
    
    txnSheet.appendRow(txnRow);
    CacheService.getScriptCache().remove('allData');
    return respond({ success: true, transaction: rowToTxnObj(txnRow) });
  } finally {
    lock.releaseLock();
  }
}

function deleteSession(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_SESSIONS);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === payload.id) {
        sheet.deleteRow(i + 1);
        break;
      }
    }
    
    CacheService.getScriptCache().remove('allData');
    return respond({ success: true });
  } finally {
    lock.releaseLock();
  }
}

function parseSheetRows(sheet) {
  const name = sheet.getName();
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];
  const body = rows.slice(1);
  if (name === SHEET_SESSIONS) return body.map(rowToSessionObj);
  if (name === SHEET_TRANSACTIONS) return body.map(rowToTxnObj);
  return [];
}

function rowToSessionObj(r) {
  let items = [];
  try { items = typeof r[2] === 'string' ? JSON.parse(r[2]) : r[2]; } catch (e) {}
  return {
    id: r[0],
    nama: r[1],
    items: items,
    startTime: Number(r[3]),
    tanggal: r[4],
    queueNo: Number(r[5]),
    payAwal: r[6]
  };
}

function rowToTxnObj(r) {
  let items = [];
  try { items = typeof r[7] === 'string' ? JSON.parse(r[7]) : r[7]; } catch (e) {}
  return {
    id: r[0],
    no: Number(r[1]),
    queueNo: Number(r[2]),
    nama: r[3],
    tanggal: r[4],
    startTime: Number(r[5]),
    endTime: Number(r[6]),
    items: items,
    ot: r[8],
    otDur: r[9],
    totalBase: Number(r[10]),
    totalOT: Number(r[11]),
    totalTol: Number(r[12]),
    grandTotal: Number(r[13]),
    totalAll: Number(r[14]),
    payAwal: r[15],
    cash: Number(r[16]),
    qris: Number(r[17]),
    shift: r[18]
  };
}

function respond(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
```

- [ ] **Step 2: Write setup instructions in `docs/google-apps-script/README.md`**

Create markdown file with instructions on creating Google Sheet, naming tabs, deploying as Web App (Execute as: Me, Access: Anyone).

- [ ] **Step 3: Commit Task 1**

```bash
git add docs/google-apps-script/
git commit -m "feat(gas): add Google Apps Script backend script and setup documentation"
```

---

### Task 2: Create React API Layer (`src/api.js`) and Unit Tests

**Files:**
- Create: `src/api.js`
- Create: `src/__tests__/api.test.js`

**Interfaces:**
- Consumes: Google Apps Script Web App Endpoint (`APPS_SCRIPT_URL`)
- Produces: `fetchAllData()`, `addSession(sessionData)`, `editSession(sessionData)`, `claimSession(checkoutData)`, `deleteSession(sessionId)`

- [ ] **Step 1: Write failing unit test `src/__tests__/api.test.js`**

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchAllData, addSession, claimSession, setApiUrl } from '../api';

describe('Apps Script API Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setApiUrl('https://script.google.com/test/exec');
  });

  it('fetchAllData performs POST request with fetch_data action', async () => {
    const mockData = { sessions: [], transactions: [], serverTime: 123456789 };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockData
    });

    const result = await fetchAllData();
    expect(global.fetch).toHaveBeenCalledWith('https://script.google.com/test/exec', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ action: 'fetch_data', payload: {} })
    }));
    expect(result).toEqual(mockData);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test` or `npx vitest run src/__tests__/api.test.js`  
Expected: FAIL ("Cannot find module '../api'")

- [ ] **Step 3: Create `src/api.js` implementation**

```javascript
let APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL || 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec';

export function setApiUrl(url) {
  APPS_SCRIPT_URL = url;
}

export async function apiCall(action, payload = {}) {
  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({ action, payload })
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`API call failed for action ${action}:`, error);
    throw error;
  }
}

export const fetchAllData = () => apiCall('fetch_data');
export const addSession = (data) => apiCall('add_session', data);
export const editSession = (data) => apiCall('edit_session', data);
export const claimSession = (data) => apiCall('claim_session', data);
export const deleteSession = (id) => apiCall('delete_session', { id });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/api.test.js`  
Expected: PASS

- [ ] **Step 5: Commit Task 2**

```bash
git add src/api.js src/__tests__/api.test.js
git commit -m "feat(api): create Google Apps Script API client with vitest unit test"
```

---

### Task 3: Refactor `src/App.jsx` to Use Apps Script API & 5s Polling

**Files:**
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `src/api.js` (`fetchAllData`, `addSession`, `editSession`, `claimSession`, `deleteSession`)
- Produces: Polled React state for `activeSessions` & `transactions`, connection status indicator.

- [ ] **Step 1: Update `src/App.jsx` imports**

Remove Supabase & sync imports:
```javascript
// REMOVE: import { sb } from './supabase';
// REMOVE: import { mergeSyncData, ... } from './lib/sync';

// ADD:
import { fetchAllData, addSession, editSession, claimSession, deleteSession } from './api';
```

- [ ] **Step 2: Implement polling & data loading state in `App.jsx`**

Add `apiConnected` state and `useEffect` for 5s polling:
```javascript
const [apiConnected, setApiConnected] = useState(true);
const [isSyncing, setIsSyncing] = useState(false);

const loadData = async () => {
  try {
    setIsSyncing(true);
    const data = await fetchAllData();
    if (data && !data.error) {
      if (Array.isArray(data.sessions)) setActiveSessions(data.sessions);
      if (Array.isArray(data.transactions)) setTransactions(data.transactions);
      setApiConnected(true);
    }
  } catch (err) {
    console.error('Polling error:', err);
    setApiConnected(false);
  } finally {
    setIsSyncing(false);
  }
};

useEffect(() => {
  loadData();
  const interval = setInterval(loadData, 5000);
  return () => clearInterval(interval);
}, []);
```

- [ ] **Step 3: Update session & checkout handlers in `App.jsx`**

Replace local/Supabase mutations in `handleStartSession`, `handleCheckout`, `handleSaveEditSession`, and session delete with `addSession`, `claimSession`, `editSession`, and `deleteSession`.

- [ ] **Step 4: Run build check**

Run: `npm run build` or `npx vite build`  
Expected: Clean build without errors.

- [ ] **Step 5: Commit Task 3**

```bash
git add src/App.jsx
git commit -m "refactor(app): replace Supabase and offline sync with Google Apps Script API polling"
```

---

### Task 4: Cleanup Obsolete Supabase Files & Update Tests

**Files:**
- Delete: `src/supabase.js`
- Delete: `src/lib/sync.js`
- Delete: `src/__tests__/sync.test.js`
- Delete: `src/__tests__/worst-cases.test.js`

- [ ] **Step 1: Delete obsolete files**

```bash
rm src/supabase.js src/lib/sync.js src/__tests__/sync.test.js src/__tests__/worst-cases.test.js
```

- [ ] **Step 2: Run full test suite & build check**

Run: `npm test` and `npm run build`  
Expected: All remaining tests pass, clean production build.

- [ ] **Step 3: Commit Task 4**

```bash
git add -A
git commit -m "chore(cleanup): remove obsolete Supabase client and sync module files"
```
