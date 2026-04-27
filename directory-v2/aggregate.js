// Aggregates all posts + comments into per-person records.
const { fixMojibake, detectIntent, extractPhones, matchCategories } = require('./extractors');

function buildPeople(posts, members) {
  const peopleMap = new Map();

  function get(id, name) {
    if (!id) return null;
    if (!peopleMap.has(id)) {
      const mi = members[id] || {};
      peopleMap.set(id, {
        userId: id,
        name: fixMojibake(name) || fixMojibake(mi.name) || 'Unknown',
        profileUrl: mi.profileUrl || `https://www.facebook.com/${id}`,
        bio: fixMojibake(mi.bio) || '',
        joinDate: mi.joinDate || '',
        role: mi.role || 'member',
        inMemberDb: !!members[id],
        posts: [], comments: [],
        phones: new Map(), trades: new Map(),
        totalReactions: 0, firstSeen: null, lastSeen: null,
      });
    }
    return peopleMap.get(id);
  }

  function touchDate(p, ts) {
    if (!ts) return;
    const t = new Date(ts).getTime();
    if (isNaN(t)) return;
    if (p.firstSeen === null || t < p.firstSeen) p.firstSeen = t;
    if (p.lastSeen === null || t > p.lastSeen) p.lastSeen = t;
  }

  function addPhones(p, text, type, link, date, contextAuthorName, contextPostAuthor) {
    for (const ph of extractPhones(text || '')) {
      if (!p.phones.has(ph.digits)) {
        p.phones.set(ph.digits, { normalized: ph.normalized, digits: ph.digits, raws: new Set(), sources: [] });
      }
      const e = p.phones.get(ph.digits);
      e.raws.add(ph.raw);
      // Capture 60 chars before + 80 chars after the phone for context
      const txt = text || '';
      const idx = txt.indexOf(ph.raw);
      const excerpt = idx >= 0
        ? (idx > 60 ? '…' : '') + txt.slice(Math.max(0, idx - 60), idx + ph.raw.length + 80).trim() + (idx + ph.raw.length + 80 < txt.length ? '…' : '')
        : txt.slice(0, 180);
      e.sources.push({ type, link, date, excerpt, postAuthor: contextPostAuthor || null });
    }
  }

  function addTrades(p, text, intent, type, link, date) {
    for (const { category, keywords } of matchCategories(text || '')) {
      if (!p.trades.has(category)) {
        p.trades.set(category, {
          keywords: new Set(), evidence: [],
          offering: 0, seeking: 0, mixed: 0, unclear: 0,
        });
      }
      const t = p.trades.get(category);
      keywords.forEach(k => t.keywords.add(k));
      if (intent === 'offering') t.offering++;
      else if (intent === 'seeking') t.seeking++;
      else if (intent === 'mixed') t.mixed++;
      else t.unclear++;
      t.evidence.push({ type, link, date, intent, keywords, excerpt: (text || '').slice(0, 280) });
    }
  }

  let nPosts = 0, nComments = 0;
  for (const [postId, post] of Object.entries(posts)) {
    const msg = fixMojibake(post.message || '');
    const aid = post.authorId;
    if (aid) {
      const p = get(aid, post.authorName);
      touchDate(p, post.timestamp);
      const intent = detectIntent(msg);
      p.posts.push({
        postId, message: msg, timestamp: post.timestamp, permalink: post.permalink,
        images: post.images || [], imageCount: (post.images || []).length,
        videoCount: (post.videos || []).length,
        reactions: (post.reactions && post.reactions.total) || 0,
        commentCount: post.commentCount || 0, intent,
      });
      p.totalReactions += (post.reactions && post.reactions.total) || 0;
      if (msg) {
        addPhones(p, msg, 'post', post.permalink, post.timestamp, p.name, null);
        addTrades(p, msg, intent, 'post', post.permalink, post.timestamp);
      }
      nPosts++;
    }

    if (Array.isArray(post.comments)) {
      for (const c of post.comments) {
        const cid = c.authorId;
        if (!cid) continue;
        const ctxt = fixMojibake(c.text || '');
        const cp = get(cid, c.author);
        touchDate(cp, c.timestamp);
        const ci = detectIntent(ctxt);
        cp.comments.push({
          commentId: c.commentId, text: ctxt, timestamp: c.timestamp,
          postId, postPermalink: post.permalink,
          postAuthorName: fixMojibake(post.authorName || ''),
          isReply: !!c.isReply, reactionCount: c.reactionCount || 0, intent: ci,
        });
        cp.totalReactions += c.reactionCount || 0;
        if (ctxt) {
          addPhones(cp, ctxt, 'comment', post.permalink, c.timestamp, cp.name, fixMojibake(post.authorName || ''));
          addTrades(cp, ctxt, ci, 'comment', post.permalink, c.timestamp);
        }
        nComments++;
      }
    }
  }

  // Include members with no activity
  for (const [id, info] of Object.entries(members)) {
    if (!peopleMap.has(id)) get(id, info.name);
  }

  return { peopleMap, nPosts, nComments };
}

function scoreConfidence(trade, hasPhone) {
  const tot = trade.offering + trade.seeking + trade.mixed + trade.unclear;
  if (tot === 0) return 0;
  const offerRatio = (trade.offering + trade.mixed * 0.3) / tot;
  let score = offerRatio * 0.5;
  score += Math.min(trade.offering / 3, 1) * 0.2;
  if (hasPhone) score += 0.2;
  if (tot >= 2) score += 0.1;
  return Math.min(Math.round(score * 100) / 100, 1);
}

function finalize(peopleMap) {
  const people = [];
  for (const p of peopleMap.values()) {
    const phones = [...p.phones.values()].map(x => ({ ...x, raws: [...x.raws] }));
    const hasPhone = phones.length > 0;

    const trades = [...p.trades.entries()].map(([cat, t]) => {
      const primaryIntent =
        t.offering > t.seeking ? 'offering' :
        t.seeking > t.offering ? 'seeking' :
        t.mixed > 0 ? 'mixed' : 'unclear';
      return {
        category: cat, keywords: [...t.keywords], evidence: t.evidence,
        offeringCount: t.offering, seekingCount: t.seeking,
        mixedCount: t.mixed, unclearCount: t.unclear,
        primaryIntent, confidence: scoreConfidence(t, hasPhone),
      };
    }).sort((a, b) => b.confidence - a.confidence);

    p.posts.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
    p.comments.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

    people.push({
      userId: p.userId, name: p.name, profileUrl: p.profileUrl,
      bio: p.bio, joinDate: p.joinDate, role: p.role, inMemberDb: p.inMemberDb,
      totalPosts: p.posts.length, totalComments: p.comments.length,
      totalActivity: p.posts.length + p.comments.length,
      totalReactions: p.totalReactions,
      firstSeen: p.firstSeen ? new Date(p.firstSeen).toISOString() : null,
      lastSeen: p.lastSeen ? new Date(p.lastSeen).toISOString() : null,
      phones, trades,
      offersService: trades.some(t => t.primaryIntent === 'offering'),
      seeksService: trades.some(t => t.primaryIntent === 'seeking'),
      topTrade: trades[0]?.category || null,
      topTradeConfidence: trades[0]?.confidence || 0,
      posts: p.posts, comments: p.comments,
    });
  }
  people.sort((a, b) => b.totalActivity - a.totalActivity);
  return people;
}

module.exports = { buildPeople, finalize };
