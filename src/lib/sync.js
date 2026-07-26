export function mergeSyncData(cloudData, localData, customFilter = () => true) {
  const dbIds = new Set(cloudData.map(item => item.id));
  return [...cloudData, ...localData.filter(item => !dbIds.has(item.id) && !item._synced && customFilter(item))];
}

export function getUnsyncedItems(items = []) {
  return items.filter(item => !item._synced);
}

export function formatTxnForSupabase(txns = []) {
  return txns.map(t => ({
    id: t.id,
    no: t.no || 0,
    queue_no: t.queueNo || 0,
    nama: t.nama,
    tanggal: t.tanggal,
    start_time: t.startTime,
    end_time: t.endTime,
    items: t.items,
    ot: t.ot || '-',
    ot_dur: t.otDur || '-',
    total_base: t.totalBase || 0,
    total_ot: t.totalOT || 0,
    total_tol: t.totalTol || 0,
    grand_total: t.grandTotal || 0,
    total_all: t.totalAll || ((t.totalBase || 0) + (t.grandTotal || 0)),
    pay_awal: t.payAwal || 'cash',
    cash: t.cash || 0,
    qris: t.qris || 0,
    shift: t.shift || '-'
  }));
}

export function formatSessionForSupabase(sessions = []) {
  return sessions.map(s => ({
    id: s.id,
    nama: s.nama,
    items: s.items,
    start_time: s.startTime,
    tanggal: s.tanggal,
    queue_no: s.queueNo || 0,
    pay_awal: s.payAwal || 'cash'
  }));
}

export function cleanZombieSessions(activeSessions = [], transactions = []) {
  const completedTxnIds = new Set(transactions.map(t => t.id));
  return activeSessions.filter(s => {
    if (!s || !s.id) return false;
    if (completedTxnIds.has(s.id)) return false;
    if (!s.items || (Array.isArray(s.items) && s.items.length === 0)) return false;
    return true;
  });
}

export function findZombieSessionIds(activeSessions = [], transactions = []) {
  const completedTxnIds = new Set(transactions.map(t => t.id));
  return activeSessions
    .filter(s => s && s.id && (completedTxnIds.has(s.id) || !s.items || (Array.isArray(s.items) && s.items.length === 0)))
    .map(s => s.id);
}
