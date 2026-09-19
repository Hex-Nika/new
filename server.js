const express = require('express');
const cors = require('cors');
let db;
if (process.env.DATABASE_URL) {
  db = require('./api/db');
} else {
  db = require('./db');
}

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.json({ ok: true, api: 'Codetorch Messages' }));

app.get('/messages', async (req, res) => {
  try {
    let messages = await db.getAllMessages();

    // Query helpers
    const q = req.query.q || req.query.filter;
    if (q) {
      const qi = String(q).toLowerCase();
      messages = messages.filter(m =>
        String(m.author || '').toLowerCase().includes(qi) ||
        String(m.content || '').toLowerCase().includes(qi)
      );
    }

    const since = req.query.since ? parseInt(req.query.since, 10) : null;
    if (since) messages = messages.filter(m => (m.id || 0) > since);

    const offset = req.query.offset ? Math.max(0, parseInt(req.query.offset, 10) || 0) : 0;
    const limit = req.query.limit ? Math.max(0, parseInt(req.query.limit, 10) || 0) : null;
    if (limit && limit > 0) {
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

    // Return raw/full objects when requested
    if (req.query.full === 'true' || req.query.raw === 'true') {
      return res.json(messages);
    }

    const formatted = messages.map(m => `${m.author || 'anonymous'}: ${m.content}`);
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/messages', async (req, res) => {
  let { author, content, blockId } = req.body || {};
  // Accept raw string body as content
  if (typeof req.body === 'string' && !content) {
    content = req.body;
  }
  // Fallback to query param
  if (!content && req.query && req.query.content) {
    content = req.query.content;
  }
  // If content is a JSON string containing an object, unwrap it
  if (typeof content === 'string') {
    const s = content.trim();
    if ((s.startsWith('{') || s.startsWith('['))) {
      try {
        const parsed = JSON.parse(s);
        if (parsed && typeof parsed === 'object') {
          // If parsed has its own author/content, prefer them
          if (parsed.content) content = parsed.content;
          if (parsed.author) author = parsed.author;
        }
      } catch (e) {
        // ignore parse errors
      }
    }
  }

  if (!content) return res.status(400).json({ error: 'content is required' });
  try {
    const { sanitizeText } = require('./filter');
    const safeAuthor = author ? sanitizeText(author) : null;
    const safeContent = sanitizeText(content);
    const saved = await db.addMessage({ author: safeAuthor, content: safeContent, blockId });
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Codetorch messages API listening on ${PORT}`));
