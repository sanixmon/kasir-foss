import { describe, it, expect } from 'vitest';
import { calcOT, calcOTCost, localDateStr } from '../lib/ot';

const SD = { priceOT30: 25000, priceOT60: 50000 }; // Scooter Dewasa
const ST = { priceOT30: 10000, priceOT60: 20000 }; // Stroller

// ─── calcOT — core overtime rule ─────────────────────────────────────────────

describe('calcOT — standard 1h limit', () => {
  it('no OT when elapsed < 60 min', () => {
    expect(calcOT(45, 60)).toEqual({ otFull: 0, otHalf: 0 });
    expect(calcOT(60, 60)).toEqual({ otFull: 0, otHalf: 0 });
  });

  it('no OT in grace period: 1–10 min over', () => {
    expect(calcOT(61, 60)).toEqual({ otFull: 0, otHalf: 0 });  // 1 min over
    expect(calcOT(70, 60)).toEqual({ otFull: 0, otHalf: 0 });  // 10 min over
  });

  it('OT triggers only at >= 11 min over limit', () => {
    expect(calcOT(70.9, 60)).toEqual({ otFull: 0, otHalf: 0 }); // 10m54s — still free
    expect(calcOT(71,   60)).toEqual({ otFull: 0, otHalf: 1 }); // 11 min → half-hour
  });

  it('half-hour OT: 11–40 min over', () => {
    expect(calcOT(71,  60)).toEqual({ otFull: 0, otHalf: 1 }); // 11 min
    expect(calcOT(90,  60)).toEqual({ otFull: 0, otHalf: 1 }); // 30 min
    expect(calcOT(100, 60)).toEqual({ otFull: 0, otHalf: 1 }); // 40 min
  });

  it('full-hour OT: >40 min over', () => {
    expect(calcOT(101, 60)).toEqual({ otFull: 1, otHalf: 0 }); // 41 min → full
    expect(calcOT(119, 60)).toEqual({ otFull: 1, otHalf: 0 }); // 59 min → full
  });

  it('second hour: free for first 10m 59s', () => {
    expect(calcOT(120, 60)).toEqual({ otFull: 1, otHalf: 0 }); // 60 min → 1 full
    expect(calcOT(130, 60)).toEqual({ otFull: 1, otHalf: 0 }); // 70 min — grace again
    expect(calcOT(130.9, 60)).toEqual({ otFull: 1, otHalf: 0 }); // 70.9 min over — still grace for 2nd hour
  });

  it('second hour half: 11–40 min into 2nd OT hour', () => {
    expect(calcOT(131, 60)).toEqual({ otFull: 1, otHalf: 1 }); // 71 min
    expect(calcOT(160, 60)).toEqual({ otFull: 1, otHalf: 1 }); // 100 min
  });

  it('second full hour: >40 min into 2nd OT hour', () => {
    expect(calcOT(161, 60)).toEqual({ otFull: 2, otHalf: 0 }); // 101 min
    expect(calcOT(180, 60)).toEqual({ otFull: 2, otHalf: 0 }); // 120 min → 2 full
  });
});

describe('calcOT — package 3h limit (SB)', () => {
  const limitMin = 180;

  it('no OT within 3h', () => {
    expect(calcOT(180, limitMin)).toEqual({ otFull: 0, otHalf: 0 });
  });

  it('grace period at 3h+1 to 3h+10', () => {
    expect(calcOT(190, limitMin)).toEqual({ otFull: 0, otHalf: 0 });
  });

  it('OT kicks in at 3h+11', () => {
    expect(calcOT(191, limitMin)).toEqual({ otFull: 0, otHalf: 1 });
  });
});

// ─── calcOTCost ───────────────────────────────────────────────────────────────

describe('calcOTCost', () => {
  it('returns 0 when no OT', () => {
    expect(calcOTCost(60, 60, SD, 1)).toBe(0);
    expect(calcOTCost(70, 60, SD, 1)).toBe(0);  // in grace
  });

  it('half-hour rate (11 min over)', () => {
    expect(calcOTCost(71, 60, SD, 1)).toBe(25000);
    expect(calcOTCost(71, 60, ST, 1)).toBe(10000);
  });

  it('full-hour rate (41 min over)', () => {
    expect(calcOTCost(101, 60, SD, 1)).toBe(50000);
    expect(calcOTCost(101, 60, ST, 1)).toBe(20000);
  });

  it('multiplies by qty', () => {
    expect(calcOTCost(71, 60, SD, 2)).toBe(50000);  // 25000 * 2
    expect(calcOTCost(101, 60, SD, 3)).toBe(150000); // 50000 * 3
  });

  it('1 full + 1 half: 1h11m over', () => {
    // 131 - 60 = 71 min over → 1 full hour + 11min into next → half
    expect(calcOTCost(131, 60, SD, 1)).toBe(50000 + 25000); // 75000
  });
});

// ─── localDateStr ─────────────────────────────────────────────────────────────

describe('localDateStr', () => {
  it('returns YYYY-MM-DD format', () => {
    const result = localDateStr();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('uses local timezone, not UTC (midnight rollover test)', () => {
    // 2026-07-15 00:30 local = 2026-07-14 16:30 UTC
    // localDateStr should return 2026-07-15, NOT 2026-07-14
    const localMidnightMs = new Date('2026-07-15T00:30:00').getTime(); // local time
    const result = localDateStr(localMidnightMs);
    const expected = new Date('2026-07-15T00:30:00').toLocaleDateString('sv-SE'); // YYYY-MM-DD
    expect(result).toBe(expected);
  });

  it('returns correct date from given timestamp', () => {
    const ts = new Date('2026-07-14T10:00:00').getTime();
    const result = localDateStr(ts);
    expect(result).toMatch(/^2026-07-14$/);
  });
});
