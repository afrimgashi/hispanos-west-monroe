const fs = require('fs');
const data = JSON.parse(fs.readFileSync('hispanos members facebook/database_posts.json', 'utf8'));
const posts = data.posts || {};

// Broad phone regex: handles 903-363-48-62 format, 3188052609, (318) 677-9428, etc.
const phoneRegex = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{2,4}[-.\s]?\d{2,4}/g;
function getPhonesBroad(text) {
  if (!text) return [];
  const matches = (text.match(phoneRegex) || []).filter(m => {
    const d = m.replace(/\D/g, '');
    return d.length >= 7 && d.length <= 11;
  });
  // Also check standalone 10-digit numbers
  const standalone = text.match(/\b\d{10}\b/g) || [];
  for (const s of standalone) {
    if (!matches.includes(s)) matches.push(s);
  }
  return matches;
}

// Concrete/masonry keywords for POST detection
const concreteKeywords = [
  'concrete', 'concreto', 'cemento', 'cement',
  'slab', 'slabs', 'losa de concreto', 'losa de cemento',
  'sidewalk', 'sidewalks', 'acera', 'aceras', 'banqueta',
  'driveway', 'driveways',
  'foundation', 'foundations', 'cimiento', 'cimientos', 'cimentacion', 'cimentación',
  'footings', 'footing',
  'stamped', 'estampado',
  'polished', 'pulido', 'pulir',
  'flatwork',
  'curb', 'curbs',
  'retaining wall', 'muro de contención', 'muro de contencion',
  'block wall', 'bloque', 'bloques',
  'brick', 'bricks', 'ladrillo', 'ladrillos',
  'mason', 'masonry', 'albañil', 'albanil', 'albañilería', 'albanileria',
  'rebar', 'varilla',
  'piedra',  // stone work
];

const concreteRe = new RegExp('\\b(' + concreteKeywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'gi');

// Words that indicate offering services or interest
const offerWords = /\b(yo|yo jefe|listo|me interesa|disponible|i do|i can|i have experience|tengo experiencia|aqui|aquí|mande|mandeme|llam[ae]|call me|text me|escriba|inbox|mensaje|dm|información|informacion|info)\b/gi;

// FALSE POSITIVE filters - skip posts where keywords appear in non-concrete context
function isFalsePositive(text) {
  const lower = text.toLowerCase();
  // Restaurant/food posts with "losa" (as in "deliciosa", "sabrosa")
  if ((lower.includes('pollo') || lower.includes('asado') || lower.includes('comida') || lower.includes('tacos') || lower.includes('ordena')) && !lower.includes('concret') && !lower.includes('cemento') && !lower.includes('ladrillo')) return true;
  // "bloqueada/bloqueado" (blocked account)
  if (lower.includes('bloqueada') || lower.includes('bloqueado') || lower.includes('bloquear')) return true;
  // "cementerio" 
  if (lower.includes('cementerio')) return true;
  // "cimiento" used in religious/figurative context — use word boundaries for short words like 'fe'
  if ((lower.includes('iglesia') || lower.includes('biblia') || lower.includes('dios') || lower.includes('señor') || lower.includes('misa') || lower.includes('virgen') || /\bfe\b/.test(lower) || lower.includes('oración') || lower.includes('cristo')) && !lower.includes('concret') && !lower.includes('cemento') && !lower.includes('ladrillo') && !lower.includes('bloque') && !lower.includes('brick') && !lower.includes('mason') && !lower.includes('mortar')) return true;
  // "escolar" zone (contains "colar")
  if (lower.includes('escolar') || lower.includes('escola')) return true;
  // Translation services with "colar"
  if (lower.includes('translat') || lower.includes('traduccion') || lower.includes('traducción') || lower.includes('interprete') || lower.includes('intérprete')) return true;
  // Cosmetics/beauty
  if (lower.includes('cera de ceja') || lower.includes('maquillaje') || lower.includes('oro laminado') || lower.includes('farmasi')) return true;
  // Counseling/therapy
  if (lower.includes('consejería') || lower.includes('consejeria') || lower.includes('counseling') || lower.includes('terapia')) return true;
  // Politics/immigration
  if (lower.includes('trump') || lower.includes('gobierno') || lower.includes('ejecutiva') || lower.includes('migracion') && !lower.includes('concret')) return true;
  // "mason" as a person's name
  if (lower.includes('olivermason') || lower.includes('james laird') || lower.includes('mason $')) return true;
  // Goat "cemental" 
  if (lower.includes('cemental') || lower.includes('nigerian dwarf')) return true;
  // "conocimiento" contains "cimiento"
  if (lower.includes('conocimiento') && !lower.includes('concret') && !lower.includes('cemento') && !lower.includes('ladrillo') && !lower.includes('bloque') && !lower.includes('albañil')) return true;
  // "agradecimiento" contains "cimiento"
  if (lower.includes('agradecimiento') && !lower.includes('concret') && !lower.includes('cemento')) return true;
  // Donuts "caseras" -> "acera" false match
  if (lower.includes('donas') || lower.includes('caseras')) return true;
  // "batallosa" contains "losa"
  if (lower.includes('batallosa') || lower.includes('gente batallosa')) return true;
  // Spanish words containing "losa" -> deliciosa, sabrosa, etc
  if (/deliciosa|sabrosa|jugosa|poderosa|hermosa|asombrosa|furiosa/i.test(lower) && !lower.includes('concret') && !lower.includes('cemento')) return true;
  
  return false;
}

console.log('Scanning all', Object.keys(posts).length, 'posts...\n');

// PASS 1: Find all concrete-related POSTS
const concretePosts = new Map(); // postId -> post
for (const post of Object.values(posts)) {
  const msg = post.message || '';
  if (msg.match(concreteRe) && !isFalsePositive(msg)) {
    concretePosts.set(post.postId, post);
  }
}

console.log('=== CONCRETE-RELATED POSTS FOUND:', concretePosts.size, '===\n');

// PASS 2: For each concrete post, get ALL comments - especially those with phones or offering
const allWorkers = [];

for (const [postId, post] of concretePosts) {
  const postPhones = getPhonesBroad(post.message || '');
  const postKeywords = (post.message || '').match(concreteRe) || [];
  
  // Add the post author if they have phones (they're offering services)
  if (postPhones.length > 0) {
    allWorkers.push({
      source: 'POST',
      name: post.authorName,
      authorId: post.authorId,
      phones: postPhones,
      keywords: [...new Set(postKeywords.map(k => k.toLowerCase()))],
      msg: post.message || '',
      date: (post.timestamp || '').split('T')[0],
      link: post.permalink,
      context: 'Posted about concrete/masonry work'
    });
  }
  
  // Check ALL comments on this post
  if (post.comments && Array.isArray(post.comments)) {
    for (const c of post.comments) {
      const cText = c.text || '';
      const cPhones = getPhonesBroad(cText);
      const cOffer = cText.match(offerWords);
      const cKeywords = cText.match(concreteRe) || [];
      
      // Include if: has phone, or offers services, or mentions concrete keywords
      if (cPhones.length > 0 || cOffer || cKeywords.length > 0) {
        allWorkers.push({
          source: 'COMMENT on concrete post',
          name: c.author,
          authorId: c.authorId,
          phones: cPhones,
          keywords: [...new Set(cKeywords.map(k => k.toLowerCase()))],
          msg: cText,
          date: (c.timestamp || '').split('T')[0],
          link: post.permalink,
          postAuthor: post.authorName,
          postMsg: (post.message || '').substring(0, 150),
          context: cPhones.length > 0 ? 'Responded with phone number' : (cOffer ? 'Offered services/interest' : 'Mentioned concrete keywords')
        });
      }
    }
  }
}

// PASS 3: Also scan ALL comments everywhere for concrete work offers with phones
console.log('Scanning all comments in all posts for concrete mentions...\n');
for (const post of Object.values(posts)) {
  if (concretePosts.has(post.postId)) continue; // already processed
  if (!post.comments || !Array.isArray(post.comments)) continue;
  
  for (const c of post.comments) {
    const cText = c.text || '';
    if (cText.match(concreteRe) && !isFalsePositive(cText)) {
      const cPhones = getPhonesBroad(cText);
      allWorkers.push({
        source: 'COMMENT (on non-concrete post)',
        name: c.author,
        authorId: c.authorId,
        phones: cPhones,
        keywords: [...new Set((cText.match(concreteRe) || []).map(k => k.toLowerCase()))],
        msg: cText,
        date: (c.timestamp || '').split('T')[0],
        link: post.permalink,
        postAuthor: post.authorName,
        postMsg: (post.message || '').substring(0, 150),
        context: 'Mentioned concrete/masonry in comment'
      });
    }
  }
}

// Sort by date desc
allWorkers.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

// Print everything
console.log('=== ALL CONCRETE/MASONRY RELATED PEOPLE: ' + allWorkers.length + ' ===\n');

allWorkers.forEach((w, i) => {
  console.log('#' + (i + 1) + ' | ' + w.name + ' | ' + w.date);
  console.log('   Source: ' + w.source);
  console.log('   Context: ' + w.context);
  if (w.phones.length) console.log('   PHONE: ' + w.phones.join(', '));
  if (w.keywords.length) console.log('   Keywords: ' + w.keywords.join(', '));
  console.log('   Message: ' + w.msg.replace(/\n/g, ' ').substring(0, 350));
  if (w.postMsg) console.log('   [On post by ' + w.postAuthor + ': "' + w.postMsg.replace(/\n/g, ' ') + '..."]');
  console.log('   Link: ' + w.link);
  console.log('');
});

// Summary: unique people with phones
console.log('\n====================================================');
console.log('=== FINAL: CONCRETE WORKERS WITH PHONE NUMBERS ===');
console.log('====================================================\n');

const phoneMap = new Map();
for (const w of allWorkers) {
  if (w.phones.length === 0) continue;
  const key = w.name + '|' + w.phones.sort().join(',');
  if (!phoneMap.has(key)) {
    phoneMap.set(key, { ...w, allDates: [w.date] });
  } else {
    phoneMap.get(key).allDates.push(w.date);
  }
}

let num = 0;
for (const [key, w] of phoneMap) {
  num++;
  console.log(num + '. ' + w.name);
  console.log('   Phone: ' + w.phones.join(', '));
  console.log('   Context: ' + w.context);
  console.log('   Message: ' + w.msg.replace(/\n/g, ' ').substring(0, 250));
  console.log('   Date(s): ' + w.allDates.join(', '));
  console.log('   Link: ' + w.link);
  console.log('');
}

console.log('Total unique concrete workers with phones:', phoneMap.size);
