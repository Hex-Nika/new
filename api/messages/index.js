const path = require('path');
const os = require('os');

// Use project DB when running locally (not Vercel); otherwise use the lightweight JSON DB.
let db;
if (!process.env.VERCEL) {
  db = require(path.join(__dirname, '..', '..', 'db'));
} else {
  db = require(path.join(__dirname, '..', 'db'));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  try {
    if (req.method === 'GET') {
      const messages = await db.getAllMessages();
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify(messages));
    }

    if (req.method === 'POST') {
      let body;
      if (req.body && typeof req.body === 'object') {
        body = req.body;
      } else {
        body = await parseBody(req);
      }
      const { author, content, blockId } = body || {};
      if (!content) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'content is required' }));
      }
      const saved = await db.addMessage({ author, content, blockId });
      res.statusCode = 201;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify(saved));
    }

    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'Method not allowed' }));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err.message }));
  }
};
