const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// If DATABASE_URL is provided, use Postgres (Supabase). Otherwise fall back to a JSON file.
if (process.env.DATABASE_URL) {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

  // Use a dedicated schema 'codetorch' for isolation
  const SCHEMA = process.env.DB_SCHEMA || 'codetorch';

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
  })().catch((err) => console.error('Failed to initialize Postgres schema/table:', err));

  async function getAllMessages() {
    const res = await pool.query(`SELECT * FROM ${SCHEMA}.messages ORDER BY id ASC`);
    return res.rows;
  }

  async function addMessage({ author, content, blockId }) {
    const res = await pool.query(
      `INSERT INTO ${SCHEMA}.messages (author, content, blockId, createdAt) VALUES ($1,$2,$3,now()) RETURNING *`,
      [author || null, content, blockId || null]
    );
    return res.rows[0];
  }

  module.exports = { getAllMessages, addMessage };

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
