import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getShiftDate, checkShiftExpiration } from '../lib/shift';
import { normalizeSession } from '../App';

describe('Multi-Device & Multi-Shift Synchronization Logic', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('maintains shift date across midnight rollover (06:00 AM rule)', () => {
    // July 26th, 11:30 PM (before midnight)
    const t1 = new Date(2026, 6, 26, 23, 30).getTime();
    // July 27th, 01:45 AM (after midnight)
    const t2 = new Date(2026, 6, 27, 1, 45).getTime();
    // July 27th, 05:59 AM (just before 6 AM rollover)
    const t3 = new Date(2026, 6, 27, 5, 59).getTime();
    // July 27th, 06:01 AM (after 6 AM rollover)
    const t4 = new Date(2026, 6, 27, 6, 1).getTime();

    const shiftDateT1 = getShiftDate(t1);
    const shiftDateT2 = getShiftDate(t2);
    const shiftDateT3 = getShiftDate(t3);
    const shiftDateT4 = getShiftDate(t4);

    expect(shiftDateT1).toBe('2026-07-26');
    expect(shiftDateT2).toBe('2026-07-26');
    expect(shiftDateT3).toBe('2026-07-26');
    expect(shiftDateT4).toBe('2026-07-27');

    // Cashier logged in during night shift should NOT expire at midnight
    expect(checkShiftExpiration(shiftDateT1, shiftDateT2)).toBe(false);
    expect(checkShiftExpiration(shiftDateT1, shiftDateT3)).toBe(false);
    // Cashier shift SHOULD expire at 6 AM rollover
    expect(checkShiftExpiration(shiftDateT1, shiftDateT4)).toBe(true);
  });

  it('preserves unsynced local sessions when merging with cloud data', () => {
    const cloudSessions = [
      { id: 's-cloud1', nama: 'Cloud User 1', _synced: true }
    ];
    const localSessions = [
      { id: 's-cloud1', nama: 'Cloud User 1', _synced: true },
      { id: 's-offline1', nama: 'Offline User 1', _synced: false }
    ];

    const unsyncedLocal = localSessions.filter(ls => ls._synced === false && !cloudSessions.some(cs => cs.id === ls.id));
    const merged = [...cloudSessions, ...unsyncedLocal];

    expect(merged.length).toBe(2);
    expect(merged.map(s => s.id)).toEqual(['s-cloud1', 's-offline1']);
  });

  it('normalizeSession auto-heals legacy and malformed cache objects', () => {
    // Malformed session with string items, missing nama, invalid payAwal
    const legacySession = {
      id: 's-legacy',
      items: 'ST×2, SB×1',
      payAwal: undefined
    };

    const healed = normalizeSession(legacySession);
    expect(healed).not.toBeNull();
    expect(healed.id).toBe('s-legacy');
    expect(healed.nama).toBe('Penyewa');
    expect(healed.payAwal).toBe('cash');
    expect(healed.items).toEqual([
      { code: 'ST', qty: 2 },
      { code: 'SB', qty: 1 }
    ]);
  });
});
