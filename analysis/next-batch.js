// analysis/next-batch.js
//
// One-shot loop helper for the AI agent.
//   1. If batch-output.json exists → validate + merge into analysis-db.json (via save-batch.js)
//   2. Then prepare the next batch (via prepare-batch.js)
//
// So the agent's loop becomes exactly:
//     read batch-input.json  →  write batch-output.json  →  `node analysis/next-batch.js`  →  repeat
//
// Usage:
//   node analysis/next-batch.js           (default batch size 100)
//   node analysis/next-batch.js 50        (custom size)

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const HERE = __dirname;
const OUT  = path.join(HERE, 'batch-output.json');
const IN   = path.join(HERE, 'batch-input.json');
const ANDB = path.join(HERE, 'analysis-db.json');

const size = process.argv[2] || '100';

function run(script, args = []) {
  const r = spawnSync(process.execPath, [path.join(HERE, script), ...args], { stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(`\n❌ ${script} failed with exit code ${r.status}. Stopping loop.`);
    process.exit(r.status || 1);
  }
}

// ── Step 1: save pending output, if any ─────────────────────────────
if (fs.existsSync(OUT)) {
  console.log('━━━ Saving pending batch-output.json ━━━');
  run('save-batch.js');

  // Step 1b: auto-patch any phone numbers the AI missed (regex sweep over raw text)
  console.log('\n━━━ Auto-patching missed phones ━━━');
  run('fix-phones.js');
} else {
  console.log('(no batch-output.json to save — skipping save step)');
}

// ── Step 2: are we done? ────────────────────────────────────────────
const db = JSON.parse(fs.readFileSync(ANDB, 'utf8'));
const total = Object.keys(db.results).length;
const posts = require(path.join(HERE, '..', 'hispanos members facebook', 'database_posts.json')).posts;
const totalPosts = Object.keys(posts).length;

if (total >= totalPosts) {
  console.log(`\n🎉 ALL DONE — ${total.toLocaleString()} / ${totalPosts.toLocaleString()} posts analyzed. No more batches to prepare.`);
  // Remove leftover input so agent knows to stop
  if (fs.existsSync(IN)) fs.unlinkSync(IN);
  process.exit(0);
}

// ── Step 3: prepare next batch ──────────────────────────────────────
console.log('\n━━━ Preparing next batch ━━━');
run('prepare-batch.js', [size]);

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ READY FOR AGENT
  → Read   analysis/batch-input.json
  → Write  analysis/batch-output.json  (schema: analysis/SCHEMA.md)
  → Run   \`node analysis/next-batch.js\`   to save + prepare the next one
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
