// analysis/prepare-batch.js
//
// Picks the next N unanalyzed posts (oldest first, chronological) and writes them
// to batch-input.json for Cascade to analyze.
//
// Empty posts (no message + no comments) are auto-tagged and written directly to
// analysis-db.json without using a batch slot.
//
// Usage:
//   node analysis/prepare-batch.js              (default 100 posts)
//   node analysis/prepare-batch.js 50           (custom size)

const fs = require('fs');
const path = require('path');

const ROOT   = path.join(__dirname, '..');
const DB     = path.join(ROOT, 'hispanos members facebook', 'database_posts.json');
const ANDB   = path.join(__dirname, 'analysis-db.json');
const BATCH  = path.join(__dirname, 'batch-input.json');

const BATCH_SIZE = parseInt(process.argv[2], 10) || 100;
const MAX_COMMENTS_PER_POST = 10;   // cap comment context to save tokens

// ────────────────────────────────────────────────────────────
// Load databases
// ────────────────────────────────────────────────────────────
console.log('Loading database_posts.json...');
const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
const posts = Object.values(db.posts);

let analysisDb = { analyzedAt: null, meta: {}, results: {} };
if (fs.existsSync(ANDB)) {
  analysisDb = JSON.parse(fs.readFileSync(ANDB, 'utf8'));
  if (!analysisDb.results) analysisDb.results = {};
}
const alreadyDone = new Set(Object.keys(analysisDb.results));
console.log(`Already analyzed: ${alreadyDone.size.toLocaleString()} / ${posts.length.toLocaleString()}`);

// ────────────────────────────────────────────────────────────
// Sort chronologically (oldest first); posts without timestamp go LAST
// ────────────────────────────────────────────────────────────
posts.sort((a, b) => {
  const ta = a.timestamp ? new Date(a.timestamp).getTime() : Infinity;
  const tb = b.timestamp ? new Date(b.timestamp).getTime() : Infinity;
  return ta - tb;
});

// ────────────────────────────────────────────────────────────
// Walk posts, auto-tag empty ones, collect the first N non-empty
// ────────────────────────────────────────────────────────────
const batch = [];
let autoTagged = 0;
let scanned = 0;
const autoResults = {};

for (const post of posts) {
  if (batch.length >= BATCH_SIZE) break;
  scanned++;
  if (alreadyDone.has(post.postId)) continue;

  const msg = (post.message || '').trim();
  const comments = (post.comments || []);
  const hasComments = comments.some(c => (c.text || '').trim().length > 0);

  // Auto-tag: completely empty post with no comment text
  if (!msg && !hasComments) {
    autoResults[post.postId] = {
      id: post.postId,
      intent: (post.images || []).length > 0 ? 'other' : 'other',
      isBusiness: false,
      svc: null,
      cats: [],
      phones: [],
      bname: null,
      loc: null,
      lang: 'other',
      sum: (post.images || []).length > 0 ? 'Image-only post with no text or comments' : 'Empty post, no content',
      price: null,
      urgency: null,
      resolution: 'no_comments',
      conf: 0.99,
      _auto: true,
    };
    autoTagged++;
    continue;
  }

  // Include in batch
  const compact = {
    id: post.postId,
    by: post.authorName || '',
    t: post.timestamp ? post.timestamp.slice(0, 10) : '',
    url: post.permalink || '',
    text: msg.length > 1500 ? msg.slice(0, 1500) + '…[truncated]' : msg,
    imgs: (post.images || []).length,
    rx: (post.reactions && post.reactions.total) || 0,
    c: comments.slice(0, MAX_COMMENTS_PER_POST).map(c => ({
      by: c.author || '',
      text: (c.text || '').slice(0, 300),
    })).filter(c => c.text || c.by),
  };
  batch.push(compact);
}

// ────────────────────────────────────────────────────────────
// Write batch-input.json
// ────────────────────────────────────────────────────────────
const batchNumber = (analysisDb.meta.nextBatch || 1);
const output = {
  batchNumber,
  generatedAt: new Date().toISOString(),
  size: batch.length,
  posts: batch,
};
fs.writeFileSync(BATCH, JSON.stringify(output, null, 2), 'utf8');

// ────────────────────────────────────────────────────────────
// Immediately save auto-tagged empty posts to analysis-db.json
// ────────────────────────────────────────────────────────────
if (autoTagged > 0) {
  Object.assign(analysisDb.results, autoResults);
  analysisDb.lastUpdated = new Date().toISOString();
  analysisDb.meta = analysisDb.meta || {};
  analysisDb.meta.autoTagged = (analysisDb.meta.autoTagged || 0) + autoTagged;
  fs.writeFileSync(ANDB, JSON.stringify(analysisDb, null, 0), 'utf8');
}

// ────────────────────────────────────────────────────────────
// Summary
// ────────────────────────────────────────────────────────────
const totalAnalyzed = Object.keys(analysisDb.results).length;
const remaining = posts.length - totalAnalyzed;
console.log(`
═══════════════════════════════════════════════════════════════════
  BATCH ${batchNumber} READY
═══════════════════════════════════════════════════════════════════
  Batch size requested:   ${BATCH_SIZE}
  Posts scanned:          ${scanned.toLocaleString()}
  Auto-tagged (empty):    ${autoTagged.toLocaleString()}  → saved directly
  For Cascade analysis:   ${batch.length.toLocaleString()}  → in batch-input.json

  Progress:
    Done total:           ${totalAnalyzed.toLocaleString()} / ${posts.length.toLocaleString()}  (${(totalAnalyzed/posts.length*100).toFixed(1)}%)
    Remaining:            ${remaining.toLocaleString()}
    Estimated batches:    ${Math.ceil(remaining / BATCH_SIZE).toLocaleString()}

  Batch file:             analysis/batch-input.json
  Next step:              Tell Cascade: "Analyze the batch"
═══════════════════════════════════════════════════════════════════`);
