const path = require('path');

// Admin endpoints: /api/admin/ban?password=...&name=... and /api/admin/unban?password=...&name=...
let db;
if (!process.env.VERCEL) db = require(path.join(__dirname, '..', '..', 'db'));
else db = require(path.join(__dirname, '..', 'db'));

function checkPassword(req) {
  const pw = req.query && req.query.password;
  return pw && process.env.ADMIN_PASSWORD && pw === process.env.ADMIN_PASSWORD;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }

  try {
    const urlPath = req.url || '';
    const isBan = urlPath.includes('/ban');
    const isUnban = urlPath.includes('/unban');

    if (!checkPassword(req)) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Unauthorized' }));
    }

    const name = req.query && req.query.name;
    if (!name) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'name parameter required' }));
    }

    if (isBan) {
      if (typeof db.addBan !== 'function') return res.end(JSON.stringify({ result: 'no-op' }));
      const reason = req.query.reason || null;
      const r = await db.addBan(name, reason);
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ banned: r }));
    }

    if (isUnban) {
      if (typeof db.removeBan !== 'function') return res.end(JSON.stringify({ result: 'no-op' }));
      const r = await db.removeBan(name);
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ unbanned: r }));
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Not Found' }));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err.message }));
  }
};
