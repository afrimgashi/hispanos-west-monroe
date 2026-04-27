// build-final.js — master builder.
// Generates every output HTML + CSV + JSON in one pass.
//
//   hispanos members facebook/
//     ├── index.html          ← landing page / dashboard
//     ├── directory.html      ← full person-by-person browser
//     ├── phones.html         ← phone lookup + referral network
//     ├── businesses.html     ← top businesses / engagement
//     ├── directory.json      ← full raw data
//     ├── directory.csv       ← spreadsheet export
//     └── categories/
//         ├── index.html      ← category directory
//         ├── painting.html
//         ├── plumbing.html
//         └── ... (one per active category)

const fs = require('fs');
const path = require('path');
const { buildPeople, finalize } = require('./directory-v2/aggregate');
const { buildHtml: buildFullDirectory } = require('./directory-v2/html-template');
const { buildDashboard } = require('./directory-v2/pages-dashboard');
const { buildCategoryPage, buildCategoryIndex } = require('./directory-v2/pages-categories');
const { buildPhonesPage } = require('./directory-v2/pages-phones');
const { buildBusinessesPage } = require('./directory-v2/pages-businesses');
const { slug } = require('./directory-v2/shared-styles');
const CATEGORIES = require('./directory-v2/categories');

const ROOT = path.join(__dirname, 'hispanos members facebook');
const CAT_DIR = path.join(ROOT, 'categories');

function main() {
  const t0 = Date.now();
  console.log('Loading databases...');
  const postsDb = JSON.parse(fs.readFileSync(path.join(ROOT, 'database_posts.json'), 'utf8'));
  const membersWrap = JSON.parse(fs.readFileSync(path.join(ROOT, 'database_members.json'), 'utf8'));
  const members = membersWrap.members || {};
  const posts = postsDb.posts || {};
  console.log(`  ${Object.keys(posts).length.toLocaleString()} posts, ${Object.keys(members).length.toLocaleString()} members`);

  console.log('Aggregating...');
  const { peopleMap, nPosts, nComments } = buildPeople(posts, members);
  const people = finalize(peopleMap);

  // Compute per-category counts
  const catCounts = Object.keys(CATEGORIES).map(cat => {
    const inCat = people.filter(p => p.trades.some(t => t.category === cat));
    return {
      category: cat,
      people: inCat.length,
      offering: inCat.filter(p => p.trades.find(t => t.category === cat)?.primaryIntent === 'offering').length,
      seeking: inCat.filter(p => p.trades.find(t => t.category === cat)?.primaryIntent === 'seeking').length,
      withPhone: inCat.filter(p => p.phones.length > 0).length,
    };
  });

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

  // ── 1. directory.json ────────────────────────────────────
  console.log('Writing directory.json...');
  fs.writeFileSync(path.join(ROOT, 'directory.json'), JSON.stringify({
    meta: { generated: new Date().toISOString(), ...stats, categoryList: Object.keys(CATEGORIES) },
    people,
  }));

  // ── 2. directory.csv ─────────────────────────────────────
  console.log('Writing directory.csv...');
  const csv = ['name,userId,profileUrl,category,intent,confidence,phones,totalPosts,totalComments,firstSeen,lastSeen,topKeywords,bio,joinDate'];
  const ce = s => {
    if (s == null) return '';
    s = String(s).replace(/"/g, '""').replace(/\r?\n/g, ' ');
    return /[",]/.test(s) ? `"${s}"` : s;
  };
  for (const p of people) {
    const phStr = p.phones.map(x => x.normalized).join('; ');
    if (p.trades.length === 0) {
      if (p.phones.length > 0 || p.totalActivity > 0) {
        csv.push([p.name, p.userId, p.profileUrl, '', '', '', phStr, p.totalPosts, p.totalComments,
          p.firstSeen || '', p.lastSeen || '', '', p.bio, p.joinDate].map(ce).join(','));
      }
    } else {
      for (const t of p.trades) {
        csv.push([p.name, p.userId, p.profileUrl, t.category, t.primaryIntent, t.confidence.toFixed(2),
          phStr, p.totalPosts, p.totalComments, p.firstSeen || '', p.lastSeen || '',
          t.keywords.join('; '), p.bio, p.joinDate].map(ce).join(','));
      }
    }
  }
  fs.writeFileSync(path.join(ROOT, 'directory.csv'), csv.join('\n'), 'utf8');

  // ── 3. directory.html (full browser) ─────────────────────
  console.log('Writing directory.html...');
  fs.writeFileSync(path.join(ROOT, 'directory.html'), buildFullDirectory(people, stats), 'utf8');

  // ── 4. index.html (dashboard) ────────────────────────────
  console.log('Writing index.html...');
  fs.writeFileSync(path.join(ROOT, 'index.html'), buildDashboard(people, stats, catCounts), 'utf8');

  // ── 5. phones.html ───────────────────────────────────────
  console.log('Writing phones.html...');
  fs.writeFileSync(path.join(ROOT, 'phones.html'), buildPhonesPage(people), 'utf8');

  // ── 6. businesses.html ───────────────────────────────────
  console.log('Writing businesses.html...');
  fs.writeFileSync(path.join(ROOT, 'businesses.html'), buildBusinessesPage(people), 'utf8');

  // ── 7. Per-category pages ────────────────────────────────
  if (!fs.existsSync(CAT_DIR)) fs.mkdirSync(CAT_DIR, { recursive: true });
  console.log(`Writing categories/index.html + ${catCounts.filter(c => c.people > 0).length} category pages...`);
  fs.writeFileSync(path.join(CAT_DIR, 'index.html'), buildCategoryIndex(catCounts), 'utf8');
  let catWritten = 0;
  for (const c of catCounts) {
    if (c.people === 0) continue;
    const peopleInCat = people.filter(p => p.trades.some(t => t.category === c.category));
    const html = buildCategoryPage(c.category, peopleInCat, catCounts);
    fs.writeFileSync(path.join(CAT_DIR, `${slug(c.category)}.html`), html, 'utf8');
    catWritten++;
  }

  // ── Summary ──────────────────────────────────────────────
  const sizeMb = fp => (fs.statSync(fp).size / 1024 / 1024).toFixed(2);
  console.log(`\n✅ Generated in ${((Date.now() - t0) / 1000).toFixed(1)}s:`);
  console.log(`   index.html          ${sizeMb(path.join(ROOT, 'index.html'))} MB  ← START HERE`);
  console.log(`   directory.html      ${sizeMb(path.join(ROOT, 'directory.html'))} MB`);
  console.log(`   phones.html         ${sizeMb(path.join(ROOT, 'phones.html'))} MB`);
  console.log(`   businesses.html     ${sizeMb(path.join(ROOT, 'businesses.html'))} MB`);
  console.log(`   directory.json      ${sizeMb(path.join(ROOT, 'directory.json'))} MB`);
  console.log(`   directory.csv       ${sizeMb(path.join(ROOT, 'directory.csv'))} MB`);
  console.log(`   categories/         ${catWritten} category pages`);
  console.log(`\n   Open: hispanos members facebook/index.html`);
}

main();
