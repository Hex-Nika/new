const path = require('path');
// Reuse db module
let db;
if (!process.env.VERCEL) db = require(path.join(__dirname, '..', '..', 'db'));
else db = require(path.join(__dirname, '..', 'db'));

module.exports = async (req, res) => {
  const ALLOWED = [
    'https://codetorch.net/projects/216575',
    'https://blockcompiler.codetorch.net/embed.html#216575',
    'https://blockcompiler.codetorch.net#216575'
  ];
  const originHeader = req.headers.origin || '';
  const refererHeader = req.headers.referer || '';
  const allowed = ALLOWED.some(a => (originHeader && originHeader.indexOf(a) !== -1) || (refererHeader && refererHeader.indexOf(a) !== -1));
  if (!allowed) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'unauthorized' }));
  }
  res.setHeader('Access-Control-Allow-Origin', originHeader || ALLOWED[0]);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.statusCode = 204 && res.end();

  try {
    if (req.method !== 'GET') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Method not allowed' }));
    }

    if (typeof db.getBans !== 'function') {
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify([]));
    }

    const bans = await db.getBans();
    const names = Array.isArray(bans) ? bans.map(b => (typeof b === 'string' ? b : b.username || b.user || b.name)).filter(Boolean) : [];
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(names));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err.message }));
  }
};

