let SPREADSHEET_ID = '';
try {
  SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
} catch (e) {
  // Jika Apps Script dibuat terpisah via script.google.com (Standalone Script),
  // masukkan Spreadsheet ID Anda di bawah ini (diambil dari URL Spreadsheet antara /d/ dan /edit):
  SPREADSHEET_ID = 'MASUKKAN_SPREADSHEET_ID_DISINI';
}

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
