/**
 * background.js
 *
 * Per member:
 *   1. Navigate to member page — stay there the whole time
 *   2. Loop: call SCRAPE_NEXT_POST (content script scrolls, opens modal, scrapes, closes modal)
 *   3. When no more posts found → next member
 */

let config = null;
let isPaused = false;
let shouldStop = false;
let tabId = null;
let stats = { membersDone: 0, postsScraped: 0, commentsCollected: 0 };

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'START_SCRAPING') {
    config = msg.config;
    shouldStop = false;
    isPaused = false;
    stats = { membersDone: 0, postsScraped: 0, commentsCollected: 0 };
    startScraping();
  }
  if (msg.action === 'PAUSE') isPaused = true;
  if (msg.action === 'RESUME') isPaused = false;
  if (msg.action === 'STOP') shouldStop = true;
  sendResponse({ ok: true });
  return true;
});

const sleep = ms => new Promise(r => setTimeout(r, ms));

function log(text, level = 'info') {
  console.log('[BG]', text);
  chrome.runtime.sendMessage({ action: 'LOG', text, level }).catch(() => {});
}

function status(data) {
  chrome.runtime.sendMessage({ action: 'STATUS_UPDATE', ...data }).catch(() => {});
}

function waitForTab(tid) {
  return new Promise(resolve => {
    const to = setTimeout(() => { chrome.tabs.onUpdated.removeListener(fn); resolve(); }, 30000);
    function fn(id, info) {
      if (id === tid && info.status === 'complete') {
        clearTimeout(to);
        chrome.tabs.onUpdated.removeListener(fn);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(fn);
  });
}

async function goTo(url) {
  await chrome.tabs.update(tabId, { url });
  await waitForTab(tabId);
  // Extra wait for FB's React rendering
  await sleep(config.pageLoadDelay || 3000);
}

async function inject(task, data = {}) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
      await sleep(400);
      const response = await chrome.tabs.sendMessage(tabId, { action: task, ...data });
      return response;
    } catch (e) {
      log(`Inject attempt ${attempt}: ${e.message}`, 'warn');
      if (attempt < 4) await sleep(1500 * attempt);
    }
  }
  log('Injection failed after 4 tries', 'error');
  return null;
}

async function waitWhilePaused() {
  while (isPaused && !shouldStop) await sleep(500);
}

async function autoSave(data) {
  try {
    const json = JSON.stringify(data, null, 2);
    const dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);
    const downloadId = await chrome.downloads.download({
      url: dataUrl,
      filename: 'fb_group_posts_database.json',
      saveAs: false,
      conflictAction: 'overwrite'
    });
    // Remove from download history to keep it clean
    setTimeout(() => chrome.downloads.erase({ id: downloadId }), 3000);
    log(`Auto-saved database to file (${data.length} posts)`);
  } catch (e) {
    log(`Auto-save error: ${e.message}`, 'warn');
  }
}

async function startScraping() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabId = tab.id;

  // Load existing data for dedup (don't clear — append to it)
  const stored = await chrome.storage.local.get(['scrapedData']);
  let scrapedData = stored.scrapedData || [];
  const existingPermalinks = scrapedData.map(p => p.permalink).filter(Boolean);
  log(`Existing database: ${existingPermalinks.length} posts (will skip duplicates)`);

  // Reset stats for this run
  await chrome.storage.local.remove(['stats']);

  const startIdx = (config.startFrom || 1) - 1;
  const members = config.members.slice(startIdx);
  log(`Starting: ${members.length} members from #${startIdx + 1}`);

  for (let i = 0; i < members.length; i++) {
    if (shouldStop) break;
    await waitWhilePaused();

    const m = members[i];
    const num = startIdx + i + 1;
    log(`─── #${num} ${m.name} ───`);
    status({ currentMember: `${m.name} (#${num})`, status: 'Loading member page...' });

    // Go to member's group page — stay here for ALL their posts
    await goTo(`https://www.facebook.com/groups/${config.groupId}/user/${m.userId}/`);
    if (shouldStop) break;

    const seenIds = [];
    let postCount = 0;
    let skippedCount = 0;

    // Loop: content script scrolls, opens post modal, scrapes, closes modal, returns data
    while (true) {
      if (shouldStop) break;
      await waitWhilePaused();

      status({ status: `${m.name}: post ${postCount + 1}...` });

      const result = await inject('SCRAPE_NEXT_POST', { seenIds, existingPermalinks });

      // No more posts on this member's page
      if (!result || !result.postId) {
        log(`No more posts for ${m.name} — scraped ${postCount}, skipped ${skippedCount}`);
        break;
      }

      seenIds.push(result.postId);

      // Post was already in database
      if (result.skipped) {
        skippedCount++;
        log(`  ⊘ Post ${result.postId} already in database, skipped`);
        continue;
      }

      postCount++;

      if (result.post) {
        result.post.memberId = m.userId;
        result.post.memberName = m.name;
        result.post.scrapedAt = new Date().toISOString();
        scrapedData.push(result.post);
        existingPermalinks.push(result.post.permalink);
        stats.postsScraped++;
        stats.commentsCollected += (result.post.comments || []).length;
        await chrome.storage.local.set({ scrapedData, stats });
        status({ postsScraped: stats.postsScraped, commentsCollected: stats.commentsCollected });
        const preview = (result.post.text || '(no text)').substring(0, 60);
        log(`  ✓ Post ${postCount}: "${preview}" | ${(result.post.comments || []).length} comments`);
      } else {
        log(`  ✗ Post ${postCount} (${result.postId}) scrape failed`, 'error');
      }

      // Small pause between posts (human-like)
      const delay = (config.minDelay || 600) + Math.random() * ((config.maxDelay || 1500) - (config.minDelay || 600));
      await sleep(delay);
    }

    stats.membersDone++;
    status({ membersDone: stats.membersDone });
    await chrome.storage.local.set({ stats });
    log(`Done: ${m.name} — ${postCount} posts, ${skippedCount} skipped`);

    // Auto-save database to file after each member
    await autoSave(scrapedData);

    // Pause between members
    if (i < members.length - 1 && !shouldStop) {
      await sleep((config.maxDelay || 1500) * 2);
    }
  }

  log('=== All done! ===');
  // Final save
  await autoSave(scrapedData);
  status({ status: 'Complete' });
  chrome.runtime.sendMessage({ action: 'SCRAPING_COMPLETE' }).catch(() => {});
}
