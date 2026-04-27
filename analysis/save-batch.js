// analysis/save-batch.js
//
// Takes Cascade's batch-output.json (produced after analysis) and merges the
// results into analysis-db.json. Validates structure first.
//
// Usage:
//   node analysis/save-batch.js

const fs = require('fs');
const path = require('path');

const ANDB = path.join(__dirname, 'analysis-db.json');
const OUT  = path.join(__dirname, 'batch-output.json');
const IN   = path.join(__dirname, 'batch-input.json');
const HIST = path.join(__dirname, 'history');

if (!fs.existsSync(OUT)) {
  console.error(`ERROR: ${OUT} does not exist. Cascade hasn't saved its output yet.`);
  process.exit(1);
}

const output = JSON.parse(fs.readFileSync(OUT, 'utf8'));
const input  = fs.existsSync(IN) ? JSON.parse(fs.readFileSync(IN, 'utf8')) : null;

if (!output.results || !Array.isArray(output.results)) {
  console.error('ERROR: batch-output.json missing `results` array.');
  process.exit(1);
}

// Validate each result has an id that matches a post in the input batch
const inputIds = input ? new Set(input.posts.map(p => p.id)) : null;
const inputPosts = input ? Object.fromEntries(input.posts.map(p => [p.id, p])) : {};
const required = ['id', 'intent', 'isBusiness', 'svc', 'cats', 'phones', 'bname', 'loc', 'lang', 'sum', 'price', 'urgency', 'resolution', 'conf'];
const validIntents = new Set(['offering', 'seeking', 'event', 'news', 'personal', 'informational', 'lost_found', 'spam', 'other']);
const validLangs = new Set(['es', 'en', 'mixed', 'other']);
const validResolutions = new Set(['answered_in_comments', 'not_answered', 'no_comments', 'offered_help', 'argued', 'other']);
const validUrgency = new Set(['immediate', 'ongoing', 'one_time', null]);
const BAD_SUMS = new Set(['no summary available.', 'no summary available', 'no summary', '', 'n/a', 'none', 'empty', 'empty post', 'no content', '.']);

let invalid = 0;
const invalidReasons = [];
let otherCount = 0;

for (const r of output.results) {
  // Field presence
  for (const f of required) {
    if (!(f in r)) {
      invalid++;
      invalidReasons.push(`Post ${r.id || '?'} missing field: ${f}`);
      break;
    }
  }

  if (inputIds && r.id && !inputIds.has(r.id)) {
    invalid++;
    invalidReasons.push(`Post ${r.id} was not in batch-input.json`);
  }

  // Enum validation
  if (r.intent && !validIntents.has(r.intent)) {
    invalid++;
    invalidReasons.push(`Post ${r.id} invalid intent: "${r.intent}" (valid: ${[...validIntents].join(', ')})`);
  }
  if (r.lang && !validLangs.has(r.lang)) {
    invalid++;
    invalidReasons.push(`Post ${r.id} invalid lang: "${r.lang}"`);
  }
  if (r.resolution && !validResolutions.has(r.resolution)) {
    invalid++;
    invalidReasons.push(`Post ${r.id} invalid resolution: "${r.resolution}"`);
  }
  if ('urgency' in r && r.urgency !== null && !validUrgency.has(r.urgency)) {
    invalid++;
    invalidReasons.push(`Post ${r.id} invalid urgency: "${r.urgency}"`);
  }

  // Type validation
  if (typeof r.isBusiness !== 'boolean') {
    invalid++;
    invalidReasons.push(`Post ${r.id} isBusiness must be boolean, got ${typeof r.isBusiness}`);
  }
  if (!Array.isArray(r.cats)) {
    invalid++;
    invalidReasons.push(`Post ${r.id} cats must be array`);
  }
  if (!Array.isArray(r.phones)) {
    invalid++;
    invalidReasons.push(`Post ${r.id} phones must be array`);
  }
  if (typeof r.conf !== 'number' || r.conf < 0 || r.conf > 1) {
    invalid++;
    invalidReasons.push(`Post ${r.id} conf must be number 0-1, got ${r.conf}`);
  }

  // Placeholder summary rejection — the #1 lazy-AI failure mode
  if (typeof r.sum === 'string') {
    const sumClean = r.sum.trim().toLowerCase();
    const srcPost = inputPosts[r.id];
    const hasRealText = srcPost && ((srcPost.text || '').trim().length > 10 || (srcPost.c || []).some(c => (c.text || '').trim().length > 5));
    if (BAD_SUMS.has(sumClean)) {
      // Allow placeholder sum only when the source post truly has no content
      if (hasRealText) {
        invalid++;
        invalidReasons.push(`Post ${r.id} has placeholder summary "${r.sum}" but post has real content — write a real summary`);
      }
    }
    if (hasRealText && r.sum.trim().length < 15) {
      invalid++;
      invalidReasons.push(`Post ${r.id} summary too short (${r.sum.trim().length} chars) for a post with real content`);
    }
  } else if ('sum' in r) {
    invalid++;
    invalidReasons.push(`Post ${r.id} sum must be string`);
  }

  // Phone format: digits-only, 10 digits
  if (Array.isArray(r.phones)) {
    for (const ph of r.phones) {
      if (typeof ph !== 'string' || !/^\d{10}$/.test(ph)) {
        invalid++;
        invalidReasons.push(`Post ${r.id} has malformed phone: "${ph}" — must be 10 digits only`);
        break;
      }
    }
  }

  // Count "other" intent to warn on laziness
  if (r.intent === 'other') otherCount++;
}

// Warn (don't reject) if "other" is overused
if (otherCount > Math.max(3, Math.floor(output.results.length * 0.1))) {
  console.warn(`⚠  ${otherCount}/${output.results.length} results use intent "other" — this is suspiciously high. Re-read SCHEMA.md §2 intent decision tree.`);
}

// Require results.length to match input
if (input && output.results.length !== input.posts.length) {
  invalid++;
  invalidReasons.push(`results.length (${output.results.length}) !== input posts.length (${input.posts.length})`);
}

// batchNumber match
if (input && output.batchNumber !== input.batchNumber) {
  invalid++;
  invalidReasons.push(`batchNumber mismatch: output=${output.batchNumber} input=${input.batchNumber}`);
}

if (invalid > 0) {
  console.error(`\n❌ ${invalid} invalid results:`);
  invalidReasons.slice(0, 10).forEach(r => console.error('   ' + r));
  if (invalidReasons.length > 10) console.error(`   ... +${invalidReasons.length - 10} more`);
  console.error('\nFix batch-output.json and re-run. Nothing was saved.');
  process.exit(1);
}

// Load existing DB
let analysisDb = { analyzedAt: null, meta: {}, results: {} };
if (fs.existsSync(ANDB)) {
  analysisDb = JSON.parse(fs.readFileSync(ANDB, 'utf8'));
  if (!analysisDb.results) analysisDb.results = {};
  if (!analysisDb.meta) analysisDb.meta = {};
}

// Merge
let inserted = 0, updated = 0;
for (const r of output.results) {
  if (analysisDb.results[r.id]) updated++;
  else inserted++;
  analysisDb.results[r.id] = r;
}

analysisDb.lastUpdated = new Date().toISOString();
analysisDb.meta.nextBatch = (output.batchNumber || analysisDb.meta.nextBatch || 1) + 1;
analysisDb.meta.lastBatchSize = output.results.length;
analysisDb.meta.totalAnalyzed = Object.keys(analysisDb.results).length;

fs.writeFileSync(ANDB, JSON.stringify(analysisDb, null, 0), 'utf8');

// Archive batch
if (!fs.existsSync(HIST)) fs.mkdirSync(HIST);
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const batchNum = String(output.batchNumber || '?').padStart(4, '0');
fs.writeFileSync(path.join(HIST, `batch-${batchNum}-${stamp}.json`), JSON.stringify({ input, output }, null, 0), 'utf8');

// Clean slate for next batch
fs.unlinkSync(OUT);

console.log(`
═══════════════════════════════════════════════════════════════════
  BATCH ${output.batchNumber} SAVED
═══════════════════════════════════════════════════════════════════
  Results merged:         ${output.results.length.toLocaleString()}
    Newly inserted:       ${inserted}
    Updated (re-run):     ${updated}

  Cumulative progress:    ${analysisDb.meta.totalAnalyzed.toLocaleString()} posts analyzed
  Auto-tagged to date:    ${(analysisDb.meta.autoTagged || 0).toLocaleString()}

  Archived:               analysis/history/batch-${batchNum}-*.json
  Next batch number:      ${analysisDb.meta.nextBatch}

  Next step:              node analysis/prepare-batch.js
═══════════════════════════════════════════════════════════════════`);
