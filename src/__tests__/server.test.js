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

  it('add_session auto-assigns sequential queue numbers per shift when queueNo omitted', () => {
    const s1 = handleAction('add_session', { id: 's-q1', nama: 'Satu', tanggal: '2026-08-07' });
    expect(s1.success).toBe(true);
    expect(s1.session.queueNo).toBe(1);

    const s2 = handleAction('add_session', { id: 's-q2', nama: 'Dua', tanggal: '2026-08-07' });
    expect(s2.session.queueNo).toBe(2);

    // Shift baru memulai nomor dari 1 kembali
    const s3 = handleAction('add_session', { id: 's-q3', nama: 'Tiga', tanggal: '2026-08-08' });
    expect(s3.session.queueNo).toBe(1);

    // Upsert id yang sama tidak menambah ulang nomor antrian
    const s1b = handleAction('add_session', { id: 's-q1', nama: 'Satu-edit', tanggal: '2026-08-07' });
    expect(s1b.session.queueNo).toBe(1);

    // Sesi aktif tetap dihitung sebagai nomor terpakai shift tsb
    const s4 = handleAction('add_session', { id: 's-q4', nama: 'Empat', tanggal: '2026-08-08' });
    expect(s4.session.queueNo).toBe(2);

    // Transaksi yang sudah diklaim juga menghabiskan nomor untuk shift tsb
    handleAction('claim_session', { sessionId: 's-q4', queueNo: 2, nama: 'Empat', tanggal: '2026-08-08', remainingItems: [] });
    const s5 = handleAction('add_session', { id: 's-q5', nama: 'Lima', tanggal: '2026-08-08' });
    expect(s5.session.queueNo).toBe(3);

    const s6 = handleAction('add_session', { id: 's-q6', nama: 'Enam', tanggal: '2026-08-07' });
    expect(s6.session.queueNo).toBe(3);
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

  it('claim_session updates active session items on partial return instead of deleting session', () => {
    handleAction('add_session', {
      id: 's-partial01',
      queueNo: 2,
      nama: 'Partial Return Customer',
      items: [{ code: 'SCT', qty: 4 }],
      startTime: 1700000000000,
      tanggal: '2026-07-26',
      payAwal: 'cash'
    });

    const claimPartialPayload = {
      sessionId: 's-partial01',
      queueNo: 2,
      nama: 'Partial Return Customer',
      tanggal: '2026-07-26',
      startTime: 1700000000000,
      endTime: 1700003600000,
      items: 'SCT×2',
      remainingItems: [{ code: 'SCT', qty: 2 }],
      totalBase: 70000,
      grandTotal: 70000,
      totalAll: 70000,
      payAwal: 'cash'
    };

    const res = handleAction('claim_session', claimPartialPayload);
    expect(res.success).toBe(true);

    const fetched = handleAction('fetch_data');
    expect(fetched.transactions).toHaveLength(1);
    expect(fetched.transactions[0].items).toBe('SCT×2');

    // Sesi aktif HARUS MASIH ADA dengan sisa 2 skuter
    expect(fetched.sessions).toHaveLength(1);
    expect(fetched.sessions[0].id).toBe('s-partial01');
    expect(fetched.sessions[0].items).toEqual([{ code: 'SCT', qty: 2 }]);

    // Saat sisa 2 skuter dikembalikan, sesi aktif baru terhapus
    const claimRemainingPayload = {
      sessionId: 's-partial01',
      queueNo: 2,
      nama: 'Partial Return Customer',
      tanggal: '2026-07-26',
      startTime: 1700000000000,
      endTime: 1700007200000,
      items: 'SCT×2',
      remainingItems: [],
      totalBase: 70000,
      grandTotal: 70000,
      totalAll: 70000,
      payAwal: 'cash'
    };

    const resFinal = handleAction('claim_session', claimRemainingPayload);
    expect(resFinal.success).toBe(true);

    const fetchedFinal = handleAction('fetch_data');
    expect(fetchedFinal.sessions).toHaveLength(0);
    expect(fetchedFinal.transactions).toHaveLength(2);
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

  it('claim_session enforces atomic invariant and rejects concurrent double-claim', () => {
    // Setup 1 active session
    const addRes = handleAction('add_session', {
      id: 's-race-01',
      queueNo: 7,
      nama: 'Race Condition Test',
      tanggal: '2026-08-25',
      items: [{ code: 'SA', qty: 1 }],
      startTime: 1700000000000
    });
    expect(addRes.success).toBe(true);

    const claimPayload = {
      sessionId: 's-race-01',
      queueNo: 7,
      nama: 'Race Condition Test',
      tanggal: '2026-08-25',
      startTime: 1700000000000,
      endTime: 1700003600000,
      items: 'SA x1',
      totalBase: 50000,
      grandTotal: 50000,
      totalAll: 50000,
      remainingItems: []
    };

    // Simulasi Kasir A mengklaim sesi
    const kasirARes = handleAction('claim_session', claimPayload);
    expect(kasirARes.success).toBe(true);
    expect(kasirARes.transaction).toBeDefined();

    // Simulasi Kasir B mencoba mengklaim sesi yang sama
    const kasirBRes = handleAction('claim_session', claimPayload);
    expect(kasirBRes.success).toBe(false);
    expect(kasirBRes.error).toMatch(/Session not found or already claimed/i);

    // Verifikasi state database akhir: persis 0 active session dan persis 1 transaction
    const finalData = handleAction('fetch_data');
    expect(finalData.sessions).toHaveLength(0);
    expect(finalData.transactions).toHaveLength(1);
    expect(finalData.transactions[0].id).toBe(kasirARes.transaction.id);
  });
});

