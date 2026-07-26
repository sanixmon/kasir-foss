let SPREADSHEET_ID = '1WEFm1wjTdFXedMPyKw521COQCKjj5PQxPvHAITiCczI';
try {
  const activeId = SpreadsheetApp.getActiveSpreadsheet().getId();
  if (activeId) SPREADSHEET_ID = activeId;
} catch (e) {
  // Menggunakan Spreadsheet ID jika Standalone Script
}

const SHEET_SESSIONS = 'ActiveSessions';
const SHEET_TRANSACTIONS = 'Transactions';
const SHEET_SETTINGS = 'Settings';
const SHEET_USERS = 'Users';

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
      case 'save_setting':
        return saveSetting(payload);
      case 'save_user':
        return saveUser(payload);
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
  const sessSheet = getOrCreateSheet(ss, SHEET_SESSIONS, ['id', 'nama', 'items', 'start_time', 'tanggal', 'queue_no', 'pay_awal']);
  const txnSheet = getOrCreateSheet(ss, SHEET_TRANSACTIONS, ['id', 'no', 'queue_no', 'nama', 'tanggal', 'start_time', 'end_time', 'items', 'ot', 'ot_dur', 'total_base', 'total_ot', 'total_tol', 'grand_total', 'total_all', 'pay_awal', 'cash', 'qris', 'shift']);
  const usersSheet = getOrCreateSheet(ss, SHEET_USERS, ['username', 'password', 'role']);
  const settingsSheet = getOrCreateSheet(ss, SHEET_SETTINGS, ['Key', 'Value']);

  if (usersSheet.getLastRow() <= 1) {
    const defaultUsers = [
      ['akbar', 'jayalahevren', 'cashier'],
      ['rani', 'jayalahevren', 'cashier'],
      ['monica', 'jayalahevren', 'cashier'],
      ['aldy', 'jayalahevren', 'cashier'],
      ['wahyu', 'jayalahevren', 'cashier'],
      ['donny', 'jayalahevren', 'cashier'],
      ['zumi', 'jayalahevren', 'cashier'],
      ['awang', 'jayalahevren', 'cashier'],
      ['admin', 'jayalahevren', 'admin']
    ];
    defaultUsers.forEach(u => usersSheet.appendRow(u));
  }

  if (settingsSheet.getLastRow() <= 1) {
    const defaultSettings = [
      ['admin_password', 'jayalahevren'],
      ['store_name', 'EVREN HOUSE'],
      ['store_sub', 'Scooter & Stroller']
    ];
    defaultSettings.forEach(s => settingsSheet.appendRow(s));
  }

  const sessions = parseSheetRows(sessSheet);
  const transactions = parseSheetRows(txnSheet);
  const users = parseUsers(usersSheet);
  const settings = parseSettings(settingsSheet);

  const responseData = { sessions, transactions, users, settings, serverTime: Date.now() };
  cache.put('allData', JSON.stringify(responseData), 4);
  return respond(responseData);
}

function parseUsers(sheet) {
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];
  return rows.slice(1).map(r => ({
    username: String(r[0]),
    password: String(r[1]),
    role: String(r[2] || 'cashier')
  }));
}

function parseSettings(sheet) {
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return {};
  const settings = {};
  rows.slice(1).forEach(r => {
    if (r[0]) settings[String(r[0])] = String(r[1] || '');
  });
  return settings;
}

function saveSetting(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = getOrCreateSheet(ss, SHEET_SETTINGS, ['Key', 'Value']);
    const data = sheet.getDataRange().getValues();
    let found = false;
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(payload.key)) {
        sheet.getRange(i + 1, 2).setValue(payload.value);
        found = true;
        break;
      }
    }
    
    if (!found && payload.key) {
      sheet.appendRow([payload.key, payload.value]);
    }
    
    CacheService.getScriptCache().remove('allData');
    return respond({ success: true });
  } finally {
    lock.releaseLock();
  }
}

function saveUser(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = getOrCreateSheet(ss, SHEET_USERS, ['username', 'password', 'role']);
    const data = sheet.getDataRange().getValues();
    let found = false;
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).toLowerCase() === String(payload.username).toLowerCase()) {
        if (payload.password) sheet.getRange(i + 1, 2).setValue(payload.password);
        if (payload.role) sheet.getRange(i + 1, 3).setValue(payload.role);
        found = true;
        break;
      }
    }
    
    if (!found && payload.username) {
      sheet.appendRow([payload.username, payload.password || '1234', payload.role || 'cashier']);
    }
    
    CacheService.getScriptCache().remove('allData');
    return respond({ success: true });
  } finally {
    lock.releaseLock();
  }
}

function generateShortId(prefix) {
  return prefix + '-' + Math.random().toString(36).substring(2, 8);
}

function formatTimeOnly(val) {
  if (!val) return '';
  if (typeof val === 'string' && val.indexOf(':') !== -1 && val.length <= 8) return val;
  const d = (typeof val === 'number') ? new Date(val) : new Date(String(val));
  if (isNaN(d.getTime())) return String(val);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function getShiftDate(ms) {
  const d = new Date(Number(ms || Date.now()));
  d.setHours(d.getHours() - 6);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const date = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${date}`;
}

function formatTanggal(val) {
  if (!val) return getShiftDate();
  let d;
  if (typeof val === 'number') {
    return getShiftDate(val);
  } else if (val instanceof Date) {
    return getShiftDate(val.getTime());
  } else {
    const str = String(val);
    if (str.length >= 10 && str.indexOf('-') === 4) return str.slice(0, 10);
    d = new Date(str);
  }
  if (isNaN(d.getTime())) return getShiftDate();
  return getShiftDate(d.getTime());
}

function parseDateTimeToTimestamp(tanggalVal, timeVal) {
  if (typeof timeVal === 'number' && timeVal > 1000000000000) return timeVal;
  if (timeVal instanceof Date) return timeVal.getTime();
  
  const timeStr = formatTimeOnly(timeVal) || '00:00:00';
  const shiftTglStr = formatTanggal(tanggalVal);
  
  let d = new Date(`${shiftTglStr} ${timeStr}`);
  if (isNaN(d.getTime())) return Date.now();
  
  // Deterministic 6 AM Shift Rule: If time is between 00:00:00 and 05:59:59 AM,
  // the calendar date is shiftTgl + 1 day.
  const parts = timeStr.split(':');
  const hh = Number(parts[0] || 0);
  if (hh < 6) {
    d.setDate(d.getDate() + 1);
  }
  return d.getTime();
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
    const sheet = getOrCreateSheet(ss, SHEET_SESSIONS, ['id', 'nama', 'items', 'start_time', 'tanggal', 'queue_no', 'pay_awal']);
    
    const startTimeMs = payload.startTime || Date.now();
    const shiftDate = payload.tanggal || getShiftDate(startTimeMs);
    
    const lastRow = sheet.getLastRow();
    const rows = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 7).getValues() : [];
    const todayRows = rows.filter(r => formatTanggal(r[4]) === shiftDate);
    const queueNo = todayRows.length + 1;
    
    const id = payload.id || generateShortId('s');
    const itemsSummary = formatItemsSummary(payload.items || []);
    
    const newRow = [
      id,
      payload.nama || 'Penyewa',
      itemsSummary,
      formatTimeOnly(startTimeMs),
      shiftDate,
      queueNo,
      payload.payAwal || 'cash'
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
    const sheet = getOrCreateSheet(ss, SHEET_SESSIONS, ['id', 'nama', 'items', 'start_time', 'tanggal', 'queue_no', 'pay_awal']);
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
    const sessSheet = getOrCreateSheet(ss, SHEET_SESSIONS, ['id', 'nama', 'items', 'start_time', 'tanggal', 'queue_no', 'pay_awal']);
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
    const shiftDate = payload.tanggal || getShiftDate(startTimeMs);
    const itemsSummary = formatItemsSummary(payload.items || []);
    
    const txnRow = [
      txnId,
      nextNo,
      payload.queueNo || 0,
      payload.nama || 'Penyewa',
      shiftDate,
      formatTimeOnly(startTimeMs),
      formatTimeOnly(endTimeMs),
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
    const sheet = getOrCreateSheet(ss, SHEET_SESSIONS, ['id', 'nama', 'items', 'start_time', 'tanggal', 'queue_no', 'pay_awal']);
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
    startTime: parseDateTimeToTimestamp(r[4], r[3]),
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
    startTime: parseDateTimeToTimestamp(r[4], r[5]),
    endTime: parseDateTimeToTimestamp(r[4], r[6]),
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
