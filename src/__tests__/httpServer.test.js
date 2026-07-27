import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testDbPath = path.join(__dirname, 'test-http-kasir.db');

describe('HTTP Server Integration (TDD)', () => {
  let server, testPort, db;

  beforeEach(async () => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    const dbModule = await import('../../server/db.js');
    db = dbModule.initDb(testDbPath);

    const { createHttpServer } = await import('../../server/index.js');
    server = createHttpServer();

    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        testPort = server.address().port;
        resolve();
      });
    });
  });

  afterEach(async () => {
    if (server && server.close) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (db && typeof db.close === 'function') {
      try { db.close(); } catch (e) {}
    }
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch (e) {}
    }
  });

  it('responds with 400 Bad Request on malformed JSON body', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid-json{'
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Bad Request: Invalid JSON');
  });

  it('responds with 413 Payload Too Large when POST body exceeds 1MB', async () => {
    const hugeBody = JSON.stringify({ action: 'add_session', payload: { data: 'a'.repeat(1.2 * 1024 * 1024) } });
    const res = await fetch(`http://127.0.0.1:${testPort}/api`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: hugeBody
    });
    expect(res.status).toBe(413);
    const json = await res.json();
    expect(json.error).toBe('Payload Too Large');
  });

  it('responds with 404 Not Found for non-API route paths', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/invalid-route`);
    expect(res.status).toBe(404);
  });

  it('includes proper CORS headers on responses', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api`);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('saves custom cashier user and returns password in fetch_data response', async () => {
    // 1. Save user via API
    const saveRes = await fetch(`http://127.0.0.1:${testPort}/api`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save_user',
        payload: { username: 'monica_custom', password: 'secretPassword888', role: 'cashier' }
      })
    });
    expect(saveRes.status).toBe(200);
    const saveJson = await saveRes.json();
    expect(saveJson.success).toBe(true);

    // 2. Fetch data via API and verify password is returned
    const fetchRes = await fetch(`http://127.0.0.1:${testPort}/api`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'fetch_data' })
    });
    const data = await fetchRes.json();
    const foundUser = data.users.find(u => u.username === 'monica_custom');
    expect(foundUser).toBeDefined();
    expect(foundUser.password).toBe('secretPassword888');
    expect(foundUser.role).toBe('cashier');
  });
});
