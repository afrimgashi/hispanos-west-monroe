// Quick quality audit: show N random analyzed posts side-by-side with the raw source
const fs = require('fs');
const path = require('path');

const db = require('../hispanos members facebook/database_posts.json');
const an = require('./analysis-db.json');

const posts = db.posts;
const results = an.results;

const ids = Object.keys(results).filter(id => !results[id]._auto);
// Shuffle
ids.sort(() => Math.random() - 0.5);

const N = parseInt(process.argv[2], 10) || 8;

console.log(`\n═══ QUALITY AUDIT — ${N} random AI-analyzed posts ═══\n`);

for (let i = 0; i < N && i < ids.length; i++) {
  const id = ids[i];
  const p = posts[id];
  const r = results[id];
  if (!p) continue;

  const msg = (p.message || '').replace(/\s+/g, ' ').slice(0, 300);
  const comments = (p.comments || []).slice(0, 3).map(c => `    [${c.author}]: ${(c.text || '').slice(0, 120)}`).join('\n');

  console.log('─'.repeat(78));
  console.log(`#${i+1}  ${id}   ${p.timestamp?.slice(0,10) || '?'}  by ${p.authorName || '?'}`);
  console.log(`  TEXT: "${msg}"${p.message?.length > 300 ? '…' : ''}`);
  if (p.images?.length) console.log(`  imgs: ${p.images.length}`);
  if (comments) console.log(`  COMMENTS:\n${comments}`);
  console.log(`  ┌─ AI SAID ─┐`);
  console.log(`    intent:     ${r.intent}   (isBusiness: ${r.isBusiness})`);
  console.log(`    svc:        ${r.svc || '—'}`);
  console.log(`    cats:       [${(r.cats || []).join(', ')}]`);
  console.log(`    phones:     [${(r.phones || []).join(', ')}]`);
  console.log(`    bname:      ${r.bname || '—'}`);
  console.log(`    loc:        ${r.loc || '—'}`);
  console.log(`    lang:       ${r.lang}   urgency: ${r.urgency || '—'}   price: ${r.price || '—'}`);
  console.log(`    resolution: ${r.resolution}   conf: ${r.conf}`);
  console.log(`    sum:        ${r.sum}`);
}

// Integrity checks
console.log('\n═══ INTEGRITY CHECKS ═══');
let missingPhone = 0, phoneButNoneExtracted = 0, extractedPhoneWrong = 0;
const phoneRe = /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
for (const id of Object.keys(results)) {
  const p = posts[id]; const r = results[id];
  if (!p) continue;
  const all = [p.message || '', ...(p.comments || []).map(c => c.text || '')].join(' ');
  const matches = (all.match(phoneRe) || []).map(m => m.replace(/\D/g, ''));
  const unique = [...new Set(matches)];
  const extracted = r.phones || [];
  if (unique.length > 0 && extracted.length === 0) phoneButNoneExtracted++;
  for (const ph of unique) if (!extracted.includes(ph)) missingPhone++;
  for (const ph of extracted) if (!all.replace(/\D/g, '').includes(ph)) extractedPhoneWrong++;
}
console.log(`Posts where a 10-digit phone exists in text but AI extracted none: ${phoneButNoneExtracted}`);
console.log(`Individual missed phone numbers: ${missingPhone}`);
console.log(`Phones AI extracted but not found in raw text: ${extractedPhoneWrong}`);

// Confidence histogram
const confs = Object.values(results).filter(r => !r._auto).map(r => r.conf);
const buckets = {'<0.5': 0, '0.5-0.7': 0, '0.7-0.85': 0, '0.85-0.95': 0, '>=0.95': 0};
for (const c of confs) {
  if (c < 0.5) buckets['<0.5']++;
  else if (c < 0.7) buckets['0.5-0.7']++;
  else if (c < 0.85) buckets['0.7-0.85']++;
  else if (c < 0.95) buckets['0.85-0.95']++;
  else buckets['>=0.95']++;
}
console.log('\nConfidence distribution:', buckets);
const avg = confs.reduce((a,b)=>a+b,0)/confs.length;
console.log(`Average confidence: ${avg.toFixed(3)}`);
