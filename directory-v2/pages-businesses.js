// Top Businesses page — the 100 most-active posters + engagement ranking.
const { CSS, navHtml, esc } = require('./shared-styles');

function buildBusinessesPage(people) {
  // Top 100 by post count
  const topPosters = [...people]
    .filter(p => p.totalPosts >= 5)
    .sort((a, b) => b.totalPosts - a.totalPosts)
    .slice(0, 100);

  // Top 50 by engagement (reactions per post)
  const topEngagement = [...people]
    .filter(p => p.totalPosts >= 5)
    .map(p => ({ ...p, engagement: p.totalReactions / Math.max(1, p.totalPosts) }))
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, 50);

  function row(p, extraCol) {
    const tradesHtml = p.trades.slice(0, 3).map(t =>
      `<span class="trade ${t.primaryIntent === 'offering' ? 'offering' : ''}">${esc(t.category)}</span>`).join(' ');
    const phonesHtml = p.phones.slice(0, 2).map(ph => `<a href="tel:${esc(ph.normalized)}" style="color:#4ae0a0;font-weight:600">${esc(ph.normalized)}</a>`).join(' ');
    return `<tr>
      <td><a href="${esc(p.profileUrl)}" target="_blank"><strong>${esc(p.name)}</strong></a></td>
      <td>${tradesHtml || '<span style="color:#555">—</span>'}</td>
      <td style="color:#4da3ff;font-weight:600">${p.totalPosts}</td>
      <td>${p.totalComments}</td>
      <td>${p.totalReactions}</td>
      ${extraCol !== undefined ? `<td style="color:#4ae0a0;font-weight:600">${extraCol}</td>` : ''}
      <td>${phonesHtml || '<span style="color:#555">—</span>'}</td>
      <td style="font-size:.75rem;color:#8b92a3">${(p.lastSeen || '').slice(0, 10)}</td>
    </tr>`;
  }

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Top Businesses — Hispanos FB Directory</title>
<style>${CSS}
.tabs{display:flex;gap:8px;margin-bottom:16px}
.tab{padding:8px 16px;background:#161a24;border:1px solid #242a38;border-radius:6px;cursor:pointer;font-size:.85rem;color:#cdd3e0}
.tab.on{background:#1a2744;color:#4da3ff;border-color:#4da3ff}
.panel{display:none}.panel.on{display:block}
table{background:#11141d;border-radius:10px;overflow:hidden}
td{vertical-align:top}
</style></head><body>
<div class="topbar">
  <div><h1>Top Businesses & Most-Active Members</h1><div class="sub">Ranked by post count, engagement, and reach</div></div>
  ${navHtml('businesses.html')}
</div>
<div class="wrap">
  <input type="text" class="search" id="q" placeholder="Search by name, trade, phone...">

  <div class="tabs">
    <div class="tab on" data-tab="posts">Most Posts (${topPosters.length})</div>
    <div class="tab" data-tab="engagement">Highest Engagement (${topEngagement.length})</div>
  </div>

  <div class="panel on" id="posts-panel">
    <table id="posts-table">
      <thead><tr><th>Name</th><th>Trades</th><th>Posts</th><th>Comments</th><th>Reactions</th><th>Phone</th><th>Last Active</th></tr></thead>
      <tbody>${topPosters.map(p => row(p)).join('')}</tbody>
    </table>
  </div>

  <div class="panel" id="engagement-panel">
    <table id="eng-table">
      <thead><tr><th>Name</th><th>Trades</th><th>Posts</th><th>Comments</th><th>Reactions</th><th>Rxn/Post</th><th>Phone</th><th>Last</th></tr></thead>
      <tbody>${topEngagement.map(p => row(p, p.engagement.toFixed(2))).join('')}</tbody>
    </table>
  </div>
</div>

<script>
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', e => {
  document.querySelectorAll('.tab').forEach(x => x.classList.remove('on'));
  document.querySelectorAll('.panel').forEach(x => x.classList.remove('on'));
  e.target.classList.add('on');
  document.getElementById(e.target.dataset.tab + '-panel').classList.add('on');
}));
document.getElementById('q').addEventListener('input', e => {
  const q = e.target.value.toLowerCase().trim();
  document.querySelectorAll('tbody tr').forEach(r => {
    r.classList.toggle('hidden', q && r.textContent.toLowerCase().indexOf(q) < 0);
  });
});
</script>
</body></html>`;
}

module.exports = { buildBusinessesPage };
