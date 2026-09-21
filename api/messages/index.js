const path = require('path');
const os = require('os');
const fs = require('fs');

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
        // Try to parse JSON, otherwise return raw body as content
        try {
          return resolve(JSON.parse(body));
        } catch (err) {
          return resolve({ content: body });
        }
    });
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  const ALLOWED_ORIGINS = ['https://codetorch.net/projects/216575', 'https://blockcompiler.codetorch.net'];
  const origin = req.headers.origin || req.headers.referer || '';
  const allowed = origin && ALLOWED_ORIGINS.some(a => origin.indexOf(a) !== -1);
  if (origin && !allowed) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'unauthorized' }));
  }
  res.setHeader('Access-Control-Allow-Origin', origin && allowed ? origin : ALLOWED_ORIGINS[0]);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  try {
    if (req.method === 'GET') {
      let messages = await db.getAllMessages();

      const q = req.query && (req.query.q || req.query.filter);
      if (q) {
        const qi = String(q).toLowerCase();
        messages = messages.filter(m =>
          String(m.author || '').toLowerCase().includes(qi) ||
          String(m.content || '').toLowerCase().includes(qi)
        );
      }

      const since = req.query && req.query.since ? parseInt(req.query.since, 10) : null;
      if (since) messages = messages.filter(m => (m.id || 0) > since);

      const PAGE_SIZE = 13;
      const page = req.query && req.query.page ? Math.max(1, parseInt(req.query.page, 10) || 1) : null;
      const offset = req.query && req.query.offset ? Math.max(0, parseInt(req.query.offset, 10) || 0) : 0;
      const limit = req.query && req.query.limit ? Math.max(0, parseInt(req.query.limit, 10) || 0) : null;

      if (page) {
        // page 1 => most recent PAGE_SIZE messages
        const end = messages.length - (page - 1) * PAGE_SIZE;
        const start = Math.max(0, end - PAGE_SIZE);
        messages = messages.slice(start, Math.max(0, end));
      } else if (limit && limit > 0) {
        if (offset) {
          messages = messages.slice(offset);
          messages = messages.slice(0, limit);
        } else {
          // Return the last `limit` messages (most recent)
          messages = messages.slice(Math.max(messages.length - limit, 0));
        }
      } else if (offset) {
        messages = messages.slice(offset);
      }

      if (req.query && (req.query.full === 'true' || req.query.raw === 'true')) {
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify(messages));
      }

      // Load tags.json to apply optional prefixes for specific usernames
      let tags = {};
      try {
        const tagsPath = path.join(__dirname, '..', '..', 'tags.json');
        if (fs.existsSync(tagsPath)) {
          const raw = fs.readFileSync(tagsPath, 'utf8');
          const parsed = JSON.parse(raw || '{}');
          if (parsed && typeof parsed === 'object') {
            Object.keys(parsed).forEach(k => {
              const v = parsed[k];
              if (typeof v === 'string' && v.trim()) tags[String(k).toLowerCase()] = v.trim();
            });
          }
        }
      } catch (e) {
        tags = {};
      }

      const formatted = messages.map(m => {
        const authorLabel = m.author || 'anonymous';
        const prefix = tags[(m.author || '').toLowerCase()];
        if (prefix) return `${prefix} - ${authorLabel}: ${m.content}`;
        return `${authorLabel}: ${m.content}`;
      });
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify(formatted));
    }

    // bans endpoint is separate; route handled at /api/bans if needed

    if (req.method === 'POST') {
      let body;
      if (req.body && typeof req.body === 'object') {
        body = req.body;
      } else {
        body = await parseBody(req);
      }
      // Accept raw string body as content
      if (typeof body === 'string') body = { content: body };
      let { author, content, blockId } = body || {};
      // Fallback to query param
      let finalContent = content || (req.query && req.query.content) || null;
      // If finalContent is a JSON string, try to parse and unwrap nested fields
      if (typeof finalContent === 'string') {
        const s = finalContent.trim();
        if (s.startsWith('{') || s.startsWith('[')) {
          try {
            const parsed = JSON.parse(s);
            if (parsed && typeof parsed === 'object') {
              if (parsed.content) finalContent = parsed.content;
              if (!author && parsed.author) author = parsed.author;
            }
          } catch (e) {
            // ignore
          }
        }
      }

      if (!finalContent) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'content is required', received: body }));
      }
      const { sanitizeText } = require(path.join(__dirname, '..', '..', 'filter'));
      const safeAuthor = author ? sanitizeText(author) : null;
      const safeContent = sanitizeText(finalContent);
      const saved = await db.addMessage({ author: safeAuthor, content: safeContent, blockId });
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
