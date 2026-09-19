const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'messages.db');
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author TEXT,
    content TEXT NOT NULL,
    blockId TEXT,
    createdAt TEXT NOT NULL
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

module.exports = { getAllMessages, addMessage };
