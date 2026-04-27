// Auto-patches missed phone numbers in analysis-db.json by regex-scanning raw text.
// Safe to re-run; only adds phones, never removes.
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'hispanos members facebook', 'database_posts.json');
const anPath = path.join(__dirname, 'analysis-db.json');

const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const an = JSON.parse(fs.readFileSync(anPath, 'utf8'));

const phoneRe = /(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;

let patched = 0, totalAdded = 0;
for (const id of Object.keys(an.results)) {
  const p = db.posts[id];
  const r = an.results[id];
  if (!p) continue;
  const all = [p.message || '', ...(p.comments || []).map(c => c.text || '')].join(' ');
  const matches = (all.match(phoneRe) || [])
    .map(m => m.replace(/\D/g, ''))
    .map(m => m.length === 11 && m.startsWith('1') ? m.slice(1) : m)
    .filter(m => m.length === 10);
  const unique = [...new Set(matches)];
  if (!unique.length) continue;
  const existing = new Set(r.phones || []);
  const added = unique.filter(ph => !existing.has(ph));
  if (added.length) {
    r.phones = [...(r.phones || []), ...added];
    patched++;
    totalAdded += added.length;
  }
}

fs.writeFileSync(anPath, JSON.stringify(an, null, 0), 'utf8');
console.log(`✓ Patched ${patched} posts · added ${totalAdded} missed phone numbers`);
