// ═══════════════════════════════════════════════════════════════
//  Facebook Group Post Scraper v5 — Hardcoded API Replay
// ═══════════════════════════════════════════════════════════════
//
//  HOW TO USE:
//  1. Be logged into Facebook in this browser
//  2. Be on ANY facebook.com page
//  3. Open DevTools → Console (F12)
//  4. Paste this entire script → Enter
//  5. Pick your scrape folder
//  6. It auto-tests, then auto-starts. That's it.
//
//  NO scrolling. NO page navigation. NO interception.
//  Uses YOUR exact captured API request replayed for all members.
//
//  COMMANDS:
//    posts.start()              — begin / resume
//    posts.stop()               — pause & save
//    posts.status()             — show progress
//    posts.save()               — force save
//    posts.export()             — export JSON
//    posts.faster()             — speed up
//    posts.slower()             — slow down
//    posts.skip()               — skip current member
//    posts.jumpTo(n)            — jump to member #n
//    posts.errors()             — list failed members
//    posts.test(uid)            — test single member
//    posts.raw(uid)             — dump raw API response
//    posts.updateToken(dtsg)    — refresh expired fb_dtsg
//
//  COMMENT ENRICHMENT:
//    posts.enrich()             — fetch all comments for all posts
//    posts.stopEnrich()         — pause comment enrichment
//    posts.testComments(pid)    — test comment fetch on a post
//    posts.rawComments(pid)     — raw comment API response
//
// ═══════════════════════════════════════════════════════════════

(async () => {
  'use strict';

  // ── CONFIG ──────────────────────────────────────────────
  const CONFIG = {
    requestDelay:  [2500, 5000],
    memberDelay:   [3000, 6000],
    maxRetries:    3,
    maxEmptyPages: 3,
    saveEvery:     5,
    autoSaveMs:    30000,
    postsPerPage:  3,
    groupId:       '1437882213110717',
    // Human-like rest breaks: pause every N members for a longer break
    restEvery:     [25, 45],     // take a break every 25-45 members (random)
    restDuration:  [60000, 180000], // rest 1-3 minutes
  };

  // ═══════════════════════════════════════════════════════
  //  YOUR CAPTURED REQUEST — exact params from Network tab
  //  fb_dtsg expires after a few hours. If errors appear,
  //  re-copy it: posts.updateToken("new_value")
  // ═══════════════════════════════════════════════════════
  const API_URL = 'https://www.facebook.com/api/graphql/';
  const DOC_ID  = '26627617276834581';

  const STATIC_PARAMS = {
    av: '100004693939090',
    __aaid: '0',
    __user: '100004693939090',
    __a: '1',
    __req: '2h',
    __hs: '20553.HCSV2:comet_pkg.2.1...0',
    dpr: '3',
    __ccg: 'EXCELLENT',
    __rev: '1037066023',
    __s: '5drsdf:6ptjpg:dx8u0m',
    __hsi: '7627063749742431062',
    __dyn: '7xeUjGU5a5Q1ryaxG4Vp41twWwIxu13wFwhUKbgS3q2ibwNw9G2Saw8i2S1DwUx60GE5O0BU2_CxS320qa321Rwwwqo462mcwfG12wOx62G5Usw9m1YwBgK7o6C1uwoE4G17yovwRwlE-U2exi4UaEW2G1jwUBwJK14xm3y3aexfxmu3W3rwxwjFovUaU3VwLyEbUGdG1QwVwwwOg2ZwhEkxebwHwKG4UrwFg2fwxyo566k1fxC13xecwBwWzUlwEKufxamEbbxG1fBG2-0P846fwk83KwHwOyUqxG0K83jxG',
    __csr: 'gaA2N4gGzhY9MXb34psnfY_4MFkJ8Qljshq6IhsIIh5gR4j4my9jh9rsACYkJ-pklFaGWGDsCRkQOQGGGHLtljvmzHuhsBkTVeiKgGCBrHiiAehlBt6BTTbRXtrrojZp4D89QbFbLnVeB9jFV4UyVAnGUxAUB2rJvGaDBjpeGoyjAVqFemExqyejCymfAwwLhKGGiEyqKjz4WKmRC-KVk2aeyEjGummeh-5HXhTGazVagydLUGqUnCCy8S2q9z-4o9Fk6k8G8x6iEWE8p8K9gSEbVUW9gkwwDyJ4zoOmaDKUK9zEgGu9gW4aGcwDCz-Gy8yEaWxrxinzopGm2q19wxDG5QVEhzEqDzVosyVbzUqDx-q2i12x69z9ESVUkAwCzUmiU-q9x-588o88y78ozoAw4S2mE5e8xG2i329G2efwHxCq0U8dEdod8f85u3C2ei4UozEowzwXw9e2K2906jKh3eahEuK1lw9y0jG1Gw9utylgy5odUycxR1y4WDz8O0y8fo6S2i9JAwau09Yg3Mwho3eg0fjUcS1axi05Bo0_K6U6W9Dg0LG06Dk0ja0shw0tf806Gq9O0_wn8bz0hE0DC1fw2f82UxZO07aw2vEB0cWtw4Ow1--6EjyEiwtFio0v-w4Pw5Kw3UUowxg0idw5Ng0wS11w6lw4lg1lz00gC8y0GoC0Oo0W60id04Om0D8La3K0muaS0lS0kVw53woU0qOzUhgd82lw68xu360wE2kg1nA0UV80Ae2kE0ifrw2QU',
    __comet_req: '15',
    fb_dtsg: 'NAfuulUEPmUAsL8S-s4BGxihsk4r9ke93PHSvHRFySA9YcDIfOG1Lpw:26:1775273035',
    jazoest: '25328',
    lsd: '2p6n7zBWerO4Yy1kpCL6qK',
    __spin_r: '1037066023',
    __spin_b: 'trunk',
    __spin_t: '1775814162',
    __crn: 'comet.fbweb.CometContextualProfileRoute',
    fb_api_caller_class: 'RelayModern',
    fb_api_req_friendly_name: 'ProfileCometContextualProfileGroupPostsFeedPaginationQuery',
    server_timestamps: 'true',
    doc_id: DOC_ID,
  };

  const EXTRA_PARAMS = {
    __hsdp: 'g4IwhrM9y2W1cxq5F43GrOMoGxh13i1ONa2Iaex-gaON8i156q4gMg5pNk4-gKFwD2IOiez2jaBgwmggbiaXEzewUABkAaf33Sxh12Aqq58dekf78VO4h34FW59D93X8Ms99Pcy48ooCiIWr9l8qgNthl2Az1Axk9Gx3p8wMvhGK48BA8tegCXqEG94SVbKiehoogF7V249jy2aCyr5aAb4FNhcEghOmgN22l4AgghbecUD428x4gKHB8mB12jykoBDyraa9XhHFa9zG43oXaioM9o8jm1jccK2aqbh98C9yUWm17CCDh29mF35qU98CaK7888Ew4Sii4mmezpoK8CEMmwFAxG5UCeG6EB7whobk23ggx4xAvg9olUPc4otwC8u0gS19m4960L8W2a3cU720EEb8dFaoeo4Sfh8bKAV8dQE2dxe0GE3Cxu0iu2O9Uy0jOi11wfG6U2uwd-0Co7C1hxK1Uw8-3W4o30wpo3sw6sw5awVwhEuw9C18waS320D9o36wcu3e0C86y0aTwby2y4E1vUa81QF83uw9-320AEtwrE0Qybw9G0uW16w9O1Gw55wVwVw7jwnU6K0K80Ti0E9E691y0pe0Xo1fU3nDwae1zw',
    __hblp: '0wDigf8rCgdoK1owEgO683WwDgpwygiwl9p83IwzxOUozrQ9wn8ynyE4-0A8eEG3S9wRwKxqbxCm2K3uuEsUG4ESUjgW7Udob9EuwZUGaxDzFULAwh9k1zwdu15DwAzEszEdoy1joky8C4oaHwSAwAAzUHxmvx62i8g4iegcQ7EhUVK4EhxucAxe7qwDwTwau1Ry8qgb88QcwAxudyUkUCfCwxxq3q5oe8kwOwhEb8rwnEozUeEa9WjAK2u0AQ8DyUcE7u1kwroeU2JwuofUmwamq18wNG3a48ixa3i13wZxS6U2uwjUeU5edwUwkE98Cq7Emzo562q2G12zo5e6EKq4U8Vk4o5ehwoGxq1egaEnw9y0x9o4u0Oo20wzwh82qwhEuCwho4O18wOCw_wCz8gz8iw9Om1LwlE36giCK5o2owq82jwaqE6K3S14w8GewaC2y4EqwooaE3nwEwxwd-3e1bwk98iUsCy84-1cw9-321BwIxS1KzEbU3pwcK0iW3ibw9G1nwpoaodorwbi48do5y3-U6G2q1Mw8q2q3C3C1Hw9a0DorxG16xy3u3e0K84m0mW1PwNw4nwaaq8wHwGF1ybxa0ni2C0gG7830xG1bx-dwwwYAG4k2y13z8mwoU2jAxK0g10l85-',
    __sjsp: 'g4IwhrNQ7G2W1cxq5F43GrOMoGxh13i3kffexF2gEW7agaON0j2kYYpEh310lD5gjV2WC2sa4h4zEMAOFk85B9gJbrC8PcjkuAZi9NkzMKjqF2tBCwTogB88BDGh2pQEF162AhwMGPdAcu48IWoJ2O4J5zUdUhFp4i8c19p27jARKSGayhdy8rhoogF7V24qjy25j9yQl3l8dhomhOkl2A9hiAgggR0wgy8h462242rx4wK7A8yHG9x4gdzIE5F0mlo4p0cm0y20820KE2Pg512k',
  };

  // Variable template — memberID and feedCursor swapped per request
  const VAR_TEMPLATE = {
    feedCursor: null,
    feedLocation: 'GROUP_MEMBER_BIO_FEED',
    feedbackSource: null,
    focusCommentID: null,
    memberID: '__MEMBER_ID__',
    postsToLoad: CONFIG.postsPerPage,
    privacySelectorRenderLocation: 'COMET_STREAM',
    referringStoryRenderLocation: null,
    renderLocation: 'group_bio',
    scale: 3,
    useDefaultActor: false,
    id: CONFIG.groupId,
    '__relay_internal__pv__GHLShouldChangeAdIdFieldNamerelayprovider': true,
    '__relay_internal__pv__GHLShouldChangeSponsoredDataFieldNamerelayprovider': true,
    '__relay_internal__pv__CometFeedStory_enable_post_permalink_white_space_clickrelayprovider': false,
    '__relay_internal__pv__CometUFICommentActionLinksRewriteEnabledrelayprovider': false,
    '__relay_internal__pv__CometUFICommentAvatarStickerAnimatedImagerelayprovider': false,
    '__relay_internal__pv__IsWorkUserrelayprovider': false,
    '__relay_internal__pv__TestPilotShouldIncludeDemoAdUseCaserelayprovider': false,
    '__relay_internal__pv__FBReels_deprecate_short_form_video_context_gkrelayprovider': true,
    '__relay_internal__pv__FBReels_enable_view_dubbed_audio_type_gkrelayprovider': true,
    '__relay_internal__pv__CometImmersivePhotoCanUserDisable3DMotionrelayprovider': false,
    '__relay_internal__pv__WorkCometIsEmployeeGKProviderrelayprovider': false,
    '__relay_internal__pv__IsMergQAPollsrelayprovider': false,
    '__relay_internal__pv__FBReelsMediaFooter_comet_enable_reels_ads_gkrelayprovider': true,
    '__relay_internal__pv__CometUFIReactionsEnableShortNamerelayprovider': false,
    '__relay_internal__pv__CometUFICommentAutoTranslationTyperelayprovider': 'ORIGINAL',
    '__relay_internal__pv__CometUFIShareActionMigrationrelayprovider': true,
    '__relay_internal__pv__CometUFISingleLineUFIrelayprovider': true,
    '__relay_internal__pv__CometUFI_dedicated_comment_routable_dialog_gkrelayprovider': true,
    '__relay_internal__pv__FBReelsIFUTileContent_reelsIFUPlayOnHoverrelayprovider': true,
    '__relay_internal__pv__GroupsCometGYSJFeedItemHeightrelayprovider': 206,
    '__relay_internal__pv__ShouldEnableBakedInTextStoriesrelayprovider': false,
    '__relay_internal__pv__StoriesShouldIncludeFbNotesrelayprovider': true,
  };

  // ── UTILITIES ───────────────────────────────────────────
  const rand  = (lo, hi) => Math.random() * (hi - lo) + lo;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const ts    = () => new Date().toLocaleTimeString();
  const log  = m => console.log(`%c[${ts()}] ${m}`, 'color:#2196F3;font-weight:bold');
  const warn = m => console.warn(`%c[${ts()}] ${m}`, 'color:#FF9800;font-weight:bold');
  const err  = m => console.error(`%c[${ts()}] ${m}`, 'color:#F44336;font-weight:bold');
  const good = m => console.log(`%c[${ts()}] ${m}`, 'color:#4CAF50;font-weight:bold');

  // ── FILE SYSTEM ─────────────────────────────────────────
  let folderHandle = null;

  async function pickFolder() {
    try {
      folderHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      log(`📂 Folder: ${folderHandle.name}`);
      return true;
    } catch { err('Folder picker cancelled.'); return false; }
  }

  async function writeFile(name, content) {
    if (!folderHandle) return false;
    try {
      const fh = await folderHandle.getFileHandle(name, { create: true });
      const w = await fh.createWritable();
      await w.write(content);
      await w.close();
      return true;
    } catch (e) { warn(`Write error: ${e.message}`); return false; }
  }

  async function readFile(name) {
    if (!folderHandle) return null;
    try {
      const fh = await folderHandle.getFileHandle(name);
      return await (await fh.getFile()).text();
    } catch { return null; }
  }

  // ── DATABASE ────────────────────────────────────────────
  const DB_FILE = 'database_posts.json';
  let db = {
    meta: { created: null, lastUpdated: null, groupId: CONFIG.groupId,
            totalPosts: 0, membersProcessed: 0, totalMembers: 0, currentMemberIdx: 0 },
    memberProgress: {},
    posts: {},
  };

  async function loadDb() {
    const raw = await readFile(DB_FILE);
    if (raw) {
      try {
        const p = JSON.parse(raw);
        db = { meta: { ...db.meta, ...p.meta }, memberProgress: p.memberProgress || {}, posts: p.posts || {} };
        log(`📦 DB: ${Object.keys(db.posts).length} posts, ${Object.keys(db.memberProgress).length} members tracked`);
      } catch { warn('DB corrupted — starting fresh'); }
    } else { log('📦 No existing DB — starting fresh'); }
  }

  async function saveDb() {
    db.meta.lastUpdated = new Date().toISOString();
    if (!db.meta.created) db.meta.created = db.meta.lastUpdated;
    db.meta.totalPosts = Object.keys(db.posts).length;
    db.meta.membersProcessed = Object.values(db.memberProgress).filter(p => p.status === 'done').length;
    const json = JSON.stringify(db, null, 2);
    if (await writeFile(DB_FILE, json))
      log(`💾 Saved: ${db.meta.totalPosts} posts, ${db.meta.membersProcessed} members (${(json.length / 1048576).toFixed(2)} MB)`);
  }

  // ── LOAD MEMBERS ────────────────────────────────────────
  let members = [];

  async function loadMembers() {
    const mJson = await readFile('database_members.json');
    if (mJson) {
      try {
        const parsed = JSON.parse(mJson);
        const map = parsed.members || parsed;
        members = Object.values(map).map(m => ({
          userId: String(m.userId || m.user_id || m.id),
          name: m.name || 'Unknown',
        }));
        log(`👥 ${members.length} members from database_members.json`);
        return;
      } catch (e) { warn(`members json error: ${e.message}`); }
    }
    // CSV fallback
    const csvMap = new Map();
    for (let b = 1; b <= 200; b++) {
      const csv = await readFile(`members_batch_${String(b).padStart(4, '0')}.csv`);
      if (!csv) break;
      const lines = csv.split('\n').filter(l => l.trim());
      const hdr = lines[0].toLowerCase().split(',').map(h => h.trim());
      const ui = hdr.indexOf('user_id'), ni = hdr.indexOf('name');
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        if (cols[ui] && !csvMap.has(cols[ui]))
          csvMap.set(cols[ui], { userId: cols[ui], name: cols[ni] || 'Unknown' });
      }
    }
    members = [...csvMap.values()];
    log(`👥 ${members.length} members from CSV files`);
  }

  function parseCSVLine(line) {
    const result = []; let cur = '', inQ = false;
    for (const ch of line) {
      if (ch === '"') inQ = !inQ;
      else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    result.push(cur.trim());
    return result;
  }

  // ═══════════════════════════════════════════════════════
  //  API CALLER — builds YOUR exact request, swaps member
  // ═══════════════════════════════════════════════════════
  async function callApi(memberID, cursor) {
    const vars = JSON.parse(JSON.stringify(VAR_TEMPLATE));
    vars.memberID = memberID;
    vars.feedCursor = cursor || null;
    vars.postsToLoad = CONFIG.postsPerPage;

    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(STATIC_PARAMS)) body.set(k, v);
    for (const [k, v] of Object.entries(EXTRA_PARAMS)) body.set(k, v);
    body.set('variables', JSON.stringify(vars));

    try {
      const resp = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        credentials: 'include',
      });

      if (!resp.ok) { warn(`API HTTP ${resp.status}`); return null; }

      const text = await resp.text();
      const parts = [];
      for (const line of text.split('\n')) {
        if (line.trim().startsWith('{')) {
          try { parts.push(JSON.parse(line.trim())); } catch {}
        }
      }
      return parts.length ? parts : null;
    } catch (e) {
      err(`Fetch error: ${e.message}`);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════
  //  POST EXTRACTION from GraphQL response
  // ═══════════════════════════════════════════════════════
  function extractPosts(data, userId, userName) {
    const posts = new Map();
    const groupId = CONFIG.groupId;

    function walk(obj, depth) {
      if (!obj || typeof obj !== 'object' || depth > 25) return;

      if (obj.__typename === 'Story' ||
          (obj.post_id && (obj.message || obj.attachments)) ||
          (obj.id && obj.creation_story) ||
          (obj.comet_sections && obj.id)) {
        const post = parsePost(obj, groupId, userId, userName);
        if (post?.postId && !posts.has(post.postId)) posts.set(post.postId, post);
      }

      if (Array.isArray(obj)) { for (const i of obj) walk(i, depth + 1); }
      else { for (const v of Object.values(obj)) { if (typeof v === 'object') walk(v, depth + 1); } }
    }

    if (Array.isArray(data)) { for (const p of data) walk(p, 0); }
    else walk(data, 0);
    return [...posts.values()];
  }

  function parsePost(obj, groupId, userId, userName) {
    const post = {
      postId: null, permalink: '', authorName: userName, authorId: userId,
      timestamp: '', message: '', images: [], videos: [],
      reactions: { total: 0 }, commentCount: 0, comments: [], shares: 0,
      scrapedAt: new Date().toISOString(),
    };

    try {
      // Post ID
      post.postId = obj.post_id || obj.legacy_token || obj.id || obj.story_id || null;
      if (!post.postId) {
        const m = JSON.stringify(obj).match(/"post_id"\s*:\s*"(\d+)"/);
        if (m) post.postId = m[1];
      }
      if (!post.postId) return null;
      const num = String(post.postId).match(/(\d{10,})/);
      if (num) post.postId = num[1]; else return null;

      // Permalink
      post.permalink = obj.url || obj.permalink_url ||
        `https://www.facebook.com/groups/${groupId}/posts/${post.postId}/`;

      // Author
      const actor = obj.actors?.[0] || obj.author || obj.owner || findDeep(obj, 'actors', 6)?.[0];
      if (actor) {
        if (actor.id) post.authorId = String(actor.id);
        if (actor.name) post.authorName = actor.name;
      }

      // Timestamp
      const ct = obj.created_time || obj.creation_time ||
                 findDeepVal(obj, 'created_time', 8) || findDeepVal(obj, 'creation_time', 8);
      if (typeof ct === 'number') post.timestamp = new Date(ct * 1000).toISOString();
      else if (ct) post.timestamp = ct;

      // Message
      if (obj.message?.text) post.message = obj.message.text;
      else if (typeof obj.message === 'string') post.message = obj.message;
      if (!post.message) {
        const d = findDeep(obj, 'message', 10);
        if (d?.text) post.message = d.text;
      }

      // Images & videos
      post.images = collectMedia(obj, 'image');
      post.videos = collectMedia(obj, 'video');

      // Reactions
      const rcObj = findDeep(obj, 'reaction_count', 10);
      if (typeof rcObj === 'number') post.reactions.total = rcObj;
      else if (rcObj?.count !== undefined) post.reactions.total = rcObj.count;
      const irc = findDeepStr(obj, 'i18n_reaction_count', 10);
      if (irc && !post.reactions.total) post.reactions.total = parseInt(irc) || 0;

      // Comments
      const ccObj = findDeep(obj, 'comment_count', 8);
      if (ccObj?.total_count !== undefined) post.commentCount = ccObj.total_count;
      else if (typeof ccObj === 'number') post.commentCount = ccObj;
      post.comments = extractComments(obj);

      // Shares
      const sc = findDeep(obj, 'share_count', 8);
      if (sc?.count !== undefined) post.shares = sc.count;
      else if (typeof sc === 'number') post.shares = sc;
    } catch (e) { warn(`Parse error: ${e.message}`); }

    return post;
  }

  // ── Helpers ─────────────────────────────────────────────
  function findDeep(obj, key, maxD, d = 0) {
    if (!obj || typeof obj !== 'object' || d > maxD) return null;
    if (key in obj) return obj[key];
    for (const v of Object.values(obj)) {
      const r = findDeep(v, key, maxD, d + 1);
      if (r !== null) return r;
    }
    return null;
  }

  function findDeepVal(obj, key, maxD, d = 0) {
    if (!obj || typeof obj !== 'object' || d > maxD) return null;
    if (key in obj && (typeof obj[key] === 'number' || typeof obj[key] === 'string')) return obj[key];
    for (const v of Object.values(obj)) {
      const r = findDeepVal(v, key, maxD, d + 1);
      if (r !== null) return r;
    }
    return null;
  }

  function findDeepStr(obj, key, maxD, d = 0) {
    if (!obj || typeof obj !== 'object' || d > maxD) return null;
    if (key in obj && typeof obj[key] === 'string') return obj[key];
    for (const v of Object.values(obj)) {
      const r = findDeepStr(v, key, maxD, d + 1);
      if (r !== null) return r;
    }
    return null;
  }

  // Filter out profile picture thumbnails (small avatar sizes)
  const AVATAR_RE = /dst-jpg_s(?:74x74|80x80|100x100|120x120|160x160)/;
  function isAvatarThumb(url) { return AVATAR_RE.test(url); }

  function collectMedia(obj, type) {
    const urls = new Set();
    const skip = new Set(['toplevel_comments', 'comment_rendering_instance', 'replies', 'reply_comments',
                          'actors', 'author', 'commenter', 'owner', 'profile_picture', 'profilePicture',
                          'profile_pic_uri', 'actor']);
    function walk(o, d) {
      if (!o || typeof o !== 'object' || d > 15) return;
      if (type === 'image') {
        // Only pick up images from attachment/media contexts, not profile pics
        if (o.uri && typeof o.uri === 'string' && o.uri.includes('scontent') && !isAvatarThumb(o.uri) && (!o.width || o.width > 200))
          urls.add(o.uri);
        if (o.url && typeof o.url === 'string' && o.url.includes('scontent') && !isAvatarThumb(o.url) && o.height > 200)
          urls.add(o.url);
        if (o.photo_image?.uri && !isAvatarThumb(o.photo_image.uri)) urls.add(o.photo_image.uri);
        if (o.full_image?.uri && !isAvatarThumb(o.full_image.uri)) urls.add(o.full_image.uri);
        if (o.image?.uri && o.image.uri.includes('scontent') && !isAvatarThumb(o.image.uri)) urls.add(o.image.uri);
      }
      if (type === 'video') {
        for (const k of ['playable_url', 'playable_url_quality_hd', 'browser_native_sd_url', 'browser_native_hd_url'])
          if (o[k]) urls.add(o[k]);
      }
      if (Array.isArray(o)) { for (const i of o) walk(i, d + 1); }
      else { for (const [k, v] of Object.entries(o)) { if (!skip.has(k) && typeof v === 'object') walk(v, d + 1); } }
    }
    walk(obj, 0);
    return [...urls];
  }

  // ── Comment extraction ──────────────────────────────────
  function extractComments(obj) {
    const comments = []; const seen = new Set();
    function walk(node, d, isReply) {
      if (!node || typeof node !== 'object' || d > 20) return;
      if (node.__typename === 'Comment' || (node.id && node.body && node.author)) {
        const c = parseComment(node, isReply);
        if (c) {
          const key = c.commentId || (c.author + c.text);
          if (!seen.has(key)) {
            seen.add(key);
            comments.push(c);
            const rep = node.replies || findDeep(node, 'replies', 3);
            if (rep) walk(rep, d + 1, true);
            return;
          }
        }
      }
      if (Array.isArray(node)) { for (const i of node) walk(i, d + 1, isReply); }
      else { for (const [k, v] of Object.entries(node)) { if (typeof v === 'object') walk(v, d + 1, isReply || k === 'replies'); } }
    }
    walk(obj, 0, false);
    return comments;
  }

  function parseComment(node, isReply) {
    try {
      const author = node.author || node.commenter || {};
      const text = node.body?.text || (typeof node.body === 'string' ? node.body : '') || '';
      const imgs = [];
      if (node.attachments) {
        const atts = Array.isArray(node.attachments) ? node.attachments : [node.attachments];
        for (const a of atts) { if (a.media?.image?.uri) imgs.push(a.media.image.uri); }
      }
      if (node.sticker?.url) imgs.push(node.sticker.url);
      const rc = findDeep(node, 'reaction_count', 4);
      return {
        commentId: node.id || '', author: author.name || '', authorId: author.id ? String(author.id) : '',
        text,
        timestamp: node.created_time
          ? (typeof node.created_time === 'number' ? new Date(node.created_time * 1000).toISOString() : node.created_time)
          : '',
        images: [...new Set(imgs)], isReply: !!isReply,
        reactionCount: rc?.count || (typeof rc === 'number' ? rc : 0),
      };
    } catch { return null; }
  }

  // ── Cursor extraction ───────────────────────────────────
  function extractCursor(data) {
    let best = { cursor: null, hasNext: false };
    function walk(obj, d) {
      if (!obj || typeof obj !== 'object' || d > 15 || best.cursor) return;
      if (obj.page_info && obj.edges && Array.isArray(obj.edges)) {
        const pi = obj.page_info;
        if (pi.end_cursor && pi.has_next_page !== undefined) {
          const isComments = obj.edges.some(e => e.node?.__typename === 'Comment');
          if (!isComments) { best = { cursor: pi.end_cursor, hasNext: !!pi.has_next_page }; return; }
        }
      }
      if (Array.isArray(obj)) { for (const i of obj) walk(i, d + 1); }
      else { for (const v of Object.values(obj)) { if (typeof v === 'object') walk(v, d + 1); } }
    }
    if (Array.isArray(data)) { for (const p of data) walk(p, 0); } else walk(data, 0);
    // Regex fallback
    if (!best.cursor) {
      const json = JSON.stringify(data);
      const m = json.match(/"end_cursor"\s*:\s*"([^"]{10,})"/);
      if (m) best = { cursor: m[1], hasNext: json.includes('"has_next_page":true') };
    }
    return best;
  }

  // ═══════════════════════════════════════════════════════
  //  COMMENT ENRICHMENT — fetch all comments for each post
  //  Uses CommentListComponentsRootQuery API
  // ═══════════════════════════════════════════════════════
  const COMMENT_DOC_ID = '26244787765149283';

  const COMMENT_STATIC_PARAMS = {
    av: '100004693939090',
    __aaid: '0',
    __user: '100004693939090',
    __a: '1',
    __req: '27',
    __hs: '20553.HCSV2:comet_pkg.2.1...0',
    dpr: '1',
    __ccg: 'EXCELLENT',
    __rev: '1037078524',
    __s: '82iyny:y89szh:m6z5fc',
    __hsi: '7627199811745846611',
    __dyn: '7xeUjGU5a5Q1ryaxG4Vp41twWwIxu13wFwhUKbgS3q2ibwNw9G2Saw8i2S1DwUx60GE5O0BU2_CxS320qa321Rwwwqo462mcwfG12wOx62G5Usw9m1YwBgK7o6C1uwoE4G17yovwRwlE-U2exi4UaEW2G1jwUBwJK14xm3y3aexfxmu3W3y261eBx_wHwfC2-awLyESE7i3C22390bS16xi4UK2K2WEjxK2B08-269wkopg4-6o4e4UO2m3Gfxm2yVU-4FqwIK6E4-mEbU3cwgo-1gweW2K3abxG6E2Uwde6E',
    __comet_req: '15',
    fb_dtsg: 'NAfuulUEPmUAsL8S-s4BGxihsk4r9ke93PHSvHRFySA9YcDIfOG1Lpw:26:1775273035',
    jazoest: '25474',
    lsd: 'dAyhdfWX1Lcft0MxmZmRSd',
    __spin_r: '1037078524',
    __spin_b: 'trunk',
    __spin_t: '1775845841',
    fb_api_caller_class: 'RelayModern',
    fb_api_req_friendly_name: 'CommentListComponentsRootQuery',
    server_timestamps: 'true',
    doc_id: COMMENT_DOC_ID,
  };

  const COMMENT_EXTRA_PARAMS = {
    __csr: 'gdQ9EI6kY64Aekx4h6gx5hkpsWsYmTlEZPnOns8iOPsblbqnkzF9OHAl9qinuNkjlZpvjiFRp9aKT-IDGnnKiBi9mhfh6Z5lXjiaRFGBjykZdGiJfDBLbV6gGiyaKjaim9J5-taiAhd5nZ7SFkl4Al8Ki8FaEFep7jGih2mKK9XBGaV999VrGumuHDKrhp9rK9y6i4p8hK9K8y8F6AyEKcxfK4oNojACgkL8q9BgOayEG-uifoJ1W4HxGcxqu6oK9xi8BUhze9CABVBDyUiyp8W7oCqi9wqolyFaQ5VVWxC4UJ3EjiG78-2ulkjG7oqwNyKE-dxWu9xycggwKzU8o9EbU_xeGy8dFE9EGbzE98d8hx62um4SVaKbxyewOx-5U7W2acyFK5E4aaxqawvES485efwdm2O4UaE2bwOwyDBy8sDwjUbopxS3a0iB0aK6Ubu0CQp6xa6k7U5y0GUiho_ofU7qpUdEgwi82cwYwbSqq8y41Gwiu0gx0yw34kmcw6dw0YNwPQ2Cu02oJ09J02LE0snw2Wm00TLyx20yUaP02SEmw2mU2_wAgCazEx06Rwvo1XS0QJw4Hw1-Je17wvi1e9w1-C0ju0n60fzyU98C040U1YA08mwTwo81O86u0muoE04cF0iQ0O80Wm0lh07exa5Uc42Wi5E1aEKdy40me6C08Hwv80qNxu9w8u12w28m0MkeweK16wGyU4S0Po1CU7Zw15ZBw30U',
    __hsdp: 'gcyMUwAwMx3IuwWyF8swTi10xqegOEN0wCGaMj8WEGp13EcFEggqN91yb48mGkYJEsPO7yzMhh4yfkc9859xA4Fj4O43Arh3aCjqcBiyhrT2zi8gCGexJ8oTkrDMMSB4A49kNGewOO8mxFkWyOEJFANaIky53wzpMmAQPEkhC64haNZ6cORrh1Gyh0raZG84LFa355popoyZAXKsa7BAGmdBDBAgrEzl8gb8SyElcQ98zaNeWap3WkxD8F5cgEjC4zx8J1lF2qypiNh0IqmUNxgVblaUTAxh4aUmc42Usxx8EPwiHCK8gaAq9ox5xG3ObzemlsxGct4Q4Qq223WdBgb84GES2hemOKcwPwKxB0EyC2m1IpodQqdxCfG78pw860RrxG6UNwZg661swWe2K3yewaa1Hzi0Hwwzp8K2y9a7EqK5U427qyE5W0oq0GGw9eF84-3q0iucwqU3Aw4Pwv816U4Ku1ZxO5U5u0TE1Bo1Co2Yw66wbq1yw4zx60ni3u0mG0UU2dw2x81Z8tw9O0HUlwwwoo1u80Au09Jw8O0J81AEe8dU1R85W0Jo6a1gw3fU4u0gG0mW19wbO1Fw4fwRwYw67w',
    __hblp: '0wDigf8py42O8zo5q2B1ucw4Rgy211e1hDAw4hwwzbxihwtbBwlo2nwNx23Cu3C2Lx61swHypE8FGx25FUCEO7E6e58S12BBwzG48jAwZwu810ElwBxGexC3W18GEfqxa3qcUcobEpwQg9HK13g9UhosDGU9U-EszUa88E461Zw92ezobVohwKxatz84Wm8wMwiEqzEa8ixe1iwCwpEqCwUwEyy0PxCu1qKEG1uw4cw4DweKbwjE521RwYDAwlp8gwTwRwtE2hxNa1uwxK685q8yE8Ub85KbwIwGwiVU7S8UK4oKbwiU3uwae1gwa20JoG3u1NwIwbW0oq0Ep8rwOU8o3cK1ix63K0DEgw8y3iE884-exO2G0EE2fwkU7-dx-09Awcm10xm0Rtu687i2u4UW0z8lwwwoo14k11wzw4DwtU2kxa0mi3-ewgE7jwgU4y0FES0Ao5K0AUgwUwTwfO0G8kxC1uwTwvo6a1gw4Bws81Y82uK1pzo1jUuwioK0I8G0jy5F8pyFK64u3Oi1ewZwZU2Rw9SdwrQ',
    __sjsp: 'gcyMUwAwMx3IsMWyF8swTi10xqegOEN0wCGaMj8WEGp13EcFEggqYV1yb48mGkVSyN3foyaf2n6N4yfkc9859xA4Fj4O43A-AsOFASz9oQmlEvripiqFi9EhIPruW8qu74QUGCh1B1xCxwESbF24Qm4awUgeXekMmxpPG4BhQ48S2Jz4S8iwmC8LpHKsa7yEsDBAgrEzmN0Izj8Q9cUN993k4Q5i2BGhk8a6A74bglqgsl0HwUzE-i59iK5z0ou1lwUggg3jwsQ',
  };

  const COMMENT_VAR_TEMPLATE = {
    commentsIntentToken: 'CHRONOLOGICAL_UNFILTERED_INTENT_V1',
    feedLocation: 'POST_PERMALINK_DIALOG',
    feedbackSource: 2,
    focusCommentID: null,
    scale: 1,
    useDefaultActor: false,
    id: '__FEEDBACK_ID__',
    '__relay_internal__pv__CometUFICommentAutoTranslationTyperelayprovider': 'ORIGINAL',
    '__relay_internal__pv__CometUFICommentAvatarStickerAnimatedImagerelayprovider': false,
    '__relay_internal__pv__CometUFICommentActionLinksRewriteEnabledrelayprovider': false,
    '__relay_internal__pv__IsWorkUserrelayprovider': false,
  };

  function postIdToFeedbackId(postId) {
    return btoa('feedback:' + postId);
  }

  async function callCommentApi(postId, cursor) {
    const vars = JSON.parse(JSON.stringify(COMMENT_VAR_TEMPLATE));
    vars.id = postIdToFeedbackId(postId);
    if (cursor) vars.after = cursor;

    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(COMMENT_STATIC_PARAMS)) body.set(k, v);
    // Use same fb_dtsg as main scraper (may have been updated)
    body.set('fb_dtsg', STATIC_PARAMS.fb_dtsg);
    for (const [k, v] of Object.entries(COMMENT_EXTRA_PARAMS)) body.set(k, v);
    body.set('variables', JSON.stringify(vars));

    try {
      const resp = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        credentials: 'include',
      });

      if (!resp.ok) { warn(`Comment API HTTP ${resp.status}`); return null; }

      const text = await resp.text();
      const parts = [];
      for (const line of text.split('\n')) {
        if (line.trim().startsWith('{')) {
          try { parts.push(JSON.parse(line.trim())); } catch {}
        }
      }
      return parts.length ? parts : null;
    } catch (e) {
      err(`Comment fetch error: ${e.message}`);
      return null;
    }
  }

  // Extract comments + replies from CommentListComponentsRootQuery response
  function extractAllComments(data) {
    const comments = [];
    const seen = new Set();

    function parseOneComment(node, isReply) {
      if (!node || typeof node !== 'object') return null;
      try {
        const author = node.author || node.commenter || {};
        const bodyText = node.body?.text || (typeof node.body === 'string' ? node.body : '') || '';
        const imgs = [];
        // Attachments (images in comments)
        const atts = node.attachments || node.comment_attachments;
        if (atts) {
          const list = Array.isArray(atts) ? atts : (atts.nodes || [atts]);
          for (const a of list) {
            const media = a.media || a.style_infos?.[0]?.media || a;
            if (media.image?.uri) imgs.push(media.image.uri);
            else if (media.photo?.image?.uri) imgs.push(media.photo.image.uri);
          }
        }
        if (node.attached_photo?.image?.uri) imgs.push(node.attached_photo.image.uri);
        if (node.sticker?.url) imgs.push(node.sticker.url);

        // Reaction count — try multiple paths
        let rc = 0;
        if (node.feedback?.reactors?.count) rc = node.feedback.reactors.count;
        else if (node.feedback?.reaction_count?.count) rc = node.feedback.reaction_count.count;
        else if (node.comment_action_links) {
          const ral = findDeep(node.comment_action_links, 'reactors', 3);
          if (ral?.count) rc = ral.count;
        }
        if (!rc) {
          const rcDeep = findDeep(node, 'reactors', 3);
          if (rcDeep?.count) rc = rcDeep.count;
        }
        if (!rc) {
          const rcDeep2 = findDeep(node, 'reaction_count', 4);
          if (rcDeep2?.count) rc = rcDeep2.count;
          else if (typeof rcDeep2 === 'number') rc = rcDeep2;
        }

        const ct = node.created_time;
        const timestamp = typeof ct === 'number' ? new Date(ct * 1000).toISOString() : (ct || '');

        return {
          commentId: node.id || '',
          author: author.name || '',
          authorId: author.id ? String(author.id) : '',
          text: bodyText,
          timestamp,
          images: [...new Set(imgs)],
          isReply: !!isReply,
          reactionCount: typeof rc === 'number' ? rc : 0,
        };
      } catch { return null; }
    }

    // Find the top-level comment connection
    function findTopLevelComments(obj, depth) {
      if (!obj || typeof obj !== 'object' || depth > 12) return null;

      // Look for display_comments or toplevel_comments with Comment edges
      for (const key of ['display_comments', 'toplevel_comments', 'comments']) {
        if (obj[key]?.edges && Array.isArray(obj[key].edges)) {
          const hasComments = obj[key].edges.some(e => e.node?.__typename === 'Comment');
          if (hasComments) return obj[key];
        }
      }

      if (Array.isArray(obj)) {
        for (const item of obj) {
          const r = findTopLevelComments(item, depth + 1);
          if (r) return r;
        }
      } else {
        for (const v of Object.values(obj)) {
          if (typeof v === 'object') {
            const r = findTopLevelComments(v, depth + 1);
            if (r) return r;
          }
        }
      }
      return null;
    }

    // Collect all top-level comment IDs first
    const topIds = new Set();

    const dataParts = Array.isArray(data) ? data : [data];
    for (const part of dataParts) {
      const conn = findTopLevelComments(part, 0);
      if (!conn) continue;

      for (const edge of conn.edges) {
        const node = edge.node;
        if (!node) continue;
        const c = parseOneComment(node, false);
        if (c && c.commentId && !seen.has(c.commentId)) {
          seen.add(c.commentId);
          topIds.add(c.commentId);
          comments.push(c);
        }
      }
    }

    // Now walk the ENTIRE response for all Comment nodes — anything not
    // already seen is a reply (nested replies, expanded threads, etc.)
    function walkForComments(obj, depth) {
      if (!obj || typeof obj !== 'object' || depth > 20) return;
      if (obj.__typename === 'Comment' && obj.id && !seen.has(obj.id)) {
        const c = parseOneComment(obj, true);
        if (c && c.commentId) {
          seen.add(c.commentId);
          comments.push(c);
        }
      }
      if (Array.isArray(obj)) {
        for (const item of obj) walkForComments(item, depth + 1);
      } else {
        for (const v of Object.values(obj)) {
          if (typeof v === 'object') walkForComments(v, depth + 1);
        }
      }
    }

    for (const part of dataParts) walkForComments(part, 0);

    return comments;
  }

  // Extract comment pagination cursor
  function extractCommentCursor(data) {
    let best = { cursor: null, hasNext: false };
    function walk(obj, d) {
      if (!obj || typeof obj !== 'object' || d > 15 || best.cursor) return;
      if (obj.page_info && obj.edges && Array.isArray(obj.edges)) {
        const isComments = obj.edges.some(e => e.node?.__typename === 'Comment');
        if (isComments && obj.page_info.end_cursor) {
          best = { cursor: obj.page_info.end_cursor, hasNext: !!obj.page_info.has_next_page };
          return;
        }
      }
      if (Array.isArray(obj)) { for (const i of obj) walk(i, d + 1); }
      else { for (const v of Object.values(obj)) { if (typeof v === 'object') walk(v, d + 1); } }
    }
    if (Array.isArray(data)) { for (const p of data) walk(p, 0); } else walk(data, 0);
    return best;
  }

  // Extract reaction count and total comment count from the response
  function extractPostMeta(data) {
    let reactionTotal = 0, commentTotal = 0, shareCount = 0;
    function walk(obj, d) {
      if (!obj || typeof obj !== 'object' || d > 15) return;
      // Reaction count (look for reactors.count or reaction_count.count)
      if (obj.reactors?.count && obj.reactors.count > reactionTotal) reactionTotal = obj.reactors.count;
      if (obj.reaction_count?.count && obj.reaction_count.count > reactionTotal) reactionTotal = obj.reaction_count.count;
      // Comment count
      if (obj.total_comment_count !== undefined && obj.total_comment_count > commentTotal) commentTotal = obj.total_comment_count;
      if (obj.comment_count?.total_count > commentTotal) commentTotal = obj.comment_count.total_count;
      // Share count
      if (obj.share_count?.count > shareCount) shareCount = obj.share_count.count;
      if (obj.reshares?.count > shareCount) shareCount = obj.reshares.count;

      if (Array.isArray(obj)) { for (const i of obj) walk(i, d + 1); }
      else { for (const v of Object.values(obj)) { if (typeof v === 'object') walk(v, d + 1); } }
    }
    if (Array.isArray(data)) { for (const p of data) walk(p, 0); } else walk(data, 0);
    return { reactionTotal, commentTotal, shareCount };
  }

  // Enrich a single post with all its comments
  async function enrichPostComments(postId) {
    const allComments = [];
    let cursor = null;
    let pageNum = 0;
    let retries = 0;
    let meta = { reactionTotal: 0, commentTotal: 0, shareCount: 0 };

    while (true) {
      pageNum++;
      const results = await callCommentApi(postId, cursor);

      if (!results) {
        retries++;
        if (retries >= CONFIG.maxRetries) {
          warn(`  Comment fetch failed after ${retries} retries for post ${postId}`);
          return null;
        }
        await sleep(rand(3000, 8000));
        continue;
      }
      retries = 0;

      // Check for errors / rate limits
      let rateLimited = false;
      for (const part of results) {
        if (part.errors) {
          const msg = part.errors[0]?.message || '';
          if (/rate.?limit/i.test(msg)) { rateLimited = true; break; }
          warn(`  Comment API error: ${JSON.stringify(msg).substring(0, 200)}`);
        }
      }
      if (rateLimited) {
        return { comments: allComments, meta, rateLimited: true };
      }

      // Extract meta on first page
      if (pageNum === 1) {
        for (const part of results) {
          const m = extractPostMeta(part);
          if (m.reactionTotal > meta.reactionTotal) meta.reactionTotal = m.reactionTotal;
          if (m.commentTotal > meta.commentTotal) meta.commentTotal = m.commentTotal;
          if (m.shareCount > meta.shareCount) meta.shareCount = m.shareCount;
        }
      }

      // Extract comments
      let pageComments = [];
      for (const part of results) {
        pageComments.push(...extractAllComments(part));
      }

      // Deduplicate with existing batch
      const existingIds = new Set(allComments.map(c => c.commentId));
      let newCount = 0;
      for (const c of pageComments) {
        if (c.commentId && !existingIds.has(c.commentId)) {
          allComments.push(c);
          existingIds.add(c.commentId);
          newCount++;
        }
      }

      // Check for more pages
      let next = { cursor: null, hasNext: false };
      for (const part of results) {
        const n = extractCommentCursor(part);
        if (n.cursor) { next = n; break; }
      }

      if (!next.hasNext || !next.cursor || newCount === 0) break;
      cursor = next.cursor;
      await sleep(rand(...CONFIG.requestDelay));
    }

    return { comments: allComments, meta };
  }

  // ── Comment enrichment loop ─────────────────────────────
  let enrichRunning = false;

  async function enrichAllComments() {
    enrichRunning = true;
    const postIds = Object.keys(db.posts);
    const total = postIds.length;
    let enriched = 0, skipped = 0, errors = 0;

    // Skip posts already enriched
    const needsEnrichment = postIds.filter(pid => !db.posts[pid]._commentsEnriched);

    log('');
    log(`💬 Comment enrichment: ${needsEnrichment.length} posts to process (${total - needsEnrichment.length} already done)`);
    log('');

    for (let i = 0; i < needsEnrichment.length; i++) {
      if (!enrichRunning) break;
      const pid = needsEnrichment[i];
      const post = db.posts[pid];
      const pct = (((i + 1) / needsEnrichment.length) * 100).toFixed(1);

      log(`[${i + 1}/${needsEnrichment.length}] (${pct}%) ${post.authorName}: ${(post.message || '(no text)').substring(0, 50)}`);

      try {
        const result = await enrichPostComments(pid);

        if (result) {
          post.comments = result.comments;
          post.commentCount = result.comments.length;
          if (result.meta.reactionTotal > 0) post.reactions = { total: result.meta.reactionTotal };
          if (result.meta.shareCount > 0) post.shares = result.meta.shareCount;
          post._commentsEnriched = true;
          enriched++;

          const cmts = result.comments.filter(c => !c.isReply).length;
          const replies = result.comments.filter(c => c.isReply).length;
          if (result.comments.length > 0) {
            good(`  💬 ${cmts} comments + ${replies} replies | 👍 ${result.meta.reactionTotal} reactions | ↗ ${result.meta.shareCount} shares`);
          } else {
            log(`  ⬜ 0 comments`);
          }
        } else {
          errors++;
          warn(`  ❌ Failed to fetch comments`);
        }
      } catch (e) {
        errors++;
        err(`  Error: ${e.message}`);
      }

      // Save periodically
      if ((enriched + errors) % 10 === 0) await saveDb();

      // Rest between requests
      if (enrichRunning) await sleep(rand(...CONFIG.requestDelay));

      // Rest break every 50 posts
      if (enrichRunning && (i + 1) % 50 === 0) {
        const restMs = Math.floor(rand(30000, 90000));
        await saveDb();
        warn(`😴 Comment enrichment break: ${Math.round(restMs/1000)}s`);
        await sleep(restMs);
      }
    }

    enrichRunning = false;
    await saveDb();
    good(`\n✅ Comment enrichment done! ${enriched} enriched, ${skipped} skipped, ${errors} errors`);
    good(`   Total comments in DB: ${Object.values(db.posts).reduce((s, p) => s + (p.comments?.length || 0), 0)}`);
  }

  // Test comment enrichment for a single post
  async function testComments(postId) {
    if (!postId) {
      // Find the first post with any existing comments or just use first post
      postId = Object.keys(db.posts)[0];
      for (const [pid, p] of Object.entries(db.posts)) {
        if (p.comments?.length > 0 || p.commentCount > 0) { postId = pid; break; }
      }
    }
    log(`🧪 Testing comment fetch for post ${postId}...`);
    log(`   Feedback ID: ${postIdToFeedbackId(postId)}`);
    const result = await enrichPostComments(postId);
    if (result) {
      good(`✅ Got ${result.comments.length} comments!`);
      good(`   Reactions: ${result.meta.reactionTotal} | Shares: ${result.meta.shareCount}`);
      for (const c of result.comments.slice(0, 5)) {
        const tag = c.isReply ? 'REPLY' : 'TOP';
        console.log(`  [${tag}] ${c.author}: ${c.text.substring(0, 80)} (👍${c.reactionCount})`);
      }
      if (result.comments.length > 5) log(`  ... and ${result.comments.length - 5} more`);
    } else {
      err('❌ Failed. Token might be expired — posts.updateToken("new_value")');
    }
    return result;
  }

  async function rawComments(postId) {
    if (!postId) postId = Object.keys(db.posts)[0];
    log(`📋 Raw comment dump for post ${postId}...`);
    log(`   Feedback ID: ${postIdToFeedbackId(postId)}`);
    const results = await callCommentApi(postId, null);
    if (!results) { err('No response.'); return; }
    console.log('Raw response (' + results.length + ' parts):');
    for (let i = 0; i < results.length; i++) {
      console.log(`── Part ${i} ──`);
      console.log(results[i]);
    }
    return results;
  }

  // ═══════════════════════════════════════════════════════
  //  MAIN SCRAPE LOOP
  // ═══════════════════════════════════════════════════════
  let running = false, skipCurrent = false, currentIdx = 0;
  let stats = { posts: 0, members: 0, errors: 0 };
  let autoSaveTimer = null;

  function startAutoSave() {
    stopAutoSave();
    autoSaveTimer = setInterval(async () => {
      if (running) {
        log('⏱ Autosave...');
        await saveDb();
      }
    }, CONFIG.autoSaveMs);
    log(`⏱ Autosave every ${CONFIG.autoSaveMs / 1000}s`);
  }

  function stopAutoSave() {
    if (autoSaveTimer) { clearInterval(autoSaveTimer); autoSaveTimer = null; }
  }

  async function scrapeMember(member) {
    const { userId, name } = member;
    if (db.memberProgress[userId]?.status === 'done') return;

    log(`── 👤 ${name} (${userId}) ──`);

    let cursor = db.memberProgress[userId]?.lastCursor || null;
    let postsFound = db.memberProgress[userId]?.postsFound || 0;
    let emptyPages = 0, pageNum = 0, retries = 0;

    while (running && !skipCurrent) {
      pageNum++;
      const results = await callApi(userId, cursor);

      if (!results) {
        retries++;
        if (retries >= CONFIG.maxRetries) {
          warn(`  ${CONFIG.maxRetries} failures — skipping`);
          db.memberProgress[userId] = { status: 'error', postsFound, lastCursor: cursor, error: 'API failures' };
          stats.errors++;
          return;
        }
        await sleep(rand(3000, 8000));
        continue;
      }
      retries = 0;

      // Check for error responses
      for (const part of results) {
        if (part.errors) {
          warn(`  API error: ${JSON.stringify(part.errors[0]?.message || part.errors).substring(0, 200)}`);
        }
      }

      let newCount = 0;
      const newPostIds = [];
      for (const part of results) {
        for (const p of extractPosts(part, userId, name)) {
          if (p.postId && !db.posts[p.postId]) {
            db.posts[p.postId] = p;
            newPostIds.push(p.postId);
            newCount++; postsFound++; stats.posts++;
          }
        }
      }

      // Inline comment enrichment for each new post
      for (const pid of newPostIds) {
        if (!running) break;
        try {
          await sleep(rand(...CONFIG.requestDelay));
          const result = await enrichPostComments(pid);
          if (result && result.rateLimited) {
            const backoff = rand(60000, 120000);
            warn(`  ⚠️ Rate limited! Pausing ${Math.round(backoff/1000)}s...`);
            await sleep(backoff);
            // Retry this post once after backoff
            const retry = await enrichPostComments(pid);
            if (retry && !retry.rateLimited) {
              db.posts[pid].comments = retry.comments;
              db.posts[pid].reactions = { total: retry.meta.reactionTotal };
              db.posts[pid].commentCount = retry.meta.commentTotal || retry.comments.length;
              db.posts[pid].shares = retry.meta.shareCount;
              db.posts[pid]._commentsEnriched = true;
            } else {
              warn(`  Still rate limited — skipping comments for ${pid}`);
            }
          } else if (result) {
            db.posts[pid].comments = result.comments;
            db.posts[pid].reactions = { total: result.meta.reactionTotal };
            db.posts[pid].commentCount = result.meta.commentTotal || result.comments.length;
            db.posts[pid].shares = result.meta.shareCount;
            db.posts[pid]._commentsEnriched = true;
          }
        } catch (e) {
          warn(`  Comment enrich failed for ${pid}: ${e.message}`);
        }
      }

      let next = { cursor: null, hasNext: false };
      for (const part of results) { next = extractCursor(part); if (next.cursor) break; }

      if (newCount > 0) emptyPages = 0; else emptyPages++;

      const enrichedCount = newPostIds.filter(pid => db.posts[pid]?._commentsEnriched).length;
      const totalComments = newPostIds.reduce((sum, pid) => sum + (db.posts[pid]?.comments?.length || 0), 0);
      const enrichInfo = newCount > 0 ? ` [💬${totalComments} comments]` : '';
      log(`  Page ${pageNum}: +${newCount} posts (${postsFound} total)${enrichInfo} ${next.hasNext ? '→ more' : '✓ end'}`);

      db.memberProgress[userId] = { status: 'in-progress', postsFound, lastCursor: next.cursor || cursor };

      if (!next.hasNext || !next.cursor || emptyPages >= CONFIG.maxEmptyPages) break;

      cursor = next.cursor;
      await sleep(rand(...CONFIG.requestDelay));
    }

    if (!skipCurrent) {
      db.memberProgress[userId] = { status: 'done', postsFound, lastCursor: null };
      stats.members++;
      if (postsFound > 0) good(`  ✅ ${name}: ${postsFound} posts`);
      else log(`  ⬜ ${name}: 0 posts`);
    }
    skipCurrent = false;
  }

  async function mainLoop() {
    running = true;
    stats = { posts: 0, members: 0, errors: 0 };
    db.meta.totalMembers = members.length;
    startAutoSave();

    // Build ordered list: first retry failed/incomplete members, then continue forward
    const retryList = [];
    const forwardStart = db.meta.currentMemberIdx || 0;
    for (let i = 0; i < forwardStart && i < members.length; i++) {
      const uid = members[i]?.userId;
      const status = db.memberProgress[uid]?.status;
      if (uid && status !== 'done') retryList.push(i);
    }

    let startIdx = forwardStart;
    while (startIdx < members.length && db.memberProgress[members[startIdx]?.userId]?.status === 'done') startIdx++;

    let membersSinceRest = 0;
    let nextRestAt = Math.floor(rand(...CONFIG.restEvery));

    const done = Object.values(db.memberProgress).filter(p => p.status === 'done').length;
    log('');
    if (retryList.length > 0) {
      warn(`🔄 Retrying ${retryList.length} failed/incomplete members first...`);
    }
    log(`🚀 Then continuing from #${startIdx + 1} of ${members.length}`);
    log(`   Done: ${done} | Posts: ${Object.keys(db.posts).length}`);
    log(`   Delay: ${CONFIG.requestDelay[0]}-${CONFIG.requestDelay[1]}ms`);
    log('');

    // Helper to process a single member by index
    async function processMember(i, label) {
      if (!running) return;
      currentIdx = i;

      const pct = ((Object.values(db.memberProgress).filter(p => p.status === 'done').length / members.length) * 100).toFixed(1);
      log(`${label}[${i + 1}/${members.length}] (${pct}%) ${members[i].name}`);

      try { await scrapeMember(members[i]); membersSinceRest++; }
      catch (e) {
        err(`Error: ${e.message}`);
        db.memberProgress[members[i].userId] = { status: 'error', postsFound: 0, lastCursor: null, error: e.message };
        stats.errors++;
        membersSinceRest++;
      }

      if (stats.members % CONFIG.saveEvery === 0) await saveDb();

      // Human-like rest break every N members
      if (running && membersSinceRest >= nextRestAt) {
        membersSinceRest = 0;
        nextRestAt = Math.floor(rand(...CONFIG.restEvery));
        const restMs = Math.floor(rand(...CONFIG.restDuration));
        await saveDb();
        warn(`😴 Rest break: ${Math.round(restMs/1000)}s pause (next break in ~${nextRestAt} members)`);
        await sleep(restMs);
      }

      if (running) await sleep(rand(...CONFIG.memberDelay));
    }

    // Phase 1: Retry failed members
    for (const idx of retryList) {
      if (!running) break;
      // Reset their failed status so scrapeMember will actually process them
      const uid = members[idx]?.userId;
      if (uid && db.memberProgress[uid]?.status !== 'done') {
        delete db.memberProgress[uid];
      }
      await processMember(idx, '🔄 ');
    }

    if (retryList.length > 0 && running) {
      good(`✅ Retry phase done. Continuing forward from #${startIdx + 1}...`);
    }

    // Phase 2: Continue forward
    for (let i = startIdx; i < members.length; i++) {
      if (!running) break;
      db.meta.currentMemberIdx = i;
      await processMember(i, '');
    }

    running = false;
    stopAutoSave();
    await saveDb();
    good(`\n✅ DONE! +${stats.posts} posts from ${stats.members} members (${stats.errors} errors)`);
    good(`   Total: ${Object.keys(db.posts).length} posts in DB`);
  }

  // ═══════════════════════════════════════════════════════
  //  TEST & DEBUG
  // ═══════════════════════════════════════════════════════
  async function testMember(userId) {
    log(`🧪 Testing userId=${userId}...`);
    const results = await callApi(userId, null);
    if (!results) { err('API returned nothing. Token may be expired — re-copy fb_dtsg.'); return null; }

    for (const part of results) {
      if (part.errors) {
        err(`API error: ${JSON.stringify(part.errors[0]?.message || part.errors).substring(0, 300)}`);
        return null;
      }
    }

    const posts = [];
    for (const part of results) posts.push(...extractPosts(part, userId, 'Test'));

    if (posts.length > 0) {
      good(`✅ Got ${posts.length} posts!`);
      for (const p of posts) {
        const msg = (p.message || '(no text)').substring(0, 80);
        console.log(`  📝 ${p.postId}: "${msg}" | ${p.images.length} imgs | ${p.comments.length} comments | ${p.reactions.total} reactions`);
      }
    } else {
      warn('0 posts extracted. Member may have no posts, or response format changed.');
      warn('Run posts.raw("userId") to inspect raw response.');
    }

    const cursor = extractCursor(results);
    log(`Pagination: hasNext=${cursor.hasNext}, cursor=${cursor.cursor ? 'yes' : 'none'}`);
    return posts;
  }

  async function rawDump(userId) {
    log(`📋 Raw dump for userId=${userId}...`);
    const results = await callApi(userId, null);
    if (!results) { err('No response.'); return; }
    console.log('Raw response (' + results.length + ' parts):');
    for (let i = 0; i < results.length; i++) {
      console.log(`── Part ${i} ──`);
      console.log(results[i]);
    }
    return results;
  }

  // ═══════════════════════════════════════════════════════
  //  INIT
  // ═══════════════════════════════════════════════════════
  console.clear();
  log('═══════════════════════════════════════════════════');
  log('  FB Group Post Scraper v5 — Hardcoded API Replay');
  log('  No scrolling • No navigation • No interception');
  log('═══════════════════════════════════════════════════');
  log('');

  if (!await pickFolder()) return;
  await loadDb();
  await loadMembers();
  if (!members.length) { err('No members! Put database_members.json or CSVs in the folder.'); return; }

  // ── Public API ──────────────────────────────────────────
  window.posts = {
    start()         { if (running) { log('Already running!'); return; } mainLoop(); },
    async stop()    { running = false; stopAutoSave(); await saveDb(); good('⏸ Stopped & saved.'); },
    status() {
      const done = Object.values(db.memberProgress).filter(p => p.status === 'done').length;
      const errs = Object.values(db.memberProgress).filter(p => p.status === 'error').length;
      console.table({
        'DB Posts':   Object.keys(db.posts).length,
        'Session':    `+${stats.posts} posts, ${stats.members} members`,
        'Progress':   `${done}/${members.length} (${((done / members.length) * 100).toFixed(1)}%)`,
        'Errors':     errs,
        'Current':    `#${currentIdx + 1} ${members[currentIdx]?.name || '-'}`,
        'Running':    running,
      });
    },
    async save()    { await saveDb(); },
    async export()  {
      const all = Object.values(db.posts);
      await writeFile(`posts_export_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(all, null, 2));
      good(`Exported ${all.length} posts`);
    },
    faster()        { CONFIG.requestDelay = [500, 1200]; CONFIG.memberDelay = [1000, 2000]; log('⚡ FAST'); },
    slower()        { CONFIG.requestDelay = [3000, 8000]; CONFIG.memberDelay = [5000, 10000]; log('🐌 SLOW'); },
    skip()          { skipCurrent = true; log('⏭ Skipping...'); },
    jumpTo(n)       { db.meta.currentMemberIdx = Math.max(0, n - 1); log(`Will start at #${n}`); },
    errors() {
      const errs = Object.entries(db.memberProgress).filter(([_, p]) => p.status === 'error');
      if (!errs.length) { log('No errors!'); return; }
      for (const [uid, p] of errs) { const m = members.find(x => x.userId === uid); console.log(`  ${m?.name || uid}: ${p.error}`); }
    },
    async test(uid) { return testMember(uid || '61572762736171'); },
    async raw(uid)  { return rawDump(uid || '61572762736171'); },
    debug() {
      log(`doc_id: ${DOC_ID}`);
      log(`group: ${CONFIG.groupId}`);
      log(`members: ${members.length}`);
      log(`fb_dtsg: ${STATIC_PARAMS.fb_dtsg.substring(0, 30)}...`);
      log(`delay: ${CONFIG.requestDelay}`);
    },
    updateToken(newDtsg) {
      STATIC_PARAMS.fb_dtsg = newDtsg;
      COMMENT_STATIC_PARAMS.fb_dtsg = newDtsg;
      good('✅ Token updated! Test with posts.test()');
    },
    // Comment enrichment commands
    enrich()                 { if (enrichRunning) { log('Already running!'); return; } enrichAllComments(); },
    async stopEnrich()       { enrichRunning = false; await saveDb(); good('⏸ Comment enrichment stopped.'); },
    async testComments(pid)  { return testComments(pid); },
    async rawComments(pid)   { return rawComments(pid); },
  };

  log('Commands:');
  log('  posts.start()         — start scraping all members');
  log('  posts.stop()          — pause & save');
  log('  posts.status()        — show progress');
  log('  posts.test()          — test with sample member');
  log('  posts.test("userID")  — test specific member');
  log('  posts.raw("userID")   — dump raw API response');
  log('  posts.faster()        — speed up');
  log('  posts.slower()        — slow down');
  log('  posts.updateToken("x")— refresh expired token');
  log('');
  log('Comment enrichment:');
  log('  posts.enrich()            — fetch all comments for all posts');
  log('  posts.stopEnrich()        — pause comment enrichment');
  log('  posts.testComments()      — test comment fetch on first post');
  log('  posts.testComments("pid") — test comment fetch on specific post');
  log('  posts.rawComments("pid")  — raw API response for comments');
  log('');

  // Auto-test with the member from the captured request
  good('🧪 Testing API with member 61572762736171...');
  const testResult = await testMember('61572762736171');

  if (testResult && testResult.length > 0) {
    good('');
    good('✅ API works! Starting in 5 seconds... (posts.stop() to cancel)');
    await sleep(5000);
    if (!running) mainLoop();
  } else if (testResult && testResult.length === 0) {
    warn('Test member has 0 posts (normal).');
    warn('Try posts.test("ID_OF_ACTIVE_MEMBER") or just posts.start()');
    log('');
    log('Auto-starting in 5 seconds...');
    await sleep(5000);
    if (!running) mainLoop();
  } else {
    err('');
    err('❌ API call failed. Possible causes:');
    err('  1. fb_dtsg expired — re-copy from Network tab');
    err('  2. Not on facebook.com — navigate there first');
    err('  3. Not logged in');
    err('');
    err('Fix: posts.updateToken("new_fb_dtsg_value")');
    err('Then: posts.test() to verify, posts.start() to begin');
  }

})();
