// ═══════════════════════════════════════════════════════════════
//  Facebook Group Post Scraper v4 — Pure API Replay
// ═══════════════════════════════════════════════════════════════
//
//  HOW TO USE:
//  1. Go to any ACTIVE member's posts page in the group:
//     https://www.facebook.com/groups/GROUP_ID/user/USER_ID/
//     (pick someone you KNOW has posted — not a lurker)
//  2. Open DevTools → Console (F12)
//  3. Paste this entire script → Enter
//  4. Pick your scrape folder (with members CSV or database_members.json)
//  5. SCROLL DOWN on the page to trigger post loading
//  6. Script captures the API query, then replays it for every
//     member automatically — NO page navigation, stays on same page
//
//  COMMANDS:
//    posts.start()    — begin (auto-starts after capture)
//    posts.stop()     — pause & save
//    posts.status()   — show progress
//    posts.save()     — force save
//    posts.export()   — export JSON
//    posts.faster()   — speed up
//    posts.slower()   — slow down
//    posts.skip()     — skip current member
//    posts.jumpTo(n)  — jump to member #n on next start
//    posts.errors()   — show failed members
//    posts.test(uid)  — test single member by userId
//
// ═══════════════════════════════════════════════════════════════

(async () => {
  'use strict';

  // ── CONFIG ──────────────────────────────────────────────
  const CONFIG = {
    requestDelay:    [1500, 3500],   // ms between API calls
    memberDelay:     [2000, 4000],   // ms between members
    maxRetries:      3,              // retries per failed request
    maxEmptyPages:   3,              // consecutive empty pages → done
    saveEvery:       5,              // save DB every N members
  };

  // ── UTIL ────────────────────────────────────────────────
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
    } catch (e) {
      err('Folder selection cancelled or not supported.');
      return false;
    }
  }

  async function writeFile(name, content) {
    if (!folderHandle) return false;
    try {
      const fh = await folderHandle.getFileHandle(name, { create: true });
      const w = await fh.createWritable();
      await w.write(content);
      await w.close();
      return true;
    } catch (e) { warn(`Write error ${name}: ${e.message}`); return false; }
  }

  async function readFile(name) {
    if (!folderHandle) return null;
    try {
      const fh = await folderHandle.getFileHandle(name);
      const f = await fh.getFile();
      return await f.text();
    } catch { return null; }
  }

  // ── DATABASE ────────────────────────────────────────────
  const DB_FILE = 'database_posts.json';
  let db = {
    meta: { created: null, lastUpdated: null, groupId: null, groupSlug: null,
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
        log(`📦 Loaded DB: ${Object.keys(db.posts).length} posts, ${Object.keys(db.memberProgress).length} members tracked`);
      } catch { warn('DB corrupted — starting fresh'); }
    } else {
      log('📦 No database found — creating new');
    }
  }

  async function saveDb() {
    db.meta.lastUpdated = new Date().toISOString();
    if (!db.meta.created) db.meta.created = db.meta.lastUpdated;
    db.meta.totalPosts = Object.keys(db.posts).length;
    db.meta.membersProcessed = Object.values(db.memberProgress).filter(p => p.status === 'done').length;
    const json = JSON.stringify(db, null, 2);
    const ok = await writeFile(DB_FILE, json);
    if (ok) log(`💾 Saved: ${db.meta.totalPosts} posts from ${db.meta.membersProcessed} members (${(json.length / 1048576).toFixed(2)} MB)`);
  }

  // ── LOAD MEMBERS ────────────────────────────────────────
  let members = [];

  async function loadMembers() {
    // Try database_members.json first
    const mJson = await readFile('database_members.json');
    if (mJson) {
      try {
        const parsed = JSON.parse(mJson);
        const map = parsed.members || parsed;
        members = Object.values(map).map(m => ({ userId: String(m.userId || m.user_id || m.id), name: m.name || 'Unknown' }));
        log(`👥 Loaded ${members.length} members from database_members.json`);
        return;
      } catch (e) { warn(`members json parse error: ${e.message}`); }
    }
    // Fallback: CSVs
    const csvMap = new Map();
    for (let b = 1; b <= 200; b++) {
      const csv = await readFile(`members_batch_${String(b).padStart(4, '0')}.csv`);
      if (!csv) break;
      const lines = csv.split('\n').filter(l => l.trim());
      const hdr = lines[0].toLowerCase().split(',').map(h => h.trim());
      const ui = hdr.indexOf('user_id'), ni = hdr.indexOf('name');
      for (let i = 1; i < lines.length; i++) {
        // Handle commas in quoted fields
        const cols = parseCSVLine(lines[i]);
        if (cols[ui] && !csvMap.has(cols[ui])) csvMap.set(cols[ui], { userId: cols[ui], name: cols[ni] || 'Unknown' });
      }
    }
    members = [...csvMap.values()];
    log(`👥 Loaded ${members.length} members from CSV files`);
  }

  function parseCSVLine(line) {
    const result = [];
    let current = '', inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
      else { current += ch; }
    }
    result.push(current.trim());
    return result;
  }

  // ── GROUP DETECTION ─────────────────────────────────────
  function detectGroup() {
    const url = window.location.href;
    const m = url.match(/\/groups\/([^/?#]+)/);
    return m ? m[1] : null;
  }

  // ═══════════════════════════════════════════════════════════
  //  API INTERCEPTION — capture the GraphQL call FB uses to
  //  load posts on a member's page, then we replay it for
  //  every other member by swapping the user ID
  // ═══════════════════════════════════════════════════════════
  let capturedQuery = null;
  let capturedUserId = null;   // the user ID from the page where we captured
  const _origFetch = window.fetch;

  function startCapture() {
    log('🔍 Intercepting network calls — scroll down to trigger post loading...');

    window.fetch = async function (...args) {
      const [url, opts] = args;
      const urlStr = typeof url === 'string' ? url : url?.url || '';

      if (urlStr.includes('/api/graphql') && opts?.body) {
        const body = typeof opts.body === 'string' ? opts.body : '';
        if (body) {
          try {
            const params = new URLSearchParams(body);
            const docId = params.get('doc_id');
            const friendlyName = params.get('fb_api_req_friendly_name') || '';
            const varsStr = params.get('variables');

            if (docId && varsStr) {
              const nameL = friendlyName.toLowerCase();
              const varsL = varsStr.toLowerCase();

              // Log ALL GraphQL calls so we can debug
              log(`📡 ${friendlyName} (doc_id=${docId})`);

              // Detect post/feed/timeline queries
              const isPostQuery =
                nameL.includes('timeline') ||
                nameL.includes('profilecontent') ||
                nameL.includes('usercontent') ||
                nameL.includes('groupmemberposts') ||
                nameL.includes('feed') ||
                (nameL.includes('group') && nameL.includes('post')) ||
                (varsL.includes('"collection_token"') && varsL.includes('timeline')) ||
                (varsL.includes('timeline_feed_units') || varsL.includes('group_feed'));

              if (isPostQuery && !capturedQuery) {
                capturedQuery = {
                  url: urlStr,
                  docId,
                  friendlyName,
                  variables: JSON.parse(varsStr),
                  allParams: Object.fromEntries(params),
                };

                // Try to extract the user ID from this captured query
                capturedUserId = findUserIdInVars(capturedQuery.variables);

                good(`🎯 CAPTURED! doc_id=${docId} (${friendlyName})`);
                good(`   User ID in query: ${capturedUserId || 'not found'}`);
                log(`   Variables: ${varsStr.substring(0, 300)}...`);
              }
            }
          } catch (e) { /* ignore parse errors */ }
        }
      }

      return _origFetch.apply(this, args);
    };
  }

  function stopCapture() {
    window.fetch = _origFetch;
  }

  function findUserIdInVars(obj, depth = 0) {
    if (!obj || typeof obj !== 'object' || depth > 10) return null;
    // Look for known user ID field names
    for (const key of ['userID', 'user_id', 'userId', 'profileID', 'profile_id', 'ownerID', 'owner_id', 'id']) {
      if (key in obj && /^\d{5,}$/.test(String(obj[key]))) return String(obj[key]);
    }
    for (const val of Object.values(obj)) {
      const found = findUserIdInVars(val, depth + 1);
      if (found) return found;
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════════
  //  API CALLER — replay the captured query for any member
  // ═══════════════════════════════════════════════════════════
  async function callPostApi(userId, cursor) {
    // Deep clone the captured variables
    const vars = JSON.parse(JSON.stringify(capturedQuery.variables));

    // Swap user ID (replace all occurrences of the captured user's ID)
    if (capturedUserId) {
      replaceValueDeep(vars, capturedUserId, userId);
    }
    // Also try known field names directly
    setFieldsDeep(vars, ['userID', 'user_id', 'userId', 'profileID', 'profile_id', 'ownerID', 'owner_id'], userId);

    // Set or clear cursor
    if (cursor) {
      setFieldsDeep(vars, ['after', 'cursor', 'end_cursor', 'afterCursor'], cursor);
    } else {
      clearFieldsDeep(vars, ['after', 'cursor', 'end_cursor', 'afterCursor']);
    }

    // Build request
    const params = new URLSearchParams();
    for (const [key, val] of Object.entries(capturedQuery.allParams)) {
      params.set(key, key === 'variables' ? JSON.stringify(vars) : val);
    }

    try {
      const resp = await _origFetch(capturedQuery.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
        credentials: 'include',
      });

      if (!resp.ok) { warn(`API ${resp.status}`); return null; }

      const text = await resp.text();
      // FB often returns multiple JSON objects separated by newlines
      const parts = [];
      for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('{')) {
          try { parts.push(JSON.parse(trimmed)); } catch {}
        }
      }
      return parts.length > 0 ? parts : null;
    } catch (e) {
      err(`API call failed: ${e.message}`);
      return null;
    }
  }

  // ── Deep object helpers ─────────────────────────────────
  function replaceValueDeep(obj, oldVal, newVal, depth = 0) {
    if (!obj || typeof obj !== 'object' || depth > 15) return;
    for (const key of Object.keys(obj)) {
      if (String(obj[key]) === String(oldVal)) obj[key] = newVal;
      else if (typeof obj[key] === 'object') replaceValueDeep(obj[key], oldVal, newVal, depth + 1);
    }
  }

  function setFieldsDeep(obj, fields, value, depth = 0) {
    if (!obj || typeof obj !== 'object' || depth > 15) return;
    for (const key of Object.keys(obj)) {
      if (fields.includes(key) && /^\d{5,}$/.test(String(obj[key]))) obj[key] = value;
      else if (typeof obj[key] === 'object') setFieldsDeep(obj[key], fields, value, depth + 1);
    }
  }

  function clearFieldsDeep(obj, fields, depth = 0) {
    if (!obj || typeof obj !== 'object' || depth > 15) return;
    for (const key of Object.keys(obj)) {
      if (fields.includes(key)) obj[key] = null;
      else if (typeof obj[key] === 'object') clearFieldsDeep(obj[key], fields, depth + 1);
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  POST EXTRACTION — parse posts from the GraphQL response
  // ═══════════════════════════════════════════════════════════
  function extractPostsFromResponse(data, groupSlug, userId, userName) {
    const posts = new Map();

    function walk(obj, depth) {
      if (!obj || typeof obj !== 'object' || depth > 25) return;

      // Detect post/story nodes by their structure
      if (obj.__typename === 'Story' || obj.__typename === 'GroupPost' ||
          (obj.post_id && (obj.message || obj.attachments)) ||
          (obj.id && obj.creation_story) ||
          (obj.comet_sections && obj.id)) {
        const post = parseSinglePost(obj, groupSlug, userId, userName);
        if (post && post.postId && !posts.has(post.postId)) {
          posts.set(post.postId, post);
        }
      }

      if (Array.isArray(obj)) {
        for (const item of obj) walk(item, depth + 1);
      } else {
        for (const val of Object.values(obj)) {
          if (typeof val === 'object') walk(val, depth + 1);
        }
      }
    }

    if (Array.isArray(data)) { for (const p of data) walk(p, 0); }
    else walk(data, 0);
    return [...posts.values()];
  }

  function parseSinglePost(obj, groupSlug, userId, userName) {
    const post = {
      postId: null, permalink: '', authorName: userName || '', authorId: userId || '',
      timestamp: '', message: '', images: [], videos: [], links: [],
      reactions: { total: 0, types: {} },
      commentCount: 0, comments: [], shares: 0,
      scrapedAt: new Date().toISOString(),
    };

    try {
      // ── Post ID ──
      post.postId = obj.post_id || obj.legacy_token || obj.id || obj.story_id || null;
      if (!post.postId) {
        const m = JSON.stringify(obj).match(/"post_id"\s*:\s*"(\d+)"/);
        if (m) post.postId = m[1];
      }
      if (!post.postId) return null;
      // Clean — extract numeric part
      const numId = String(post.postId).match(/(\d{10,})/);
      if (numId) post.postId = numId[1];
      else return null;

      // ── Permalink ──
      post.permalink = obj.url || obj.permalink_url || '';
      if (!post.permalink && groupSlug) {
        post.permalink = `https://www.facebook.com/groups/${groupSlug}/posts/${post.postId}/`;
      }

      // ── Author ──
      const actors = obj.actors || [];
      const actor = actors[0] || obj.author || obj.owner || findDeep(obj, 'actors', 6)?.[0];
      if (actor) {
        if (actor.id) post.authorId = String(actor.id);
        if (actor.name) post.authorName = actor.name;
      }

      // ── Timestamp ──
      const ct = obj.created_time || obj.creation_time || findDeepNum(obj, 'created_time', 8) || findDeepNum(obj, 'creation_time', 8);
      if (ct) post.timestamp = typeof ct === 'number' ? new Date(ct * 1000).toISOString() : ct;

      // ── Message ──
      if (obj.message?.text) post.message = obj.message.text;
      else if (typeof obj.message === 'string') post.message = obj.message;
      if (!post.message) {
        const d = findDeep(obj, 'message', 10);
        if (d?.text) post.message = d.text;
        else if (typeof d === 'string' && d.length > 3) post.message = d;
      }

      // ── Images ──
      post.images = collectMediaUrls(obj, 'image');
      post.videos = collectMediaUrls(obj, 'video');

      // ── Reactions ──
      const rc = findDeepNum(obj, 'reaction_count', 10);
      if (typeof rc === 'number') post.reactions.total = rc;
      else if (rc?.count !== undefined) post.reactions.total = rc.count;
      const irc = findDeepStr(obj, 'i18n_reaction_count', 10);
      if (irc && !post.reactions.total) post.reactions.total = parseInt(irc) || 0;

      // ── Comments ──
      const ccObj = findDeep(obj, 'comment_count', 8);
      if (ccObj?.total_count !== undefined) post.commentCount = ccObj.total_count;
      else if (typeof ccObj === 'number') post.commentCount = ccObj;
      post.comments = extractComments(obj);

      // ── Shares ──
      const sc = findDeep(obj, 'share_count', 8);
      if (sc?.count !== undefined) post.shares = sc.count;
      else if (typeof sc === 'number') post.shares = sc;

    } catch (e) { warn(`Parse error: ${e.message}`); }

    return post;
  }

  // ── Deep find helpers ───────────────────────────────────
  function findDeep(obj, key, maxD, d = 0) {
    if (!obj || typeof obj !== 'object' || d > maxD) return null;
    if (key in obj) return obj[key];
    for (const v of Object.values(obj)) {
      const r = findDeep(v, key, maxD, d + 1);
      if (r !== null) return r;
    }
    return null;
  }

  function findDeepNum(obj, key, maxD, d = 0) {
    if (!obj || typeof obj !== 'object' || d > maxD) return null;
    if (key in obj && (typeof obj[key] === 'number' || (typeof obj[key] === 'object' && obj[key]?.count !== undefined)))
      return obj[key];
    for (const v of Object.values(obj)) {
      const r = findDeepNum(v, key, maxD, d + 1);
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

  // ── Media collector ─────────────────────────────────────
  function collectMediaUrls(obj, type) {
    const urls = new Set();
    const skipKeys = new Set(['toplevel_comments', 'comment_rendering_instance', 'replies', 'reply_comments']);

    function walk(o, d) {
      if (!o || typeof o !== 'object' || d > 15) return;

      if (type === 'image') {
        // FB image patterns
        if (o.uri && typeof o.uri === 'string' && o.uri.includes('scontent') && (!o.width || o.width > 100))
          urls.add(o.uri);
        if (o.url && typeof o.url === 'string' && o.url.includes('scontent') && o.height > 100)
          urls.add(o.url);
        if (o.photo_image?.uri) urls.add(o.photo_image.uri);
        if (o.full_image?.uri) urls.add(o.full_image.uri);
        if (o.image?.uri && o.image.uri.includes('scontent')) urls.add(o.image.uri);
      }
      if (type === 'video') {
        for (const k of ['playable_url', 'playable_url_quality_hd', 'browser_native_sd_url', 'browser_native_hd_url']) {
          if (o[k]) urls.add(o[k]);
        }
      }

      if (Array.isArray(o)) { for (const i of o) walk(i, d + 1); }
      else {
        for (const [k, v] of Object.entries(o)) {
          if (!skipKeys.has(k) && typeof v === 'object') walk(v, d + 1);
        }
      }
    }
    walk(obj, 0);
    return [...urls];
  }

  // ── Comment extraction ──────────────────────────────────
  function extractComments(obj) {
    const comments = [];
    const seen = new Set();

    function walk(node, d, isReply) {
      if (!node || typeof node !== 'object' || d > 20) return;

      if (node.__typename === 'Comment' || (node.id && node.body && node.author) || (node.comment_id && node.body)) {
        const c = parseComment(node, isReply);
        if (c) {
          const key = c.commentId || (c.author + c.text);
          if (!seen.has(key)) {
            seen.add(key);
            comments.push(c);
            // Check for nested replies
            const rep = node.replies || findDeep(node, 'replies', 3);
            if (rep) walk(rep, d + 1, true);
            return;
          }
        }
      }

      if (Array.isArray(node)) { for (const i of node) walk(i, d + 1, isReply); }
      else {
        for (const [k, v] of Object.entries(node)) {
          if (typeof v === 'object') walk(v, d + 1, isReply || k === 'replies' || k === 'reply_comments');
        }
      }
    }
    walk(obj, 0, false);
    return comments;
  }

  function parseComment(node, isReply) {
    try {
      const author = node.author || node.commenter || {};
      const text = node.body?.text || (typeof node.body === 'string' ? node.body : '') || node.text?.text || '';
      const imgs = [];

      // Comment attachments
      if (node.attachments) {
        const atts = Array.isArray(node.attachments) ? node.attachments : [node.attachments];
        for (const a of atts) {
          if (a.media?.image?.uri) imgs.push(a.media.image.uri);
          if (a.media?.photo_image?.uri) imgs.push(a.media.photo_image.uri);
        }
      }
      if (node.sticker?.url) imgs.push(node.sticker.url);

      const rc = findDeep(node, 'reaction_count', 4);

      return {
        commentId: node.id || node.comment_id || '',
        author: author.name || '',
        authorId: author.id ? String(author.id) : '',
        text,
        timestamp: node.created_time ? (typeof node.created_time === 'number' ? new Date(node.created_time * 1000).toISOString() : node.created_time) : '',
        images: [...new Set(imgs)],
        isReply: !!isReply,
        reactionCount: rc?.count || (typeof rc === 'number' ? rc : 0),
      };
    } catch { return null; }
  }

  // ── Cursor extraction ───────────────────────────────────
  function extractCursor(data) {
    let best = { cursor: null, hasNext: false };

    function walk(obj, d, parentKey) {
      if (!obj || typeof obj !== 'object' || d > 15 || best.cursor) return;

      // Look for page_info alongside edges (post edges, not comment edges)
      if (obj.page_info && obj.edges && Array.isArray(obj.edges)) {
        const pi = obj.page_info;
        if (pi.end_cursor && pi.has_next_page !== undefined) {
          // Prefer post-level pagination (not comments)
          const looksLikeComments = obj.edges.some(e => e.node?.__typename === 'Comment');
          if (!looksLikeComments) {
            best = { cursor: pi.end_cursor, hasNext: !!pi.has_next_page };
            return;
          }
        }
      }

      if (Array.isArray(obj)) { for (const i of obj) walk(i, d + 1, parentKey); }
      else { for (const [k, v] of Object.entries(obj)) { if (typeof v === 'object') walk(v, d + 1, k); } }
    }

    if (Array.isArray(data)) { for (const p of data) walk(p, 0, null); }
    else walk(data, 0, null);

    // Regex fallback
    if (!best.cursor) {
      const json = JSON.stringify(data);
      const m = json.match(/"end_cursor"\s*:\s*"([^"]{10,})"/);
      if (m) best = { cursor: m[1], hasNext: json.includes('"has_next_page":true') };
    }

    return best;
  }

  // ═══════════════════════════════════════════════════════════
  //  MAIN SCRAPE LOGIC — stays on same page, pure API calls
  // ═══════════════════════════════════════════════════════════
  let running = false;
  let skipCurrent = false;
  let currentIdx = 0;
  let stats = { posts: 0, members: 0, errors: 0 };

  async function scrapeMember(member) {
    const { userId, name } = member;

    // Already done?
    if (db.memberProgress[userId]?.status === 'done') return;

    log(`── 👤 ${name} (${userId}) ──`);

    let cursor = db.memberProgress[userId]?.lastCursor || null;
    let postsFound = db.memberProgress[userId]?.postsFound || 0;
    let emptyPages = 0;
    let pageNum = 0;
    let retries = 0;

    while (running && !skipCurrent) {
      pageNum++;

      const results = await callPostApi(userId, cursor);

      if (!results) {
        retries++;
        if (retries >= CONFIG.maxRetries) {
          warn(`  ${CONFIG.maxRetries} failures — skipping ${name}`);
          db.memberProgress[userId] = { status: 'error', postsFound, lastCursor: cursor, error: 'API failures' };
          stats.errors++;
          return;
        }
        await sleep(rand(3000, 8000));
        continue;
      }
      retries = 0;

      // Extract posts
      let newCount = 0;
      for (const part of results) {
        const extracted = extractPostsFromResponse(part, db.meta.groupSlug, userId, name);
        for (const p of extracted) {
          if (p.postId && !db.posts[p.postId]) {
            db.posts[p.postId] = p;
            newCount++;
            postsFound++;
            stats.posts++;
          }
        }
      }

      // Get next page cursor
      let next = { cursor: null, hasNext: false };
      for (const part of results) {
        next = extractCursor(part);
        if (next.cursor) break;
      }

      if (newCount > 0) emptyPages = 0;
      else emptyPages++;

      const cursorInfo = next.hasNext ? '→ more' : '✓ end';
      log(`  Page ${pageNum}: +${newCount} posts (${postsFound} total) ${cursorInfo}`);

      // Update progress
      db.memberProgress[userId] = { status: 'in-progress', postsFound, lastCursor: next.cursor || cursor };

      // Check if done
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

    // Find starting point
    let startIdx = db.meta.currentMemberIdx || 0;
    while (startIdx < members.length && db.memberProgress[members[startIdx]?.userId]?.status === 'done') startIdx++;

    const doneCount = Object.values(db.memberProgress).filter(p => p.status === 'done').length;
    log('');
    log(`🚀 Starting from member #${startIdx + 1} of ${members.length}`);
    log(`   Already done: ${doneCount} | Posts in DB: ${Object.keys(db.posts).length}`);
    log(`   Delay: ${CONFIG.requestDelay[0]}-${CONFIG.requestDelay[1]}ms per page`);
    log('');

    for (let i = startIdx; i < members.length; i++) {
      if (!running) break;
      currentIdx = i;
      db.meta.currentMemberIdx = i;

      const pct = ((i / members.length) * 100).toFixed(1);
      log(`[${i + 1}/${members.length}] (${pct}%) ${members[i].name}`);

      try {
        await scrapeMember(members[i]);
      } catch (e) {
        err(`Error on ${members[i].name}: ${e.message}`);
        db.memberProgress[members[i].userId] = { status: 'error', postsFound: 0, lastCursor: null, error: e.message };
        stats.errors++;
      }

      // Save periodically
      if (stats.members % CONFIG.saveEvery === 0 || stats.posts % 10 === 0) await saveDb();

      if (i < members.length - 1 && running) await sleep(rand(...CONFIG.memberDelay));
    }

    running = false;
    await saveDb();
    good(`\n✅ DONE! Session: ${stats.posts} posts from ${stats.members} members (${stats.errors} errors)`);
    good(`   Total in DB: ${Object.keys(db.posts).length} posts`);
  }

  // ═══════════════════════════════════════════════════════════
  //  TEST MODE — scrape a single member to verify it works
  // ═══════════════════════════════════════════════════════════
  async function testSingle(userId) {
    if (!capturedQuery) { err('No captured query yet — scroll down first!'); return; }
    log(`🧪 Testing API call for userId=${userId}...`);

    const results = await callPostApi(userId, null);
    if (!results) { err('API returned nothing.'); return; }

    log(`Response has ${results.length} JSON parts`);

    // Show raw structure overview
    for (let i = 0; i < results.length; i++) {
      const keys = Object.keys(results[i]);
      log(`  Part ${i}: keys=[${keys.join(', ')}]`);
    }

    // Try extraction
    const posts = [];
    for (const part of results) {
      posts.push(...extractPostsFromResponse(part, db.meta.groupSlug, userId, 'Test'));
    }

    if (posts.length > 0) {
      good(`✅ Extracted ${posts.length} posts!`);
      for (const p of posts) {
        console.log(`  📝 ${p.postId}: "${(p.message || '').substring(0, 80)}..." | ${p.images.length} imgs | ${p.comments.length} comments`);
      }
    } else {
      warn('0 posts extracted. Dumping raw response for inspection:');
      console.log(JSON.stringify(results).substring(0, 5000));
    }

    // Show cursor
    for (const part of results) {
      const c = extractCursor(part);
      if (c.cursor) { log(`Cursor: hasNext=${c.hasNext}`); break; }
    }

    return posts;
  }

  // ═══════════════════════════════════════════════════════════
  //  INIT
  // ═══════════════════════════════════════════════════════════
  console.clear();
  log('═══════════════════════════════════════════════════');
  log('  Facebook Group Post Scraper v4 — Pure API Replay');
  log('  No page navigation • No modals • No DOM scraping');
  log('═══════════════════════════════════════════════════');
  log('');

  // 1. Folder
  if (!await pickFolder()) return;

  // 2. Load data
  await loadDb();
  await loadMembers();
  if (!members.length) { err('No members found! Put database_members.json or CSVs in the folder.'); return; }

  // 3. Detect group
  const groupSlug = detectGroup();
  if (!groupSlug) { err('Navigate to a group page first! (/groups/GROUP_ID/...)'); return; }
  db.meta.groupSlug = groupSlug;
  const gidMatch = groupSlug.match(/^\d+$/) ? groupSlug : null;
  if (gidMatch) db.meta.groupId = gidMatch;
  good(`✅ Group: ${groupSlug}`);

  // 4. Start capture
  startCapture();
  log('');
  log('╔═══════════════════════════════════════════════╗');
  log('║  SCROLL DOWN on this page to trigger the      ║');
  log('║  post-loading API call. Pick a member with     ║');
  log('║  ACTUAL POSTS for this first step.             ║');
  log('║                                                ║');
  log('║  Once captured, the script does all the rest   ║');
  log('║  via API replay — no more scrolling needed.    ║');
  log('╚═══════════════════════════════════════════════╝');
  log('');

  // Auto-scroll attempts
  for (let i = 0; i < 5; i++) {
    await sleep(1500);
    window.scrollBy(0, rand(400, 900));
    if (capturedQuery) break;
  }

  // Wait for capture
  let waited = 0;
  while (!capturedQuery && waited < 120) {
    await sleep(1000);
    waited++;
    if (waited % 15 === 0) {
      log(`⏳ Still waiting for post API call... (${waited}s)`);
      log('   Make sure this member has posts and scroll down!');
      window.scrollBy(0, rand(300, 700));
    }
  }

  stopCapture();

  if (!capturedQuery) {
    err('❌ Could not capture post API call after 2 minutes.');
    err('   Try a different member who has VISIBLE POSTS, then re-run the script.');
    return;
  }

  good('');
  good(`🎯 Query captured: doc_id=${capturedQuery.docId}`);
  good(`   Name: ${capturedQuery.friendlyName}`);
  good(`   Template user: ${capturedUserId}`);
  log('');

  // ── Public API ──────────────────────────────────────────
  window.posts = {
    start()        { if (running) { log('Already running!'); return; } mainLoop(); },
    async stop()   { running = false; await saveDb(); good('⏸ Stopped & saved.'); },
    status() {
      const done = Object.values(db.memberProgress).filter(p => p.status === 'done').length;
      const errs = Object.values(db.memberProgress).filter(p => p.status === 'error').length;
      console.table({
        'DB Posts':     Object.keys(db.posts).length,
        'Session':      `+${stats.posts} posts, ${stats.members} members`,
        'Progress':     `${done}/${members.length} members (${((done/members.length)*100).toFixed(1)}%)`,
        'Errors':       errs,
        'Current':      `#${currentIdx + 1} ${members[currentIdx]?.name || '-'}`,
        'Running':      running,
      });
    },
    async save()    { await saveDb(); },
    async export()  {
      const all = Object.values(db.posts);
      await writeFile(`posts_export_${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(all, null, 2));
      good(`Exported ${all.length} posts`);
    },
    faster()        { CONFIG.requestDelay = [500, 1200]; CONFIG.memberDelay = [1000, 2000]; log('⚡ FAST mode'); },
    slower()        { CONFIG.requestDelay = [3000, 8000]; CONFIG.memberDelay = [5000, 10000]; log('🐌 SLOW mode'); },
    skip()          { skipCurrent = true; log('⏭ Skipping...'); },
    jumpTo(n)       { db.meta.currentMemberIdx = Math.max(0, n - 1); log(`Will start at #${n} next`); },
    errors() {
      const errs = Object.entries(db.memberProgress).filter(([_, p]) => p.status === 'error');
      if (!errs.length) { log('No errors!'); return; }
      for (const [uid, p] of errs) {
        const m = members.find(m => m.userId === uid);
        console.log(`  ${m?.name || uid}: ${p.error}`);
      }
    },
    async test(uid) { return testSingle(uid || capturedUserId); },
    debug() {
      log('Captured query:');
      console.log(capturedQuery);
      log(`Template userId: ${capturedUserId}`);
      log(`Members: ${members.length}`);
    },
  };

  log('Commands:');
  log('  posts.start()    — begin scraping all members');
  log('  posts.stop()     — pause & save');
  log('  posts.status()   — show progress');
  log('  posts.test()     — test current member first');
  log('  posts.test("ID") — test specific user ID');
  log('  posts.debug()    — show captured query details');
  log('  posts.faster()   — speed up (riskier)');
  log('  posts.slower()   — slow down (safer)');
  log('');

  // Auto-test, then auto-start
  good('🧪 Running test on captured member first...');
  const testPosts = await testSingle(capturedUserId);
  if (testPosts && testPosts.length > 0) {
    good('');
    good('✅ Test passed! Auto-starting full scrape in 5 seconds...');
    good('   Type posts.stop() to cancel');
    await sleep(5000);
    if (!running) mainLoop();
  } else {
    warn('');
    warn('⚠️ Test extracted 0 posts. The response format may be different.');
    warn('   Check posts.debug() and the raw output above.');
    warn('   You can still try posts.start() — it might work with other members.');
  }

})();
