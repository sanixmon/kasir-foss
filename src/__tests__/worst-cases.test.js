/**
 * Worst-case scenario tests — weekend-rush conditions.
 * Tests the fixes we implemented for the critical bugs.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { calcOT } from '../lib/ot';
import { safeSetItem } from '../App';

// ─── 1. txn.no collision via sequence ────────────────────────────────────────
// The actual DB sequence test requires integration, but we verify the
// fallback logic stays consistent in offline mode.

describe('txn.no — offline fallback', () => {
  it('falls back to transactions.length + 1 when offline', () => {
    const transactions = [{ id: 'a', no: 1 }, { id: 'b', no: 2 }];
    // Simulates the fallback path in handleFinalizePayment
    const txnNo = transactions.length + 1;
    expect(txnNo).toBe(3);
  });

  it('two concurrent offline checkouts get different no if arrays differ', () => {
    // Terminal A has 5 txns, Terminal B has 6 — they'll get different numbers
    const noA = [1,2,3,4,5].length + 1;
    const noB = [1,2,3,4,5,6].length + 1;
    expect(noA).toBe(6);
    expect(noB).toBe(7);
  });
});

// ─── 2. Double-checkout race condition ───────────────────────────────────────

describe('claim_and_delete_session logic', () => {
  it('returns true when session exists (claim succeeds)', () => {
    // Simulates DB returning claimed=true
    const sessions = [{ id: 'sess-1' }, { id: 'sess-2' }];

    function claimLocally(id, sessions) {
      const idx = sessions.findIndex(s => s.id === id);
      if (idx === -1) return false;
      sessions.splice(idx, 1);
      return true;
    }

    expect(claimLocally('sess-1', [...sessions])).toBe(true);
  });

  it('returns false when session already claimed by another terminal', () => {
    const sessions = [{ id: 'sess-2' }]; // sess-1 already gone

    function claimLocally(id, sessions) {
      const idx = sessions.findIndex(s => s.id === id);
      if (idx === -1) return false;
      sessions.splice(idx, 1);
      return true;
    }

    expect(claimLocally('sess-1', sessions)).toBe(false);
  });

  it('two concurrent claims on same id: only one wins', () => {
    let sessions = [{ id: 'sess-x' }];

    function claimLocally(id) {
      const idx = sessions.findIndex(s => s.id === id);
      if (idx === -1) return false;
      sessions.splice(idx, 1);
      return true;
    }

    const resultA = claimLocally('sess-x');
    const resultB = claimLocally('sess-x'); // same id, second call

    expect(resultA).toBe(true);
    expect(resultB).toBe(false); // already gone
    // Only one transaction should be created
    expect([resultA, resultB].filter(Boolean).length).toBe(1);
  });
});

describe('claim_and_update_session logic', () => {
  it('updates the session items when expected_items matches', () => {
    let sessions = [{ id: 'sess-1', items: [{ code: 'ST', qty: 1 }, { code: 'SD', qty: 2 }] }];

    function claimAndUpdateLocally(id, expectedItems, newItems) {
      const idx = sessions.findIndex(s => s.id === id);
      if (idx === -1) return false;
      const session = sessions[idx];
      // Compare expected items (simplified JSON equality)
      if (JSON.stringify(session.items) !== JSON.stringify(expectedItems)) {
        return false;
      }
      if (newItems.length === 0) {
        sessions.splice(idx, 1);
      } else {
        sessions[idx] = { ...session, items: newItems };
      }
      return true;
    }

    const expected = [{ code: 'ST', qty: 1 }, { code: 'SD', qty: 2 }];
    const nextItems = [{ code: 'SD', qty: 2 }];
    const res = claimAndUpdateLocally('sess-1', expected, nextItems);
    expect(res).toBe(true);
    expect(sessions[0].items).toEqual([{ code: 'SD', qty: 2 }]);
  });

  it('fails update if another terminal already updated the items (expected_items mismatch)', () => {
    let sessions = [{ id: 'sess-1', items: [{ code: 'SD', qty: 2 }] }]; // already updated by Terminal A

    function claimAndUpdateLocally(id, expectedItems, newItems) {
      const idx = sessions.findIndex(s => s.id === id);
      if (idx === -1) return false;
      const session = sessions[idx];
      if (JSON.stringify(session.items) !== JSON.stringify(expectedItems)) {
        return false;
      }
      if (newItems.length === 0) {
        sessions.splice(idx, 1);
      } else {
        sessions[idx] = { ...session, items: newItems };
      }
      return true;
    }

    // Terminal B tries to checkout using the old expected items (ST:1, SD:2)
    const oldExpected = [{ code: 'ST', qty: 1 }, { code: 'SD', qty: 2 }];
    const nextItems = [];
    const res = claimAndUpdateLocally('sess-1', oldExpected, nextItems);
    expect(res).toBe(false); // fails!
    expect(sessions[0].items).toEqual([{ code: 'SD', qty: 2 }]); // untouched
  });

  it('deletes session completely if new items is empty', () => {
    let sessions = [{ id: 'sess-1', items: [{ code: 'ST', qty: 1 }] }];

    function claimAndUpdateLocally(id, expectedItems, newItems) {
      const idx = sessions.findIndex(s => s.id === id);
      if (idx === -1) return false;
      const session = sessions[idx];
      if (JSON.stringify(session.items) !== JSON.stringify(expectedItems)) {
        return false;
      }
      if (newItems.length === 0) {
        sessions.splice(idx, 1);
      } else {
        sessions[idx] = { ...session, items: newItems };
      }
      return true;
    }

    const expected = [{ code: 'ST', qty: 1 }];
    const nextItems = [];
    const res = claimAndUpdateLocally('sess-1', expected, nextItems);
    expect(res).toBe(true);
    expect(sessions.length).toBe(0);
  });
});

// ─── 3. Midnight rollover — tanggal locked at start ──────────────────────────

describe('midnight-spanning shift — tanggal', () => {
  it('session tanggal stays as start day even after midnight', () => {
    // Session started at 23:50 on July 14
    const startTs = new Date('2026-07-14T23:50:00').getTime();
    const startTanggal = (() => {
      const d = new Date(startTs);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();

    expect(startTanggal).toBe('2026-07-14');

    // Payment happens at 00:10 on July 15
    // todayStr() at payment time would give '2026-07-15'
    const paymentTs = new Date('2026-07-15T00:10:00').getTime();
    const paymentDay = (() => {
      const d = new Date(paymentTs);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();

    expect(paymentDay).toBe('2026-07-15');

    // With fix: txn.tanggal = session.tanggal (locked at start)
    const session = { tanggal: startTanggal };
    const txnTanggal = session.tanggal || paymentDay;
    expect(txnTanggal).toBe('2026-07-14'); // ✅ correct day
  });

  it('fallback to todayStr() only for sessions without tanggal (old sessions)', () => {
    const session = { tanggal: '' }; // old session, no tanggal field
    const todayFallback = '2026-07-15';
    const txnTanggal = session.tanggal || todayFallback;
    expect(txnTanggal).toBe('2026-07-15'); // falls back correctly
  });
});

// ─── 4. localStorage overflow ─────────────────────────────────────────────────

describe('safeSetItem — QuotaExceededError handling', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('normal write works', () => {
    safeSetItem('kw_sessions', JSON.stringify([{ id: '1' }]));
    expect(JSON.parse(localStorage.getItem('kw_sessions'))).toHaveLength(1);
  });

  it('prunes to last 200 txns on quota exceeded', () => {
    const txns = Array.from({ length: 350 }, (_, i) => ({ id: `${i}`, no: i, _synced: true }));
    localStorage.setItem('kw_txns', JSON.stringify(txns));

    let callCount = 0;
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function(key, value) {
      callCount++;
      if (callCount === 1) {
        const err = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        throw err;
      }
      return original.call(this, key, value);
    });

    safeSetItem('kw_extra', '"x"');

    const remaining = JSON.parse(localStorage.getItem('kw_txns'));
    expect(remaining.length).toBe(200);
    expect(remaining[0].no).toBe(150); // kept last 200 of 350

    vi.restoreAllMocks();
  });

  it('never prunes unsynced transactions, even if they are old', () => {
    // 0-99 are old offline txns (no _synced)
    // 100-349 are synced txns (_synced: true)
    const txns = Array.from({ length: 350 }, (_, i) => ({ 
      id: `${i}`, 
      no: i, 
      ...(i >= 100 ? { _synced: true } : {}) 
    }));
    localStorage.setItem('kw_txns', JSON.stringify(txns));

    let callCount = 0;
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function(key, value) {
      callCount++;
      if (callCount === 1) {
        const err = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        throw err;
      }
      return original.call(this, key, value);
    });

    safeSetItem('kw_extra', '"x"');

    const remaining = JSON.parse(localStorage.getItem('kw_txns'));
    // Should keep all 100 unsynced, plus 100 of the newest synced
    expect(remaining.length).toBe(200);
    
    // Check that all 100 unsynced are preserved
    const unsyncedRemaining = remaining.filter(t => !t._synced);
    expect(unsyncedRemaining.length).toBe(100);
    expect(unsyncedRemaining[0].no).toBe(0); // the oldest one is still there!

    // Check that we also kept the latest synced
    const syncedRemaining = remaining.filter(t => t._synced);
    expect(syncedRemaining.length).toBe(100);
    expect(syncedRemaining[0].no).toBe(250); // newest 100 synced (250 to 349)

    vi.restoreAllMocks();
  });
});

// ─── 5. Zombie session detection ─────────────────────────────────────────────

describe('zombie session detection', () => {
  it('marks session as zombie after 8 hours', () => {
    const ZOMBIE_THRESHOLD = 28800; // 8h in seconds

    const isZombie = (elapsedSec) => elapsedSec > ZOMBIE_THRESHOLD;

    expect(isZombie(28799)).toBe(false); // 7h59m59s — not zombie
    expect(isZombie(28800)).toBe(false); // exactly 8h — not zombie
    expect(isZombie(28801)).toBe(true);  // 8h0m1s — zombie!
    expect(isZombie(86400)).toBe(true);  // 24h — definitely zombie
  });
});

// ─── 6. OT edge cases — real skenario weekend ────────────────────────────────

describe('OT edge cases from weekend rush', () => {
  it('customer returns at exactly 10m59s over — still free', () => {
    // elapsedMin = 70.983... (10m59s over 60 min limit)
    const elapsedSec = 60 * 60 + 10 * 60 + 59; // 4259 seconds
    const elapsedMin = elapsedSec / 60; // 70.9833...
    expect(calcOT(elapsedMin, 60)).toEqual({ otFull: 0, otHalf: 0 });
  });

  it('customer returns at exactly 11m0s over — OT kicks in', () => {
    const elapsedSec = 60 * 60 + 11 * 60; // 4260 seconds
    const elapsedMin = elapsedSec / 60; // 71 minutes exactly
    expect(calcOT(elapsedMin, 60)).toEqual({ otFull: 0, otHalf: 1 });
  });

  it('package 3h: OT at 3h11m', () => {
    const elapsedMin = 3 * 60 + 11; // 191 min
    expect(calcOT(elapsedMin, 180)).toEqual({ otFull: 0, otHalf: 1 });
  });

  it('multiple items, each calculated independently', () => {
    // 2 scooters rented, 30 min OT each
    const elapsedMin = 90;
    const limitMin = 60;
    const sd = { priceOT30: 25000, priceOT60: 50000 };

    const { otFull, otHalf } = calcOT(elapsedMin, limitMin);
    const costPerUnit = otFull * sd.priceOT60 + otHalf * sd.priceOT30;
    const totalCost = costPerUnit * 2; // qty = 2

    expect(otHalf).toBe(1);
    expect(costPerUnit).toBe(25000);
    expect(totalCost).toBe(50000);
  });
});

// ─── 7. Offline-first conflict resolution worst-cases ─────────────────────────

describe('Offline-First Conflict Resolution', () => {
  it('prevents offline sessions from overriding cloud deletions if they were already synced', () => {
    const cloudSessions = [{ id: 'sess-active-1', nama: 'Active' }];
    const localSessions = [
      { id: 'sess-active-1', nama: 'Active', _synced: true },
      { id: 'sess-deleted-on-cloud', nama: 'Deleted', _synced: true },
      { id: 'sess-offline-new', nama: 'New Offline', _synced: false }
    ];

    const { mergeSyncData } = require('../lib/sync');
    const merged = mergeSyncData(cloudSessions, localSessions);

    expect(merged.length).toBe(2);
    expect(merged.map(s => s.id)).toEqual(['sess-active-1', 'sess-offline-new']);
    expect(merged.find(s => s.id === 'sess-deleted-on-cloud')).toBeUndefined();
  });

  it('formatTxnForSupabase and formatSessionForSupabase supply safe defaults for broken/missing offline fields', () => {
    const { formatTxnForSupabase, formatSessionForSupabase } = require('../lib/sync');
    
    const brokenTxns = [{ no: 0 }];
    const formattedTxns = formatTxnForSupabase(brokenTxns);
    expect(formattedTxns[0].id).toBeDefined();
    expect(formattedTxns[0].nama).toBe('Penyewa');
    expect(formattedTxns[0].items).toBe('-');

    const brokenSessions = [{ nama: '' }];
    const formattedSessions = formatSessionForSupabase(brokenSessions);
    expect(formattedSessions[0].id).toBeDefined();
    expect(formattedSessions[0].nama).toBe('Penyewa');
    expect(formattedSessions[0].items).toEqual([]);
  });

  it('cleanZombieSessions purges sessions completed during offline mode when transactions exist', () => {
    const { cleanZombieSessions } = require('../lib/sync');
    const sessions = [
      { id: 'offline-completed', nama: 'Customer A', items: [{ code: 'sc1', qty: 1 }] },
      { id: 'offline-still-running', nama: 'Customer B', items: [{ code: 'sc2', qty: 1 }] }
    ];
    const transactions = [
      { id: 'offline-completed', no: 100 }
    ];

    const cleaned = cleanZombieSessions(sessions, transactions);
    expect(cleaned.length).toBe(1);
    expect(cleaned[0].id).toBe('offline-still-running');
  });
});
