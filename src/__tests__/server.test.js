import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testDbPath = path.join(__dirname, 'test-kasir.db');

describe('SQLite Backend Server Logic (TDD)', () => {
  let handleAction, db;

  beforeEach(async () => {
    // Remove test DB if exists
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Dynamic import of backend logic module initialized with test db
    const serverModule = await import('../../server/db.js');
    db = serverModule.initDb(testDbPath);
    handleAction = serverModule.handleAction;
  });

  afterEach(() => {
    if (db && typeof db.close === 'function') {
      try { db.close(); } catch (e) {}
    }
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch (e) {}
    }
  });

  it('fetch_data initially returns empty sessions and transactions', () => {
    const res = handleAction('fetch_data');
    expect(res).toEqual({ sessions: [], transactions: [], users: [], settings: {} });
  });

  it('add_session inserts a new active session and returns it formatted', () => {
    const sessionData = {
      id: 's-test01',
      queueNo: 1,
      nama: 'Budi Test',
      items: [{ code: 'SA', qty: 2 }],
      startTime: 1700000000000,
      tanggal: '2026-07-26',
      payAwal: 'cash'
    };

    const res = handleAction('add_session', sessionData);
    expect(res.success).toBe(true);
    expect(res.session).toEqual(sessionData);

    const fetched = handleAction('fetch_data');
    expect(fetched.sessions).toHaveLength(1);
    expect(fetched.sessions[0]).toEqual(sessionData);
  });

  it('edit_session updates active session details', () => {
    const sessionData = {
      id: 's-test01',
      queueNo: 1,
      nama: 'Budi Test',
      items: [{ code: 'SA', qty: 2 }],
      startTime: 1700000000000,
      tanggal: '2026-07-26',
      payAwal: 'cash'
    };
    handleAction('add_session', sessionData);

    const updatedData = {
      ...sessionData,
      nama: 'Budi Updated',
      items: [{ code: 'SA', qty: 3 }]
    };
    const res = handleAction('edit_session', updatedData);

    expect(res.success).toBe(true);
    expect(res.session.nama).toBe('Budi Updated');
    expect(res.session.items).toEqual([{ code: 'SA', qty: 3 }]);

    const fetched = handleAction('fetch_data');
    expect(fetched.sessions[0].nama).toBe('Budi Updated');
  });

  it('delete_session removes an active session by id', () => {
    handleAction('add_session', { id: 's-test01', nama: 'Test' });
    expect(handleAction('fetch_data').sessions).toHaveLength(1);

    const res = handleAction('delete_session', { id: 's-test01' });
    expect(res.success).toBe(true);
    expect(handleAction('fetch_data').sessions).toHaveLength(0);
  });

  it('claim_session deletes active session and inserts transaction with sequential "no"', () => {
    handleAction('add_session', { id: 's-test01', nama: 'Customer 1', queueNo: 1 });

    const claimPayload = {
      sessionId: 's-test01',
      queueNo: 1,
      nama: 'Customer 1',
      tanggal: '2026-07-26',
      startTime: 1700000000000,
      endTime: 1700003600000,
      items: 'SA×1',
      ot: '0',
      otDur: '00:00:00',
      totalBase: 35000,
      totalOT: 0,
      totalTol: 0,
      grandTotal: 35000,
      totalAll: 35000,
      payAwal: 'cash',
      cash: 50000,
      qris: 0,
      shift: 'Kasir1'
    };

    const res = handleAction('claim_session', claimPayload);
    expect(res.success).toBe(true);
    expect(res.transaction.no).toBe(1);
    expect(res.transaction.nama).toBe('Customer 1');

    // Active session should be deleted
    expect(handleAction('fetch_data').sessions).toHaveLength(0);

    // Transaction should exist in ledger
    const fetched = handleAction('fetch_data');
    expect(fetched.transactions).toHaveLength(1);
    expect(fetched.transactions[0].no).toBe(1);
  });

  it('save_setting upserts system setting key-values', () => {
    const res = handleAction('save_setting', { key: 'theme', value: 'dark' });
    expect(res.success).toBe(true);
  });

  it('save_user upserts user accounts', () => {
    const res = handleAction('save_user', { username: 'admin', password: '123', role: 'admin' });
    expect(res.success).toBe(true);
  });

  it('claim_session fails gracefully if session does not exist or was already claimed', () => {
    const claimPayload = {
      sessionId: 's-nonexistent',
      nama: 'Ghost'
    };
    const res = handleAction('claim_session', claimPayload);
    expect(res.success).toBe(false);
    expect(res.error).toBe('Session not found or already claimed');
  });

  it('edit_session fails gracefully if session does not exist', () => {
    const res = handleAction('edit_session', { id: 's-nonexistent', nama: 'Ghost' });
    expect(res.success).toBe(false);
    expect(res.error).toBe('Session not found');
  });

  it('edit_session preserves existing omitted fields during partial updates', () => {
    handleAction('add_session', {
      id: 's-partial',
      nama: 'Original Name',
      payAwal: 'qris',
      items: [{ code: 'SA', qty: 1 }]
    });

    const res = handleAction('edit_session', {
      id: 's-partial',
      nama: 'Updated Name'
    });

    expect(res.success).toBe(true);
    expect(res.session.nama).toBe('Updated Name');
    expect(res.session.payAwal).toBe('qris');
    expect(res.session.items).toEqual([{ code: 'SA', qty: 1 }]);
  });

  it('save_user and delete_user perform full user CRUD on SQLite database', () => {
    // CREATE
    const resCreate = handleAction('save_user', { username: 'kasir1', password: 'pass123', role: 'cashier' });
    expect(resCreate.success).toBe(true);

    // READ via raw db query
    const rowBefore = db.prepare('SELECT * FROM users WHERE username = ?').get('kasir1');
    expect(rowBefore).toEqual({ username: 'kasir1', password: 'pass123', role: 'cashier' });

    // UPDATE
    const resUpdate = handleAction('save_user', { username: 'kasir1', password: 'newpass456', role: 'admin' });
    expect(resUpdate.success).toBe(true);

    const rowUpdated = db.prepare('SELECT * FROM users WHERE username = ?').get('kasir1');
    expect(rowUpdated).toEqual({ username: 'kasir1', password: 'newpass456', role: 'admin' });

    // DELETE USER
    const resDelete = handleAction('delete_user', { username: 'kasir1' });
    expect(resDelete.success).toBe(true);

    const rowAfter = db.prepare('SELECT * FROM users WHERE username = ?').get('kasir1');
    expect(rowAfter).toBeUndefined();
  });

  it('delete_txn removes a transaction record from SQLite database', () => {
    handleAction('add_session', { id: 's-del', queueNo: 5, nama: 'Delete Me' });
    handleAction('claim_session', { sessionId: 's-del', queueNo: 5, nama: 'Delete Me', grandTotal: 50000 });

    const fetchedBefore = handleAction('fetch_data');
    expect(fetchedBefore.transactions).toHaveLength(1);
    const txnId = fetchedBefore.transactions[0].id;

    const res = handleAction('delete_txn', { id: txnId });
    expect(res.success).toBe(true);

    const fetchedAfter = handleAction('fetch_data');
    expect(fetchedAfter.transactions).toHaveLength(0);
  });
});
