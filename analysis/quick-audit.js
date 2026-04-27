const db = require('../hispanos members facebook/database_posts.json');
const an = require('./analysis-db.json');
const posts = db.posts;

let generic = 0, genericWithText = 0, empty = 0;
const samples = [];
const lowQualityIds = [];

for (const id of Object.keys(an.results)) {
  const r = an.results[id];
  const p = posts[id];
  const text = (p?.message || '').trim();
  const hasContent = text.length > 10;

  const isGenericSum = r.sum === 'No summary available.';
  const isLowQ = isGenericSum || (r.intent === 'other' && !r.svc && (!r.cats || r.cats.length === 0) && hasContent);

  if (isGenericSum) {
    generic++;
    if (hasContent) {
      genericWithText++;
      if (samples.length < 8) samples.push([id, text.slice(0, 120), r.intent]);
    } else {
      empty++;
    }
  }

  if (isLowQ && hasContent) lowQualityIds.push(id);
}

console.log('Total results:', Object.keys(an.results).length);
console.log('"No summary available." total:', generic);
console.log('  → on empty/image-only posts (acceptable):', empty);
console.log('  → on posts with REAL text (BAD):', genericWithText);
console.log('Low-quality results with real text:', lowQualityIds.length);
console.log('\nSample BAD results:');
samples.forEach(s => console.log('  [' + s[2] + ']', s[0], '→', s[1]));

require('fs').writeFileSync('./analysis/_reanalyze-ids.json', JSON.stringify(lowQualityIds, null, 2));
console.log('\n→ Wrote', lowQualityIds.length, 'IDs to analysis/_reanalyze-ids.json');
