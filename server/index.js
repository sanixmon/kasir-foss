import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDb, handleAction, fetchAllData, backupDatabase, resolveToken } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'data', 'kasir.db');
initDb(dbPath);

export function createHttpServer() {
  return http.createServer((req, res) => {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const bearerToken = (() => {
      const h = req.headers['authorization'];
      if (!h) return null;
      const m = /^Bearer\s+(.+)$/i.exec(h);
      return m ? m[1].trim() : null;
    })();

    const cleanPath = (req.url || '/').split('?')[0];
    if (cleanPath !== '/' && cleanPath !== '/api') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
      return;
    }

    if (req.method === 'GET') {
      if (!resolveToken(bearerToken)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized: login required', code: 'UNAUTHORIZED' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(fetchAllData()));
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      let isDestroyed = false;

      req.on('data', chunk => {
        if (isDestroyed) return;
        body += chunk.toString();
        if (body.length > 1e6) { // 1MB payload limit guard
          isDestroyed = true;
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Payload Too Large' }));
          req.destroy();
        }
      });

      req.on('end', () => {
        if (isDestroyed) return;
        try {
          const data = JSON.parse(body || '{}');
          const action = data.action || 'fetch_data';
          const payload = data.payload || {};
          const token = bearerToken || (data.token ? String(data.token) : null);
          const auth = resolveToken(token);

          const result = handleAction(action, payload, auth);
          const status = result && result.code === 'UNAUTHORIZED' ? 401
            : result && result.code === 'FORBIDDEN' ? 403
            : 200;
          res.writeHead(status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (err) {
          if (err instanceof SyntaxError) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Bad Request: Invalid JSON' }));
          } else {
            console.error('Server error processing request:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
        }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  });
}

const PORT = process.env.PORT || 3001;

if (process.env.NODE_ENV !== 'test') {
  const server = createHttpServer();
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`🚀 Kasir DB Server running on http://localhost:${PORT}`);
    const result = backupDatabase();
    if (result.success) {
      console.log(`💾 Initial backup created: ${result.path}`);
    } else {
      console.warn('⚠️ Initial backup failed:', result.error);
    }
  });

  // Hourly automatic backup
  setInterval(() => {
    const result = backupDatabase();
    if (result.success) {
      console.log(`💾 Hourly backup: ${result.path}`);
    }
  }, 3600000);
}
