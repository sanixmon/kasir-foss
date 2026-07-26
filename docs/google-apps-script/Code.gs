let SPREADSHEET_ID = '1WEFm1wjTdFXedMPyKw521COQCKjj5PQxPvHAITiCczI';
try {
  const activeId = SpreadsheetApp.getActiveSpreadsheet().getId();
  if (activeId) SPREADSHEET_ID = activeId;
} catch (e) {
  // Menggunakan Spreadsheet ID yang disediakan user jika Standalone Script
}

const SHEET_SESSIONS = 'ActiveSessions';
const SHEET_TRANSACTIONS = 'Transactions';
const SHEET_SETTINGS = 'Settings';

function doGet(e) {
  return fetchAllData();
}

function doPost(e) {
  try {
    let contents = '{}';
    if (e && e.postData && e.postData.contents) {
      contents = e.postData.contents;
    }
    const data = JSON.parse(contents);
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
    return respond({ error: String(err && err.message ? err.message : err) });
  }
}

function getOrCreateSheet(ss, name, defaultHeaders) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (defaultHeaders && defaultHeaders.length > 0) {
      sheet.appendRow(defaultHeaders);
    }
  }
  return sheet;
}

function fetchAllData() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('allData');
  if (cached) {
    return respond(JSON.parse(cached));
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sessSheet = getOrCreateSheet(ss, SHEET_SESSIONS, ['id', 'nama', 'items', 'start_time', 'tanggal', 'queue_no', 'pay_awal', 'created_at']);
  const txnSheet = getOrCreateSheet(ss, SHEET_TRANSACTIONS, ['id', 'no', 'queue_no', 'nama', 'tanggal', 'start_time', 'end_time', 'items', 'ot', 'ot_dur', 'total_base', 'total_ot', 'total_tol', 'grand_total', 'total_all', 'pay_awal', 'cash', 'qris', 'shift']);

  const sessions = parseSheetRows(sessSheet);
  const transactions = parseSheetRows(txnSheet);

  const responseData = { sessions, transactions, serverTime: Date.now() };
  cache.put('allData', JSON.stringify(responseData), 4);
  return respond(responseData);
}

function generateShortId(prefix) {
  return prefix + '-' + Math.random().toString(36).substring(2, 8);
}

function formatDateTime(val) {
  if (!val) return '';
  const d = (typeof val === 'number') ? new Date(val) : new Date(String(val));
  if (isNaN(d.getTime())) return String(val);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const date = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${date} ${hh}:${mm}:${ss}`;
}

function parseTimestamp(val) {
  if (!val) return Date.now();
  if (typeof val === 'number') return val;
  if (val instanceof Date) return val.getTime();
  if (typeof val === 'string') {
    const num = Number(val);
    if (!isNaN(num) && num > 0) return num;
    const parsed = Date.parse(val);
    if (!isNaN(parsed)) return parsed;
  }
  return Date.now();
}

function formatTanggal(val) {
  if (!val) return new Date().toISOString().slice(0, 10);
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(val).slice(0, 10);
}

function formatItemsSummary(items) {
  if (!items) return '-';
  if (typeof items === 'string') {
    try {
      const parsed = JSON.parse(items);
      if (Array.isArray(parsed)) return parsed.map(i => `${i.code}×${i.qty}`).join(', ');
    } catch (e) {}
    return items;
  }
  if (Array.isArray(items)) {
    return items.map(i => `${i.code}×${i.qty}`).join(', ');
  }
  return String(items);
}

function parseItems(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {}
    return val.split(',').map(part => {
      const p = part.trim();
      const match = p.match(/^(.+?)(?:[x×](\d+))?$/i);
      if (match) {
        return { code: match[1].trim(), qty: Number(match[2] || 1) };
      }
      return { code: p, qty: 1 };
    });
  }
  return [];
}

function addSession(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = getOrCreateSheet(ss, SHEET_SESSIONS, ['id', 'nama', 'items', 'start_time', 'tanggal', 'queue_no', 'pay_awal', 'created_at']);
    
    const today = payload.tanggal || new Date().toISOString().slice(0, 10);
    const lastRow = sheet.getLastRow();
    const rows = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 8).getValues() : [];
    const todayRows = rows.filter(r => String(r[4]).slice(0, 10) === today);
    const queueNo = todayRows.length + 1;
    
    const id = payload.id || generateShortId('s');
    const startTimeMs = payload.startTime || Date.now();
    const itemsSummary = formatItemsSummary(payload.items || []);
    
    const newRow = [
      id,
      payload.nama || 'Penyewa',
      itemsSummary,
      formatDateTime(startTimeMs),
      today,
      queueNo,
      payload.payAwal || 'cash',
      formatDateTime(Date.now())
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
    const sheet = getOrCreateSheet(ss, SHEET_SESSIONS, ['id', 'nama', 'items', 'start_time', 'tanggal', 'queue_no', 'pay_awal', 'created_at']);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(payload.id)) {
        if (payload.nama !== undefined) sheet.getRange(i + 1, 2).setValue(payload.nama);
        if (payload.items !== undefined) {
          sheet.getRange(i + 1, 3).setValue(formatItemsSummary(payload.items));
        }
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
    const sessSheet = getOrCreateSheet(ss, SHEET_SESSIONS, ['id', 'nama', 'items', 'start_time', 'tanggal', 'queue_no', 'pay_awal', 'created_at']);
    const txnSheet = getOrCreateSheet(ss, SHEET_TRANSACTIONS, ['id', 'no', 'queue_no', 'nama', 'tanggal', 'start_time', 'end_time', 'items', 'ot', 'ot_dur', 'total_base', 'total_ot', 'total_tol', 'grand_total', 'total_all', 'pay_awal', 'cash', 'qris', 'shift']);
    
    if (payload.sessionId) {
      const sessData = sessSheet.getDataRange().getValues();
      for (let i = 1; i < sessData.length; i++) {
        if (String(sessData[i][0]) === String(payload.sessionId)) {
          sessSheet.deleteRow(i + 1);
          break;
        }
      }
    }
    
    const txnRows = txnSheet.getLastRow();
    const nextNo = txnRows > 1 ? Number(txnSheet.getRange(txnRows, 2).getValue()) + 1 : 1;
    
    const txnId = payload.id || generateShortId('t');
    const startTimeMs = payload.startTime || Date.now();
    const endTimeMs = payload.endTime || Date.now();
    const itemsSummary = formatItemsSummary(payload.items || []);
    
    const txnRow = [
      txnId,
      nextNo,
      payload.queueNo || 0,
      payload.nama || 'Penyewa',
      payload.tanggal || new Date().toISOString().slice(0, 10),
      formatDateTime(startTimeMs),
      formatDateTime(endTimeMs),
      itemsSummary,
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
    const sheet = getOrCreateSheet(ss, SHEET_SESSIONS, ['id', 'nama', 'items', 'start_time', 'tanggal', 'queue_no', 'pay_awal', 'created_at']);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(payload.id)) {
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
  return {
    id: String(r[0]),
    nama: String(r[1]),
    items: parseItems(r[2]),
    startTime: parseTimestamp(r[3]),
    tanggal: formatTanggal(r[4]),
    queueNo: Number(r[5] || 0),
    payAwal: String(r[6] || 'cash')
  };
}

function rowToTxnObj(r) {
  return {
    id: String(r[0]),
    no: Number(r[1] || 0),
    queueNo: Number(r[2] || 0),
    nama: String(r[3]),
    tanggal: formatTanggal(r[4]),
    startTime: parseTimestamp(r[5]),
    endTime: parseTimestamp(r[6]),
    items: parseItems(r[7]),
    ot: String(r[8] || '-'),
    otDur: String(r[9] || '-'),
    totalBase: Number(r[10] || 0),
    totalOT: Number(r[11] || 0),
    totalTol: Number(r[12] || 0),
    grandTotal: Number(r[13] || 0),
    totalAll: Number(r[14] || 0),
    payAwal: String(r[15] || 'cash'),
    cash: Number(r[16] || 0),
    qris: Number(r[17] || 0),
    shift: String(r[18] || '-')
  };
}

function respond(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
