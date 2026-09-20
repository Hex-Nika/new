const path = require('path');
let db;
if (!process.env.VERCEL) db = require(path.join(__dirname, '..', '..', 'db'));
else db = require(path.join(__dirname, '..', 'db'));

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }

  try {
    if (req.method !== 'GET') { res.statusCode = 405; res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ error: 'Method not allowed' })); }
    if (typeof db.getLatestTimestamp !== 'function') { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ updated: false })); }
    const last = await db.getLatestTimestamp();
    if (!last) return res.end(JSON.stringify({ updated: false }));
    const lastDate = new Date(last);
    const diffMs = Date.now() - lastDate.getTime();
    const updated = diffMs <= 1000;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ updated }));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err.message }));
  }
};
