const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');

async function main() {
  const dbUrl = process.env.DATABASE_URL || process.argv[2];
  if (!dbUrl) {
    console.error('Usage: set DATABASE_URL env or pass as first arg');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        author TEXT,
        content TEXT NOT NULL,
        blockId TEXT,
        createdAt TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const filePath = path.join(__dirname, 'messages.json');
    let raw;
    try {
      raw = await fs.readFile(filePath, 'utf8');
    } catch (err) {
      console.error('No messages.json found in project root to migrate.');
      process.exit(0);
    }

    const messages = JSON.parse(raw);
    console.log(`Found ${messages.length} messages in messages.json, checking for inserts...`);

    let inserted = 0;
    for (const m of messages) {
      const author = m.author || null;
      const content = m.content || '';
      const blockId = m.blockId || null;
      const createdAt = m.createdAt || null;

      // Avoid duplicates: check by author+content+createdAt
      const existsRes = await pool.query(
        'SELECT 1 FROM messages WHERE author IS NOT DISTINCT FROM $1 AND content = $2 AND createdAt = $3 LIMIT 1',
        [author, content, createdAt]
      );
      if (existsRes.rowCount > 0) continue;

      await pool.query(
        'INSERT INTO messages (author, content, blockId, createdAt) VALUES ($1,$2,$3,$4)',
        [author, content, blockId, createdAt]
      );
      inserted++;
    }

    console.log(`Migration complete. Inserted ${inserted} new messages.`);
  } catch (err) {
    console.error('Migration failed:', err.message || err);
    process.exit(2);
  } finally {
    await pool.end();
  }
}

main();
