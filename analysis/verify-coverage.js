// analysis/verify-coverage.js
// Authoritative coverage check: compares every post ID in the source database
// against every analyzed ID in analysis-db.json. Reports any missing or extra IDs.
//
// Usage:
//   node analysis/verify-coverage.js
//   node analysis/verify-coverage.js --write-missing   (writes missing-ids.json)

const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const POSTS_FILE = path.join(HERE, '..', 'hispanos members facebook', 'database_posts.json');
const ANDB_FILE  = path.join(HERE, 'analysis-db.json');
const HISTORY    = path.join(HERE, 'history');

const writeMissing = process.argv.includes('--write-missing');

const posts   = require(POSTS_FILE).posts;
const db      = JSON.parse(fs.readFileSync(ANDB_FILE, 'utf8'));

const sourceIds   = new Set(Object.keys(posts));
const analyzedIds = new Set(Object.keys(db.results));

// Set differences
const missing = [...sourceIds].filter(id => !analyzedIds.has(id));   // in source but not analyzed
const extra   = [...analyzedIds].filter(id => !sourceIds.has(id));   // analyzed but not in source (shouldn't happen)

// Also verify every batch file on disk is valid & sums to analyzed count
const batchFiles = fs.existsSync(HISTORY)
  ? fs.readdirSync(HISTORY).filter(f => /^batch-\d+.*\.json$/.test(f)).sort()
  : [];

let batchTotal = 0;
let batchErrors = 0;
const batchIds = new Set();
const dupAcrossBatches = [];

for (const f of batchFiles) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(HISTORY, f), 'utf8'));
    const r = (j.output && j.output.results) || j.results || [];
    batchTotal += r.length;
    for (const x of r) {
      if (batchIds.has(x.id)) dupAcrossBatches.push({ id: x.id, file: f });
      batchIds.add(x.id);
    }
  } catch (e) {
    batchErrors++;
    console.error(`  ✗ ${f}: ${e.message}`);
  }
}

// Check for batch-number gaps
const nums = batchFiles.map(f => parseInt(f.match(/^batch-(\d+)/)[1], 10)).sort((a, b) => a - b);
const gaps = [];
for (let i = 1; i < nums.length; i++) {
  for (let n = nums[i - 1] + 1; n < nums[i]; n++) gaps.push(n);
}

// ── Report ──
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  COVERAGE VERIFICATION');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`  Source posts      : ${sourceIds.size.toLocaleString()}`);
console.log(`  Analyzed (in db)  : ${analyzedIds.size.toLocaleString()}`);
console.log(`  Coverage          : ${(analyzedIds.size / sourceIds.size * 100).toFixed(2)}%`);
console.log('');
console.log(`  Batch files       : ${batchFiles.length} (range ${nums[0] || '-'}..${nums[nums.length - 1] || '-'})`);
console.log(`  Gaps in numbering : ${gaps.length ? gaps.join(',') : 'none'}`);
console.log(`  Batch file errors : ${batchErrors}`);
console.log(`  Rows across all batches : ${batchTotal.toLocaleString()}`);
console.log(`  Unique IDs in batches   : ${batchIds.size.toLocaleString()}`);
console.log(`  Duplicates across batches: ${dupAcrossBatches.length}`);
console.log('');
console.log(`  Missing (source − analyzed): ${missing.length}`);
console.log(`  Extra   (analyzed − source): ${extra.length}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

if (missing.length === 0 && extra.length === 0) {
  console.log('\n✅ PERFECT — every source post is analyzed, nothing orphaned.\n');
} else {
  if (missing.length) {
    console.log(`\n⚠️  ${missing.length} posts NOT analyzed. First 10 IDs:`);
    missing.slice(0, 10).forEach(id => console.log('   ' + id));
    if (writeMissing) {
      const out = path.join(HERE, 'missing-ids.json');
      fs.writeFileSync(out, JSON.stringify(missing, null, 2));
      console.log(`\n   → Wrote full list to ${out} (${missing.length} IDs)`);
    } else {
      console.log('\n   Run with --write-missing to dump full list to missing-ids.json');
    }
  }
  if (extra.length) {
    console.log(`\n⚠️  ${extra.length} analyzed IDs don't exist in source. First 10:`);
    extra.slice(0, 10).forEach(id => console.log('   ' + id));
  }
}

if (dupAcrossBatches.length) {
  console.log(`\n⚠️  ${dupAcrossBatches.length} IDs appear in more than one batch (first 5):`);
  dupAcrossBatches.slice(0, 5).forEach(d => console.log(`   ${d.id}  (${d.file})`));
}

process.exit(missing.length || extra.length ? 1 : 0);
