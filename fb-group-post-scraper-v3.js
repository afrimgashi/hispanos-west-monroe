// ═══════════════════════════════════════════════════════════════
//  Facebook Group Post Scraper — API Interception Edition (v3)
// ═══════════════════════════════════════════════════════════════
//
//  HOW TO USE:
//  1. Open ANY member's posts page in the group:
//     https://www.facebook.com/groups/GROUP_ID/user/USER_ID/
//  2. Press F12 → Console tab
//  3. Copy-paste this ENTIRE script and press Enter
//  4. A folder picker opens — select your scrape folder
//     (should contain members CSV files + database_members.json)
//  5. Scroll down once to trigger FB's post-loading API call
//  6. Script captures the GraphQL query and auto-paginates
//     through ALL members and ALL their posts
//
//  CONSOLE COMMANDS:
//    posts.stop()         — pause & save
//    posts.start()        — resume from where you left off
//    posts.status()       — show progress
//    posts.save()         — force save now
//    posts.faster()       — speed up (risky)
//    posts.slower()       — slow down (safer)
//    posts.skip()         — skip current member
//    posts.retry()        — retry current member
//    posts.export()       — export all posts as JSON
//    posts.jumpTo(n)      — jump to member #n
//
// ═══════════════════════════════════════════════════════════════

(async () => {
  'use strict';

  // ── CONFIG ──────────────────────────────────────────────
  const CONFIG = {
    requestDelay:   [1200, 3000],   // ms between API calls
    memberDelay:    [3000, 6000],   // ms between navigating to next member
    pageLoadDelay:  4000,           // ms to wait after page navigation
    maxRetries:     3,              // retries per failed request
    maxEmptyPages:  5,              // consecutive empty pages before moving on
    saveEvery:      10,             // save database every N posts
    commentPages:   20,             // max comment pagination rounds
    maxWaitCapture: 90,             // seconds to wait for initial API capture
  };

  // ── UTILITIES ───────────────────────────────────────────
  const rand   = (lo, hi) => Math.random() * (hi - lo) + lo;
  const sleep  = ms => new Promise(r => setTimeout(r, ms));
  const now    = () => new Date().toLocaleTimeString();

  function log(msg)  { console.log(`%c[${now()}] ${msg}`, 'color:#2196F3;font-weight:bold'); }
  function warn(msg) { console.warn(`%c[${now()}] ${msg}`, 'color:#FF9800;font-weight:bold'); }
  function err(msg)  { console.error(`%c[${now()}] ${msg}`, 'color:#F44336;font-weight:bold'); }
  function good(msg) { console.log(`%c[${now()}] ${msg}`, 'color:#4CAF50;font-weight:bold'); }

  // ── FILE SYSTEM ─────────────────────────────────────────
  let folderHandle = null;

  async function pickFolder() {
    if (!window.showDirectoryPicker) {
      err('File System Access API not supported. Use Chrome or Edge.');
      return false;
    }
    try {
      folderHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      log(`Folder: ${folderHandle.name}`);
      return true;
    } catch (e) {
      if (e.name === 'AbortError') warn('Folder selection cancelled.');
      else err(`Folder picker error: ${e.message}`);
      return false;
    }
  }

  async function writeFile(filename, content) {
    if (!folderHandle) return false;
    try {
      const fh = await folderHandle.getFileHandle(filename, { create: true });
      const w = await fh.createWritable();
      await w.write(content);
      await w.close();
      return true;
    } catch (e) {
      warn(`Write failed ${filename}: ${e.message}`);
      return false;
    }
  }

  async function readFile(filename) {
    if (!folderHandle) return null;
    try {
      const fh = await folderHandle.getFileHandle(filename);
      const file = await fh.getFile();
      return await file.text();
    } catch { return null; }
  }

  // ── DATABASE ────────────────────────────────────────────
  const DB_FILE = 'database_posts.json';
  let db = {
    meta: {
      created: null,
      lastUpdated: null,
      groupId: null,
      groupSlug: null,
      totalPosts: 0,
      totalComments: 0,
      totalImages: 0,
      membersProcessed: 0,
      totalMembers: 0,
      currentMemberIdx: 0,
    },
    memberProgress: {},  // userId -> { status, postsFound, lastCursor }
    posts: {},           // postId -> full post object
  };

  async function loadDb() {
    const raw = await readFile(DB_FILE);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        db = { ...db, ...parsed };
        db.meta = { ...db.meta, ...parsed.meta };
        db.memberProgress = parsed.memberProgress || {};
        db.posts = parsed.posts || {};
        log(`📦 Loaded: ${Object.keys(db.posts).length} posts, ${Object.keys(db.memberProgress).length} members tracked`);
      } catch (e) {
        warn(`Database corrupted, starting fresh: ${e.message}`);
      }
    } else {
      log('📦 No post database found — creating new one');
    }
  }

  async function saveDb() {
    db.meta.lastUpdated = new Date().toISOString();
    if (!db.meta.created) db.meta.created = db.meta.lastUpdated;
    db.meta.totalPosts = Object.keys(db.posts).length;
    // count totals
    let tc = 0, ti = 0;
    for (const p of Object.values(db.posts)) {
      tc += (p.comments || []).length;
      ti += (p.images || []).length;
      for (const c of (p.comments || [])) ti += (c.images || []).length;
    }
    db.meta.totalComments = tc;
    db.meta.totalImages = ti;
    const json = JSON.stringify(db, null, 2);
    const ok = await writeFile(DB_FILE, json);
    if (ok) {
      const mb = (json.length / 1048576).toFixed(2);
      log(`💾 Saved: ${db.meta.totalPosts} posts, ${tc} comments, ${ti} images (${mb} MB)`);
    }
  }

  // ── LOAD MEMBERS FROM CSV ───────────────────────────────
  let members = [];

  async function loadMembers() {
    // Try database_members.json first
    const membersJson = await readFile('database_members.json');
    if (membersJson) {
      try {
        const parsed = JSON.parse(membersJson);
        const memberMap = parsed.members || {};
        members = Object.values(memberMap).map(m => ({
          userId: m.userId,
          name: m.name,
        }));
        log(`👥 Loaded ${members.length} members from database_members.json`);
        return;
      } catch (e) {
        warn(`Failed to parse database_members.json: ${e.message}`);
      }
    }

    // Fallback: load CSV files
    log('📄 Loading members from CSV files...');
    const csvMembers = new Map();
    for (let batch = 1; batch <= 100; batch++) {
      const filename = `members_batch_${String(batch).padStart(4, '0')}.csv`;
      const csv = await readFile(filename);
      if (!csv) break;
      const lines = csv.split('\n').filter(l => l.trim());
      const header = lines[0].split(',').map(h => h.trim().toLowerCase());
      const uidIdx = header.indexOf('user_id');
      const nameIdx = header.indexOf('name');
      if (uidIdx === -1) continue;
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());
        if (cols[uidIdx] && !csvMembers.has(cols[uidIdx])) {
          csvMembers.set(cols[uidIdx], {
            userId: cols[uidIdx],
            name: cols[nameIdx] || 'Unknown',
          });
        }
      }
      log(`  Loaded ${filename}`);
    }
    members = [...csvMembers.values()];
    log(`👥 Loaded ${members.length} members from CSV files`);
  }

  // ── GROUP DETECTION ─────────────────────────────────────
  function detectGroup() {
    const url = window.location.href;
    const m1 = url.match(/\/groups\/(\d+)/);
    if (m1) return { groupId: m1[1], groupSlug: m1[1] };
    const m2 = url.match(/\/groups\/([^/?#]+)/);
    if (m2) return { groupId: null, groupSlug: m2[1] };
    return { groupId: null, groupSlug: null };
  }

  // ── NETWORK INTERCEPTION ────────────────────────────────
  let capturedPostQuery = null;
  let capturedCommentQuery = null;
  let originalFetch = null;

  function tryCapture(urlStr, body) {
    if (!urlStr.includes('graphql')) return;
    if (!body || typeof body !== 'string') return;

    const params = new URLSearchParams(body);
    const docId = params.get('doc_id');
    const fbReqName = params.get('fb_api_req_friendly_name') || '';
    const variables = params.get('variables');
    if (!docId || !variables) return;

    const varsLower = variables.toLowerCase();
    const nameL = fbReqName.toLowerCase();

    // Detect post feed queries
    const isPostQuery =
      nameL.includes('profilecontent') ||
      nameL.includes('timeline') ||
      nameL.includes('usercontent') ||
      nameL.includes('groupmemberposts') ||
      nameL.includes('profiletimeline') ||
      nameL.includes('comet') && (nameL.includes('feed') || nameL.includes('post')) ||
      (varsLower.includes('group') && varsLower.includes('user') && !nameL.includes('member')) ||
      (varsLower.includes('timeline') && varsLower.includes('group'));

    if (isPostQuery && !capturedPostQuery) {
      try {
        capturedPostQuery = {
          url: urlStr,
          docId,
          variables: JSON.parse(variables),
          allParams: Object.fromEntries(params),
          friendlyName: fbReqName,
        };
        good(`🎯 CAPTURED post query! doc_id=${docId} (${fbReqName})`);
      } catch (e) {
        warn(`Failed to parse post query: ${e.message}`);
      }
    }

    // Detect comment queries
    const isCommentQuery =
      nameL.includes('comment') ||
      nameL.includes('feedback') ||
      (varsLower.includes('comment') && varsLower.includes('feedback'));

    if (isCommentQuery && !capturedCommentQuery) {
      try {
        capturedCommentQuery = {
          url: urlStr,
          docId,
          variables: JSON.parse(variables),
          allParams: Object.fromEntries(params),
          friendlyName: fbReqName,
        };
        good(`🎯 CAPTURED comment query! doc_id=${docId} (${fbReqName})`);
      } catch (e) {}
    }

    if (docId) {
      log(`📡 GraphQL: doc_id=${docId} name=${fbReqName}`);
    }
  }

  function startInterception() {
    log('🔍 Intercepting API calls...');
    originalFetch = window.fetch;
    window.fetch = async function(...args) {
      const [url, opts] = args;
      const urlStr = typeof url === 'string' ? url : url?.url || '';
      const body = opts?.body || '';
      tryCapture(urlStr, body);
      return originalFetch.apply(this, args);
    };
  }

  function stopInterception() {
    if (originalFetch) {
      window.fetch = originalFetch;
      originalFetch = null;
    }
  }

  // ── API CALLER ──────────────────────────────────────────
  async function callApi(query, variableOverrides = {}) {
    try {
      const variables = JSON.parse(JSON.stringify(query.variables));

      // Apply overrides
      for (const [key, val] of Object.entries(variableOverrides)) {
        // Handle nested keys like "userID" at root or deep
        setDeep(variables, key, val);
      }

      const params = new URLSearchParams();
      for (const [key, val] of Object.entries(query.allParams)) {
        if (key === 'variables') {
          params.set(key, JSON.stringify(variables));
        } else {
          params.set(key, val);
        }
      }

      const response = await fetch(query.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
        credentials: 'include',
      });

      if (!response.ok) {
        warn(`API ${response.status}`);
        return null;
      }

      const text = await response.text();
      const jsonParts = text.split('\n').filter(l => l.trim().startsWith('{'));
      const results = [];
      for (const part of jsonParts) {
        try { results.push(JSON.parse(part)); } catch {}
      }
      return results.length > 0 ? results : null;
    } catch (e) {
      err(`API error: ${e.message}`);
      return null;
    }
  }

  function setDeep(obj, key, value) {
    if (key in obj) { obj[key] = value; return true; }
    for (const val of Object.values(obj)) {
      if (val && typeof val === 'object' && setDeep(val, key, value)) return true;
    }
    return false;
  }

  // ── POST EXTRACTION FROM API RESPONSE ───────────────────
  function extractPostsFromResponse(data, groupSlug, memberUserId, memberName) {
    const posts = new Map();

    function walk(obj, depth, parentKey) {
      if (!obj || typeof obj !== 'object' || depth > 25) return;

      // Look for story/post nodes
      if (obj.__typename === 'Story' || obj.__typename === 'GroupPost' ||
          (obj.id && obj.message && obj.created_time) ||
          (obj.id && obj.creation_story) ||
          (obj.post_id && obj.message)) {
        const post = extractSinglePost(obj, groupSlug, memberUserId, memberName);
        if (post && post.postId && !posts.has(post.postId)) {
          posts.set(post.postId, post);
        }
      }

      // Look inside node wrappers
      if (obj.node && typeof obj.node === 'object') {
        walk(obj.node, depth + 1, parentKey);
      }

      if (Array.isArray(obj)) {
        for (const item of obj) walk(item, depth + 1, parentKey);
      } else {
        for (const [key, val] of Object.entries(obj)) {
          if (typeof val === 'object') walk(val, depth + 1, key);
        }
      }
    }

    if (Array.isArray(data)) {
      for (const part of data) walk(part, 0, null);
    } else {
      walk(data, 0, null);
    }

    return [...posts.values()];
  }

  function extractSinglePost(obj, groupSlug, memberUserId, memberName) {
    const post = {
      postId: null,
      permalink: '',
      authorName: '',
      authorId: '',
      timestamp: '',
      message: '',
      images: [],
      videos: [],
      links: [],
      reactions: { total: 0, types: {} },
      commentCount: 0,
      comments: [],
      shares: 0,
      scrapedAt: new Date().toISOString(),
    };

    try {
      // Post ID
      post.postId = obj.post_id || obj.id || obj.legacy_token ||
                    obj.story_id || (obj.creation_story && obj.creation_story.id) || null;
      if (!post.postId) {
        // Try to find a numeric ID in the object
        const idStr = JSON.stringify(obj).match(/"post_id"\s*:\s*"(\d+)"/);
        if (idStr) post.postId = idStr[1];
      }
      if (!post.postId) return null;

      // Clean post ID (sometimes prefixed)
      const numericId = post.postId.match(/(\d{10,})/);
      if (numericId) post.postId = numericId[1];

      // Permalink
      if (groupSlug) {
        post.permalink = `https://www.facebook.com/groups/${groupSlug}/posts/${post.postId}/`;
      }
      // Override with URL from data if available
      if (obj.url) post.permalink = obj.url;
      if (obj.permalink_url) post.permalink = obj.permalink_url;

      // Author
      post.authorId = memberUserId || '';
      post.authorName = memberName || '';
      const actor = obj.actors?.[0] || obj.author || obj.owner ||
                    obj.creation_story?.comet_sections?.context_layout?.story?.comet_sections?.actor_photo?.story?.actors?.[0];
      if (actor) {
        if (actor.id) post.authorId = String(actor.id);
        if (actor.name) post.authorName = actor.name;
      }

      // Timestamp
      post.timestamp = '';
      if (obj.created_time) {
        post.timestamp = typeof obj.created_time === 'number'
          ? new Date(obj.created_time * 1000).toISOString()
          : obj.created_time;
      }
      if (!post.timestamp && obj.creation_time) {
        post.timestamp = new Date(obj.creation_time * 1000).toISOString();
      }
      // Deep search for timestamp
      if (!post.timestamp) {
        const tsMatch = JSON.stringify(obj).match(/"created_time"\s*:\s*(\d{10})/);
        if (tsMatch) post.timestamp = new Date(parseInt(tsMatch[1]) * 1000).toISOString();
      }
      if (!post.timestamp) {
        const tsMatch2 = JSON.stringify(obj).match(/"creation_time"\s*:\s*(\d{10})/);
        if (tsMatch2) post.timestamp = new Date(parseInt(tsMatch2[1]) * 1000).toISOString();
      }

      // Message
      post.message = '';
      if (obj.message?.text) post.message = obj.message.text;
      else if (typeof obj.message === 'string') post.message = obj.message;
      // Try deeper paths for message text
      if (!post.message) {
        const msgDeep = findDeep(obj, 'message', 8);
        if (msgDeep && msgDeep.text) post.message = msgDeep.text;
        else if (typeof msgDeep === 'string' && msgDeep.length > 5) post.message = msgDeep;
      }
      if (!post.message) {
        const storyMsg = findDeep(obj, 'story_message', 8);
        if (storyMsg && storyMsg.text) post.message = storyMsg.text;
      }

      // Images
      post.images = [];
      collectImages(obj, post.images, 0);
      // Deduplicate
      post.images = [...new Set(post.images)];

      // Videos
      post.videos = [];
      collectVideos(obj, post.videos, 0);
      post.videos = [...new Set(post.videos)];

      // Shared links
      post.links = [];
      collectLinks(obj, post.links, 0);

      // Reactions
      const reactionsData = findDeep(obj, 'reaction_count', 10) ||
                            findDeep(obj, 'reactors', 10) ||
                            findDeep(obj, 'reaction_display_config', 10);
      if (reactionsData) {
        if (typeof reactionsData === 'number') {
          post.reactions.total = reactionsData;
        } else if (reactionsData.count !== undefined) {
          post.reactions.total = reactionsData.count;
        }
      }
      // Try to get total from i18n reaction string
      const countMatch = JSON.stringify(obj).match(/"reaction_count"\s*:\s*\{\s*"count"\s*:\s*(\d+)/);
      if (countMatch) post.reactions.total = parseInt(countMatch[1]);
      // Reaction types
      const importantReactionsMatch = JSON.stringify(obj).match(/"important_reactors"\s*:\s*(\{[^}]*\})/);
      // Simple total count
      const totalCountMatch = JSON.stringify(obj).match(/"i18n_reaction_count"\s*:\s*"(\d+)"/);
      if (totalCountMatch) post.reactions.total = parseInt(totalCountMatch[1]);

      // Comment count
      const ccMatch = JSON.stringify(obj).match(/"comment_count"\s*:\s*\{\s*"total_count"\s*:\s*(\d+)/);
      if (ccMatch) post.commentCount = parseInt(ccMatch[1]);
      if (!post.commentCount) {
        const ccMatch2 = JSON.stringify(obj).match(/"total_comment_count"\s*:\s*(\d+)/);
        if (ccMatch2) post.commentCount = parseInt(ccMatch2[1]);
      }

      // Shares
      const shareMatch = JSON.stringify(obj).match(/"share_count"\s*:\s*\{\s*"count"\s*:\s*(\d+)/);
      if (shareMatch) post.shares = parseInt(shareMatch[1]);

      // Extract inline comments if present
      post.comments = extractCommentsFromObj(obj);

    } catch (e) {
      warn(`Post extraction error: ${e.message}`);
    }

    return post;
  }

  // ── DEEP SEARCH HELPERS ─────────────────────────────────
  function findDeep(obj, key, maxDepth, depth = 0) {
    if (!obj || typeof obj !== 'object' || depth > maxDepth) return null;
    if (key in obj) return obj[key];
    for (const val of Object.values(obj)) {
      if (typeof val === 'object') {
        const found = findDeep(val, key, maxDepth, depth + 1);
        if (found !== null) return found;
      }
    }
    return null;
  }

  function collectImages(obj, images, depth) {
    if (!obj || typeof obj !== 'object' || depth > 15) return;
    // Various FB image patterns
    if (obj.uri && typeof obj.uri === 'string' && obj.uri.includes('scontent')) {
      if (obj.width > 100 || !obj.width) images.push(obj.uri);
    }
    if (obj.url && typeof obj.url === 'string' && obj.url.includes('scontent') && (obj.width > 100 || obj.height > 100)) {
      images.push(obj.url);
    }
    if (obj.image?.uri && obj.image.uri.includes('scontent')) {
      images.push(obj.image.uri);
    }
    if (obj.photo_image?.uri) images.push(obj.photo_image.uri);
    if (obj.full_image?.uri) images.push(obj.full_image.uri);
    if (obj.large_share_image?.uri) images.push(obj.large_share_image.uri);

    if (Array.isArray(obj)) {
      for (const item of obj) collectImages(item, images, depth + 1);
    } else {
      for (const [key, val] of Object.entries(obj)) {
        // Skip comment-nested images at first (handle separately)
        if (key === 'comment_rendering_instance' || key === 'toplevel_comments') continue;
        if (typeof val === 'object') collectImages(val, images, depth + 1);
      }
    }
  }

  function collectVideos(obj, videos, depth) {
    if (!obj || typeof obj !== 'object' || depth > 12) return;
    if (obj.playable_url) videos.push(obj.playable_url);
    if (obj.playable_url_quality_hd) videos.push(obj.playable_url_quality_hd);
    if (obj.browser_native_sd_url) videos.push(obj.browser_native_sd_url);
    if (obj.browser_native_hd_url) videos.push(obj.browser_native_hd_url);

    if (Array.isArray(obj)) {
      for (const item of obj) collectVideos(item, videos, depth + 1);
    } else {
      for (const val of Object.values(obj)) {
        if (typeof val === 'object') collectVideos(val, videos, depth + 1);
      }
    }
  }

  function collectLinks(obj, links, depth) {
    if (!obj || typeof obj !== 'object' || depth > 10) return;
    if (obj.attached_story?.attachments) {
      for (const att of obj.attached_story.attachments) {
        if (att.url) links.push({ url: att.url, title: att.title_with_entities?.text || '' });
      }
    }
    if (obj.story_attachment?.url) {
      links.push({ url: obj.story_attachment.url, title: obj.story_attachment.title_with_entities?.text || obj.story_attachment.title || '' });
    }
    if (Array.isArray(obj)) {
      for (const item of obj) collectLinks(item, links, depth + 1);
    } else {
      for (const val of Object.values(obj)) {
        if (typeof val === 'object') collectLinks(val, links, depth + 1);
      }
    }
  }

  // ── COMMENT EXTRACTION ──────────────────────────────────
  function extractCommentsFromObj(obj) {
    const comments = [];
    const seen = new Set();

    function walkComments(node, depth, isReplyCtx) {
      if (!node || typeof node !== 'object' || depth > 20) return;

      // Detect comment nodes
      const isComment =
        node.__typename === 'Comment' ||
        (node.id && node.body && node.author) ||
        (node.comment_id && node.body);

      if (isComment) {
        const c = parseSingleComment(node, isReplyCtx);
        if (c && !seen.has(c.commentId || c.author + c.text)) {
          seen.add(c.commentId || c.author + c.text);
          comments.push(c);
          // Look for replies nested inside
          const replies = node.replies || node.feedback?.replies ||
                          findDeep(node, 'replies', 4);
          if (replies) {
            walkComments(replies, depth + 1, true);
          }
          return; // Don't descend further into this comment
        }
      }

      if (Array.isArray(node)) {
        for (const item of node) walkComments(item, depth + 1, isReplyCtx);
      } else {
        for (const [key, val] of Object.entries(node)) {
          if (typeof val === 'object') {
            const replyCtx = isReplyCtx || key === 'replies' || key === 'reply_comments';
            walkComments(val, depth + 1, replyCtx);
          }
        }
      }
    }

    walkComments(obj, 0, false);
    return comments;
  }

  function parseSingleComment(node, isReply) {
    try {
      const c = {
        commentId: node.id || node.comment_id || '',
        author: '',
        authorId: '',
        text: '',
        timestamp: '',
        images: [],
        isReply: !!isReply,
        reactionCount: 0,
      };

      // Author
      const author = node.author || node.commenter || {};
      c.author = author.name || '';
      c.authorId = author.id || '';

      // Text
      if (node.body?.text) c.text = node.body.text;
      else if (typeof node.body === 'string') c.text = node.body;
      else if (node.text?.text) c.text = node.text.text;

      // Timestamp
      if (node.created_time) {
        c.timestamp = typeof node.created_time === 'number'
          ? new Date(node.created_time * 1000).toISOString()
          : node.created_time;
      }

      // Images in comment
      if (node.attachments) {
        for (const att of (Array.isArray(node.attachments) ? node.attachments : [node.attachments])) {
          if (att.media?.image?.uri) c.images.push(att.media.image.uri);
          if (att.media?.photo_image?.uri) c.images.push(att.media.photo_image.uri);
          if (att.url && att.url.includes('scontent')) c.images.push(att.url);
        }
      }
      // Sticker
      if (node.sticker?.url) c.images.push(node.sticker.url);
      // Inline image
      if (node.comment_image?.uri) c.images.push(node.comment_image.uri);
      // Broader image search on the comment
      const cImgs = [];
      collectCommentImages(node, cImgs, 0);
      c.images = [...new Set([...c.images, ...cImgs])];

      // Reactions
      const rc = findDeep(node, 'reaction_count', 5);
      if (rc && typeof rc === 'object' && rc.count !== undefined) c.reactionCount = rc.count;
      else if (typeof rc === 'number') c.reactionCount = rc;

      if (c.author || c.text || c.images.length > 0) return c;
    } catch (e) {}
    return null;
  }

  function collectCommentImages(obj, images, depth) {
    if (!obj || typeof obj !== 'object' || depth > 6) return;
    if (obj.uri && typeof obj.uri === 'string' && obj.uri.includes('scontent')) {
      if (!obj.width || obj.width > 50) images.push(obj.uri);
    }
    if (Array.isArray(obj)) {
      for (const item of obj) collectCommentImages(item, images, depth + 1);
    } else {
      for (const [key, val] of Object.entries(obj)) {
        if (key === 'replies' || key === 'reply_comments') continue; // Don't cross into replies
        if (typeof val === 'object') collectCommentImages(val, images, depth + 1);
      }
    }
  }

  // ── CURSOR EXTRACTION ───────────────────────────────────
  function extractCursor(data) {
    let bestCursor = null;
    let bestHasNext = false;

    function walk(obj, depth, parentKey) {
      if (!obj || typeof obj !== 'object' || depth > 15 || bestCursor) return;

      if (obj.page_info && obj.edges) {
        const edges = obj.edges;
        if (Array.isArray(edges) && edges.length > 0) {
          // Check if this looks like post edges (not comment edges)
          const isPostEdges = edges.some(e =>
            e.node?.__typename === 'Story' ||
            e.node?.__typename === 'GroupPost' ||
            e.node?.id?.length > 8
          ) || parentKey === 'timeline_feed_units' ||
             parentKey === 'group_feed' ||
             parentKey === 'timeline_list_feed_units';

          if (isPostEdges || !parentKey) {
            const pi = obj.page_info;
            if (pi.end_cursor) {
              bestCursor = pi.end_cursor;
              bestHasNext = !!pi.has_next_page;
              return;
            }
          }
        }
      }

      if (Array.isArray(obj)) {
        for (const item of obj) walk(item, depth + 1, parentKey);
      } else {
        for (const [key, val] of Object.entries(obj)) {
          if (typeof val === 'object') walk(val, depth + 1, key);
        }
      }
    }

    if (Array.isArray(data)) {
      for (const part of data) walk(part, 0, null);
    } else {
      walk(data, 0, null);
    }

    if (!bestCursor) {
      // Regex fallback
      const json = JSON.stringify(data);
      const blocks = [...json.matchAll(/"end_cursor"\s*:\s*"([^"]{10,})"/g)];
      const hasNext = /"has_next_page"\s*:\s*true/.test(json);
      if (blocks.length > 0) {
        blocks.sort((a, b) => b[1].length - a[1].length);
        return { cursor: blocks[0][1], hasNext };
      }
    }

    return { cursor: bestCursor, hasNext: bestHasNext };
  }

  // ── MAIN SCRAPE LOOP ───────────────────────────────────
  let running = false;
  let skipCurrent = false;
  let currentMemberIdx = 0;
  let sessionStats = { posts: 0, comments: 0, images: 0, members: 0 };

  async function scrapeMember(member, query, groupSlug) {
    const userId = member.userId;
    const name = member.name;

    // Check if already done
    const progress = db.memberProgress[userId];
    if (progress && progress.status === 'done') {
      return;
    }

    log(`──── 👤 ${name} (${userId}) ────`);

    // Navigate to member's page in group
    const memberUrl = `https://www.facebook.com/groups/${groupSlug}/user/${userId}/`;
    window.location.href = memberUrl;
    await sleep(CONFIG.pageLoadDelay);

    // Wait for page to settle
    await sleep(2000);

    // Re-inject interception for this new page load
    startInterception();

    // Trigger scroll to load posts
    window.scrollBy(0, 800);
    await sleep(2000);
    window.scrollBy(0, 600);
    await sleep(2000);

    // Try to capture the post query if we don't have one
    if (!capturedPostQuery) {
      let waitSec = 0;
      while (!capturedPostQuery && waitSec < 30) {
        await sleep(1000);
        waitSec++;
        if (waitSec % 5 === 0) {
          window.scrollBy(0, rand(300, 700));
          log(`⏳ Waiting for post API capture... (${waitSec}s)`);
        }
      }
      stopInterception();

      if (!capturedPostQuery) {
        warn(`No post API captured for ${name} — they may have 0 posts`);
        db.memberProgress[userId] = { status: 'done', postsFound: 0, lastCursor: null };
        return;
      }
    } else {
      stopInterception();
    }

    // Now paginate through all posts for this member
    let cursor = (progress && progress.lastCursor) || null;
    let postsFound = (progress && progress.postsFound) || 0;
    let emptyPages = 0;
    let pageNum = 0;

    // Modify the captured query to point to this member
    // The query variables should contain the user ID — we need to swap it
    while (running && !skipCurrent) {
      pageNum++;

      // Build variable overrides for this member
      const overrides = {};

      // Set cursor
      if (cursor) {
        // Try to find and set cursor in various places
        const vars = JSON.parse(JSON.stringify(capturedPostQuery.variables));
        setCursorDeep(vars, cursor);
        overrides.__fullVars = vars;
      }

      // Set user ID
      const vars = cursor ? overrides.__fullVars : JSON.parse(JSON.stringify(capturedPostQuery.variables));
      setUserIdDeep(vars, userId);
      if (cursor) setCursorDeep(vars, cursor);
      else clearCursorDeep(vars);

      // Make the API call with modified variables
      const modifiedQuery = {
        ...capturedPostQuery,
        variables: vars,
      };

      const results = await callApi(modifiedQuery);

      if (!results) {
        emptyPages++;
        if (emptyPages >= CONFIG.maxRetries) {
          warn(`${CONFIG.maxRetries} failures for ${name} — moving on`);
          break;
        }
        await sleep(rand(3000, 8000));
        continue;
      }

      // Extract posts from response
      let newPosts = [];
      for (const part of results) {
        const extracted = extractPostsFromResponse(part, groupSlug, userId, name);
        newPosts.push(...extracted);
      }

      // Also try to grab posts from the raw JSON with regex fallback
      const rawJson = JSON.stringify(results);
      const postIdMatches = [...rawJson.matchAll(/"post_id"\s*:\s*"(\d+)"/g)];

      let newCount = 0;
      for (const post of newPosts) {
        if (post.postId && !db.posts[post.postId]) {
          post.scrapedAt = new Date().toISOString();
          db.posts[post.postId] = post;
          newCount++;
          postsFound++;
          sessionStats.posts++;
          sessionStats.comments += post.comments.length;
          sessionStats.images += post.images.length;
        }
      }

      // Extract cursor for next page
      let nextInfo = { cursor: null, hasNext: false };
      for (const part of results) {
        nextInfo = extractCursor(part);
        if (nextInfo.cursor) break;
      }

      log(`  Page ${pageNum}: +${newCount} posts (${postsFound} total) | cursor: ${nextInfo.hasNext ? 'more' : 'end'}`);

      if (newCount === 0) {
        emptyPages++;
      } else {
        emptyPages = 0;
      }

      // Save cursor for resume
      db.memberProgress[userId] = {
        status: 'in-progress',
        postsFound,
        lastCursor: nextInfo.cursor || cursor,
      };

      // Save periodically
      if (sessionStats.posts % CONFIG.saveEvery === 0 && sessionStats.posts > 0) {
        await saveDb();
      }

      // Check if done
      if (!nextInfo.hasNext || !nextInfo.cursor || emptyPages >= CONFIG.maxEmptyPages) {
        break;
      }

      cursor = nextInfo.cursor;
      await sleep(rand(...CONFIG.requestDelay));
    }

    // Mark member as done
    if (!skipCurrent) {
      db.memberProgress[userId] = { status: 'done', postsFound, lastCursor: null };
      sessionStats.members++;
      good(`  ✓ ${name}: ${postsFound} posts`);
    }
    skipCurrent = false;
  }

  function setUserIdDeep(obj, userId) {
    if (!obj || typeof obj !== 'object') return false;
    let found = false;
    // Common FB variable names for user ID
    for (const key of ['userID', 'user_id', 'userId', 'profileID', 'profile_id', 'id', 'ownerID', 'owner_id']) {
      if (key in obj && /^\d+$/.test(String(obj[key]))) {
        obj[key] = userId;
        found = true;
      }
    }
    for (const val of Object.values(obj)) {
      if (typeof val === 'object') {
        if (setUserIdDeep(val, userId)) found = true;
      }
    }
    return found;
  }

  function setCursorDeep(obj, cursor) {
    if (!obj || typeof obj !== 'object') return false;
    let found = false;
    for (const key of ['after', 'cursor', 'end_cursor', 'afterCursor']) {
      if (key in obj) { obj[key] = cursor; found = true; }
    }
    for (const val of Object.values(obj)) {
      if (typeof val === 'object') {
        if (setCursorDeep(val, cursor)) found = true;
      }
    }
    return found;
  }

  function clearCursorDeep(obj) {
    if (!obj || typeof obj !== 'object') return;
    for (const key of ['after', 'cursor', 'end_cursor', 'afterCursor']) {
      if (key in obj) obj[key] = null;
    }
    for (const val of Object.values(obj)) {
      if (typeof val === 'object') clearCursorDeep(val);
    }
  }

  // ── MAIN LOOP ──────────────────────────────────────────
  async function mainLoop() {
    running = true;
    const group = detectGroup();
    const groupSlug = group.groupSlug || db.meta.groupSlug || '';
    db.meta.groupSlug = groupSlug;
    db.meta.groupId = group.groupId || db.meta.groupId;
    db.meta.totalMembers = members.length;

    // Start from where we left off
    let startIdx = db.meta.currentMemberIdx || 0;

    // Skip already-done members
    while (startIdx < members.length && db.memberProgress[members[startIdx].userId]?.status === 'done') {
      startIdx++;
    }

    log(`🚀 Starting from member #${startIdx + 1} of ${members.length}`);
    log(`   Group: ${groupSlug}`);
    log(`   Already processed: ${Object.values(db.memberProgress).filter(p => p.status === 'done').length}`);
    log(`   Posts in database: ${Object.keys(db.posts).length}`);
    log('');

    for (let i = startIdx; i < members.length; i++) {
      if (!running) break;
      currentMemberIdx = i;
      db.meta.currentMemberIdx = i;
      db.meta.membersProcessed = Object.values(db.memberProgress).filter(p => p.status === 'done').length;

      const pct = ((i / members.length) * 100).toFixed(1);
      log(`[${i + 1}/${members.length}] (${pct}%) Processing: ${members[i].name}`);

      try {
        await scrapeMember(members[i], capturedPostQuery, groupSlug);
      } catch (e) {
        err(`Error on ${members[i].name}: ${e.message}`);
        db.memberProgress[members[i].userId] = {
          status: 'error',
          postsFound: 0,
          lastCursor: null,
          error: e.message,
        };
      }

      // Save after each member
      await saveDb();

      // Delay between members
      if (i < members.length - 1 && running) {
        await sleep(rand(...CONFIG.memberDelay));
      }
    }

    running = false;
    await saveDb();
    good(`\n✅ ALL DONE! ${sessionStats.posts} posts, ${sessionStats.comments} comments, ${sessionStats.images} images from ${sessionStats.members} members`);
  }

  // ═══════════════════════════════════════════════════════
  //  INITIALIZATION
  // ═══════════════════════════════════════════════════════
  log('═══════════════════════════════════════════════');
  log('  Facebook Group Post Scraper v3');
  log('  API Interception — No Modals — Full Data');
  log('═══════════════════════════════════════════════');
  log('');

  // Step 1: Pick folder (with member CSVs)
  log('Step 1: Select your scrape folder...');
  const ok = await pickFolder();
  if (!ok) return;

  // Step 2: Load database & members
  await loadDb();
  await loadMembers();

  if (members.length === 0) {
    err('❌ No members found! Place database_members.json or members_batch_*.csv files in the folder.');
    return;
  }

  // Step 3: Detect group
  const group = detectGroup();
  if (!group.groupSlug) {
    err('❌ Navigate to a group member page first: /groups/GROUP/user/USER_ID/');
    return;
  }
  db.meta.groupSlug = group.groupSlug;
  db.meta.groupId = group.groupId || db.meta.groupId;
  log(`✅ Group: ${group.groupSlug} (ID: ${group.groupId || 'slug-only'})`);

  // Step 4: Intercept the post-loading API call
  startInterception();
  log('');
  log('═══════════════════════════════════════════════');
  log('  Step 2: SCROLL DOWN on this member page');
  log('  This triggers the post-loading API call');
  log('  The script will capture it automatically');
  log('═══════════════════════════════════════════════');
  log('');

  // Auto-scroll to trigger
  await sleep(2000);
  window.scrollBy(0, 600);
  await sleep(1500);
  window.scrollBy(0, 800);
  await sleep(1500);
  window.scrollBy(0, 500);

  let waitSec = 0;
  while (!capturedPostQuery && waitSec < CONFIG.maxWaitCapture) {
    await sleep(1000);
    waitSec++;
    if (waitSec % 10 === 0) {
      log(`⏳ Waiting for post API capture... (${waitSec}s) — try scrolling`);
      window.scrollBy(0, rand(300, 800));
    }
    if (waitSec % 30 === 0) {
      window.scrollTo(0, 0);
      await sleep(500);
      window.scrollBy(0, 1500);
    }
  }

  stopInterception();

  if (!capturedPostQuery) {
    err('❌ No post API call captured.');
    err('   Make sure you are on a member\'s posts page in the group and scroll down.');
    err('   URL should look like: /groups/GROUP_ID/user/USER_ID/');
    return;
  }

  good(`🎯 Using: doc_id=${capturedPostQuery.docId} (${capturedPostQuery.friendlyName})`);
  log(`   Variables: ${JSON.stringify(capturedPostQuery.variables).substring(0, 200)}...`);
  log('');

  // ── PUBLIC API ──────────────────────────────────────────
  window.posts = {
    async stop() {
      running = false;
      await saveDb();
      good('⏸ Stopped & saved.');
    },
    start() {
      if (running) { log('Already running!'); return; }
      sessionStats = { posts: 0, comments: 0, images: 0, members: 0 };
      mainLoop();
    },
    status() {
      const totalPosts = Object.keys(db.posts).length;
      const doneMbrs = Object.values(db.memberProgress).filter(p => p.status === 'done').length;
      const errorMbrs = Object.values(db.memberProgress).filter(p => p.status === 'error').length;
      console.table({
        'Total posts':         totalPosts,
        'This session':        sessionStats.posts,
        'Total members':       members.length,
        'Members done':        `${doneMbrs}/${members.length}`,
        'Members with errors': errorMbrs,
        'Current member':      members[currentMemberIdx]?.name || '-',
        'Current index':       `#${currentMemberIdx + 1}`,
        'Running':             running,
        'Last saved':          db.meta.lastUpdated || 'never',
      });
    },
    async save() { await saveDb(); },
    async export() {
      const allPosts = Object.values(db.posts);
      const json = JSON.stringify(allPosts, null, 2);
      await writeFile(`posts_export_${new Date().toISOString().slice(0,10)}.json`, json);
      good(`📊 Exported ${allPosts.length} posts`);
    },
    faster() { CONFIG.requestDelay = [500, 1200]; CONFIG.memberDelay = [1500, 3000]; log('⚡ Speed: FAST'); },
    slower() { CONFIG.requestDelay = [3000, 8000]; CONFIG.memberDelay = [5000, 12000]; log('🐌 Speed: SLOW'); },
    skip() { skipCurrent = true; log('⏭ Skipping current member...'); },
    retry() {
      if (members[currentMemberIdx]) {
        delete db.memberProgress[members[currentMemberIdx].userId];
        log(`🔄 Retry ${members[currentMemberIdx].name}`);
      }
    },
    jumpTo(n) {
      db.meta.currentMemberIdx = Math.max(0, n - 1);
      log(`⏩ Will jump to member #${n} on next start`);
    },
    errors() {
      const errs = Object.entries(db.memberProgress).filter(([_, p]) => p.status === 'error');
      if (errs.length === 0) { log('No errors!'); return; }
      for (const [uid, p] of errs) {
        const m = members.find(m => m.userId === uid);
        console.log(`  ${m?.name || uid}: ${p.error}`);
      }
    },
  };

  log('  posts.stop()       — pause & save');
  log('  posts.start()      — resume');
  log('  posts.status()     — show progress');
  log('  posts.save()       — force save');
  log('  posts.export()     — export all posts as JSON');
  log('  posts.faster()     — speed up');
  log('  posts.slower()     — slow down');
  log('  posts.skip()       — skip current member');
  log('  posts.retry()      — retry current member');
  log('  posts.jumpTo(n)    — jump to member #n');
  log('  posts.errors()     — show failed members');
  log('');

  // Auto-start
  mainLoop();
})();
