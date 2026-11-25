'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || '/data';
const DATA_FILE = path.join(DATA_DIR, 'orders.json');
const PUBLIC = path.join(__dirname, 'public');

fs.mkdirSync(DATA_DIR, { recursive: true });

let orders = {};
try {
  orders = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
} catch (e) {
  if (e.code !== 'ENOENT') console.error('Could not read', DATA_FILE, e.message);
}

// Write to a temp file, then rename, so a crash never leaves a half-written file.
let writing = Promise.resolve();
function save() {
  writing = writing.then(() => {
    const tmp = DATA_FILE + '.tmp';
    return fs.promises.writeFile(tmp, JSON.stringify(orders, null, 2))
      .then(() => fs.promises.rename(tmp, DATA_FILE))
      .catch((e) => console.error('Save failed:', e.message));
  });
  return writing;
}

function send(res, code, body, type) {
  res.writeHead(code, { 'Content-Type': type || 'application/json', 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 1e6) { reject(new Error('too large')); req.destroy(); }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function clean(id, o) {
  if (!o || typeof o !== 'object' || !Array.isArray(o.items)) return null;
  return {
    id,
    customer: String(o.customer || '').slice(0, 200),
    note: String(o.note || '').slice(0, 500),
    created: Number(o.created) || Date.now(),
    delivered: !!o.delivered,
    deliveredAt: o.deliveredAt ? Number(o.deliveredAt) : undefined,
    items: o.items.slice(0, 200).map((i) => ({
      name: String(i.name || '').slice(0, 200),
      qty: Math.max(1, parseInt(i.qty, 10) || 1),
      color: String(i.color || '').slice(0, 100),
      printed: !!i.printed,
    })),
  };
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    const m = url.pathname.match(/^\/api\/orders(?:\/([A-Za-z0-9]{1,40}))?$/);

    if (m) {
      const id = m[1];
      if (req.method === 'GET' && !id) {
        return send(res, 200, Object.values(orders).sort((a, b) => b.created - a.created));
      }
      if (req.method === 'PUT' && id) {
        const o = clean(id, JSON.parse(await readBody(req)));
        if (!o) return send(res, 400, { error: 'bad order' });
        orders[id] = o;
        await save();
        return send(res, 200, o);
      }
      if (req.method === 'DELETE' && id) {
        delete orders[id];
        await save();
        return send(res, 200, { ok: true });
      }
      return send(res, 405, { error: 'method not allowed' });
    }

    if (url.pathname === '/healthz') return send(res, 200, { ok: true });

    if (req.method === 'GET') {
      const file = url.pathname === '/' ? '/index.html' : url.pathname;
      const full = path.normalize(path.join(PUBLIC, file));
      if (full.startsWith(PUBLIC + path.sep) && fs.existsSync(full) && fs.statSync(full).isFile()) {
        return send(res, 200, fs.readFileSync(full), TYPES[path.extname(full)] || 'application/octet-stream');
      }
    }
    send(res, 404, { error: 'not found' });
  } catch (e) {
    console.error(e.message);
    send(res, 400, { error: 'bad request' });
  }
}).listen(PORT, () => console.log(`Print order tracker on http://localhost:${PORT} (data: ${DATA_FILE})`));
