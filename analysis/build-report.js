// Generates analysis/report.html — a side-by-side view of raw posts vs AI analysis.
const fs = require('fs');
const path = require('path');

const db = require('../hispanos members facebook/database_posts.json');
const an = require('./analysis-db.json');

const posts = db.posts;
const results = an.results;

// Build enriched rows (merge post + analysis)
const rows = [];
for (const id of Object.keys(results)) {
  const p = posts[id];
  const r = results[id];
  if (!p) continue;
  rows.push({
    id,
    date: (p.timestamp || '').slice(0, 10),
    author: p.authorName || '',
    text: p.message || '',
    imgs: (p.images || []).length,
    rx: (p.reactions && p.reactions.total) || 0,
    comments: (p.comments || []).slice(0, 5).map(c => ({ by: c.author || '', text: c.text || '' })),
    url: p.permalink || '',
    r,
    auto: !!r._auto,
  });
}
// Chronological
rows.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

// Stats
const total = rows.length;
const totalPosts = Object.keys(posts).length;
const autoN = rows.filter(r => r.auto).length;
const aiN = total - autoN;
const counter = (fn) => {
  const m = {};
  rows.forEach(x => {
    const v = fn(x);
    if (v == null) return;
    if (Array.isArray(v)) v.forEach(k => m[k] = (m[k] || 0) + 1);
    else m[v] = (m[v] || 0) + 1;
  });
  return m;
};
const intents = counter(x => x.r.intent);
const cats = counter(x => x.r.cats);
const langs = counter(x => x.r.lang);
const urgencies = counter(x => x.r.urgency);
const resolutions = counter(x => x.r.resolution);
const years = counter(x => (x.date || '').slice(0, 4) || null);
const phonesSet = new Set();
rows.forEach(x => (x.r.phones || []).forEach(p => phonesSet.add(p)));
const withPhoneN = rows.filter(x => (x.r.phones || []).length).length;

// Build HTML
const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const barRow = (title, obj, max = 12) => {
  const entries = Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, max);
  const top = entries[0] ? entries[0][1] : 1;
  return `<div class="bars"><h3>${esc(title)}</h3>${entries.map(([k, v]) => `
    <div class="bar-row"><span class="bar-label">${esc(k)}</span>
      <span class="bar"><span class="bar-fill" style="width:${(v / top * 100).toFixed(1)}%"></span></span>
      <span class="bar-val">${v}</span></div>`).join('')}</div>`;
};

const rowCard = (x, idx) => {
  const r = x.r;
  const commentsHtml = x.comments.length
    ? `<details class="cmts"><summary>${x.comments.length} comment${x.comments.length === 1 ? '' : 's'}</summary>${x.comments.map(c => `<div class="cmt"><b>${esc(c.by)}:</b> ${esc(c.text)}</div>`).join('')}</details>`
    : '';
  const badge = (label, cls) => `<span class="badge ${cls}">${esc(label)}</span>`;
  const intentCls = { offering: 'green', seeking: 'blue', personal: 'gray', event: 'purple', news: 'red', informational: 'teal', spam: 'orange', lost_found: 'yellow', other: 'gray' }[r.intent] || 'gray';
  return `
  <div class="card" data-intent="${esc(r.intent)}" data-lang="${esc(r.lang)}" data-biz="${r.isBusiness}" data-auto="${x.auto}" data-cats="${esc((r.cats||[]).join('|'))}" data-urg="${esc(r.urgency||'')}" data-res="${esc(r.resolution||'')}" data-year="${esc((x.date||'').slice(0,4))}" data-phone="${(r.phones||[]).length?'1':'0'}" data-conf="${r.conf||0}" data-date="${esc(x.date||'')}">
    <div class="left">
      <div class="meta">
        <span class="date">${esc(x.date || '—')}</span>
        <span class="author">${esc(x.author)}</span>
        ${x.imgs ? `<span class="tag">🖼 ${x.imgs}</span>` : ''}
        ${x.rx ? `<span class="tag">❤ ${x.rx}</span>` : ''}
        <a class="fblink" href="${esc(x.url)}" target="_blank" rel="noopener">FB↗</a>
      </div>
      <div class="text">${x.text ? esc(x.text) : '<i class="empty">(no text — image only)</i>'}</div>
      ${commentsHtml}
    </div>
    <div class="right">
      <div class="badges">
        ${badge(r.intent, intentCls)}
        ${r.isBusiness ? badge('BUSINESS', 'biz') : ''}
        ${x.auto ? badge('AUTO', 'auto') : ''}
        ${badge(r.lang, 'lang')}
        ${r.urgency ? badge(r.urgency, 'urg') : ''}
      </div>
      ${r.svc ? `<div class="svc">${esc(r.svc)}</div>` : ''}
      ${r.bname ? `<div class="kv"><b>Business:</b> ${esc(r.bname)}</div>` : ''}
      ${r.loc ? `<div class="kv"><b>Location:</b> ${esc(r.loc)}</div>` : ''}
      ${r.price ? `<div class="kv"><b>Price:</b> ${esc(r.price)}</div>` : ''}
      ${(r.cats && r.cats.length) ? `<div class="cats">${r.cats.map(c => `<span class="cat">${esc(c)}</span>`).join('')}</div>` : ''}
      ${(r.phones && r.phones.length) ? `<div class="phones">📞 ${r.phones.map(p => `<code>${esc(p)}</code>`).join(' ')}</div>` : ''}
      <div class="sum">${esc(r.sum)}</div>
      <div class="footer">
        <span class="resolution">${esc(r.resolution)}</span>
        <span class="conf" data-conf="${r.conf}">conf ${r.conf}</span>
      </div>
    </div>
  </div>`;
};

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Hispanos Analysis Report — ${total.toLocaleString()} posts</title>
<style>
* { box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; background: #0f172a; color: #e2e8f0; }
header { background: linear-gradient(135deg, #1e293b, #334155); padding: 24px 32px; border-bottom: 1px solid #475569; position: sticky; top: 0; z-index: 10; }
h1 { margin: 0 0 4px; font-size: 22px; }
.sub { color: #94a3b8; font-size: 13px; }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; padding: 20px 32px; background: #1e293b; border-bottom: 1px solid #334155; }
.stat { background: #0f172a; padding: 14px 16px; border-radius: 8px; border: 1px solid #334155; }
.stat-val { font-size: 26px; font-weight: 700; color: #38bdf8; }
.stat-lbl { font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
.charts { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; padding: 20px 32px; background: #1e293b; border-bottom: 1px solid #334155; }
.bars h3 { margin: 0 0 10px; font-size: 13px; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.5px; }
.bar-row { display: grid; grid-template-columns: 140px 1fr 40px; align-items: center; gap: 8px; margin-bottom: 4px; font-size: 12px; }
.bar-label { color: #cbd5e1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bar { background: #0f172a; border-radius: 3px; height: 14px; overflow: hidden; }
.bar-fill { display: block; height: 100%; background: linear-gradient(90deg, #38bdf8, #6366f1); }
.bar-val { text-align: right; color: #94a3b8; font-variant-numeric: tabular-nums; }

.filters { padding: 16px 32px; background: #1e293b; border-bottom: 1px solid #334155; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; position: sticky; top: 73px; z-index: 9; }
.filters > input, .filters > select, .filters > button { background: #0f172a; color: #e2e8f0; border: 1px solid #334155; border-radius: 6px; padding: 7px 11px; font-size: 13px; }
.filters > input#q { flex: 1; min-width: 220px; }
.filters select { cursor: pointer; }
.filters button { cursor: pointer; }
.filters button:hover { background: #1e293b; border-color: #475569; }
.filter-count { color: #94a3b8; font-size: 12px; margin-left: auto; font-weight: 600; }

.multi { position: relative; }
.multi-btn { background: #0f172a; color: #e2e8f0; border: 1px solid #334155; border-radius: 6px; padding: 7px 11px; font-size: 13px; cursor: pointer; min-width: 150px; text-align: left; display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.multi-btn:hover { border-color: #475569; }
.multi-btn .chev { color: #64748b; font-size: 10px; }
.multi-btn.active { border-color: #38bdf8; color: #38bdf8; }
.multi-panel { display: none; position: absolute; top: calc(100% + 4px); left: 0; background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 8px; z-index: 20; width: 300px; max-height: 400px; overflow-y: auto; overflow-x: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
.multi-panel.open { display: block; }
.multi-panel::-webkit-scrollbar { width: 8px; }
.multi-panel::-webkit-scrollbar-track { background: transparent; }
.multi-panel::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
.multi-panel .mp-search { width: 100%; margin-bottom: 6px; background: #1e293b; color: #e2e8f0; border: 1px solid #334155; border-radius: 5px; padding: 6px 10px; font-size: 12px; outline: none; }
.multi-panel .mp-search:focus { border-color: #38bdf8; }
.multi-panel .mp-actions { display: flex; gap: 6px; margin-bottom: 6px; }
.multi-panel .mp-actions button { flex: 1; background: #1e293b; color: #94a3b8; border: 1px solid #334155; border-radius: 4px; padding: 5px 8px; font-size: 11px; cursor: pointer; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }
.multi-panel .mp-actions button:hover { color: #38bdf8; border-color: #38bdf8; }
.multi-panel label { display: flex; align-items: center; gap: 10px; padding: 6px 8px; font-size: 12.5px; color: #cbd5e1; cursor: pointer; border-radius: 4px; user-select: none; }
.multi-panel label:hover { background: #1e293b; color: #e2e8f0; }
.multi-panel label.hidden { display: none; }
.multi-panel label.checked { background: #172033; color: #38bdf8; }
.multi-panel label > input[type=checkbox] { flex: 0 0 auto; accent-color: #38bdf8; cursor: pointer; margin: 0; width: 14px; height: 14px; }
.multi-panel label > .mp-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; }
.multi-panel label > .mp-count { flex: 0 0 auto; color: #64748b; font-size: 11px; font-variant-numeric: tabular-nums; background: #1e293b; padding: 1px 7px; border-radius: 10px; min-width: 28px; text-align: center; }
.multi-panel label.checked .mp-count { background: #0c4a6e; color: #7dd3fc; }

.list { padding: 20px 32px; display: flex; flex-direction: column; gap: 14px; }
.card { display: grid; grid-template-columns: 1.2fr 1fr; gap: 0; background: #1e293b; border: 1px solid #334155; border-radius: 10px; overflow: hidden; }
.card .left { padding: 16px; border-right: 1px solid #334155; }
.card .right { padding: 16px; background: #172033; }
.meta { display: flex; gap: 10px; align-items: center; margin-bottom: 10px; font-size: 12px; color: #94a3b8; flex-wrap: wrap; }
.date { background: #0f172a; padding: 3px 8px; border-radius: 4px; font-variant-numeric: tabular-nums; }
.author { color: #e2e8f0; font-weight: 600; }
.tag { color: #94a3b8; }
.fblink { color: #38bdf8; text-decoration: none; font-size: 11px; }
.fblink:hover { text-decoration: underline; }
.text { color: #f1f5f9; line-height: 1.5; font-size: 13.5px; white-space: pre-wrap; word-break: break-word; }
.empty { color: #64748b; }
.cmts { margin-top: 12px; font-size: 12.5px; color: #cbd5e1; }
.cmts summary { cursor: pointer; color: #94a3b8; user-select: none; }
.cmt { padding: 6px 0 6px 14px; border-left: 2px solid #334155; margin-top: 6px; }
.cmt b { color: #cbd5e1; }

.badges { display: flex; gap: 6px; margin-bottom: 10px; flex-wrap: wrap; }
.badge { font-size: 10.5px; padding: 3px 8px; border-radius: 999px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; background: #334155; color: #e2e8f0; }
.badge.green { background: #064e3b; color: #6ee7b7; }
.badge.blue { background: #1e3a8a; color: #93c5fd; }
.badge.red { background: #7f1d1d; color: #fca5a5; }
.badge.purple { background: #4c1d95; color: #c4b5fd; }
.badge.teal { background: #134e4a; color: #5eead4; }
.badge.orange { background: #7c2d12; color: #fdba74; }
.badge.yellow { background: #713f12; color: #fcd34d; }
.badge.gray { background: #334155; color: #cbd5e1; }
.badge.biz { background: #b45309; color: #fef3c7; }
.badge.auto { background: #475569; color: #94a3b8; }
.badge.lang { background: #0c4a6e; color: #7dd3fc; }
.badge.urg { background: #581c87; color: #d8b4fe; }

.svc { font-size: 15px; font-weight: 600; color: #fbbf24; margin-bottom: 8px; }
.kv { font-size: 12.5px; color: #cbd5e1; margin: 2px 0; }
.kv b { color: #94a3b8; font-weight: 500; }
.cats { display: flex; gap: 5px; flex-wrap: wrap; margin: 8px 0; }
.cat { background: #1e3a8a; color: #bfdbfe; font-size: 11px; padding: 2px 8px; border-radius: 4px; }
.phones { margin: 8px 0; font-size: 12.5px; }
.phones code { background: #0f172a; color: #6ee7b7; padding: 2px 6px; border-radius: 3px; font-size: 12px; margin: 0 2px; }
.sum { margin-top: 10px; padding-top: 10px; border-top: 1px dashed #334155; color: #e2e8f0; font-size: 13px; line-height: 1.45; font-style: italic; }
.footer { display: flex; justify-content: space-between; margin-top: 10px; font-size: 11px; color: #64748b; }
.conf { font-variant-numeric: tabular-nums; }
.conf[data-conf="0.99"], .conf[data-conf^="0.95"], .conf[data-conf^="0.96"], .conf[data-conf^="0.97"], .conf[data-conf^="0.98"] { color: #6ee7b7; }
.conf[data-conf^="0.5"], .conf[data-conf^="0.6"] { color: #fdba74; }

.card.hidden { display: none; }
@media (max-width: 900px) { .card { grid-template-columns: 1fr; } .card .left { border-right: none; border-bottom: 1px solid #334155; } .charts { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<header>
  <h1>Hispanos FB Group — Analysis Report</h1>
  <div class="sub">${total.toLocaleString()} posts analyzed out of ${totalPosts.toLocaleString()} total · Generated ${new Date().toISOString().slice(0, 19).replace('T', ' ')}</div>
</header>

<div class="stats">
  <div class="stat"><div class="stat-val">${total.toLocaleString()}</div><div class="stat-lbl">Analyzed</div></div>
  <div class="stat"><div class="stat-val">${aiN.toLocaleString()}</div><div class="stat-lbl">AI-Analyzed</div></div>
  <div class="stat"><div class="stat-val">${autoN.toLocaleString()}</div><div class="stat-lbl">Auto-Tagged (empty)</div></div>
  <div class="stat"><div class="stat-val">${rows.filter(r => r.r.isBusiness).length}</div><div class="stat-lbl">Business Posts</div></div>
  <div class="stat"><div class="stat-val">${phonesSet.size}</div><div class="stat-lbl">Unique Phones</div></div>
  <div class="stat"><div class="stat-val">${withPhoneN.toLocaleString()}</div><div class="stat-lbl">Posts With Phone</div></div>
  <div class="stat"><div class="stat-val">${(totalPosts - total).toLocaleString()}</div><div class="stat-lbl">Remaining</div></div>
</div>

<div class="charts">
  ${barRow('Intent', intents)}
  ${barRow('Top Categories', cats, 10)}
  ${barRow('Language', langs)}
</div>

<div class="filters">
  <input id="q" placeholder="Search text, author, business, location, phone…" />
  <div class="multi" data-multi="intent">
    <button class="multi-btn" type="button"><span class="mb-label">All intents</span><span class="chev">▾</span></button>
    <div class="multi-panel">
      <input class="mp-search" placeholder="Search intents…" />
      <div class="mp-actions"><button type="button" data-act="all">All</button><button type="button" data-act="none">None</button></div>
      ${Object.keys(intents).sort().map(i => `<label><input type="checkbox" value="${esc(i)}"><span class="mp-name">${esc(i)}</span><span class="mp-count">${intents[i]}</span></label>`).join('')}
    </div>
  </div>
  <div class="multi" data-multi="cat">
    <button class="multi-btn" type="button"><span class="mb-label">All categories</span><span class="chev">▾</span></button>
    <div class="multi-panel">
      <input class="mp-search" placeholder="Search categories…" />
      <div class="mp-actions"><button type="button" data-act="all">All</button><button type="button" data-act="none">None</button></div>
      ${Object.keys(cats).sort().map(c => `<label><input type="checkbox" value="${esc(c)}"><span class="mp-name">${esc(c)}</span><span class="mp-count">${cats[c]}</span></label>`).join('')}
    </div>
  </div>
  <select id="lang"><option value="">All languages</option>${Object.keys(langs).sort().map(l => `<option value="${esc(l)}">${esc(l)} (${langs[l]})</option>`).join('')}</select>
  <select id="year"><option value="">All years</option>${Object.keys(years).sort().map(y => `<option value="${esc(y)}">${esc(y)} (${years[y]})</option>`).join('')}</select>
  <select id="urg"><option value="">Any urgency</option>${Object.keys(urgencies).sort().map(u => `<option value="${esc(u)}">${esc(u)} (${urgencies[u]})</option>`).join('')}</select>
  <select id="res"><option value="">Any resolution</option>${Object.keys(resolutions).sort().map(u => `<option value="${esc(u)}">${esc(u)} (${resolutions[u]})</option>`).join('')}</select>
  <select id="biz"><option value="">All</option><option value="true">Business only</option><option value="false">Non-business</option></select>
  <select id="phone"><option value="">Phone?</option><option value="1">Has phone</option><option value="0">No phone</option></select>
  <select id="auto"><option value="">All</option><option value="false">AI-analyzed only</option><option value="true">Auto-tagged only</option></select>
  <select id="conf"><option value="">Any confidence</option><option value="0.9">≥ 0.90</option><option value="0.8">≥ 0.80</option><option value="0.7">≥ 0.70</option><option value="0.5">≥ 0.50</option></select>
  <select id="sort"><option value="date-asc">Date ↑</option><option value="date-desc">Date ↓</option><option value="conf-desc">Confidence ↓</option><option value="conf-asc">Confidence ↑</option></select>
  <button id="reset" class="btn">Reset</button>
  <span class="filter-count" id="fc">${total} shown</span>
</div>

<div class="list" id="list">
  ${rows.map((x, i) => rowCard(x, i)).join('')}
</div>

<script>
const q = document.getElementById('q');
const sLang = document.getElementById('lang');
const sYear = document.getElementById('year');
const sUrg = document.getElementById('urg');
const sRes = document.getElementById('res');
const sBiz = document.getElementById('biz');
const sPhone = document.getElementById('phone');
const sAuto = document.getElementById('auto');
const sConf = document.getElementById('conf');
const sSort = document.getElementById('sort');
const btnReset = document.getElementById('reset');
const fc = document.getElementById('fc');
const list = document.getElementById('list');
const cards = [...document.querySelectorAll('.card')];

// Multi-select setup
const multiState = {}; // { intent: Set<string>, cat: Set<string> }
document.querySelectorAll('.multi').forEach(m => {
  const key = m.dataset.multi;
  multiState[key] = new Set();
  const btn = m.querySelector('.multi-btn');
  const panel = m.querySelector('.multi-panel');
  const label = m.querySelector('.mb-label');
  const search = m.querySelector('.mp-search');
  const checks = [...m.querySelectorAll('input[type=checkbox]')];
  const allLabel = { intent: 'All intents', cat: 'All categories' }[key] || 'All';

  const refreshLabel = () => {
    const n = multiState[key].size;
    if (n === 0) { label.textContent = allLabel; btn.classList.remove('active'); }
    else if (n === 1) { label.textContent = [...multiState[key]][0]; btn.classList.add('active'); }
    else { label.textContent = n + ' selected'; btn.classList.add('active'); }
  };

  btn.addEventListener('click', e => {
    e.stopPropagation();
    document.querySelectorAll('.multi-panel.open').forEach(p => { if (p !== panel) p.classList.remove('open'); });
    panel.classList.toggle('open');
  });
  panel.addEventListener('click', e => e.stopPropagation());
  checks.forEach(cb => cb.addEventListener('change', () => {
    if (cb.checked) multiState[key].add(cb.value);
    else multiState[key].delete(cb.value);
    cb.closest('label').classList.toggle('checked', cb.checked);
    refreshLabel(); apply();
  }));
  search.addEventListener('input', () => {
    const t = search.value.toLowerCase();
    m.querySelectorAll('label').forEach(lbl => {
      const v = lbl.querySelector('input').value.toLowerCase();
      lbl.classList.toggle('hidden', t && !v.includes(t));
    });
  });
  m.querySelector('[data-act=all]').addEventListener('click', () => {
    checks.forEach(cb => {
      const lbl = cb.closest('label');
      if (!lbl.classList.contains('hidden')) { cb.checked = true; multiState[key].add(cb.value); lbl.classList.add('checked'); }
    });
    refreshLabel(); apply();
  });
  m.querySelector('[data-act=none]').addEventListener('click', () => {
    checks.forEach(cb => { cb.checked = false; cb.closest('label').classList.remove('checked'); });
    multiState[key].clear();
    refreshLabel(); apply();
  });
});
document.addEventListener('click', () => {
  document.querySelectorAll('.multi-panel.open').forEach(p => p.classList.remove('open'));
});

function apply() {
  const t = q.value.toLowerCase().trim();
  const intentSel = multiState.intent, catSel = multiState.cat;
  const l = sLang.value, y = sYear.value;
  const u = sUrg.value, res = sRes.value, b = sBiz.value, p = sPhone.value, a = sAuto.value;
  const minConf = parseFloat(sConf.value) || 0;
  let shown = 0;
  for (const c of cards) {
    let ok = true;
    if (intentSel.size && !intentSel.has(c.dataset.intent)) ok = false;
    if (ok && catSel.size) {
      const cs = (c.dataset.cats || '').split('|');
      ok = cs.some(x => catSel.has(x));
    }
    if (ok && l && c.dataset.lang !== l) ok = false;
    if (ok && y && c.dataset.year !== y) ok = false;
    if (ok && u && c.dataset.urg !== u) ok = false;
    if (ok && res && c.dataset.res !== res) ok = false;
    if (ok && b && c.dataset.biz !== b) ok = false;
    if (ok && p && c.dataset.phone !== p) ok = false;
    if (ok && a && c.dataset.auto !== a) ok = false;
    if (ok && minConf && parseFloat(c.dataset.conf) < minConf) ok = false;
    if (ok && t) ok = c.textContent.toLowerCase().includes(t);
    c.classList.toggle('hidden', !ok);
    if (ok) shown++;
  }
  fc.textContent = shown.toLocaleString() + ' / ' + cards.length.toLocaleString() + ' shown';
}

function sortCards() {
  const [key, dir] = sSort.value.split('-');
  const mul = dir === 'desc' ? -1 : 1;
  const sorted = [...cards].sort((a, b) => {
    const av = key === 'conf' ? parseFloat(a.dataset.conf) : a.dataset.date;
    const bv = key === 'conf' ? parseFloat(b.dataset.conf) : b.dataset.date;
    if (av < bv) return -1 * mul;
    if (av > bv) return 1 * mul;
    return 0;
  });
  const frag = document.createDocumentFragment();
  sorted.forEach(c => frag.appendChild(c));
  list.appendChild(frag);
}

const filterEls = [q, sLang, sYear, sUrg, sRes, sBiz, sPhone, sAuto, sConf];
filterEls.forEach(el => el.addEventListener('input', apply));
sSort.addEventListener('change', sortCards);
btnReset.addEventListener('click', () => {
  filterEls.forEach(el => { el.value = ''; });
  document.querySelectorAll('.multi input[type=checkbox]').forEach(cb => { cb.checked = false; cb.closest('label').classList.remove('checked'); });
  Object.values(multiState).forEach(s => s.clear());
  document.querySelectorAll('.multi').forEach(m => {
    const key = m.dataset.multi;
    const allLabel = { intent: 'All intents', cat: 'All categories' }[key] || 'All';
    m.querySelector('.mb-label').textContent = allLabel;
    m.querySelector('.multi-btn').classList.remove('active');
  });
  apply();
});
</script>
</body>
</html>`;

const outPath = path.join(__dirname, 'report.html');
fs.writeFileSync(outPath, html, 'utf8');
console.log(`✓ Wrote ${outPath}`);
console.log(`  ${total.toLocaleString()} posts · ${(fs.statSync(outPath).size / 1024).toFixed(0)} KB`);
