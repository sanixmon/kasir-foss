import { describe, it, expect } from 'vitest';
import { checkShiftExpiration, getShiftDate } from '../lib/shift';

describe('shift.js - Shift Rollover and Expiration', () => {
  it('getShiftDate calculates shift date with 6 AM rollover', () => {
    // 2026-07-26 23:30 (11:30 PM) -> shift date is 2026-07-26
    const lateNight = new Date(2026, 6, 26, 23, 30).getTime();
    expect(getShiftDate(lateNight)).toBe('2026-07-26');

    // 2026-07-27 02:15 (2:15 AM) -> shift date is STILL 2026-07-26
    const pastMidnight = new Date(2026, 6, 27, 2, 15).getTime();
    expect(getShiftDate(pastMidnight)).toBe('2026-07-26');

    // 2026-07-27 06:05 (6:05 AM) -> shift date rolls over to 2026-07-27
    const nextMorning = new Date(2026, 6, 27, 6, 5).getTime();
    expect(getShiftDate(nextMorning)).toBe('2026-07-27');
  });

  it('returns false if shiftDate matches current shift date', () => {
    expect(checkShiftExpiration('2026-07-15', '2026-07-15')).toBe(false);
  });

  it('returns true if shiftDate is different from current shift date', () => {
    expect(checkShiftExpiration('2026-07-14', '2026-07-15')).toBe(true);
  });

  it('handles missing shiftDate by returning false', () => {
    expect(checkShiftExpiration(null, '2026-07-15')).toBe(false);
  });
});

