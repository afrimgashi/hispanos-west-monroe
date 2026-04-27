// build-directory-v2.js
// Comprehensive person-centric directory builder.
// Reads: hispanos members facebook/database_posts.json
//        hispanos members facebook/database_members.json
// Writes: hispanos members facebook/directory.json   (full data)
//         hispanos members facebook/directory.csv    (one row per person+trade)
//         hispanos members facebook/directory.html   (interactive viewer)

const fs = require('fs');
const path = require('path');
const { buildPeople, finalize } = require('./directory-v2/aggregate');
const { buildHtml } = require('./directory-v2/html-template');
const CATEGORIES = require('./directory-v2/categories');

const ROOT = path.join(__dirname, 'hispanos members facebook');
const POSTS_DB = path.join(ROOT, 'database_posts.json');
const MEMBERS_DB = path.join(ROOT, 'database_members.json');

const OUT_JSON = path.join(ROOT, 'directory.json');
const OUT_CSV = path.join(ROOT, 'directory.csv');
const OUT_HTML = path.join(ROOT, 'directory.html');

function main() {
  const t0 = Date.now();

  console.log('Loading databases...');
  const postsDb = JSON.parse(fs.readFileSync(POSTS_DB, 'utf8'));
  const membersWrap = JSON.parse(fs.readFileSync(MEMBERS_DB, 'utf8'));
  const members = membersWrap.members || {};
  const posts = postsDb.posts || {};
  console.log(`  ${Object.keys(posts).length.toLocaleString()} posts`);
  console.log(`  ${Object.keys(members).length.toLocaleString()} members`);

  console.log('Aggregating posts + comments per person...');
  const { peopleMap, nPosts, nComments } = buildPeople(posts, members);
  console.log(`  ${nPosts.toLocaleString()} posts processed`);
  console.log(`  ${nComments.toLocaleString()} comments processed`);
  console.log(`  ${peopleMap.size.toLocaleString()} people indexed`);

  console.log('Scoring trades + finalizing...');
  const people = finalize(peopleMap);

  const stats = {
    totalPeople: people.length,
    peopleWithPosts: people.filter(p => p.totalPosts > 0).length,
    peopleWithPhones: people.filter(p => p.phones.length > 0).length,
    peopleOffering: people.filter(p => p.offersService).length,
    peopleSeeking: people.filter(p => p.seeksService).length,
    uniquePhones: new Set(people.flatMap(p => p.phones.map(ph => ph.digits))).size,
    totalPosts: nPosts,
    totalComments: nComments,
    categories: Object.keys(CATEGORIES).length,
  };

  // directory.json
  console.log('Writing directory.json...');
  fs.writeFileSync(OUT_JSON, JSON.stringify({
    meta: { generated: new Date().toISOString(), ...stats, categoryList: Object.keys(CATEGORIES) },
    people,
  }));
  console.log(`  ${OUT_JSON}  (${(fs.statSync(OUT_JSON).size / 1024 / 1024).toFixed(1)} MB)`);

  // directory.csv
  console.log('Writing directory.csv...');
  const csv = ['name,userId,profileUrl,category,intent,confidence,phones,totalPosts,totalComments,firstSeen,lastSeen,topKeywords,bio,joinDate'];
  const csvEsc = s => {
    if (s == null) return '';
    s = String(s).replace(/"/g, '""').replace(/\r?\n/g, ' ');
    return /[",]/.test(s) ? `"${s}"` : s;
  };
  for (const p of people) {
    const phonesStr = p.phones.map(x => x.normalized).join('; ');
    if (p.trades.length === 0) {
      if (p.phones.length > 0 || p.totalActivity > 0) {
        csv.push([p.name, p.userId, p.profileUrl, '', '', '', phonesStr,
          p.totalPosts, p.totalComments, p.firstSeen || '', p.lastSeen || '',
          '', p.bio, p.joinDate].map(csvEsc).join(','));
      }
    } else {
      for (const t of p.trades) {
        csv.push([p.name, p.userId, p.profileUrl, t.category, t.primaryIntent,
          t.confidence.toFixed(2), phonesStr, p.totalPosts, p.totalComments,
          p.firstSeen || '', p.lastSeen || '', t.keywords.join('; '),
          p.bio, p.joinDate].map(csvEsc).join(','));
      }
    }
  }
  fs.writeFileSync(OUT_CSV, csv.join('\n'), 'utf8');
  console.log(`  ${OUT_CSV}  (${(csv.length - 1).toLocaleString()} rows)`);

  // directory.html
  console.log('Writing directory.html...');
  const html = buildHtml(people, stats);
  fs.writeFileSync(OUT_HTML, html, 'utf8');
  console.log(`  ${OUT_HTML}  (${(fs.statSync(OUT_HTML).size / 1024 / 1024).toFixed(1)} MB)`);

  console.log(`\nSummary:`);
  console.log(`  ${stats.totalPeople.toLocaleString()} people indexed`);
  console.log(`  ${stats.peopleWithPosts.toLocaleString()} active posters`);
  console.log(`  ${stats.peopleWithPhones.toLocaleString()} with phone numbers`);
  console.log(`  ${stats.peopleOffering.toLocaleString()} offering services`);
  console.log(`  ${stats.peopleSeeking.toLocaleString()} seeking services`);
  console.log(`  ${stats.uniquePhones.toLocaleString()} unique phone numbers`);
  console.log(`\nTop categories by people count:`);
  const catCount = {};
  for (const p of people) for (const t of p.trades) catCount[t.category] = (catCount[t.category] || 0) + 1;
  Object.entries(catCount).sort((a, b) => b[1] - a[1]).slice(0, 20)
    .forEach(([c, n]) => console.log(`  ${String(n).padStart(5)}  ${c}`));

  console.log(`\nDone in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main();
