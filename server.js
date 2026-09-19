const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.json({ ok: true, api: 'Codetorch Messages' }));

app.get('/messages', async (req, res) => {
  try {
    const messages = await db.getAllMessages();
    res.json(messages);
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
