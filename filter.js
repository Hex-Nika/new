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
  if (!text) return text;
  // Remove links first: markdown links [label](url) -> label, angle-bracketed <url> -> '', plain urls -> ''
  let s = String(text);
  // Replace markdown links [label](url) with just the label
  s = s.replace(/\[([^\]]+)\]\((?:\s*<?(?:https?:\/\/|www\.)[^)\s>]+>?\s*)\)/ig, '$1');
  // Remove angle-bracketed URLs like <https://example.com>
  s = s.replace(/<\s*(?:https?:\/\/|www\.)[^>]+>/ig, '');
  // Remove plain URLs starting with http://, https:// or www.
  s = s.replace(/(?:https?:\/\/|www\.)\S+/ig, '');
  if (!BAD_RE) return s;
  return s.replace(BAD_RE, (m) => maskWord(m));
}

module.exports = { sanitizeText, BAD_WORDS };
