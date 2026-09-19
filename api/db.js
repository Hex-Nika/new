const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const filePath = process.env.DB_FILE_PATH || path.join(os.tmpdir(), 'messages.json');

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
  return rows.sort((a, b) => (b.id || 0) - (a.id || 0));
}

async function addMessage({ author, content, blockId }) {
  const rows = await readFile();
  const id = (rows[0] && rows[0].id ? rows[0].id + 1 : rows.length + 1);
  const createdAt = new Date().toISOString();
  const msg = { id, author: author || null, content, blockId: blockId || null, createdAt };
  rows.unshift(msg);
  await writeFile(rows);
  return msg;
}

module.exports = { getAllMessages, addMessage };
