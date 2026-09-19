const fs = require('fs');
const path = require('path');

function loadBadWords() {
  // Priority: env BAD_WORDS (comma-separated), then badwords.txt in project root, then built-in defaults
  if (process.env.BAD_WORDS) {
    return process.env.BAD_WORDS.split(',').map(s => s.trim()).filter(Boolean);
  }

  const filePath = path.join(__dirname, 'badwords.txt');
  if (fs.existsSync(filePath)) {
    const txt = fs.readFileSync(filePath, 'utf8');
    return txt.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  }

  // Minimal default list (no protected-class slurs included). Customize via BAD_WORDS or badwords.txt.
  return ['damn', 'hell', 'crap', 'shit', 'fuck'];
}

const BAD_WORDS = loadBadWords();
// Match bad words anywhere inside text (no word boundaries) so substrings like "bullshit" are detected.
const BAD_RE = BAD_WORDS.length ? new RegExp(`(${BAD_WORDS.map(w => w.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')})`, 'ig') : null;

function maskWord(word) {
  return '*'.repeat([...word].length);
}

function sanitizeText(text) {
  if (!text || !BAD_RE) return text;
  return String(text).replace(BAD_RE, (m) => maskWord(m));
}

module.exports = { sanitizeText, BAD_WORDS };
