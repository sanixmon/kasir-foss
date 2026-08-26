import { getShiftDate } from './shift';

function getShiftDateStr(val) {
  if (!val) return '';
  if (typeof val === 'string' && val.length >= 10 && val.indexOf('-') === 4) return val.slice(0, 10);
  const num = Number(val);
  if (isNaN(num) || num <= 0) return '';
  return getShiftDate(num);
}

export function aggregateHistory(transactions, mode, value, sortOrder = 'desc') {
  const filtered = transactions
    .filter(t => {
      if (!value) return true;
      if (t.tanggal && t.tanggal.startsWith(value)) return true;
      const startShiftDate = getShiftDateStr(t.startTime);
      if (startShiftDate && startShiftDate.startsWith(value)) return true;
      const endShiftDate = getShiftDateStr(t.endTime);
      if (endShiftDate && endShiftDate.startsWith(value)) return true;
      return false;
    })
    .sort((a, b) => {
      const timeA = Number(a.endTime || a.end_time || 0);
      const timeB = Number(b.endTime || b.end_time || 0);
      return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
    });

  const totalPokok = filtered.reduce((s, t) => s + (t.totalBase || 0), 0);
  const totalPokokCash = filtered.reduce((s, t) => s + ((t.payAwal || 'cash') === 'cash' ? (t.totalBase || 0) : 0), 0);
  const totalPokokQris = filtered.reduce((s, t) => s + ((t.payAwal || 'cash') === 'qris' ? (t.totalBase || 0) : 0), 0);
  const totalTambahan = filtered.reduce((s, t) => s + (t.grandTotal || 0), 0);
  const totalOTCash = filtered.reduce((s, t) => s + (t.cash || 0), 0);
  const totalOTQris = filtered.reduce((s, t) => s + (t.qris || 0), 0);

  const totalCashAll = totalPokokCash + totalOTCash;
  const totalQrisAll = totalPokokQris + totalOTQris;
  const grandTotal = totalPokok + totalTambahan;

  return {
    filtered,
    totalPokok,
    totalPokokCash,
    totalPokokQris,
    totalTambahan,
    totalOTCash,
    totalOTQris,
    totalCashAll,
    totalQrisAll,
    grandTotal
  };
}

