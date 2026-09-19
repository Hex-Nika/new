const fs = require('fs').promises;
const path = require('path');
const os = require('os');

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
