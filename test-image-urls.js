// Tests a sample of FB CDN image URLs to see which still work.
// Samples across different ages (new, 1mo, 6mo, 1yr, 2yr+) to find expiration threshold.

const fs = require('fs');
const path = require('path');
const https = require('https');

const DB = path.join(__dirname, 'hispanos members facebook', 'database_posts.json');
console.log('Loading DB...');
const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
const posts = Object.values(db.posts);

// Collect image-only posts with timestamps
const imgPosts = posts.filter(p => (p.images || []).length > 0 && p.timestamp);
console.log(`${imgPosts.length} posts with images and timestamps`);

// Sort by date, pick samples across age buckets
const now = Date.now();
const buckets = {
  '<1 week':    [],
  '1w-1mo':     [],
  '1-3 months': [],
  '3-6 months': [],
  '6-12 months':[],
  '1-2 years':  [],
  '2+ years':   [],
};
for (const p of imgPosts) {
  const age = (now - new Date(p.timestamp).getTime()) / 86400000;
  if (age < 7) buckets['<1 week'].push(p);
  else if (age < 30) buckets['1w-1mo'].push(p);
  else if (age < 90) buckets['1-3 months'].push(p);
  else if (age < 180) buckets['3-6 months'].push(p);
  else if (age < 365) buckets['6-12 months'].push(p);
  else if (age < 730) buckets['1-2 years'].push(p);
  else buckets['2+ years'].push(p);
}

console.log('Image post distribution by age:');
for (const [k, arr] of Object.entries(buckets)) console.log(`  ${k.padEnd(14)}${arr.length}`);

// Pick 5 random from each bucket
const samples = [];
for (const [bucket, arr] of Object.entries(buckets)) {
  const pick = arr.sort(() => Math.random() - 0.5).slice(0, 5);
  pick.forEach(p => samples.push({ bucket, post: p, url: p.images[0] }));
}
console.log(`\nTesting ${samples.length} sample URLs...\n`);

function testUrl(url) {
  return new Promise(resolve => {
    const t0 = Date.now();
    const req = https.request(url, { method: 'HEAD', timeout: 10000 }, res => {
      resolve({ status: res.statusCode, size: res.headers['content-length'], type: res.headers['content-type'], ms: Date.now() - t0 });
    });
    req.on('error', e => resolve({ status: 0, error: e.code || e.message, ms: Date.now() - t0 }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'TIMEOUT', ms: Date.now() - t0 }); });
    req.end();
  });
}

(async () => {
  const results = { ok: 0, fail: 0, byBucket: {} };
  for (const s of samples) {
    const r = await testUrl(s.url);
    const ok = r.status === 200;
    results[ok ? 'ok' : 'fail']++;
    if (!results.byBucket[s.bucket]) results.byBucket[s.bucket] = { ok: 0, fail: 0 };
    results.byBucket[s.bucket][ok ? 'ok' : 'fail']++;
    const mark = ok ? '✅' : '❌';
    const info = ok ? `${r.size} bytes, ${r.type}` : `${r.status} ${r.error || ''}`;
    console.log(`${mark} ${s.bucket.padEnd(14)} ${s.post.timestamp.slice(0,10)} ${info}`);
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Overall: ${results.ok}/${samples.length} succeeded (${(results.ok/samples.length*100).toFixed(0)}%)`);
  console.log(`\nBy age bucket:`);
  for (const [bucket, b] of Object.entries(results.byBucket)) {
    const total = b.ok + b.fail;
    const pct = total ? (b.ok / total * 100).toFixed(0) : 0;
    console.log(`  ${bucket.padEnd(14)} ${b.ok}/${total}  (${pct}% alive)`);
  }

  // Now test: do posts store multiple image URLs? If so, can we try fallbacks?
  console.log(`\nImage-count distribution (all image posts):`);
  const counts = {};
  for (const p of imgPosts) counts[p.images.length] = (counts[p.images.length] || 0) + 1;
  Object.entries(counts).sort((a,b) => +a[0] - +b[0]).forEach(([n,c]) => console.log(`  ${n} image(s): ${c} posts`));
})();
