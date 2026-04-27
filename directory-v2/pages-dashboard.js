// Main dashboard (index.html) — landing page with overview stats and links.
const { CSS, navHtml, esc, slug } = require('./shared-styles');

function buildDashboard(people, stats, catCounts) {
  // Top 10 categories by offering people
  const topOffering = catCounts.sort((a, b) => b.offering - a.offering).slice(0, 10);

  // Recent activity — last 20 people who posted
  const recent = [...people]
    .filter(p => p.lastSeen)
    .sort((a, b) => (b.lastSeen || '').localeCompare(a.lastSeen || ''))
    .slice(0, 20);

  const categoryLinks = catCounts
    .filter(c => c.people > 0)
    .sort((a, b) => b.people - a.people)
    .map(c => `<a href="categories/${slug(c.category)}.html" class="trade">${esc(c.category)} (${c.people})</a>`)
    .join(' ');

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Hispanos FB Directory — Dashboard</title>
<style>${CSS}
.hero{background:linear-gradient(135deg,#1a2744 0%,#2a1f44 100%);padding:40px 20px;border-radius:16px;margin-bottom:24px;text-align:center}
.hero h2{font-size:2rem;color:#fff;margin-bottom:8px}
.hero p{color:#b48eff;font-size:1rem}
.quick-links{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:24px}
.ql{background:#11141d;border:1px solid #1f2432;border-radius:10px;padding:20px;text-decoration:none;color:inherit;transition:all .2s}
.ql:hover{border-color:#4da3ff;background:#161a24;text-decoration:none}
.ql .icon{font-size:1.8rem;margin-bottom:8px}
.ql h3{color:#fff;font-size:1rem;margin-bottom:6px}
.ql p{color:#8b92a3;font-size:.8rem}
</style></head><body>
<div class="topbar">
  <div><h1>Hispanos Facebook Directory</h1><div class="sub">${stats.totalPeople.toLocaleString()} people · ${stats.totalPosts.toLocaleString()} posts · ${stats.totalComments.toLocaleString()} comments</div></div>
  ${navHtml('index.html')}
</div>
<div class="wrap">
  <div class="hero">
    <h2>Your Community Intelligence Hub</h2>
    <p>Every member, every post, every phone number — searchable and cross-referenced.</p>
  </div>

  <div class="stats">
    <div class="stat"><div class="n">${stats.totalPeople.toLocaleString()}</div><div class="l">People Indexed</div></div>
    <div class="stat"><div class="n">${stats.peopleWithPosts.toLocaleString()}</div><div class="l">Active Posters</div></div>
    <div class="stat"><div class="n">${stats.peopleOffering.toLocaleString()}</div><div class="l">Offering Services</div></div>
    <div class="stat"><div class="n">${stats.peopleWithPhones.toLocaleString()}</div><div class="l">With Phone Numbers</div></div>
    <div class="stat"><div class="n">${stats.uniquePhones.toLocaleString()}</div><div class="l">Unique Phone #s</div></div>
    <div class="stat"><div class="n">${stats.totalPosts.toLocaleString()}</div><div class="l">Posts Captured</div></div>
    <div class="stat"><div class="n">${stats.totalComments.toLocaleString()}</div><div class="l">Comments Captured</div></div>
    <div class="stat"><div class="n">${stats.categories}</div><div class="l">Service Categories</div></div>
  </div>

  <h2 class="sec">Quick Access</h2>
  <div class="quick-links">
    <a class="ql" href="directory.html"><div class="icon">👥</div><h3>Full Directory</h3><p>Browse every person with full post & comment history. Search, filter, export.</p></a>
    <a class="ql" href="phones.html"><div class="icon">📞</div><h3>Phone Lookup</h3><p>Reverse-search any phone number. See who shares numbers (referrals).</p></a>
    <a class="ql" href="categories/index.html"><div class="icon">🔧</div><h3>By Category</h3><p>One page per trade: painters, plumbers, food, etc. Shareable links.</p></a>
    <a class="ql" href="businesses.html"><div class="icon">🏪</div><h3>Top Businesses</h3><p>Most-active posters — the community's anchor businesses.</p></a>
  </div>

  <h2 class="sec">Top Categories (by people offering services)</h2>
  <div style="margin-bottom:24px">
    <table>
      <thead><tr><th>Category</th><th>Offering</th><th>Total People</th><th>Link</th></tr></thead>
      <tbody>
        ${topOffering.map(c => `<tr>
          <td><strong>${esc(c.category)}</strong></td>
          <td style="color:#4ae0a0;font-weight:600">${c.offering}</td>
          <td>${c.people}</td>
          <td><a href="categories/${slug(c.category)}.html">View →</a></td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>

  <h2 class="sec">All Categories</h2>
  <div class="trades" style="margin-bottom:24px">${categoryLinks}</div>

  <h2 class="sec">Most Recently Active (last 20 people who posted)</h2>
  <div class="list">
    ${recent.map(p => {
      const cls = p.offersService ? 'offer' : p.seeksService ? 'seek' : '';
      const tradesHtml = p.trades.slice(0, 4).map(t =>
        `<span class="trade ${t.primaryIntent === 'offering' ? 'offering' : t.primaryIntent === 'seeking' ? 'seeking' : ''}">${esc(t.category)}</span>`).join('');
      const phonesHtml = p.phones.length
        ? `<div class="phones">${p.phones.slice(0, 2).map(ph => `<span class="phone"><a href="tel:${esc(ph.normalized)}">${esc(ph.normalized)}</a></span>`).join('')}</div>` : '';
      return `<div class="card ${cls}"><div class="card-head">
        <div class="avatar">${esc((p.name || '?').split(' ').map(x => x[0]).filter(Boolean).slice(0, 2).join('').toUpperCase())}</div>
        <div class="head-body">
          <div class="name">${esc(p.name)} <a href="${esc(p.profileUrl)}" target="_blank" style="font-size:.75rem;margin-left:6px">FB ↗</a></div>
          <div class="meta"><span>📝 ${p.totalPosts}</span><span>💬 ${p.totalComments}</span><span>🕒 ${(p.lastSeen || '').slice(0, 10)}</span></div>
          ${tradesHtml ? `<div class="trades">${tradesHtml}</div>` : ''}
          ${phonesHtml}
        </div>
      </div></div>`;
    }).join('')}
  </div>
</div></body></html>`;
}

module.exports = { buildDashboard };
