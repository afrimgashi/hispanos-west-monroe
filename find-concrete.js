const fs = require('fs');
const data = JSON.parse(fs.readFileSync('hispanos members facebook/database_posts.json', 'utf8'));
const posts = data.posts || {};

// Comprehensive concrete/masonry keywords - English + Spanish
const keywords = [
  // Core concrete
  'concrete', 'concreto', 'cemento', 'cement',
  // Surfaces
  'losa', 'losas', 'slab', 'slabs',
  'sidewalk', 'sidewalks', 'acera', 'aceras', 'banqueta', 'banquetas',
  'driveway', 'driveways',
  // Foundation
  'foundation', 'foundations', 'cimiento', 'cimientos', 'cimentacion', 'cimentación',
  'footings', 'footing',
  // Decorative concrete
  'stamped concrete', 'estampado',
  'polished concrete', 'pulido', 'pulir',
  'stained concrete',
  // Flatwork
  'flatwork',
  'curb', 'curbs',
  // Retaining/walls
  'retaining wall', 'muro de contención', 'muro de contencion',
  // Block/brick/masonry
  'block wall', 'blocks', 'bloque', 'bloques',
  'brick', 'bricks', 'ladrillo', 'ladrillos',
  'mason', 'masonry', 'albañil', 'albanil', 'albañilería', 'albanileria',
  // Pouring
  'pour concrete', 'pouring concrete', 'vaciado', 'vaciar concreto', 'colar',
  // Rebar
  'rebar', 'varilla',
];

const re = new RegExp(keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi');

const results = [];

function check(text, authorName, authorId, date, link, type) {
  if (!text) return;
  const matches = text.match(re);
  if (!matches) return;
  const found = [...new Set(matches.map(m => m.toLowerCase()))];
  results.push({ name: authorName || 'Unknown', id: authorId, date: date ? date.split('T')[0] : '', link, type, keywords: found, msg: text });
}

for (const post of Object.values(posts)) {
  check(post.message, post.authorName, post.authorId, post.timestamp, post.permalink, 'POST');
  if (post.comments) {
    for (const c of post.comments) {
      check(c.text, c.author, c.authorId, c.timestamp, post.permalink, 'COMMENT');
    }
  }
}

// Sort by date descending
results.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

console.log('=== TOTAL CONCRETE-RELATED RESULTS: ' + results.length + ' ===\n');

// Print each one
results.forEach((r, i) => {
  const msgClean = r.msg.replace(/\n/g, ' ').substring(0, 350);
  console.log('#' + (i + 1) + ' [' + r.type + '] ' + r.name + ' | Date: ' + r.date);
  console.log('   Keywords: ' + r.keywords.join(', '));
  console.log('   Message: ' + msgClean);
  console.log('   Link: ' + (r.link || 'N/A'));
  console.log('');
});

// Also check for phone numbers in those results
const phoneRe = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g;
const withPhones = results.filter(r => {
  const m = r.msg.match(phoneRe);
  return m && m.some(p => { const d = p.replace(/\D/g, ''); return d.length >= 7 && d.length <= 11; });
});

console.log('\n=== WITH PHONE NUMBERS: ' + withPhones.length + ' ===\n');
withPhones.forEach((r, i) => {
  const phones = (r.msg.match(phoneRe) || []).filter(p => { const d = p.replace(/\D/g, ''); return d.length >= 7 && d.length <= 11; });
  console.log('#' + (i + 1) + ' ' + r.name + ' | Phone: ' + phones.join(', ') + ' | ' + r.date);
  console.log('   ' + r.msg.replace(/\n/g, ' ').substring(0, 300));
  console.log('');
});
