// Helper for re-analyzing botched entries.
//
// Usage:
//   node analysis/reanalyze-bad.js prep     → writes first 50 bad IDs to reanalyze-input.json
//   node analysis/reanalyze-bad.js save     → merges reanalyze-output.json into analysis-db.json
//
// This does NOT touch batch-input.json / batch-output.json, so the normal
// ChatGPT loop is unaffected.

const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const ANDB = path.join(HERE, 'analysis-db.json');
const IDS  = path.join(HERE, '_reanalyze-ids.json');
const IN   = path.join(HERE, 'reanalyze-input.json');
const OUT  = path.join(HERE, 'reanalyze-output.json');

const cmd = process.argv[2];

if (cmd === 'prep') {
  const db = require('../hispanos members facebook/database_posts.json');
  const ids = JSON.parse(fs.readFileSync(IDS, 'utf8'));
  if (ids.length === 0) { console.log('🎉 No more bad posts to re-analyze.'); return; }

  const chunk = ids.slice(0, 50);
  const posts = chunk.map(id => {
    const p = db.posts[id];
    if (!p) return null;
    return {
      id,
      by: p.author || 'Unknown',
      t: p.date?.slice(0, 10) || '',
      url: p.url || '',
      text: p.message || '',
      imgs: (p.images || []).length,
      rx: p.reactions || 0,
      c: (p.comments || []).slice(0, 20).map(c => ({ by: c.author || '?', text: (c.text || '').slice(0, 300) })),
    };
  }).filter(Boolean);

  fs.writeFileSync(IN, JSON.stringify({
    reanalysis: true,
    totalBadRemaining: ids.length,
    size: posts.length,
    posts,
  }, null, 2), 'utf8');
  console.log(`✓ Wrote ${posts.length} bad posts to reanalyze-input.json (${ids.length - posts.length} still bad after this chunk)`);
}
else if (cmd === 'save') {
  if (!fs.existsSync(OUT)) { console.error('❌ reanalyze-output.json not found'); process.exit(1); }
  const out = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  const an  = JSON.parse(fs.readFileSync(ANDB, 'utf8'));
  const ids = JSON.parse(fs.readFileSync(IDS, 'utf8'));

  const required = ['id', 'intent', 'isBusiness', 'svc', 'cats', 'phones', 'bname', 'loc', 'lang', 'sum', 'resolution', 'conf'];
  for (const r of out.results) {
    for (const f of required) if (!(f in r)) { console.error('❌ Post', r.id, 'missing', f); process.exit(1); }
    if (r.sum === 'No summary available.') { console.error('❌ Post', r.id, 'still has placeholder summary'); process.exit(1); }
  }

  let updated = 0;
  const fixed = new Set();
  for (const r of out.results) {
    an.results[r.id] = r;
    fixed.add(r.id);
    updated++;
  }
  an.lastUpdated = new Date().toISOString();
  fs.writeFileSync(ANDB, JSON.stringify(an, null, 0), 'utf8');

  const remaining = ids.filter(id => !fixed.has(id));
  fs.writeFileSync(IDS, JSON.stringify(remaining, null, 2), 'utf8');
  fs.unlinkSync(OUT);
  fs.unlinkSync(IN);

  console.log(`✓ Re-analyzed ${updated} posts · ${remaining.length} bad posts remaining`);

  // Also run phone patcher to recover any phones on the re-analyzed posts
  require('child_process').spawnSync(process.execPath, [path.join(HERE, 'fix-phones.js')], { stdio: 'inherit' });
}
else {
  console.log('Usage: node reanalyze-bad.js prep|save');
}
