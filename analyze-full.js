// analyze-full.js — exhaustive top-to-bottom analysis of database_posts.json
// Processes every post and every comment, inspecting every field.

const fs = require('fs');
const path = require('path');

const DB = path.join(__dirname, 'hispanos members facebook', 'database_posts.json');
const OUT = path.join(__dirname, 'hispanos members facebook', 'analysis-report.txt');

console.log('Loading database...');
const t0 = Date.now();
const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
console.log(`  Loaded in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

const out = [];
const R = (...a) => { const line = a.join(' '); out.push(line); console.log(line); };
const H = (s) => { R(''); R('═'.repeat(72)); R('  ' + s); R('═'.repeat(72)); };

// ───────────────────────────────────────────────────────────────
H('1. FILE & TOP-LEVEL STRUCTURE');
const stat = fs.statSync(DB);
R(`File:            ${DB}`);
R(`Size:            ${(stat.size / 1024 / 1024).toFixed(2)} MB (${stat.size.toLocaleString()} bytes)`);
R(`Modified:        ${stat.mtime.toISOString()}`);
R(`Top-level keys:  ${Object.keys(db).join(', ')}`);

// ───────────────────────────────────────────────────────────────
H('2. META');
for (const [k, v] of Object.entries(db.meta || {})) R(`  ${k.padEnd(20)}${JSON.stringify(v)}`);

// ───────────────────────────────────────────────────────────────
H('3. MEMBER PROGRESS');
const mp = db.memberProgress || {};
const mpEntries = Object.entries(mp);
const statusCounts = {};
const postsFoundDist = { zero: 0, '1-5': 0, '6-20': 0, '21-100': 0, '100+': 0 };
let mpTotalPosts = 0, mpMaxPosts = 0, mpMaxPostsUid = '';
let mpWithCursor = 0, mpNoCursor = 0;
for (const [uid, info] of mpEntries) {
  statusCounts[info.status || 'unknown'] = (statusCounts[info.status || 'unknown'] || 0) + 1;
  const pf = info.postsFound || 0;
  mpTotalPosts += pf;
  if (pf > mpMaxPosts) { mpMaxPosts = pf; mpMaxPostsUid = uid; }
  if (pf === 0) postsFoundDist.zero++;
  else if (pf <= 5) postsFoundDist['1-5']++;
  else if (pf <= 20) postsFoundDist['6-20']++;
  else if (pf <= 100) postsFoundDist['21-100']++;
  else postsFoundDist['100+']++;
  if (info.lastCursor) mpWithCursor++; else mpNoCursor++;
}
R(`Total member entries:           ${mpEntries.length.toLocaleString()}`);
R(`Status breakdown:`);
for (const [s, n] of Object.entries(statusCounts)) R(`  ${s.padEnd(15)}${n.toLocaleString()}`);
R(`Sum of postsFound:              ${mpTotalPosts.toLocaleString()}`);
R(`Max posts by single member:     ${mpMaxPosts} (userId=${mpMaxPostsUid})`);
R(`Members with lastCursor saved:  ${mpWithCursor.toLocaleString()}`);
R(`Members with null/no cursor:    ${mpNoCursor.toLocaleString()}`);
R(`\npostsFound distribution:`);
for (const [b, n] of Object.entries(postsFoundDist)) R(`  ${b.padEnd(10)}${n.toLocaleString()} members`);

// ───────────────────────────────────────────────────────────────
H('4. POSTS — FIELD INVENTORY & COMPLETENESS');
const posts = Object.values(db.posts || {});
const postKeys = new Map(); // field -> count
const postKeyTypes = new Map(); // field -> Set of types
for (const p of posts) {
  for (const [k, v] of Object.entries(p)) {
    postKeys.set(k, (postKeys.get(k) || 0) + 1);
    if (!postKeyTypes.has(k)) postKeyTypes.set(k, new Set());
    const t = Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v;
    postKeyTypes.get(k).add(t);
  }
}
R(`Total posts: ${posts.length.toLocaleString()}\n`);
R(`Field                     Present   %       Types`);
R(`-`.repeat(68));
const sortedFields = [...postKeys.entries()].sort((a, b) => b[1] - a[1]);
for (const [k, n] of sortedFields) {
  const pct = (n / posts.length * 100).toFixed(1);
  const types = [...postKeyTypes.get(k)].join(',');
  R(`  ${k.padEnd(24)}${String(n).padStart(6)}  ${pct.padStart(5)}%  ${types}`);
}

// ───────────────────────────────────────────────────────────────
H('5. POSTS — CONTENT CHARACTERISTICS');
let msgEmpty = 0, msgShort = 0, msgMedium = 0, msgLong = 0;
let msgTotalChars = 0, msgMaxLen = 0;
let hasImages = 0, hasVideos = 0, hasBoth = 0, hasNeither = 0;
let imgTotal = 0, vidTotal = 0, imgMax = 0;
let hasLinks = 0, hasHashtags = 0, hasMentions = 0, hasEmail = 0;
let hasPhone = 0, hasPrice = 0, hasEmoji = 0;
const linkRegex = /https?:\/\/[^\s]+/gi;
const hashtagRegex = /#\w+/g;
const mentionRegex = /@\w+/g;
const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const phoneRegex = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
const priceRegex = /\$\s?\d+/g;
const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
for (const p of posts) {
  const m = p.message || '';
  const len = m.length;
  msgTotalChars += len;
  if (len === 0) msgEmpty++;
  else if (len < 50) msgShort++;
  else if (len < 500) msgMedium++;
  else msgLong++;
  if (len > msgMaxLen) msgMaxLen = len;
  const imgs = (p.images || []).length;
  const vids = (p.videos || []).length;
  imgTotal += imgs; vidTotal += vids;
  if (imgs > imgMax) imgMax = imgs;
  if (imgs > 0 && vids > 0) hasBoth++;
  else if (imgs > 0) hasImages++;
  else if (vids > 0) hasVideos++;
  else hasNeither++;
  if (m) {
    if (linkRegex.test(m)) hasLinks++;
    linkRegex.lastIndex = 0;
    if (hashtagRegex.test(m)) hasHashtags++;
    hashtagRegex.lastIndex = 0;
    if (mentionRegex.test(m)) hasMentions++;
    mentionRegex.lastIndex = 0;
    if (emailRegex.test(m)) hasEmail++;
    emailRegex.lastIndex = 0;
    if (phoneRegex.test(m)) hasPhone++;
    phoneRegex.lastIndex = 0;
    if (priceRegex.test(m)) hasPrice++;
    priceRegex.lastIndex = 0;
    if (emojiRegex.test(m)) hasEmoji++;
  }
}
R(`Message length distribution:`);
R(`  Empty (0 chars):    ${msgEmpty.toLocaleString()}  (${(msgEmpty/posts.length*100).toFixed(1)}%)`);
R(`  Short  (<50):       ${msgShort.toLocaleString()}  (${(msgShort/posts.length*100).toFixed(1)}%)`);
R(`  Medium (50-500):    ${msgMedium.toLocaleString()}  (${(msgMedium/posts.length*100).toFixed(1)}%)`);
R(`  Long   (500+):      ${msgLong.toLocaleString()}  (${(msgLong/posts.length*100).toFixed(1)}%)`);
R(`  Max length:         ${msgMaxLen.toLocaleString()} chars`);
R(`  Avg length:         ${(msgTotalChars/posts.length).toFixed(0)} chars`);
R(`\nMedia:`);
R(`  Image-only posts:   ${hasImages.toLocaleString()}`);
R(`  Video-only posts:   ${hasVideos.toLocaleString()}`);
R(`  Image + Video:      ${hasBoth.toLocaleString()}`);
R(`  No media:           ${hasNeither.toLocaleString()}`);
R(`  Total images:       ${imgTotal.toLocaleString()}`);
R(`  Total videos:       ${vidTotal.toLocaleString()}`);
R(`  Max images in post: ${imgMax}`);
R(`\nContent signals (posts containing):`);
R(`  Phone number:       ${hasPhone.toLocaleString()}  (${(hasPhone/posts.length*100).toFixed(1)}%)`);
R(`  Price ($xxx):       ${hasPrice.toLocaleString()}  (${(hasPrice/posts.length*100).toFixed(1)}%)`);
R(`  URL / link:         ${hasLinks.toLocaleString()}`);
R(`  Hashtag:            ${hasHashtags.toLocaleString()}`);
R(`  Mention (@):        ${hasMentions.toLocaleString()}`);
R(`  Email:              ${hasEmail.toLocaleString()}`);
R(`  Emoji:              ${hasEmoji.toLocaleString()}  (${(hasEmoji/posts.length*100).toFixed(1)}%)`);

// ───────────────────────────────────────────────────────────────
H('6. POSTS — ENGAGEMENT');
let totalReactions = 0, totalComments = 0, totalShares = 0;
let maxReactions = 0, maxComments = 0, maxShares = 0;
let maxRPost = null, maxCPost = null, maxSPost = null;
let zeroReactions = 0, zeroComments = 0;
const reactionBuckets = { '0': 0, '1-5': 0, '6-20': 0, '21-100': 0, '100+': 0 };
for (const p of posts) {
  const r = (p.reactions && p.reactions.total) || 0;
  const c = p.commentCount || 0;
  const s = p.shares || 0;
  totalReactions += r; totalComments += c; totalShares += s;
  if (r > maxReactions) { maxReactions = r; maxRPost = p; }
  if (c > maxComments) { maxComments = c; maxCPost = p; }
  if (s > maxShares) { maxShares = s; maxSPost = p; }
  if (r === 0) zeroReactions++;
  if (c === 0) zeroComments++;
  if (r === 0) reactionBuckets['0']++;
  else if (r <= 5) reactionBuckets['1-5']++;
  else if (r <= 20) reactionBuckets['6-20']++;
  else if (r <= 100) reactionBuckets['21-100']++;
  else reactionBuckets['100+']++;
}
R(`Total reactions:           ${totalReactions.toLocaleString()}`);
R(`Total comments (field):    ${totalComments.toLocaleString()}`);
R(`Total shares:              ${totalShares.toLocaleString()}`);
R(`Posts with 0 reactions:    ${zeroReactions.toLocaleString()} (${(zeroReactions/posts.length*100).toFixed(1)}%)`);
R(`Posts with 0 comments:     ${zeroComments.toLocaleString()} (${(zeroComments/posts.length*100).toFixed(1)}%)`);
R(`Avg reactions/post:        ${(totalReactions/posts.length).toFixed(2)}`);
R(`Avg comments/post:         ${(totalComments/posts.length).toFixed(2)}`);
R(`\nReaction distribution:`);
for (const [b, n] of Object.entries(reactionBuckets)) R(`  ${b.padEnd(10)}${n.toLocaleString()} posts`);
R(`\nMost-reacted post:  ${maxReactions} reactions by "${maxRPost?.authorName}"`);
R(`  ${(maxRPost?.message || '').slice(0,120).replace(/\n/g,' ')}`);
R(`  ${maxRPost?.permalink}`);
R(`Most-commented post: ${maxComments} comments by "${maxCPost?.authorName}"`);
R(`  ${(maxCPost?.message || '').slice(0,120).replace(/\n/g,' ')}`);
R(`Most-shared post:    ${maxShares} shares by "${maxSPost?.authorName}"`);

// ───────────────────────────────────────────────────────────────
H('7. POSTS — TEMPORAL DISTRIBUTION');
const byYear = {}, byMonth = {}, byDow = [0,0,0,0,0,0,0], byHour = new Array(24).fill(0);
let invalidTs = 0;
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
for (const p of posts) {
  if (!p.timestamp) { invalidTs++; continue; }
  const d = new Date(p.timestamp);
  if (isNaN(d)) { invalidTs++; continue; }
  const y = d.getUTCFullYear();
  const m = `${y}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;
  byYear[y] = (byYear[y]||0)+1;
  byMonth[m] = (byMonth[m]||0)+1;
  byDow[d.getUTCDay()]++;
  byHour[d.getUTCHours()]++;
}
R(`Invalid/missing timestamps: ${invalidTs}`);
R(`\nPosts by year:`);
Object.entries(byYear).sort().forEach(([y,n]) => R(`  ${y}  ${String(n).padStart(6)}  ${'█'.repeat(Math.min(60, Math.round(n/Math.max(...Object.values(byYear))*60)))}`));
R(`\nPosts by day of week:`);
byDow.forEach((n,i) => R(`  ${DOW[i]}  ${String(n).padStart(5)}  ${'█'.repeat(Math.round(n/Math.max(...byDow)*40))}`));
R(`\nPosts by UTC hour (peak activity times):`);
byHour.forEach((n,i) => R(`  ${String(i).padStart(2,'0')}:00  ${String(n).padStart(5)}  ${'█'.repeat(Math.round(n/Math.max(...byHour)*40))}`));

// Show top 12 busiest months
R(`\nTop 12 busiest months:`);
Object.entries(byMonth).sort((a,b)=>b[1]-a[1]).slice(0,12).forEach(([m,n]) => R(`  ${m}  ${n}`));

// ───────────────────────────────────────────────────────────────
H('8. POSTS — AUTHOR ANALYSIS');
const authorPosts = {};
const authorNames = {};
const noAuthorId = [];
for (const p of posts) {
  const aid = p.authorId;
  if (!aid) { noAuthorId.push(p.postId); continue; }
  authorPosts[aid] = (authorPosts[aid]||0) + 1;
  if (p.authorName) authorNames[aid] = p.authorName;
}
const uniqueAuthors = Object.keys(authorPosts).length;
const authorsWith1 = Object.values(authorPosts).filter(n=>n===1).length;
const authorsWith10plus = Object.values(authorPosts).filter(n=>n>=10).length;
const authorsWith100plus = Object.values(authorPosts).filter(n=>n>=100).length;
R(`Unique authors:            ${uniqueAuthors.toLocaleString()}`);
R(`Posts without authorId:    ${noAuthorId.length}`);
R(`Authors with 1 post:       ${authorsWith1.toLocaleString()}`);
R(`Authors with 10+ posts:    ${authorsWith10plus.toLocaleString()}`);
R(`Authors with 100+ posts:   ${authorsWith100plus.toLocaleString()}`);
R(`\nTop 20 most prolific authors:`);
Object.entries(authorPosts).sort((a,b)=>b[1]-a[1]).slice(0,20).forEach(([aid,n]) => {
  R(`  ${String(n).padStart(5)}  ${(authorNames[aid]||'?').padEnd(36)} (${aid})`);
});

// ───────────────────────────────────────────────────────────────
H('9. COMMENTS — FIELD INVENTORY');
let totalCommentsActual = 0, totalReplies = 0, totalTopLevel = 0;
const commentKeys = new Map(), commentKeyTypes = new Map();
const commentLenDist = { empty:0, short:0, medium:0, long:0 };
let cMaxLen = 0, cTotalChars = 0;
let commentWithPhone = 0, commentWithEmoji = 0;
const cmtAuthors = {};
const cmtAuthorNames = {};
let noCommentAuthorId = 0;
for (const p of posts) {
  if (!Array.isArray(p.comments)) continue;
  for (const c of p.comments) {
    totalCommentsActual++;
    for (const [k,v] of Object.entries(c)) {
      commentKeys.set(k, (commentKeys.get(k)||0)+1);
      if (!commentKeyTypes.has(k)) commentKeyTypes.set(k, new Set());
      const t = Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v;
      commentKeyTypes.get(k).add(t);
    }
    if (c.isReply) totalReplies++; else totalTopLevel++;
    const tt = c.text || '';
    cTotalChars += tt.length;
    if (tt.length > cMaxLen) cMaxLen = tt.length;
    if (tt.length === 0) commentLenDist.empty++;
    else if (tt.length < 30) commentLenDist.short++;
    else if (tt.length < 200) commentLenDist.medium++;
    else commentLenDist.long++;
    if (phoneRegex.test(tt)) commentWithPhone++; phoneRegex.lastIndex = 0;
    if (emojiRegex.test(tt)) commentWithEmoji++;
    if (c.authorId) {
      cmtAuthors[c.authorId] = (cmtAuthors[c.authorId]||0)+1;
      if (c.author) cmtAuthorNames[c.authorId] = c.author;
    } else noCommentAuthorId++;
  }
}
R(`Total comments (actual):    ${totalCommentsActual.toLocaleString()}`);
R(`  Top-level:                ${totalTopLevel.toLocaleString()}`);
R(`  Replies:                  ${totalReplies.toLocaleString()}`);
R(`  Without authorId:         ${noCommentAuthorId.toLocaleString()}`);
R(`\nComment fields:`);
[...commentKeys.entries()].sort((a,b)=>b[1]-a[1]).forEach(([k,n]) => {
  R(`  ${k.padEnd(18)}${String(n).padStart(6)}  ${(n/totalCommentsActual*100).toFixed(1)}%  ${[...commentKeyTypes.get(k)].join(',')}`);
});
R(`\nComment length:`);
R(`  Empty:                    ${commentLenDist.empty.toLocaleString()}`);
R(`  Short (<30):              ${commentLenDist.short.toLocaleString()}`);
R(`  Medium (30-200):          ${commentLenDist.medium.toLocaleString()}`);
R(`  Long (200+):              ${commentLenDist.long.toLocaleString()}`);
R(`  Max length:               ${cMaxLen}`);
R(`  Avg length:               ${(cTotalChars/totalCommentsActual).toFixed(0)}`);
R(`Comments with phone #:      ${commentWithPhone.toLocaleString()}`);
R(`Comments with emoji:        ${commentWithEmoji.toLocaleString()}`);
R(`Unique commenters:          ${Object.keys(cmtAuthors).length.toLocaleString()}`);
R(`\nTop 15 most-active commenters:`);
Object.entries(cmtAuthors).sort((a,b)=>b[1]-a[1]).slice(0,15).forEach(([id,n]) => {
  R(`  ${String(n).padStart(5)}  ${(cmtAuthorNames[id]||'?').padEnd(36)} (${id})`);
});

// ───────────────────────────────────────────────────────────────
H('10. DATA QUALITY & ANOMALIES');
// commentCount mismatch
let mismatchCount = 0, mismatchGreater = 0, mismatchLess = 0;
for (const p of posts) {
  const declared = p.commentCount || 0;
  const actual = Array.isArray(p.comments) ? p.comments.length : 0;
  if (declared !== actual) {
    mismatchCount++;
    if (actual > declared) mismatchGreater++;
    else mismatchLess++;
  }
}
R(`Posts where commentCount != actual stored comments: ${mismatchCount.toLocaleString()}`);
R(`  actual > declared: ${mismatchGreater}`);
R(`  actual < declared: ${mismatchLess}`);
R(`  (this is normal — Facebook hides some comments / enrichment fetched extras/fewer)`);

// Mojibake detection
let mojibakePosts = 0, mojibakeComments = 0;
const mojibakeRe = /Ã[\u0080-\u00BF]|Â[\u0080-\u00BF]|â€[\u0099\u009C\u009D]/;
for (const p of posts) {
  if (mojibakeRe.test(p.message || '') || mojibakeRe.test(p.authorName || '')) mojibakePosts++;
  if (Array.isArray(p.comments)) {
    for (const c of p.comments) if (mojibakeRe.test(c.text || '') || mojibakeRe.test(c.author || '')) mojibakeComments++;
  }
}
R(`\nMojibake (encoding corruption):`);
R(`  Posts affected:     ${mojibakePosts.toLocaleString()} (${(mojibakePosts/posts.length*100).toFixed(1)}%)`);
R(`  Comments affected:  ${mojibakeComments.toLocaleString()} (${(mojibakeComments/totalCommentsActual*100).toFixed(1)}%)`);

// Missing permalinks
const noPermalink = posts.filter(p => !p.permalink).length;
const noAuthorName = posts.filter(p => !p.authorName).length;
const noTimestamp = posts.filter(p => !p.timestamp).length;
R(`\nMissing critical fields (posts):`);
R(`  No permalink:       ${noPermalink}`);
R(`  No authorName:      ${noAuthorName}`);
R(`  No timestamp:       ${noTimestamp}`);

// Duplicate postIds (key check)
const postIdSet = new Set();
let dupPostIds = 0;
for (const p of posts) {
  if (postIdSet.has(p.postId)) dupPostIds++;
  postIdSet.add(p.postId);
}
R(`  Duplicate postId values in posts array: ${dupPostIds}`);

// ───────────────────────────────────────────────────────────────
H('11. LANGUAGE & VOCABULARY ESTIMATE');
let spanishMarkers = 0, englishMarkers = 0, bothMarkers = 0;
const spanishWords = /\b(que|los|las|para|pero|con|una|este|esta|esto|muy|más|sin|bien|sí|más|también|porque|cuando|donde|quiero|necesito|busco|vendo|hago|ofrezco|gracias|buenas|buenos|saludos|hola|señor|señora|trabajo|casa|persona)\b/i;
const englishWords = /\b(the|and|for|you|are|this|that|with|have|from|your|will|would|please|thanks|hello|need|looking|available|call|message|work|house|home|person)\b/i;
for (const p of posts) {
  const m = p.message || '';
  if (!m) continue;
  const hasSp = spanishWords.test(m);
  const hasEn = englishWords.test(m);
  if (hasSp && hasEn) bothMarkers++;
  else if (hasSp) spanishMarkers++;
  else if (hasEn) englishMarkers++;
}
R(`Language heuristic on post messages:`);
R(`  Spanish markers only:   ${spanishMarkers.toLocaleString()}`);
R(`  English markers only:   ${englishMarkers.toLocaleString()}`);
R(`  Both (mixed/Spanglish): ${bothMarkers.toLocaleString()}`);
R(`  (no markers = short/no text / only emoji/phone)`);

// ───────────────────────────────────────────────────────────────
H('12. UNIQUE PHONE NUMBERS — GLOBAL');
const phoneSet = new Set();
const phoneToAuthors = new Map();
function collect(phones, authorName) {
  for (const ph of phones) {
    const digits = ph.replace(/\D/g, '').slice(-10);
    if (digits.length !== 10) continue;
    if (/^(\d)\1+$/.test(digits)) continue;
    if (digits.startsWith('0')) continue;
    phoneSet.add(digits);
    if (!phoneToAuthors.has(digits)) phoneToAuthors.set(digits, new Set());
    if (authorName) phoneToAuthors.get(digits).add(authorName);
  }
}
for (const p of posts) {
  const m = (p.message || '').match(phoneRegex) || [];
  collect(m, p.authorName);
  if (Array.isArray(p.comments)) {
    for (const c of p.comments) {
      const cm = (c.text || '').match(phoneRegex) || [];
      collect(cm, c.author);
    }
  }
}
const sharedPhones = [...phoneToAuthors.entries()].filter(([,names]) => names.size >= 2);
R(`Total unique phone numbers:      ${phoneSet.size.toLocaleString()}`);
R(`Phones shared by 2+ people:      ${sharedPhones.length}`);
R(`(shared phones = business lines or phone-number dedup opportunities)`);
R(`\nTop 10 most-shared phone numbers:`);
sharedPhones.sort((a,b)=>b[1].size-a[1].size).slice(0,10).forEach(([digits, names]) => {
  const formatted = `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
  R(`  ${formatted}  used by ${names.size} names: ${[...names].slice(0,3).join(', ')}${names.size>3?', ...':''}`);
});

// ───────────────────────────────────────────────────────────────
H('13. IMAGE URL PATTERNS');
const imgHosts = new Map();
let totalImgUrls = 0;
for (const p of posts) {
  for (const u of (p.images || [])) {
    totalImgUrls++;
    try {
      const host = new URL(u).hostname;
      imgHosts.set(host, (imgHosts.get(host)||0)+1);
    } catch(_) {}
  }
}
R(`Total image URLs:  ${totalImgUrls.toLocaleString()}`);
R(`Image hosts:`);
[...imgHosts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8).forEach(([h,n]) => R(`  ${String(n).padStart(7)}  ${h}`));

// ───────────────────────────────────────────────────────────────
H('14. SCRAPE COMPLETENESS SUMMARY');
R(`Members scraped:            ${mpEntries.length.toLocaleString()} / ${db.meta?.totalMembers?.toLocaleString() || '?'}`);
R(`Remaining to scrape:        ${(db.meta?.totalMembers || 0) - mpEntries.length}`);
R(`Posts captured:             ${posts.length.toLocaleString()}`);
R(`Comments captured:          ${totalCommentsActual.toLocaleString()}`);
R(`Unique authors (posters):   ${uniqueAuthors.toLocaleString()}`);
R(`Unique commenters:          ${Object.keys(cmtAuthors).length.toLocaleString()}`);
const allParticipants = new Set([...Object.keys(authorPosts), ...Object.keys(cmtAuthors)]);
R(`Unique participants total:  ${allParticipants.size.toLocaleString()}`);
R(`Unique phone numbers:       ${phoneSet.size.toLocaleString()}`);
R(`Total images collected:     ${imgTotal.toLocaleString()}`);
R(`Total reactions captured:   ${totalReactions.toLocaleString()}`);
R(`Date range:                 ${Object.keys(byYear).sort()[0]} → ${Object.keys(byYear).sort().slice(-1)[0]}`);

R(`\n═══════════════════════════════════════════════════════════════════════`);
R(`  Analysis complete. Runtime: ${((Date.now()-t0)/1000).toFixed(1)}s`);
R(`═══════════════════════════════════════════════════════════════════════`);

fs.writeFileSync(OUT, out.join('\n'), 'utf8');
console.log(`\nFull report saved to: ${OUT}`);
