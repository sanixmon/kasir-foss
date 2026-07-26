import { describe, it, expect } from 'vitest';
import { mergeSyncData, getUnsyncedItems, formatTxnForSupabase, formatSessionForSupabase, cleanZombieSessions, findZombieSessionIds } from '../lib/sync';

describe('mergeSyncData', () => {
  it('keeps completely new offline data', () => {
    const cloudData = [{ id: '1', name: 'A' }];
    const localData = [{ id: '1', name: 'A', _synced: true }, { id: '2', name: 'B' }];
    
    // '2' is not in cloud and not synced, so it's a new offline item
    const merged = mergeSyncData(cloudData, localData);
    expect(merged.length).toBe(2);
    expect(merged.find(x => x.id === '2')).toBeDefined();
  });

  it('removes zombie data (synced before but missing in cloud)', () => {
    const cloudData = [{ id: '1', name: 'A' }];
    // '3' was previously synced but is now missing from cloudData (deleted on server)
    const localData = [
      { id: '1', name: 'A', _synced: true },
      { id: '3', name: 'C', _synced: true } 
    ];
    
    const merged = mergeSyncData(cloudData, localData);
    expect(merged.length).toBe(1); // '3' should NOT be resurrected!
    expect(merged.find(x => x.id === '3')).toBeUndefined();
  });

  it('merges with additional offline filtering logic (like active_sessions checking against currentTxns)', () => {
    const cloudData = [{ id: '1', name: 'A' }];
    const localData = [
      { id: '1', name: 'A', _synced: true },
      { id: '4', name: 'D' } // Offline, but let's say it's checked out
    ];
    // customFilter returns true to keep, false to drop
    // '4' is in currentTxns so it should be dropped from sessions
    const customFilter = (item) => item.id !== '4'; 

    const merged = mergeSyncData(cloudData, localData, customFilter);
    expect(merged.length).toBe(1);
    expect(merged.find(x => x.id === '4')).toBeUndefined();
  });
});

describe('Auto-push helpers', () => {
  it('getUnsyncedItems returns items where _synced is falsy or undefined', () => {
    const items = [
      { id: 'a', _synced: true },
      { id: 'b', _synced: false },
      { id: 'c' }
    ];
    const unsynced = getUnsyncedItems(items);
    expect(unsynced.length).toBe(2);
    expect(unsynced.map(x => x.id)).toEqual(['b', 'c']);
  });

  it('formatTxnForSupabase converts camelCase transaction objects to Supabase snake_case rows', () => {
    const txns = [{
      id: 'tx-1',
      no: 1,
      queueNo: 5,
      nama: 'John',
      tanggal: '2026-07-26',
      startTime: 100,
      endTime: 200,
      items: '1x Mobil',
      totalBase: 50000,
      grandTotal: 0,
      totalAll: 50000,
      payAwal: 'cash'
    }];
    const formatted = formatTxnForSupabase(txns);
    expect(formatted[0]).toEqual({
      id: 'tx-1',
      no: 1,
      queue_no: 5,
      nama: 'John',
      tanggal: '2026-07-26',
      start_time: 100,
      end_time: 200,
      items: '1x Mobil',
      ot: '-',
      ot_dur: '-',
      total_base: 50000,
      total_ot: 0,
      total_tol: 0,
      grand_total: 0,
      total_all: 50000,
      pay_awal: 'cash',
      cash: 0,
      qris: 0,
      shift: '-'
    });
  });

  it('formatSessionForSupabase converts camelCase session objects to Supabase snake_case rows', () => {
    const sessions = [{
      id: 'sess-1',
      nama: 'Jane',
      items: ['Mobil A'],
      startTime: 100,
      tanggal: '2026-07-26',
      queueNo: 2,
      payAwal: 'qris'
    }];
    const formatted = formatSessionForSupabase(sessions);
    expect(formatted[0]).toEqual({
      id: 'sess-1',
      nama: 'Jane',
      items: ['Mobil A'],
      start_time: 100,
      tanggal: '2026-07-26',
      queue_no: 2,
      pay_awal: 'qris'
    });
  });

  it('cleanZombieSessions filters out sessions whose ID exists in completed transactions or have no items', () => {
    const sessions = [
      { id: 'sess-active', nama: 'Active Customer', items: [{ code: 'sc1', qty: 1 }] },
      { id: 'sess-completed', nama: 'Completed Customer', items: [{ code: 'sc1', qty: 1 }] },
      { id: 'sess-empty', nama: 'Empty Customer', items: [] }
    ];
    const transactions = [
      { id: 'sess-completed', no: 1 }
    ];

    const cleaned = cleanZombieSessions(sessions, transactions);
    expect(cleaned.length).toBe(1);
    expect(cleaned[0].id).toBe('sess-active');
  });

  it('findZombieSessionIds returns array of zombie session IDs', () => {
    const sessions = [
      { id: 'sess-active', nama: 'Active Customer', items: [{ code: 'sc1', qty: 1 }] },
      { id: 'sess-zombie1', nama: 'Completed Customer', items: [{ code: 'sc1', qty: 1 }] },
      { id: 'sess-zombie2', nama: 'Empty Customer', items: [] }
    ];
    const transactions = [
      { id: 'sess-zombie1', no: 1 }
    ];

    const zombieIds = findZombieSessionIds(sessions, transactions);
    expect(zombieIds).toEqual(['sess-zombie1', 'sess-zombie2']);
  });
});
