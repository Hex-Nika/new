const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// If USE_VEREL_KV=1 use Vercel KV; if a Postgres connection string is provided, use Postgres; otherwise fall back to a JSON file.
// Prefer STORAGE_POSTGRES_URL (Supabase) when present.
let CONNECTION_STRING = null;
let CONNECTION_SOURCE = null;
if (process.env.STORAGE_POSTGRES_URL) {
  CONNECTION_STRING = process.env.STORAGE_POSTGRES_URL;
  CONNECTION_SOURCE = 'STORAGE_POSTGRES_URL';
} else if (process.env.STORAGE_POSTGRES_PRISMA_URL) {
  CONNECTION_STRING = process.env.STORAGE_POSTGRES_PRISMA_URL;
  CONNECTION_SOURCE = 'STORAGE_POSTGRES_PRISMA_URL';
} else if (process.env.STORAGE_POSTGRES_URL_NON_POOLING) {
  CONNECTION_STRING = process.env.STORAGE_POSTGRES_URL_NON_POOLING;
  CONNECTION_SOURCE = 'STORAGE_POSTGRES_URL_NON_POOLING';
} else if (process.env.DATABASE_URL) {
  CONNECTION_STRING = process.env.DATABASE_URL;
  CONNECTION_SOURCE = 'DATABASE_URL';
} else if (process.env.DATABASE_URI) {
  CONNECTION_STRING = process.env.DATABASE_URI.trim();
  CONNECTION_SOURCE = 'DATABASE_URI';
}

if (process.env.USE_VEREL_KV === '1') {
  // Vercel KV backend
  const kv = require('@vercel/kv');
  const PREFIX = process.env.KV_PREFIX || 'codetorch';

  async function getAllMessages() {
    const ids = (await kv.get(`${PREFIX}:ids`)) || [];
    const rows = [];
    for (const id of ids) {
      const m = await kv.get(`${PREFIX}:msg:${id}`);
      if (m) rows.push(m);
    }
    return rows.sort((a, b) => (a.id || 0) - (b.id || 0));
  }

  async function addMessage({ author, content, blockId }) {
    const id = await kv.incr(`${PREFIX}:nextId`);
    const createdAt = new Date().toISOString();
    const msg = { id, author: author || null, content, blockId: blockId || null, createdAt };
    await kv.set(`${PREFIX}:msg:${id}`, msg);
    const ids = (await kv.get(`${PREFIX}:ids`)) || [];
    ids.push(id);
    await kv.set(`${PREFIX}:ids`, ids);
    return msg;
  }

  async function getBans() {
    const ids = (await kv.get(`${PREFIX}:bans`)) || [];
    return ids;
  }

  async function addBan(username, reason) {
    const uname = String(username);
    const ids = (await kv.get(`${PREFIX}:bans`)) || [];
    if (!ids.includes(uname)) ids.push(uname);
    await kv.set(`${PREFIX}:bans`, ids);
    if (reason) await kv.set(`${PREFIX}:ban:reason:${uname}`, reason);
    return uname;
  }

  async function removeBan(username) {
    const uname = String(username);
    const ids = (await kv.get(`${PREFIX}:bans`)) || [];
    const filtered = ids.filter(x => x !== uname);
    await kv.set(`${PREFIX}:bans`, filtered);
    await kv.delete(`${PREFIX}:ban:reason:${uname}`);
    return uname;
  }

  module.exports = { getAllMessages, addMessage, getBans, addBan, removeBan };

  module.exports = { getAllMessages, addMessage };

} else if (CONNECTION_STRING) {
  // Use Postgres (Supabase) when a connection string is available
  const { Pool } = require('pg');
  // Some Supabase setups use certificates that Node may reject; disable strict TLS verification
  // for the DB client when the connection string comes from STORAGE_POSTGRES_* or DATABASE_*.
  // This sets a global Node option — acceptable here for compatibility, but be aware of security implications.
  if (!process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    console.log('[codetorch] Warning: disabled TLS certificate verification for Postgres connections (NODE_TLS_REJECT_UNAUTHORIZED=0)');
  }

  const pool = new Pool({ connectionString: CONNECTION_STRING, ssl: { rejectUnauthorized: false } });

  // Use a dedicated schema 'codetorch' for isolation
  const SCHEMA = process.env.DB_SCHEMA || 'codetorch';

  // Log connection info (non-sensitive) to help debug Vercel logs
  try {
    const parsed = new URL(CONNECTION_STRING);
    console.log(`[codetorch] Postgres init host=${parsed.hostname} port=${parsed.port || 5432} schema=${SCHEMA} source=${CONNECTION_SOURCE}`);
  } catch (e) {
    console.log('[codetorch] Postgres init (could not parse host) schema=' + SCHEMA + ' source=' + CONNECTION_SOURCE);
  }

  // Ensure schema and table exist using schema-qualified names
  (async () => {
    await pool.query(`CREATE SCHEMA IF NOT EXISTS ${SCHEMA}`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${SCHEMA}.messages (
        id BIGSERIAL PRIMARY KEY,
        author TEXT,
        content TEXT NOT NULL,
        blockId TEXT,
        createdAt TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS ${SCHEMA}_messages_created_at_idx ON ${SCHEMA}.messages (createdAt)`);
    console.log(`[codetorch] Ensured schema/table exist in schema=${SCHEMA}`);
  })().catch((err) => console.error('Failed to initialize Postgres schema/table:', err));

  async function getAllMessages() {
    const res = await pool.query(`SELECT * FROM ${SCHEMA}.messages ORDER BY id ASC`);
    console.log(`[codetorch] getAllMessages -> returned ${res.rowCount} rows`);
    return res.rows;
  }

  async function getBans() {
    try {
      const r = await pool.query(`SELECT username FROM ${SCHEMA}.bans`);
      return r.rows.map(x => x.username);
    } catch (e) {
      return [];
    }
  }

  async function addBan(username, reason) {
    const res = await pool.query(
      `INSERT INTO ${SCHEMA}.bans (username, reason, createdAt) VALUES ($1,$2,now()) ON CONFLICT (username) DO UPDATE SET reason = EXCLUDED.reason RETURNING *`,
      [username, reason || null]
    );
    return res.rows[0];
  }

  async function removeBan(username) {
    await pool.query(`DELETE FROM ${SCHEMA}.bans WHERE LOWER(username) = LOWER($1)`, [username]);
    return username;
  }

  async function addMessage({ author, content, blockId }) {
    const res = await pool.query(
      `INSERT INTO ${SCHEMA}.messages (author, content, blockId, createdAt) VALUES ($1,$2,$3,now()) RETURNING *`,
      [author || null, content, blockId || null]
    );
    console.log(`[codetorch] addMessage -> inserted id=${res.rows[0] && res.rows[0].id}`);
    return res.rows[0];
  }

  module.exports = { getAllMessages, addMessage, getBans, addBan, removeBan };

} else {
  // Persist to project file when running locally; use /tmp on Vercel (ephemeral).
  let filePath;
  if (process.env.VERCEL) {
    filePath = process.env.DB_FILE_PATH || path.join(os.tmpdir(), 'messages.json');
  } else {
    filePath = process.env.DB_FILE_PATH || path.join(__dirname, '..', '..', 'messages.json');
  }

  async function readFile() {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      return JSON.parse(raw);
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
  }

  async function writeFile(data) {
    await fs.mkdir(path.dirname(filePath), { recursive: true }).catch(() => {});
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  async function getAllMessages() {
    const rows = await readFile();
    // Return chronological order (oldest first)
    return rows.sort((a, b) => (a.id || 0) - (b.id || 0));
  }

  async function getBans() {
    // Look for bans.json or bans array inside messages file
    try {
      const raw = await readFile();
      // if file is an object with bans key
      if (Array.isArray(raw.bans)) return raw.bans.map(b => (typeof b === 'string' ? b : b.username || b.user || b.name)).filter(Boolean);
    } catch (e) {}
    // fallback to separate bans.json
    try {
      const bansRaw = await fs.readFile(path.join(__dirname, '..', '..', 'bans.json'), 'utf8');
      const bans = JSON.parse(bansRaw);
      return Array.isArray(bans) ? bans.map(b => (typeof b === 'string' ? b : b.username || b.user || b.name)).filter(Boolean) : [];
    } catch (e) {
      return [];
    }
  }

  async function addBan(username, reason) {
    // Append to bans.json
    const fp = path.join(__dirname, '..', '..', 'bans.json');
    let arr = [];
    try {
      const raw = await fs.readFile(fp, 'utf8');
      arr = JSON.parse(raw) || [];
    } catch (e) {
      arr = [];
    }
    const uname = String(username);
    if (!arr.includes(uname)) arr.push(uname);
    await fs.writeFile(fp, JSON.stringify(arr, null, 2), 'utf8');
    return uname;
  }

  async function removeBan(username) {
    const fp = path.join(__dirname, '..', '..', 'bans.json');
    let arr = [];
    try {
      const raw = await fs.readFile(fp, 'utf8');
      arr = JSON.parse(raw) || [];
    } catch (e) {
      arr = [];
    }
    const uname = String(username);
    arr = arr.filter(x => x !== uname);
    await fs.writeFile(fp, JSON.stringify(arr, null, 2), 'utf8');
    return uname;
  }

  async function addMessage({ author, content, blockId }) {
    const rows = await readFile();
    // Stable id generation: max existing id + 1
    const maxId = rows.reduce((max, r) => Math.max(max, r.id || 0), 0);
    const id = maxId + 1;
    const createdAt = new Date().toISOString();
    const msg = { id, author: author || null, content, blockId: blockId || null, createdAt };
    rows.push(msg);
    await writeFile(rows);
    return msg;
  }

  module.exports = { getAllMessages, addMessage };
}
