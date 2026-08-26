import { describe, it, expect } from 'vitest';
import { checkShiftExpiration, getShiftDate, SHIFT_ROLLOVER_HOUR } from '../lib/shift';
import { shiftDateStr, SHIFT_ROLLOVER_HOUR as SERVER_ROLLOVER_HOUR } from '../../server/db';
import { calcOT, calcOTCost } from '../features/rentals/domain/rentalCalculations';

describe('shift.js - Shift Rollover and Expiration', () => {
  it('exports SHIFT_ROLLOVER_HOUR as 6 with frontend-backend parity', () => {
    expect(SHIFT_ROLLOVER_HOUR).toBe(6);
    expect(SERVER_ROLLOVER_HOUR).toBe(6);
  });

  it('getShiftDate calculates shift date with 6 AM rollover', () => {
    // 2026-07-26 23:30 (11:30 PM) -> shift date is 2026-07-26
    const lateNight = new Date(2026, 6, 26, 23, 30).getTime();
    expect(getShiftDate(lateNight)).toBe('2026-07-26');
    expect(shiftDateStr(lateNight)).toBe('2026-07-26');

    // 2026-07-27 02:15 (2:15 AM) -> shift date is STILL 2026-07-26
    const pastMidnight = new Date(2026, 6, 27, 2, 15).getTime();
    expect(getShiftDate(pastMidnight)).toBe('2026-07-26');
    expect(shiftDateStr(pastMidnight)).toBe('2026-07-26');

    // 2026-07-27 05:59:59 (5:59:59 AM) -> still previous shift date
    const preRollover = new Date(2026, 6, 27, 5, 59, 59).getTime();
    expect(getShiftDate(preRollover)).toBe('2026-07-26');
    expect(shiftDateStr(preRollover)).toBe('2026-07-26');

    // 2026-07-27 06:00:00 (6:00:00 AM) -> exact rollover to new shift date
    const exactRollover = new Date(2026, 6, 27, 6, 0, 0).getTime();
    expect(getShiftDate(exactRollover)).toBe('2026-07-27');
    expect(shiftDateStr(exactRollover)).toBe('2026-07-27');

    // 2026-07-27 06:05 (6:05 AM) -> shift date rolls over to 2026-07-27
    const nextMorning = new Date(2026, 6, 27, 6, 5).getTime();
    expect(getShiftDate(nextMorning)).toBe('2026-07-27');
    expect(shiftDateStr(nextMorning)).toBe('2026-07-27');
  });

  it('handles rental session crossing 6 AM rollover with deterministic OT and shift assignment', () => {
    // Session started at 05:30 AM (belongs to shift 2026-07-26)
    const startTime = new Date(2026, 6, 27, 5, 30, 0).getTime();
    const sessionShift = getShiftDate(startTime);
    expect(sessionShift).toBe('2026-07-26');

    // Closed at 07:05 AM (after 6 AM rollover) -> 95 minutes elapsed
    const endTime = new Date(2026, 6, 27, 7, 5, 0).getTime();
    const elapsedMin = (endTime - startTime) / (60 * 1000); // 95 minutes

    // 95 min - 60 min limit = 35 min over (in 11-40m range -> 1 half-hour OT)
    const ot = calcOT(elapsedMin, 60);
    expect(ot).toEqual({ otFull: 0, otHalf: 1 });

    const scooterRate = { priceOT30: 25000, priceOT60: 50000 };
    const cost = calcOTCost(elapsedMin, 60, scooterRate, 1);
    expect(cost).toBe(25000);

    // Shift date assigned to transaction remains the session start shift
    expect(sessionShift).toBe('2026-07-26');
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

