const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'messages.db');
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author TEXT,
    content TEXT NOT NULL,
    ip TEXT,
    blockId TEXT,
    createdAt TEXT NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS bans (
    username TEXT PRIMARY KEY,
    reason TEXT,
    createdAt TEXT
  )`);
});

function getAllMessages() {
  return new Promise((resolve, reject) => {
    // Return messages in chronological order (oldest first)
    db.all('SELECT * FROM messages ORDER BY id ASC', (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function getLatestTimestamp() {
  return new Promise((resolve, reject) => {
    db.get('SELECT createdAt FROM messages ORDER BY id DESC LIMIT 1', (err, row) => {
      if (err) return resolve(null);
      resolve(row && (row.createdAt || row.createdat) ? row.createdAt || row.createdat : null);
    });
  });
}

function getLastUpdateTimestamp() {
  return new Promise((resolve, reject) => {
    db.get("SELECT value FROM meta WHERE key='last_update' LIMIT 1", (err, row) => {
      if (err || !row) return resolve(null);
      resolve(row.value || null);
    });
  });
}

function setLastUpdateTimestamp(ts) {
  return new Promise((resolve, reject) => {
    const v = ts || new Date().toISOString();
    db.run('INSERT OR REPLACE INTO meta (key, value) VALUES (?,?)', ['last_update', v], function(err) {
      if (err) return reject(err);
      resolve(v);
    });
  });
}

function getBans() {
  return new Promise((resolve) => {
    db.all("SELECT username FROM bans", (err, rows) => {
      if (err || !rows) return resolve([]);
      resolve(rows.map(r => r.username));
    });
  });
}

function addBan(username, reason) {
  return new Promise((resolve, reject) => {
    db.run('INSERT OR IGNORE INTO bans (username, reason, createdAt) VALUES (?,?,?)', [username, reason || null, new Date().toISOString()], function(err) {
      if (err) return reject(err);
      resolve(username);
    });
  });
}

function removeBan(username) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM bans WHERE LOWER(username)=LOWER(?)', [username], function(err) {
      if (err) return reject(err);
      resolve(username);
    });
  });
}

function addMessage({ author, content, blockId }) {
  return new Promise((resolve, reject) => {
    const createdAt = new Date().toISOString();
    db.run(
      'INSERT INTO messages (author, content, blockId, createdAt) VALUES (?,?,?,?)',
      [author || null, content, blockId || null, createdAt],
      function (err) {
        if (err) return reject(err);
        resolve({ id: this.lastID, author, content, blockId, createdAt });
      }
    );
  });
}

module.exports = { getAllMessages, addMessage, getBans, addBan, removeBan, getLatestTimestamp, getLastUpdateTimestamp, setLastUpdateTimestamp };
