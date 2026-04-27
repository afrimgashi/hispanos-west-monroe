/**
 * content.js â€” Scrapes one post at a time via modal dialog.
 *
 * Strategy 1: Find posts via /posts/ID or /permalink/ID links (posts with comment links)
 * Strategy 2: Find posts via __cft__ token grouping + click post text (posts without any post links)
 */
(() => {
  if (window.__fbScraper) return;
  window.__fbScraper = true;

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const UI_WORDS = new Set([
    'like','comment','share','reply','most relevant','all comments',
    'top comments','newest first','write a comment','see more',
    'see translation','follow','hide','report','remove',
    'view more comments','no comments yet','be the first to comment.',
    'see original','rate this translation'
  ]);

  let lastPostY = 0;
  // Track __cft__ tokens we've already tried clicking (Strategy 2)
  let triedCftTokens = new Set();

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  //  Group page links by __cft__ token.
  //  Each __cft__ token corresponds to one post.
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  function getCftGroups() {
    const groups = new Map();
    for (const a of document.querySelectorAll('a[href*="__cft__"]')) {
      if (a.closest('[role="dialog"]')) continue;
      const m = a.href.match(/__cft__\[0\]=([^&]+)/);
      if (!m) continue;
      const token = m[1];
      if (!groups.has(token)) groups.set(token, []);
      groups.get(token).push(a);
    }
    return groups;
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  //  Find next unseen post on the member page
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  async function findNextPostLink(seen) {
    if (lastPostY > 0) {
      window.scrollTo({ top: Math.max(0, lastPostY - 200), behavior: 'smooth' });
      await sleep(800);
    }

    let bottomStreak = 0;

    for (let attempt = 0; attempt < 150; attempt++) {
      const allLinks = document.querySelectorAll('a[href]');

      // â”€â”€ STRATEGY 1: Find direct /posts/ID or /permalink/ID links â”€â”€
      let candidateCount = 0;
      for (const a of allLinks) {
        const href = a.href || '';
        let postId = null;
        let groupSlug = null;

        let m = href.match(/\/groups\/([^/?#]+)\/(?:posts|permalink)\/([\w]+)/);
        if (m) { groupSlug = m[1]; postId = m[2]; }
        if (!postId) { m = href.match(/multi_permalinks=(\d+)/); if (m) { postId = m[1]; groupSlug = (href.match(/\/groups\/([^/?#]+)/) || [])[1] || ''; } }
        if (!postId) { m = href.match(/story\.php\?.*story_fbid=(\d+)/); if (m) { postId = m[1]; groupSlug = (href.match(/\/groups\/([^/?#]+)/) || [])[1] || ''; } }

        if (!postId) continue;
        candidateCount++;
        if (seen.has(postId)) continue;

        const rect = a.getBoundingClientRect();
        lastPostY = window.scrollY + rect.top;
        const finalGroupSlug = groupSlug || (window.location.href.match(/\/groups\/([^/?#]+)/) || [])[1] || '';
        console.log(`[Scraper] Strategy 1: post ${postId} (${candidateCount} links, ${seen.size} seen)`);
        return { link: a, groupSlug: finalGroupSlug, postId, strategy: 1 };
      }

      // â”€â”€ STRATEGY 2: Find posts without direct links via __cft__ grouping â”€â”€
      // Group links by __cft__ token. Each group = one post.
      // If a group has NO /posts/ or /permalink/ links, it's a linkless post.
      const cftGroups = getCftGroups();
      // Collect __cft__ tokens that belong to posts we've already handled (Strategy 1)
      const cftWithPostLinks = new Set();
      for (const [token, links] of cftGroups) {
        for (const a of links) {
          if (/\/(?:posts|permalink)\/[\w]+/.test(a.href)) {
            cftWithPostLinks.add(token);
            break;
          }
        }
      }

      for (const [token, links] of cftGroups) {
        // Skip if this __cft__ group has post links (Strategy 1 handles it)
        if (cftWithPostLinks.has(token)) continue;
        // Skip if we already tried this token
        if (triedCftTokens.has(token)) continue;

        // This is a linkless post. Collect click targets in priority order.
        const candidates = [];

        // 1) Timestamp-like <a> links from the __cft__ group (most reliable for opening post)
        for (const a of links) {
          const text = a.textContent.trim();
          if (!text || text.length > 40) continue;
          if (/ago|hour|min|just|yesterday|\d{4}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d+[hdwmy]/i.test(text)) {
            candidates.push(a);
          }
        }

        // 2) Post text div near the __cft__ links
        // 3) Image fallback
        let bestContainer = null;
        for (const a of links) {
          let container = a;
          for (let up = 0; up < 20; up++) {
            if (!container.parentElement) break;
            container = container.parentElement;
            if (container.offsetHeight > 300) break;
          }
          if (!bestContainer || container.offsetHeight > bestContainer.offsetHeight) {
            bestContainer = container;
          }
        }
        if (bestContainer) {
          for (const div of bestContainer.querySelectorAll('div[dir="auto"]')) {
            const t = div.innerText.trim();
            if (t.length > 10 && !UI_WORDS.has(t.toLowerCase()) && !/^\d+$/.test(t)) {
              candidates.push(div);
              break;
            }
          }
          const img = bestContainer.querySelector('img[src*="scontent"]');
          if (img) candidates.push(img);
        }

        if (candidates.length > 0) {
          triedCftTokens.add(token);
          const primary = candidates[0];
          const rect = primary.getBoundingClientRect();
          lastPostY = window.scrollY + rect.top;
          const preview = primary.textContent?.trim().substring(0, 50) || '(image)';
          console.log(`[Scraper] Strategy 2: ${candidates.length} targets for linkless post: "${preview}"`);
          return { link: primary, groupSlug: '', postId: null, strategy: 2, altLinks: candidates.slice(1) };
        }
      }

      if (attempt % 5 === 0) {
        console.log(`[Scraper] Scroll ${attempt}: ${candidateCount} S1 links, ${cftGroups.size} cft groups, ${cftWithPostLinks.size} with post links, ${triedCftTokens.size} tried S2`);
      }

      const prevHeight = document.body.scrollHeight;
      window.scrollBy({ top: 600, behavior: 'smooth' });
      await sleep(2000);
      const nowHeight = document.body.scrollHeight;
      const nearBottom = (window.innerHeight + window.scrollY) >= nowHeight - 500;

      if (nearBottom && nowHeight === prevHeight) {
        bottomStreak++;
        if (bottomStreak >= 5) return null;
      } else {
        bottomStreak = 0;
      }
    }
    return null;
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  //  Helpers
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  function isInsideComment(el, commentArticles) {
    for (const art of commentArticles) {
      if (art.contains(el)) return true;
    }
    return false;
  }

  function getCommentAuthor(articleEl) {
    const ariaLabel = articleEl.getAttribute('aria-label') || '';
    const byMatch = ariaLabel.match(/comment\s+by\s+(.+)/i);
    if (byMatch) {
      let name = byMatch[1].trim();
      // Strip trailing timestamps: "2 years ago", "4 days ago", "1h", etc.
      name = name.replace(/\s+\d+\s+(year|month|week|day|hour|minute|second)s?\s+ago$/i, '');
      name = name.replace(/\s+\d+[hdwmy]$/i, '');
      name = name.replace(/\s+(just now|yesterday)$/i, '');
      return name.trim();
    }
    const strong = articleEl.querySelector('strong');
    if (strong) return strong.textContent.trim();
    return '';
  }

  function normalize(s) {
    return s.replace(/\s+/g, ' ').trim();
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  //  Main: find next post, open modal, scrape, close
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  async function scrapeNextPost(seenIds, existingPermalinks) {
    const seen = new Set(seenIds || []);
    const existing = new Set(existingPermalinks || []);

    const found = await findNextPostLink(seen);
    if (!found) return { postId: null, post: null };

    let { link, groupSlug, postId, strategy } = found;

    if (!groupSlug) {
      const pageMatch = window.location.href.match(/\/groups\/([^/?#]+)/);
      if (pageMatch) groupSlug = pageMatch[1];
    }

    console.log(`[Scraper] Opening post: ${postId || '(Strategy 2, ID from modal)'}`);

    // Scroll to element
    link.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(1000);

    // Click to open modal
    link.click();
    await sleep(2500);

    // Wait for dialog
    let dialog = null;
    for (let w = 0; w < 20; w++) {
      dialog = document.querySelector('[role="dialog"]');
      if (dialog) break;
      await sleep(500);
    }

    // If no dialog and we have alternative click targets (Strategy 2), try them
    if (!dialog && found.altLinks && found.altLinks.length > 0) {
      console.log(`[Scraper] Primary click failed, trying ${found.altLinks.length} alternatives...`);
      for (const alt of found.altLinks) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
        await sleep(500);
        alt.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(800);
        alt.click();
        await sleep(2500);
        for (let w = 0; w < 10; w++) {
          dialog = document.querySelector('[role="dialog"]');
          if (dialog) break;
          await sleep(500);
        }
        if (dialog) {
          console.log('[Scraper] Dialog opened via alternative click target');
          break;
        }
      }
    }

    if (!dialog) {
      console.log('[Scraper] No dialog opened after all attempts');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
      await sleep(500);
      return { postId: postId || '__nodialog_' + Date.now(), post: null };
    }

    console.log('[Scraper] Dialog opened');
    await sleep(800);

    // Extract post ID from dialog if we don't have one (Strategy 2)
    if (!postId) {
      for (const a of dialog.querySelectorAll('a[href]')) {
        const m = a.href.match(/\/groups\/([^/?#]+)\/(?:posts|permalink)\/([\w]+)/);
        if (m) {
          groupSlug = m[1];
          postId = m[2];
          console.log(`[Scraper] Extracted post ID from modal: ${postId}`);
          break;
        }
      }
      if (!postId) {
        postId = '__s2_' + Date.now();
        console.log(`[Scraper] No post ID in modal, using temp: ${postId}`);
      }
      if (seen.has(postId)) {
        console.log('[Scraper] Already seen after modal extract:', postId);
        closeDialog(dialog);
        return { postId, post: null, skipped: true };
      }
    }

    // Build permalink
    const pathType = postId.startsWith('pfbid') ? 'permalink' : 'posts';
    const postUrl = (groupSlug && !postId.startsWith('__'))
      ? `https://www.facebook.com/groups/${groupSlug}/${pathType}/${postId}/`
      : '';

    // Dedup check
    if (postUrl && existing.has(postUrl)) {
      console.log('[Scraper] Already in database:', postId);
      closeDialog(dialog);
      return { postId, post: null, skipped: true };
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    //  SCRAPE THE DIALOG
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    const post = {
      permalink: postUrl,
      text: '',
      author: '',
      timestamp: '',
      images: [],
      reactions: '',
      comments: []
    };

    const commentArticles = [...dialog.querySelectorAll('[role="article"]')];

    // â”€â”€ AUTHOR â”€â”€
    const titleEl = dialog.querySelector('h2');
    if (titleEl) {
      const t = titleEl.textContent.trim();
      const m = t.match(/^(.+?)(?:'s|'s)\s+Post$/i);
      if (m) post.author = m[1].trim();
    }
    if (!post.author) {
      for (const a of dialog.querySelectorAll('a[role="link"]')) {
        if (isInsideComment(a, commentArticles)) continue;
        const strong = a.querySelector('strong');
        if (strong) {
          const name = strong.textContent.trim();
          if (name.length > 1 && name.length < 80) { post.author = name; break; }
        }
      }
    }

    // â”€â”€ TIMESTAMP â”€â”€
    for (const a of dialog.querySelectorAll('a[href]')) {
      if (isInsideComment(a, commentArticles)) continue;
      const t = a.textContent.trim();
      if (t === post.author || !t || t.length > 50) continue;
      if (/ago|hour|min|just|yesterday|\d{4}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d+[hdwmy]/i.test(t)) {
        post.timestamp = t;
        break;
      }
    }

    // â”€â”€ POST TEXT â”€â”€
    const allDirAuto = [...dialog.querySelectorAll('div[dir="auto"]')];
    const textSet = new Set();
    for (const el of allDirAuto) {
      if (isInsideComment(el, commentArticles)) continue;
      if (el.querySelector('div[dir="auto"]')) continue;
      const t = el.innerText.trim();
      const norm = normalize(t);
      if (norm.length > 1 && !UI_WORDS.has(norm.toLowerCase()) && !/^\d+$/.test(norm) && !textSet.has(norm)) {
        textSet.add(norm);
      }
    }
    post.text = [...textSet].join('\n').trim();

    // â”€â”€ IMAGES â”€â”€
    for (const img of dialog.querySelectorAll('img[src*="scontent"]')) {
      if (isInsideComment(img, commentArticles)) continue;
      if (!post.images.includes(img.src)) post.images.push(img.src);
    }

    // â”€â”€ REACTIONS â”€â”€
    for (const el of dialog.querySelectorAll('[aria-label]')) {
      if (isInsideComment(el, commentArticles)) continue;
      const label = el.getAttribute('aria-label');
      if (label && (/reaction/i.test(label) || /\d+\s+(people|person)/i.test(label))) {
        post.reactions = label;
        break;
      }
    }

    // â”€â”€ SWITCH TO ALL COMMENTS â”€â”€
    for (const btn of dialog.querySelectorAll('[role="button"]')) {
      const t = btn.textContent.trim().toLowerCase();
      if (t === 'most relevant' || t === 'top comments' || t === 'newest first') {
        btn.click();
        await sleep(1000);
        for (const item of document.querySelectorAll('[role="menuitem"], [role="option"]')) {
          if (item.textContent.trim().toLowerCase() === 'all comments') {
            item.click();
            await sleep(2000);
            break;
          }
        }
        break;
      }
    }

    // â”€â”€ EXPAND COMMENTS + REPLIES â”€â”€
    for (let round = 0; round < 30; round++) {
      let clicked = false;
      for (const btn of dialog.querySelectorAll('[role="button"]')) {
        const t = btn.textContent.trim().toLowerCase();
        if (
          t.includes('view more comment') || t.includes('view more repl') ||
          t.includes('view previous') || t.includes('view all') ||
          /^view \d+ repl/.test(t) || /^\d+ more comment/.test(t) ||
          /^view \d+ more comment/.test(t)
        ) {
          btn.scrollIntoView({ block: 'center' });
          await sleep(400);
          btn.click();
          clicked = true;
          await sleep(1500);
          break;
        }
      }
      if (!clicked) break;
    }

    // Expand "See more"
    for (const btn of dialog.querySelectorAll('[role="button"]')) {
      if (btn.textContent.trim().toLowerCase() === 'see more') {
        btn.click();
        await sleep(150);
      }
    }

    // â”€â”€ SCRAPE COMMENTS â”€â”€
    const finalArticles = dialog.querySelectorAll('[role="article"]');
    console.log(`[Scraper] ${finalArticles.length} comment articles`);

    for (const c of finalArticles) {
      const cAuthor = getCommentAuthor(c);
      const cTexts = [];
      for (const el of c.querySelectorAll('div[dir="auto"]')) {
        if (el.querySelector('div[dir="auto"]')) continue;
        const t = el.innerText.trim();
        if (t.length > 1 && t !== cAuthor && !UI_WORDS.has(t.toLowerCase()) && !cTexts.includes(t)) {
          cTexts.push(t);
        }
      }
      const parentArticle = c.parentElement?.closest('[role="article"]');
      const isReply = !!(parentArticle && parentArticle !== c);
      let timestamp = '';
      const timeEl = c.querySelector('a[href*="comment_id"]');
      if (timeEl) {
        for (const s of timeEl.querySelectorAll('span')) {
          const t = s.textContent.trim();
          if (/^\d+[hdwmy]$/.test(t) || /ago$/i.test(t)) { timestamp = t; break; }
        }
        if (!timestamp) timestamp = timeEl.textContent.trim();
      }
      // Capture images in comments (photos people posted as replies)
      const cImages = [];
      for (const img of c.querySelectorAll('img[src*="scontent"]')) {
        if (!cImages.includes(img.src)) cImages.push(img.src);
      }

      if (cAuthor || cTexts.length > 0 || cImages.length > 0) {
        const comment = { author: cAuthor, text: cTexts.join(' ').trim(), timestamp, isReply };
        if (cImages.length > 0) comment.images = cImages;
        post.comments.push(comment);
      }
    }

    console.log(`[Scraper] "${post.text.substring(0, 50)}" by ${post.author} | ${post.comments.length} comments`);

    // â”€â”€ CLOSE MODAL â”€â”€
    closeDialog(dialog);

    return { postId, post };
  }

  function closeDialog(dialog) {
    const closeBtn = dialog.querySelector('[aria-label="Close"]') ||
                     document.querySelector('[aria-label="Close"]');
    if (closeBtn) {
      closeBtn.click();
    } else {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
    }
    // Ensure dialog is gone
    setTimeout(() => {
      for (let i = 0; i < 10; i++) {
        if (!document.querySelector('[role="dialog"]')) break;
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
      }
    }, 1200);
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  //  Message listener
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'SCRAPE_NEXT_POST') {
      scrapeNextPost(msg.seenIds, msg.existingPermalinks)
        .then(r => sendResponse(r))
        .catch(e => { console.error('[Scraper]', e); sendResponse({ postId: null, post: null }); });
      return true;
    }
  });

  console.log('[Scraper] Ready on:', window.location.href);
})();
