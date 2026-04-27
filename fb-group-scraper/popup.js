document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);

  // Elements
  const groupIdInput = $('groupId');
  const csvFileInput = $('csvFile');
  const fileUploadBtn = $('fileUploadBtn');
  const fileNameSpan = $('fileName');
  const minDelayInput = $('minDelay');
  const maxDelayInput = $('maxDelay');
  const pageLoadDelayInput = $('pageLoadDelay');
  const startFromInput = $('startFrom');
  const expandCommentsToggle = $('expandComments');
  const collectReactionsToggle = $('collectReactions');
  const btnStart = $('btnStart');
  const btnPause = $('btnPause');
  const btnStop = $('btnStop');
  const btnExport = $('btnExport');
  const statusText = $('statusText');
  const membersLoaded = $('membersLoaded');
  const currentMember = $('currentMember');
  const membersDone = $('membersDone');
  const postsScraped = $('postsScraped');
  const commentsCollected = $('commentsCollected');
  const logBox = $('logBox');

  let members = [];

  // Load saved state
  chrome.storage.local.get(['groupId', 'members', 'scrapedData', 'stats'], (data) => {
    if (data.groupId) groupIdInput.value = data.groupId;
    if (data.members) {
      members = data.members;
      membersLoaded.textContent = members.length;
    }
    if (data.stats) {
      membersDone.textContent = `${data.stats.membersDone || 0} / ${members.length}`;
      postsScraped.textContent = data.stats.postsScraped || 0;
      commentsCollected.textContent = data.stats.commentsCollected || 0;
    }
  });

  // File upload
  fileUploadBtn.addEventListener('click', () => csvFileInput.click());
  csvFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    fileNameSpan.textContent = file.name;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const lines = ev.target.result.split('\n').filter(l => l.trim());
      const header = lines[0].split(',').map(h => h.trim().toLowerCase());
      const uidIdx = header.indexOf('user_id');
      const nameIdx = header.indexOf('name');
      if (uidIdx === -1 || nameIdx === -1) {
        addLog('CSV must have user_id and name columns', 'error');
        return;
      }
      members = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());
        if (cols[uidIdx]) {
          members.push({ userId: cols[uidIdx], name: cols[nameIdx] || 'Unknown' });
        }
      }
      membersLoaded.textContent = members.length;
      membersDone.textContent = `0 / ${members.length}`;
      chrome.storage.local.set({ members });
      addLog(`Loaded ${members.length} members from CSV`, 'info');
    };
    reader.readAsText(file);
  });

  // Start
  btnStart.addEventListener('click', () => {
    const groupId = groupIdInput.value.trim();
    if (!groupId) { addLog('Enter a group ID', 'error'); return; }
    if (members.length === 0) { addLog('Upload a CSV first', 'error'); return; }

    const config = {
      groupId,
      members,
      minDelay: parseInt(minDelayInput.value) || 600,
      maxDelay: parseInt(maxDelayInput.value) || 1500,
      pageLoadDelay: parseInt(pageLoadDelayInput.value) || 3000,
      startFrom: parseInt(startFromInput.value) || 1,
      expandComments: expandCommentsToggle.checked,
      collectReactions: collectReactionsToggle.checked
    };

    chrome.storage.local.set({ groupId, config });
    chrome.runtime.sendMessage({ action: 'START_SCRAPING', config });

    statusText.textContent = 'Running...';
    btnStart.style.display = 'none';
    btnPause.style.display = 'block';
    btnStop.style.display = 'block';
    addLog('Scraping started', 'info');
  });

  // Pause
  btnPause.addEventListener('click', () => {
    const isPaused = btnPause.textContent.includes('Resume');
    chrome.runtime.sendMessage({ action: isPaused ? 'RESUME' : 'PAUSE' });
    btnPause.textContent = isPaused ? '⏸ Pause' : '▶ Resume';
    statusText.textContent = isPaused ? 'Running...' : 'Paused';
    addLog(isPaused ? 'Resumed' : 'Paused', 'warn');
  });

  // Stop
  btnStop.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'STOP' });
    resetUI();
    addLog('Stopped', 'warn');
  });

  // Export
  btnExport.addEventListener('click', () => {
    chrome.storage.local.get(['scrapedData'], (data) => {
      const scrapedData = data.scrapedData || [];
      if (scrapedData.length === 0) { addLog('No data to export', 'warn'); return; }
      const blob = new Blob([JSON.stringify(scrapedData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      chrome.downloads.download({
        url,
        filename: `fb_group_posts_${Date.now()}.json`,
        saveAs: true
      });
      addLog(`Exported ${scrapedData.length} posts`, 'info');
    });
  });

  // Listen for status updates from background
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'STATUS_UPDATE') {
      if (msg.currentMember) currentMember.textContent = msg.currentMember;
      if (msg.membersDone !== undefined) membersDone.textContent = `${msg.membersDone} / ${members.length}`;
      if (msg.postsScraped !== undefined) postsScraped.textContent = msg.postsScraped;
      if (msg.commentsCollected !== undefined) commentsCollected.textContent = msg.commentsCollected;
      if (msg.status) statusText.textContent = msg.status;
    }
    if (msg.action === 'LOG') {
      addLog(msg.text, msg.level || 'info');
    }
    if (msg.action === 'SCRAPING_COMPLETE') {
      resetUI();
      addLog('All members processed!', 'info');
    }
  });

  function resetUI() {
    statusText.textContent = 'Idle';
    btnStart.style.display = 'block';
    btnPause.style.display = 'none';
    btnStop.style.display = 'none';
    btnPause.textContent = '⏸ Pause';
  }

  function addLog(text, level = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${level}`;
    const time = new Date().toLocaleTimeString();
    entry.textContent = `[${time}] ${text}`;
    logBox.appendChild(entry);
    logBox.scrollTop = logBox.scrollHeight;
  }
});
