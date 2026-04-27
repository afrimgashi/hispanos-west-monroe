// Walks database_posts.json top-to-bottom showing the actual SHAPE:
//   - every key that exists at every level
//   - type of each field (and distribution if mixed)
//   - sample values so you can see what it looks like
//   - the JSON path so you know how to access it
//
//   Usage:  node analyze-structure.js

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'hispanos members facebook', 'database_posts.json');
const OUT  = path.join(__dirname, 'hispanos members facebook', 'structure-report.txt');

let out = '';
const w = (s = '') => { out += s + '\n'; console.log(s); };

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────
function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}
function preview(v, max = 70) {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (typeof v === 'string') {
    const s = v.replace(/\s+/g, ' ');
    return `"${s.length > max ? s.slice(0, max) + '…' : s}"`;
  }
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return `[${v.length} items]`;
  if (typeof v === 'object') return `{${Object.keys(v).length} keys}`;
  return String(v);
}
function banner(title, char = '═') {
  w(); w(char.repeat(72)); w(`  ${title}`); w(char.repeat(72));
}

// ────────────────────────────────────────────────────────────
// Load
// ────────────────────────────────────────────────────────────
console.log('Loading database_posts.json...');
const rawSize = fs.statSync(FILE).size;
const db = JSON.parse(fs.readFileSync(FILE, 'utf8'));

banner('DATABASE_POSTS.JSON  —  STRUCTURAL WALKTHROUGH');
w(`File size:        ${(rawSize / 1024 / 1024).toFixed(2)} MB  (${rawSize.toLocaleString()} bytes)`);
w(`Root type:        ${typeOf(db)}`);
w(`Root keys:        ${Object.keys(db).join(', ')}`);

// ────────────────────────────────────────────────────────────
// LEVEL 1 — root object
// ────────────────────────────────────────────────────────────
banner('LEVEL 1 — ROOT OBJECT');
w('Access:  db = JSON.parse(fs.readFileSync(...))');
w();
for (const k of Object.keys(db)) {
  const v = db[k];
  const t = typeOf(v);
  if (t === 'array') {
    w(`  db.${k}       → array of ${v.length.toLocaleString()} items`);
  } else if (t === 'object') {
    w(`  db.${k}       → object with ${Object.keys(v).length.toLocaleString()} keys`);
  } else {
    w(`  db.${k}       → ${t}  ${preview(v)}`);
  }
}

// ────────────────────────────────────────────────────────────
// LEVEL 2 — db.meta
// ────────────────────────────────────────────────────────────
banner('LEVEL 2 — db.meta');
w('The header / state-tracking object.');
w();
for (const k of Object.keys(db.meta)) {
  const v = db.meta[k];
  w(`  db.meta.${k.padEnd(20)} ${typeOf(v).padEnd(8)} ${preview(v)}`);
}

// ────────────────────────────────────────────────────────────
// LEVEL 2 — db.memberProgress
// ────────────────────────────────────────────────────────────
banner('LEVEL 2 — db.memberProgress');
const mp = db.memberProgress;
const mpKeys = Object.keys(mp);
w(`Object keyed by userId. Total entries: ${mpKeys.length.toLocaleString()}`);
w();
w('Access:  db.memberProgress["<userId>"]');
w();
const sampleMp = mp[mpKeys[0]];
w(`Example (db.memberProgress["${mpKeys[0]}"]):`);
w(JSON.stringify(sampleMp, null, 2).split('\n').map(l => '    ' + l).join('\n'));
w();
// Field distribution across all entries
const mpFieldTypes = {};
for (const id of mpKeys) {
  for (const k of Object.keys(mp[id])) {
    if (!mpFieldTypes[k]) mpFieldTypes[k] = { types: {}, samples: new Set() };
    const t = typeOf(mp[id][k]);
    mpFieldTypes[k].types[t] = (mpFieldTypes[k].types[t] || 0) + 1;
    if (mpFieldTypes[k].samples.size < 3) mpFieldTypes[k].samples.add(preview(mp[id][k], 40));
  }
}
w('Field inventory across all memberProgress entries:');
for (const [k, info] of Object.entries(mpFieldTypes)) {
  const typeStr = Object.entries(info.types).map(([t, n]) => `${t}×${n}`).join(', ');
  w(`  .${k.padEnd(18)} ${typeStr.padEnd(20)} examples: ${[...info.samples].slice(0, 2).join('  |  ')}`);
}

// ────────────────────────────────────────────────────────────
// LEVEL 2 — db.posts
// ────────────────────────────────────────────────────────────
banner('LEVEL 2 — db.posts');
const posts = db.posts;
const postKeys = Object.keys(posts);
w(`Object keyed by postId. Total posts: ${postKeys.length.toLocaleString()}`);
w();
w('Access:  db.posts["<postId>"]    OR    Object.values(db.posts)');

// ────────────────────────────────────────────────────────────
// LEVEL 3 — A single post
// ────────────────────────────────────────────────────────────
banner('LEVEL 3 — A SINGLE POST (db.posts["<id>"])');
const samplePost = posts[postKeys[0]];
w('Every post has the same shape. Fields with type distribution:');
w();
const postFields = {};
for (const id of postKeys) {
  for (const k of Object.keys(posts[id])) {
    if (!postFields[k]) postFields[k] = { types: {}, nonEmpty: 0, total: 0, samples: new Set() };
    const v = posts[id][k];
    const t = typeOf(v);
    postFields[k].total++;
    postFields[k].types[t] = (postFields[k].types[t] || 0) + 1;
    if (v !== '' && v !== null && !(Array.isArray(v) && v.length === 0)) postFields[k].nonEmpty++;
    if (postFields[k].samples.size < 3 && t !== 'array' && t !== 'object') postFields[k].samples.add(preview(v, 60));
  }
}
const postFieldList = Object.entries(postFields).sort((a, b) => b[1].total - a[1].total);
for (const [k, info] of postFieldList) {
  const typeStr = Object.entries(info.types).map(([t, n]) => `${t}×${n}`).join(', ');
  const pct = (info.nonEmpty / info.total * 100).toFixed(0) + '%';
  const samples = info.samples.size ? [...info.samples].slice(0, 1)[0] : '(nested)';
  w(`  .${k.padEnd(20)} ${typeStr.padEnd(20)} non-empty ${pct.padStart(4)}   ex: ${samples}`);
}
w();
w('Example post (first record, truncated strings):');
const cleanPost = { ...samplePost };
if (cleanPost.message && cleanPost.message.length > 80) cleanPost.message = cleanPost.message.slice(0, 80) + '…';
if (Array.isArray(cleanPost.images) && cleanPost.images.length > 2) cleanPost.images = [cleanPost.images[0], `… + ${cleanPost.images.length - 1} more`];
if (Array.isArray(cleanPost.comments) && cleanPost.comments.length > 1) cleanPost.comments = [cleanPost.comments[0], `… + ${cleanPost.comments.length - 1} more`];
w(JSON.stringify(cleanPost, null, 2).split('\n').map(l => '    ' + l).join('\n'));

// ────────────────────────────────────────────────────────────
// LEVEL 4 — post.reactions
// ────────────────────────────────────────────────────────────
banner('LEVEL 4 — post.reactions  (every post has one)');
const rxFields = {};
for (const id of postKeys) {
  const rx = posts[id].reactions || {};
  for (const k of Object.keys(rx)) {
    if (!rxFields[k]) rxFields[k] = { types: {}, samples: new Set() };
    const t = typeOf(rx[k]);
    rxFields[k].types[t] = (rxFields[k].types[t] || 0) + 1;
    if (rxFields[k].samples.size < 3) rxFields[k].samples.add(preview(rx[k], 30));
  }
}
w('Keys present on reactions objects:');
for (const [k, info] of Object.entries(rxFields)) {
  const typeStr = Object.entries(info.types).map(([t, n]) => `${t}×${n}`).join(', ');
  w(`  .reactions.${k.padEnd(12)} ${typeStr.padEnd(16)} ex: ${[...info.samples].slice(0, 2).join(' | ')}`);
}
w();
w('Example post.reactions:');
w('    ' + JSON.stringify(samplePost.reactions));

// ────────────────────────────────────────────────────────────
// LEVEL 4 — post.images & post.videos
// ────────────────────────────────────────────────────────────
banner('LEVEL 4 — post.images (array of URL strings)');
let minImg = Infinity, maxImg = 0, totalImg = 0, postsWithImg = 0;
for (const id of postKeys) {
  const n = (posts[id].images || []).length;
  if (n > 0) { postsWithImg++; totalImg += n; if (n < minImg) minImg = n; if (n > maxImg) maxImg = n; }
}
w(`Posts with at least one image:  ${postsWithImg.toLocaleString()}`);
w(`Total image URLs:               ${totalImg.toLocaleString()}`);
w(`Images per post:                min ${minImg}, max ${maxImg}, avg ${(totalImg / postsWithImg).toFixed(1)}`);
w();
// Find a post with multiple images
const imgExample = Object.values(posts).find(p => (p.images || []).length >= 2);
if (imgExample) {
  w('Example (first 2 URLs):');
  w('    ' + imgExample.images[0]);
  w('    ' + imgExample.images[1]);
}

banner('LEVEL 4 — post.videos (array)');
const vids = Object.values(posts).filter(p => (p.videos || []).length > 0);
w(`Posts with videos:              ${vids.length}`);
if (vids[0]) {
  w();
  w('Example post.videos[0]:');
  w(JSON.stringify(vids[0].videos[0], null, 2).split('\n').map(l => '    ' + l).join('\n'));
}

// ────────────────────────────────────────────────────────────
// LEVEL 4 — post.comments
// ────────────────────────────────────────────────────────────
banner('LEVEL 4 — post.comments (array of comment objects)');
let totalComments = 0, maxComments = 0;
for (const id of postKeys) {
  const n = (posts[id].comments || []).length;
  totalComments += n;
  if (n > maxComments) maxComments = n;
}
w(`Total comment objects:          ${totalComments.toLocaleString()}`);
w(`Most comments on a single post: ${maxComments}`);
w();

// ────────────────────────────────────────────────────────────
// LEVEL 5 — a comment
// ────────────────────────────────────────────────────────────
banner('LEVEL 5 — a single comment (post.comments[i])');
const cmtFields = {};
const exampleComment = (() => {
  for (const id of postKeys) for (const c of (posts[id].comments || [])) return c;
  return null;
})();
for (const id of postKeys) {
  for (const c of (posts[id].comments || [])) {
    for (const k of Object.keys(c)) {
      if (!cmtFields[k]) cmtFields[k] = { types: {}, total: 0, nonEmpty: 0, samples: new Set() };
      const t = typeOf(c[k]);
      cmtFields[k].total++;
      cmtFields[k].types[t] = (cmtFields[k].types[t] || 0) + 1;
      if (c[k] !== '' && c[k] !== null && !(Array.isArray(c[k]) && c[k].length === 0)) cmtFields[k].nonEmpty++;
      if (cmtFields[k].samples.size < 3 && t !== 'array' && t !== 'object') cmtFields[k].samples.add(preview(c[k], 55));
    }
  }
}
w('Field inventory across all comment objects:');
for (const [k, info] of Object.entries(cmtFields).sort((a, b) => b[1].total - a[1].total)) {
  const typeStr = Object.entries(info.types).map(([t, n]) => `${t}×${n}`).join(', ');
  const pct = (info.nonEmpty / info.total * 100).toFixed(0) + '%';
  const samples = info.samples.size ? [...info.samples].slice(0, 1)[0] : '(nested)';
  w(`  .${k.padEnd(18)} ${typeStr.padEnd(20)} non-empty ${pct.padStart(4)}   ex: ${samples}`);
}
w();
w('Example comment:');
if (exampleComment) {
  const clean = { ...exampleComment };
  if (clean.text && clean.text.length > 100) clean.text = clean.text.slice(0, 100) + '…';
  w(JSON.stringify(clean, null, 2).split('\n').map(l => '    ' + l).join('\n'));
}

// ────────────────────────────────────────────────────────────
// JSON PATHS CHEAT SHEET
// ────────────────────────────────────────────────────────────
banner('JSON PATHS CHEAT SHEET — how to access anything');
w(`
Root
├── db.meta.groupId                     → "1437882213110717"
├── db.meta.totalPosts                  → 32429
├── db.meta.totalMembers                → 8610
├── db.meta.lastUpdated                 → ISO timestamp
│
├── db.memberProgress["<userId>"]       → scraping status for one member
│   ├── .name                           → "Jesus Barbacoa"
│   ├── .status                         → "done" | "in-progress" | "pending"
│   ├── .postsFound                     → number
│   └── .lastCursor                     → pagination token (for resume)
│
└── db.posts["<postId>"]                → ONE POST
    ├── .postId                         → Facebook post ID
    ├── .permalink                      → https://facebook.com/groups/.../posts/.../
    ├── .authorId  /  .authorName       → who wrote the post
    ├── .timestamp                      → ISO date
    ├── .message                        → full text of post
    ├── .images[i]                      → fbcdn.net URL (EXPIRES in ~1 week)
    ├── .videos[i]                      → rare, almost never populated
    ├── .reactions.total                → count
    ├── .reactions.like / .love / ...   → per-emoji counts (mostly 0s)
    ├── .commentCount                   → Facebook's declared count
    ├── .shares                         → always 0 (scraper doesn't capture)
    ├── .scrapedAt                      → when WE fetched this post
    ├── ._commentsEnriched              → true once we fetched deep comments
    └── .comments[i]                    → ONE COMMENT
        ├── .commentId                  → Facebook comment ID
        ├── .authorId / .author         → who wrote the comment
        ├── .text                       → comment body
        ├── .timestamp                  → ISO
        ├── .isReply                    → true if it's a reply-to-comment
        ├── .reactionCount              → count of reactions on the comment
        └── .images[i]                  → attached to the comment (rare)
`);

// ────────────────────────────────────────────────────────────
// PLAYGROUND SNIPPETS
// ────────────────────────────────────────────────────────────
banner('PLAYGROUND — copy/paste these to explore');
w(`
// Load:
const db = JSON.parse(require('fs').readFileSync('hispanos members facebook/database_posts.json','utf8'));
const posts = Object.values(db.posts);

// Every post text mentioning "pintura":
posts.filter(p => /pintura|pintor/i.test(p.message)).length;

// All posts by one author:
posts.filter(p => p.authorId === '100078107146338');

// All comments on a specific post:
db.posts['<postId>'].comments;

// Phone numbers across all posts (naive):
const phones = new Set();
for (const p of posts) (p.message.match(/\\b3\\d{2}[- ]?\\d{3}[- ]?\\d{4}\\b/g) || []).forEach(n => phones.add(n));

// Busiest commenters:
const byCommenter = {};
for (const p of posts) for (const c of (p.comments||[])) byCommenter[c.author] = (byCommenter[c.author]||0) + 1;
Object.entries(byCommenter).sort((a,b)=>b[1]-a[1]).slice(0,10);

// Posts where someone offered a service (naive — contains "se hace" or "ofrezco"):
posts.filter(p => /\\b(se hace|ofrezco|hago|vendo)\\b/i.test(p.message)).length;

// Every post from this week:
const oneWeekAgo = Date.now() - 7*86400000;
posts.filter(p => new Date(p.timestamp).getTime() >= oneWeekAgo);

// Who replied to whom (reply chains):
posts.flatMap(p => p.comments.filter(c => c.isReply));
`);

// Save
fs.writeFileSync(OUT, out, 'utf8');
w();
w(`Report saved to ${OUT}`);
