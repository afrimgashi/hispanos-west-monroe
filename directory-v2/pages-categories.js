// Per-category HTML pages — one shareable page per trade (painters.html, plumbers.html, etc.)
const { CSS, navHtml, esc, slug } = require('./shared-styles');

function buildCategoryPage(category, peopleInCategory, allCatCounts) {
  // Sort: offering first (by confidence), then unclear, then seeking
  const sorted = [...peopleInCategory].sort((a, b) => {
    const at = a.trades.find(t => t.category === category);
    const bt = b.trades.find(t => t.category === category);
    const ai = at?.primaryIntent === 'offering' ? 0 : at?.primaryIntent === 'seeking' ? 2 : 1;
    const bi = bt?.primaryIntent === 'offering' ? 0 : bt?.primaryIntent === 'seeking' ? 2 : 1;
    if (ai !== bi) return ai - bi;
    return (bt?.confidence || 0) - (at?.confidence || 0);
  });

  const offering = sorted.filter(p => p.trades.find(t => t.category === category)?.primaryIntent === 'offering');
  const seeking = sorted.filter(p => p.trades.find(t => t.category === category)?.primaryIntent === 'seeking');
  const unclear = sorted.filter(p => {
    const intent = p.trades.find(t => t.category === category)?.primaryIntent;
    return intent !== 'offering' && intent !== 'seeking';
  });

  const withPhone = sorted.filter(p => p.phones.length > 0);

  function renderPerson(p) {
    const trade = p.trades.find(t => t.category === category);
    const intent = trade?.primaryIntent || 'unclear';
    const cls = intent === 'offering' ? 'offer' : intent === 'seeking' ? 'seek' : '';
    const phonesHtml = p.phones.length
      ? `<div class="phones">${p.phones.map(ph => `<span class="phone"><a href="tel:${esc(ph.normalized)}">${esc(ph.normalized)}</a></span>`).join('')}</div>` : '';
    const otherTrades = p.trades.filter(t => t.category !== category).slice(0, 5);
    const evidenceExcerpt = trade?.evidence?.[0]?.excerpt?.slice(0, 280) || '';
    const evidenceLink = trade?.evidence?.[0]?.link || '';

    return `<div class="card ${cls}">
      <div class="card-head">
        <div class="avatar">${esc((p.name || '?').split(' ').map(x => x[0]).filter(Boolean).slice(0, 2).join('').toUpperCase())}</div>
        <div class="head-body">
          <div class="name">${esc(p.name)}
            <a href="${esc(p.profileUrl)}" target="_blank" style="font-size:.75rem;margin-left:6px">Facebook ↗</a>
            <span style="font-size:.7rem;color:#8b92a3;margin-left:8px">${intent === 'offering' ? '🟢 OFFERING' : intent === 'seeking' ? '🟡 SEEKING' : 'mentioned'} · ${((trade?.confidence || 0) * 100 | 0)}% confidence</span>
          </div>
          <div class="meta">
            <span>📝 ${p.totalPosts} posts</span>
            <span>💬 ${p.totalComments} comments</span>
            ${p.lastSeen ? `<span>🕒 ${p.lastSeen.slice(0, 10)}</span>` : ''}
          </div>
          ${phonesHtml}
          ${otherTrades.length ? `<div class="trades"><span style="font-size:.7rem;color:#8b92a3">Also:</span> ${otherTrades.map(t => `<span class="trade">${esc(t.category)}</span>`).join('')}</div>` : ''}
          ${evidenceExcerpt ? `<div class="excerpt">"${esc(evidenceExcerpt)}${evidenceExcerpt.length >= 280 ? '…' : ''}" ${evidenceLink ? `<a href="${esc(evidenceLink)}" target="_blank">View on FB ↗</a>` : ''}</div>` : ''}
          ${p.bio ? `<div class="bio">${esc(p.bio)}</div>` : ''}
        </div>
      </div>
    </div>`;
  }

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(category)} — Hispanos FB Directory</title>
<style>${CSS}
.cat-head{background:linear-gradient(135deg,#1a2744 0%,#2a1f44 100%);padding:32px 20px;border-radius:12px;margin-bottom:24px}
.cat-head h2{font-size:1.8rem;color:#fff;margin-bottom:8px}
.cat-head p{color:#cdd3e0;font-size:.9rem}
.section{margin-top:24px}
.section h3{color:#fff;margin-bottom:12px;display:flex;align-items:center;gap:10px}
.section h3 .count{font-size:.75rem;background:#1a2744;color:#4da3ff;padding:3px 10px;border-radius:10px}
</style></head><body>
<div class="topbar">
  <div><h1>${esc(category)}</h1><div class="sub"><a href="index.html" style="color:#8b92a3">← Dashboard</a> · <a href="index.html" style="color:#8b92a3">All categories</a></div></div>
  ${navHtml('categories/index.html').replace(/href="/g, 'href="../')}
</div>
<div class="wrap">
  <div class="cat-head">
    <h2>${esc(category)}</h2>
    <p>${sorted.length} people mentioned · ${offering.length} offering · ${seeking.length} seeking · ${withPhone.length} with phone numbers</p>
  </div>

  <input type="text" class="search" id="q" placeholder="Search name or phone within ${esc(category)}...">

  ${offering.length ? `<div class="section"><h3>🟢 Offering Services <span class="count">${offering.length}</span></h3>
    <div class="list" id="offer-list">${offering.map(renderPerson).join('')}</div></div>` : ''}

  ${unclear.length ? `<div class="section"><h3>Mentioned (intent unclear) <span class="count">${unclear.length}</span></h3>
    <div class="list" id="unclear-list">${unclear.map(renderPerson).join('')}</div></div>` : ''}

  ${seeking.length ? `<div class="section"><h3>🟡 Seeking Services <span class="count">${seeking.length}</span></h3>
    <div class="list" id="seek-list">${seeking.map(renderPerson).join('')}</div></div>` : ''}
</div>
<script>
document.getElementById('q').addEventListener('input', e => {
  const q = e.target.value.toLowerCase().trim();
  document.querySelectorAll('.card').forEach(c => {
    const txt = c.textContent.toLowerCase();
    c.classList.toggle('hidden', q && txt.indexOf(q) < 0);
  });
});
</script>
</body></html>`;
}

function buildCategoryIndex(catCounts) {
  const active = catCounts.filter(c => c.people > 0).sort((a, b) => b.offering - a.offering || b.people - a.people);

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Categories — Hispanos FB Directory</title>
<style>${CSS}
.cat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}
.cat-card{background:#11141d;border:1px solid #1f2432;border-radius:10px;padding:18px;text-decoration:none;color:inherit;transition:all .2s;display:block}
.cat-card:hover{border-color:#4da3ff;text-decoration:none;transform:translateY(-2px)}
.cat-card h3{color:#fff;font-size:1.05rem;margin-bottom:8px}
.cat-card .nums{display:flex;gap:14px;font-size:.78rem;color:#8b92a3}
.cat-card .nums b{color:#4ae0a0;font-size:1rem}
</style></head><body>
<div class="topbar">
  <div><h1>Service Categories</h1><div class="sub">${active.length} active categories · Click any category to see details</div></div>
  ${navHtml('categories/index.html').replace(/href="/g, 'href="../')}
</div>
<div class="wrap">
  <input type="text" class="search" id="q" placeholder="Search categories...">
  <div class="cat-grid" id="grid">
    ${active.map(c => `<a class="cat-card" href="${slug(c.category)}.html">
      <h3>${esc(c.category)}</h3>
      <div class="nums">
        <span><b>${c.offering}</b> offering</span>
        <span><b>${c.people}</b> total</span>
        <span><b>${c.withPhone}</b> with phone</span>
      </div>
    </a>`).join('')}
  </div>
</div>
<script>
document.getElementById('q').addEventListener('input', e => {
  const q = e.target.value.toLowerCase().trim();
  document.querySelectorAll('.cat-card').forEach(c => {
    c.classList.toggle('hidden', q && c.textContent.toLowerCase().indexOf(q) < 0);
  });
});
</script>
</body></html>`;
}

module.exports = { buildCategoryPage, buildCategoryIndex };
