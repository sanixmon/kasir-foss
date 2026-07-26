let SPREADSHEET_ID = '1WEFm1wjTdFXedMPyKw521COQCKjj5PQxPvHAITiCczI';
try {
  const activeId = SpreadsheetApp.getActiveSpreadsheet().getId();
  if (activeId) SPREADSHEET_ID = activeId;
} catch (e) {}

const SHEET_SESSIONS    = 'ActiveSessions';
const SHEET_TRANSACTIONS = 'Transactions';
const SHEET_USERS       = 'Users';
const SHEET_SETTINGS    = 'Settings';

// ─── HTTP Handlers ────────────────────────────────────────────────────────────

function doGet(e) {
  return fetchAllData();
}

function doPost(e) {
  try {
    const body    = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    const req     = JSON.parse(body);
    const action  = req.action;
    const payload = req.payload || {};
    switch (action) {
      case 'fetch_data':    return fetchAllData();
      case 'add_session':   return addSession(payload);
      case 'edit_session':  return editSession(payload);
      case 'claim_session': return claimSession(payload);
      case 'delete_session':return deleteSession(payload);
      case 'save_setting':  return saveSetting(payload);
      case 'save_user':     return saveUser(payload);
      default:              return respond({ error: 'Invalid action: ' + action });
    }
  } catch (err) {
    return respond({ error: String(err && err.message ? err.message : err) });
  }
}

// ─── Sheet Helpers ────────────────────────────────────────────────────────────

function getOrCreateSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (headers && headers.length) sheet.appendRow(headers);
  }
  return sheet;
}

// ─── Main Read ────────────────────────────────────────────────────────────────

function fetchAllData() {
  const cache  = CacheService.getScriptCache();
  const cached = cache.get('allData');
  if (cached) return respond(JSON.parse(cached));

  const ss          = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sessSheet   = getOrCreateSheet(ss, SHEET_SESSIONS,     ['id','nama','items','start_time','tanggal','queue_no','pay_awal']);
  const txnSheet    = getOrCreateSheet(ss, SHEET_TRANSACTIONS, ['id','no','queue_no','nama','tanggal','start_time','end_time','items','ot','ot_dur','total_base','total_ot','total_tol','grand_total','total_all','pay_awal','cash','qris','shift']);
  const usersSheet  = getOrCreateSheet(ss, SHEET_USERS,        ['username','password','role']);
  const settSheet   = getOrCreateSheet(ss, SHEET_SETTINGS,     ['Key','Value']);

  if (usersSheet.getLastRow() <= 1) {
    [['akbar','jayalahevren','cashier'],['rani','jayalahevren','cashier'],
     ['monica','jayalahevren','cashier'],['aldy','jayalahevren','cashier'],
     ['wahyu','jayalahevren','cashier'],['donny','jayalahevren','cashier'],
     ['zumi','jayalahevren','cashier'],['awang','jayalahevren','cashier'],
     ['admin','jayalahevren','admin']
    ].forEach(function(u){ usersSheet.appendRow(u); });
  }

  if (settSheet.getLastRow() <= 1) {
    [['admin_password','jayalahevren'],['store_name','EVREN HOUSE'],['store_sub','Scooter & Stroller']]
    .forEach(function(s){ settSheet.appendRow(s); });
  }

  var result = {
    sessions:     parseSheetRows(sessSheet),
    transactions: parseSheetRows(txnSheet),
    users:        parseUsers(usersSheet),
    settings:     parseSettings(settSheet),
    serverTime:   Date.now()
  };
  cache.put('allData', JSON.stringify(result), 2);
  return respond(result);
}

// ─── Date / Time Utilities ────────────────────────────────────────────────────

/**
 * Always returns a zero-padded HH:mm:ss string.
 * Handles: number (ms), Date object, 'H:mm:ss', 'HH:mm:ss'
 */
function formatTimeOnly(val) {
  if (!val && val !== 0) return '00:00:00';

  if (typeof val === 'number') {
    var d = new Date(val);
    if (isNaN(d.getTime())) return '00:00:00';
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
  }

  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '00:00:00';
    return pad2(val.getHours()) + ':' + pad2(val.getMinutes()) + ':' + pad2(val.getSeconds());
  }

  if (typeof val === 'string' && val.indexOf(':') !== -1) {
    var parts = val.split(':');
    return pad2(Number(parts[0]||0)) + ':' + pad2(Number(parts[1]||0)) + ':' + pad2(Number(parts[2]||0));
  }

  return '00:00:00';
}

function pad2(n) {
  return String(Number(n) || 0).padStart(2, '0');
}

/**
 * Returns shift date (YYYY-MM-DD) for a given timestamp.
 * Shift rolls over at 06:00 AM, so 00:00–05:59 belongs to the previous shift date.
 */
function getShiftDate(ms) {
  var d = new Date(Number(ms || Date.now()));
  d.setHours(d.getHours() - 6);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

/**
 * Converts any date-like value to shift-date string YYYY-MM-DD.
 */
function formatTanggal(val) {
  if (!val) return getShiftDate();
  if (typeof val === 'number')  return getShiftDate(val);
  if (val instanceof Date)      return getShiftDate(val.getTime());
  var str = String(val);
  // Already a YYYY-MM-DD string
  if (str.length >= 10 && str.indexOf('-') === 4) return str.slice(0, 10);
  var d = new Date(str);
  return isNaN(d.getTime()) ? getShiftDate() : getShiftDate(d.getTime());
}

/**
 * Combines a shift-date string (YYYY-MM-DD) and a time string (H:mm:ss or HH:mm:ss)
 * into a Unix millisecond timestamp.
 *
 * Rule: times 00:00–05:59 belong to the calendar day AFTER the shift date
 * (because the shift started before midnight of the next day).
 */
function parseDateTimeToTimestamp(tanggalVal, timeVal) {
  // Already a full Unix timestamp
  if (typeof timeVal === 'number' && timeVal > 1000000000000) return timeVal;
  if (timeVal instanceof Date && !isNaN(timeVal.getTime())) return timeVal.getTime();

  var timeStr     = formatTimeOnly(timeVal);          // always HH:mm:ss
  var shiftTglStr = formatTanggal(tanggalVal);        // always YYYY-MM-DD

  // Use ISO 8601 "T" separator for guaranteed parsing in V8 / Apps Script engine
  var d = new Date(shiftTglStr + 'T' + timeStr);
  if (isNaN(d.getTime())) return Date.now();

  // Deterministic 6 AM shift rule
  var hh = Number(timeStr.split(':')[0] || 0);
  if (hh < 6) {
    d.setDate(d.getDate() + 1);
  }

  return d.getTime();
}

// ─── Item Serialization ───────────────────────────────────────────────────────

function formatItemsSummary(items) {
  if (!items) return '-';
  if (typeof items === 'string') {
    try {
      var p = JSON.parse(items);
      if (Array.isArray(p)) return p.map(function(i){ return i.code + '\xD7' + i.qty; }).join(', ');
    } catch(e){}
    return items;
  }
  if (Array.isArray(items)) {
    return items.map(function(i){ return i.code + '\xD7' + i.qty; }).join(', ');
  }
  return String(items);
}

function parseItems(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      var p = JSON.parse(val);
      if (Array.isArray(p)) return p;
    } catch(e){}
    return val.split(',').map(function(part) {
      var p = part.trim();
      var m = p.match(/^(.+?)(?:[x\xD7](\d+))?$/i);
      return m ? { code: m[1].trim(), qty: Number(m[2] || 1) } : { code: p, qty: 1 };
    });
  }
  return [];
}

// ─── Row Converters ───────────────────────────────────────────────────────────

function rowToSessionObj(r) {
  return {
    id:       String(r[0]),
    nama:     String(r[1]),
    items:    parseItems(r[2]),
    startTime: parseDateTimeToTimestamp(r[4], r[3]),
    tanggal:  formatTanggal(r[4]),
    queueNo:  Number(r[5] || 0),
    payAwal:  String(r[6] || 'cash')
  };
}

function rowToTxnObj(r) {
  return {
    id:         String(r[0]),
    no:         Number(r[1]  || 0),
    queueNo:    Number(r[2]  || 0),
    nama:       String(r[3]),
    tanggal:    formatTanggal(r[4]),
    startTime:  parseDateTimeToTimestamp(r[4], r[5]),
    endTime:    parseDateTimeToTimestamp(r[4], r[6]),
    items:      parseItems(r[7]),
    ot:         String(r[8]  || '-'),
    otDur:      String(r[9]  || '-'),
    totalBase:  Number(r[10] || 0),
    totalOT:    Number(r[11] || 0),
    totalTol:   Number(r[12] || 0),
    grandTotal: Number(r[13] || 0),
    totalAll:   Number(r[14] || 0),
    payAwal:    String(r[15] || 'cash'),
    cash:       Number(r[16] || 0),
    qris:       Number(r[17] || 0),
    shift:      String(r[18] || '-')
  };
}

function parseSheetRows(sheet) {
  var name = sheet.getName();
  var rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];
  var body = rows.slice(1);
  if (name === SHEET_SESSIONS)     return body.map(rowToSessionObj);
  if (name === SHEET_TRANSACTIONS) return body.map(rowToTxnObj);
  return [];
}

function parseUsers(sheet) {
  var rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];
  return rows.slice(1).map(function(r) {
    return { username: String(r[0]), password: String(r[1]), role: String(r[2] || 'cashier') };
  });
}

function parseSettings(sheet) {
  var rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return {};
  var out = {};
  rows.slice(1).forEach(function(r) { if (r[0]) out[String(r[0])] = String(r[1] || ''); });
  return out;
}

// ─── ID Generator ─────────────────────────────────────────────────────────────

function generateShortId(prefix) {
  return prefix + '-' + Math.random().toString(36).substring(2, 8);
}

// ─── Write Actions ────────────────────────────────────────────────────────────

function addSession(payload) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss         = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet      = getOrCreateSheet(ss, SHEET_SESSIONS, ['id','nama','items','start_time','tanggal','queue_no','pay_awal']);
    var startMs    = payload.startTime || Date.now();
    var shiftDate  = payload.tanggal   || getShiftDate(startMs);

    var lastRow    = sheet.getLastRow();
    var rows       = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 7).getValues() : [];
    var queueNo    = rows.filter(function(r){ return formatTanggal(r[4]) === shiftDate; }).length + 1;

    var id         = payload.id || generateShortId('s');
    var newRow     = [id, payload.nama || 'Penyewa', formatItemsSummary(payload.items || []),
                     formatTimeOnly(startMs), shiftDate, queueNo, payload.payAwal || 'cash'];

    sheet.appendRow(newRow);
    CacheService.getScriptCache().remove('allData');
    return respond({ success: true, session: rowToSessionObj(newRow) });
  } finally { lock.releaseLock(); }
}

function editSession(payload) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = getOrCreateSheet(ss, SHEET_SESSIONS, ['id','nama','items','start_time','tanggal','queue_no','pay_awal']);
    var data  = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(payload.id)) {
        if (payload.nama    !== undefined) sheet.getRange(i+1, 2).setValue(payload.nama);
        if (payload.items   !== undefined) sheet.getRange(i+1, 3).setValue(formatItemsSummary(payload.items));
        if (payload.payAwal !== undefined) sheet.getRange(i+1, 7).setValue(payload.payAwal);
        break;
      }
    }
    CacheService.getScriptCache().remove('allData');
    return respond({ success: true });
  } finally { lock.releaseLock(); }
}

function claimSession(payload) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss        = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sessSheet = getOrCreateSheet(ss, SHEET_SESSIONS,     ['id','nama','items','start_time','tanggal','queue_no','pay_awal']);
    var txnSheet  = getOrCreateSheet(ss, SHEET_TRANSACTIONS, ['id','no','queue_no','nama','tanggal','start_time','end_time','items','ot','ot_dur','total_base','total_ot','total_tol','grand_total','total_all','pay_awal','cash','qris','shift']);

    // Remove active session
    if (payload.sessionId) {
      var sessData = sessSheet.getDataRange().getValues();
      for (var i = 1; i < sessData.length; i++) {
        if (String(sessData[i][0]) === String(payload.sessionId)) {
          sessSheet.deleteRow(i + 1); break;
        }
      }
    }

    var txnRows  = txnSheet.getLastRow();
    var nextNo   = txnRows > 1 ? Number(txnSheet.getRange(txnRows, 2).getValue()) + 1 : 1;
    var txnId    = payload.id || generateShortId('t');
    var startMs  = payload.startTime || Date.now();
    var endMs    = payload.endTime   || Date.now();
    var shiftDate= payload.tanggal   || getShiftDate(startMs);

    var txnRow = [
      txnId, nextNo, payload.queueNo || 0, payload.nama || 'Penyewa',
      shiftDate, formatTimeOnly(startMs), formatTimeOnly(endMs),
      formatItemsSummary(payload.items || []),
      payload.ot      || '-', payload.otDur    || '-',
      payload.totalBase  || 0, payload.totalOT   || 0,
      payload.totalTol   || 0, payload.grandTotal || 0,
      payload.totalAll   || 0, payload.payAwal  || 'cash',
      payload.cash || 0, payload.qris || 0, payload.shift || '-'
    ];

    txnSheet.appendRow(txnRow);
    CacheService.getScriptCache().remove('allData');
    return respond({ success: true, transaction: rowToTxnObj(txnRow) });
  } finally { lock.releaseLock(); }
}

function deleteSession(payload) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = getOrCreateSheet(ss, SHEET_SESSIONS, ['id','nama','items','start_time','tanggal','queue_no','pay_awal']);
    var data  = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(payload.id)) { sheet.deleteRow(i + 1); break; }
    }
    CacheService.getScriptCache().remove('allData');
    return respond({ success: true });
  } finally { lock.releaseLock(); }
}

function saveSetting(payload) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = getOrCreateSheet(ss, SHEET_SETTINGS, ['Key','Value']);
    var data  = sheet.getDataRange().getValues();
    var found = false;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(payload.key)) {
        sheet.getRange(i+1, 2).setValue(payload.value); found = true; break;
      }
    }
    if (!found && payload.key) sheet.appendRow([payload.key, payload.value]);
    CacheService.getScriptCache().remove('allData');
    return respond({ success: true });
  } finally { lock.releaseLock(); }
}

function saveUser(payload) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = getOrCreateSheet(ss, SHEET_USERS, ['username','password','role']);
    var data  = sheet.getDataRange().getValues();
    var found = false;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).toLowerCase() === String(payload.username).toLowerCase()) {
        if (payload.password) sheet.getRange(i+1, 2).setValue(payload.password);
        if (payload.role)     sheet.getRange(i+1, 3).setValue(payload.role);
        found = true; break;
      }
    }
    if (!found && payload.username) {
      sheet.appendRow([payload.username, payload.password || '1234', payload.role || 'cashier']);
    }
    CacheService.getScriptCache().remove('allData');
    return respond({ success: true });
  } finally { lock.releaseLock(); }
}

// ─── Response Helper ──────────────────────────────────────────────────────────

function respond(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
