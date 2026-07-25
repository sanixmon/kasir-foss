import { describe, it, expect } from 'vitest';
import { aggregateHistory } from '../lib/history';

describe('aggregateHistory', () => {
  const transactions = [
    { id: 1, tanggal: '2026-07-15', totalBase: 10000, payAwal: 'cash', grandTotal: 5000, cash: 5000, qris: 0 },
    { id: 2, tanggal: '2026-07-15', totalBase: 20000, payAwal: 'qris', grandTotal: 0, cash: 0, qris: 0 },
    { id: 3, tanggal: '2026-07-16', totalBase: 30000, payAwal: 'cash', grandTotal: 10000, cash: 0, qris: 10000 },
    { id: 4, tanggal: '2026-08-01', totalBase: 50000, payAwal: 'qris', grandTotal: 0, cash: 0, qris: 0 },
    { id: 5, tanggal: '2025-12-31', totalBase: 10000, payAwal: 'cash', grandTotal: 0, cash: 0, qris: 0 }
  ];

  it('aggregates daily correctly (2026-07-15)', () => {
    const res = aggregateHistory(transactions, 'daily', '2026-07-15');
    expect(res.filtered.length).toBe(2);
    expect(res.totalPokok).toBe(30000); // 10000 + 20000
    expect(res.totalPokokCash).toBe(10000);
    expect(res.totalPokokQris).toBe(20000);
    expect(res.totalTambahan).toBe(5000);
    expect(res.grandTotal).toBe(35000);
  });

  it('aggregates monthly correctly (2026-07)', () => {
    const res = aggregateHistory(transactions, 'monthly', '2026-07');
    expect(res.filtered.length).toBe(3); // items 1, 2, 3
    expect(res.totalPokok).toBe(60000); // 10000 + 20000 + 30000
    expect(res.totalTambahan).toBe(15000); // 5000 + 0 + 10000
    expect(res.totalCashAll).toBe(45000); // pokok cash (10k+30k) + ot cash (5k) = 45k
    expect(res.totalQrisAll).toBe(30000); // pokok qris (20k) + ot qris (10k) = 30k
    expect(res.grandTotal).toBe(75000);
  });

  it('aggregates yearly correctly (2026)', () => {
    const res = aggregateHistory(transactions, 'yearly', '2026');
    expect(res.filtered.length).toBe(4); // items 1, 2, 3, 4
    expect(res.totalPokok).toBe(110000); // 10+20+30+50
    expect(res.grandTotal).toBe(125000);
  });

  it('sorts transactions by bill close time (endTime) descending by default and ascending when specified', () => {
    const timedTxns = [
      { id: 't1', tanggal: '2026-07-25', endTime: 1000, totalBase: 5000 },
      { id: 't2', tanggal: '2026-07-25', endTime: 3000, totalBase: 5000 },
      { id: 't3', tanggal: '2026-07-25', endTime: 2000, totalBase: 5000 }
    ];

    const resDesc = aggregateHistory(timedTxns, 'daily', '2026-07-25', 'desc');
    expect(resDesc.filtered.map(t => t.id)).toEqual(['t2', 't3', 't1']);

    const resAsc = aggregateHistory(timedTxns, 'daily', '2026-07-25', 'asc');
    expect(resAsc.filtered.map(t => t.id)).toEqual(['t1', 't3', 't2']);
  });
});

