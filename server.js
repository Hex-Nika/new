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
    const messages = await db.getAllMessages();
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
    const saved = await db.addMessage({ author, content, blockId });
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Codetorch messages API listening on ${PORT}`));
