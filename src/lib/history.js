export function aggregateHistory(transactions, mode, value, sortOrder = 'desc') {
  const filtered = transactions
    .filter(t => t.tanggal?.startsWith(value))
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

