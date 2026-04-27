// Phone lookup — clear answer to "whose phone is this?"
//
// For each phone number we classify each member's relationship:
//   OWNER      — posted this number in their OWN post (it's their contact)
//   REFERRER   — only typed this number in comments (recommending someone)
//
// The owner's name is prominent; referrers are listed below as "also mentioned by".

const { CSS, navHtml, esc } = require('./shared-styles');

function classifyRelation(sources) {
  // Any source that is type 'post' → OWNER (they put it in their own post)
  if (sources.some(s => s.type === 'post')) return 'owner';
  // Otherwise only-commented → REFERRER
  return 'referrer';
}

function buildPhonesPage(people) {
  const phoneMap = new Map();

  for (const p of people) {
    for (const ph of p.phones) {
      if (!phoneMap.has(ph.digits)) {
        phoneMap.set(ph.digits, {
          normalized: ph.normalized,
          digits: ph.digits,
          members: [],     // each { relation, person, sources, primaryExcerpt }
        });
      }
      const rec = phoneMap.get(ph.digits);
      const sources = (ph.sources || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      const relation = classifyRelation(sources);
      // Pick the best excerpt to show up front
      const primary = sources.find(s => s.type === 'post') || sources[0] || null;

      rec.members.push({
        userId: p.userId, name: p.name, profileUrl: p.profileUrl,
        bio: p.bio || '',
        totalPosts: p.totalPosts, totalComments: p.totalComments,
        trades: p.trades.slice(0, 5).map(t => t.category),
        topTrade: p.topTrade || '',
        offersService: p.offersService,
        lastSeen: p.lastSeen,
        relation,
        sources,
        primary,
      });
    }
  }

  // For each phone: sort members — owners first (by post count), then referrers (by date)
  for (const rec of phoneMap.values()) {
    rec.members.sort((a, b) => {
      if (a.relation !== b.relation) return a.relation === 'owner' ? -1 : 1;
      if (a.relation === 'owner') return b.totalPosts - a.totalPosts;
      return (b.primary?.date || '').localeCompare(a.primary?.date || '');
    });
    rec.owners = rec.members.filter(m => m.relation === 'owner');
    rec.referrers = rec.members.filter(m => m.relation === 'referrer');
    // Services offered by owners (primary) — else by referrers
    const tradeSet = new Set();
    const src = rec.owners.length ? rec.owners : rec.referrers;
    for (const m of src) for (const t of m.trades) tradeSet.add(t);
    rec.services = [...tradeSet];
  }

  const allPhones = [...phoneMap.values()];
  const withOwner = allPhones.filter(ph => ph.owners.length > 0);
  const noOwner = allPhones.filter(ph => ph.owners.length === 0);
  const shared = allPhones.filter(ph => ph.members.length >= 2);
  const singleMember = allPhones.filter(ph => ph.members.length === 1);

  // Category filter options
  const catCounts = new Map();
  for (const ph of allPhones) for (const s of ph.services) catCounts.set(s, (catCounts.get(s) || 0) + 1);
  const sortedCats = [...catCounts.entries()].sort((a, b) => b[1] - a[1]);

  // Compact client-side index
  const idx = allPhones.map(ph => ({
    d: ph.digits, n: ph.normalized,
    s: ph.services,
    o: ph.owners.map(m => compactMember(m)),
    r: ph.referrers.map(m => compactMember(m)),
  }));

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Phone Lookup — Who owns this number?</title>
<style>${CSS}
.big-search{font-size:1.1rem;padding:14px 18px;margin-bottom:14px}
.filter-row{display:grid;grid-template-columns:1fr auto auto;gap:10px;margin-bottom:16px}
.filter-row select{background:#161a24;border:1px solid #242a38;color:#e4e6eb;padding:10px 14px;border-radius:8px;font-size:.9rem;outline:none;cursor:pointer}
.filter-row select:focus{border-color:#4da3ff}

.pcard{background:#11141d;border:1px solid #1f2432;border-radius:12px;margin-bottom:14px;overflow:hidden}
.pcard-head{padding:16px 20px;background:#0d1019;border-bottom:1px solid #1f2432;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px}
.pnum{font-size:1.5rem;font-weight:700;color:#4ae0a0;font-family:ui-monospace,SF Mono,Consolas,monospace}
.pnum a{color:inherit;text-decoration:none}
.services{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.svc{font-size:.72rem;padding:3px 10px;border-radius:12px;background:#1a2744;color:#4da3ff;border:1px solid #2c3f5e}
.call-btn{background:#1f5540;color:#4ae0a0;padding:6px 14px;border-radius:8px;text-decoration:none;font-weight:600;font-size:.85rem}
.call-btn:hover{background:#2a7055;text-decoration:none;color:#4ae0a0}

.section-label{padding:10px 20px 4px;font-size:.7rem;text-transform:uppercase;letter-spacing:.8px;color:#8b92a3;font-weight:600;display:flex;align-items:center;gap:8px}
.section-label.owner{color:#4ae0a0}
.section-label.referrer{color:#f0a84a}
.section-label .count{background:#1a1f2c;color:#cdd3e0;padding:1px 8px;border-radius:8px;font-size:.7rem;text-transform:none;letter-spacing:0;font-weight:500}

.member{padding:12px 20px;border-top:1px solid #1a1f2c;display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:flex-start}
.member:first-of-type{border-top:none}
.avatar{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#4da3ff,#b48eff);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:.9rem;flex-shrink:0}
.member.owner .avatar{background:linear-gradient(135deg,#4ae0a0,#3cb381)}
.member.referrer .avatar{background:linear-gradient(135deg,#f0a84a,#c48530)}
.member-body{min-width:0}
.member-name{font-size:1rem;font-weight:600;color:#fff;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.member-name a{color:inherit}
.relation-badge{font-size:.65rem;font-weight:700;padding:2px 8px;border-radius:10px;text-transform:uppercase;letter-spacing:.4px}
.relation-badge.owner{background:#1f5540;color:#4ae0a0}
.relation-badge.referrer{background:#55401f;color:#f0a84a}
.member-trades{font-size:.78rem;color:#cdd3e0;margin-top:3px}
.member-trades .lbl{color:#8b92a3}
.member-evidence{margin-top:8px;font-size:.82rem;color:#cdd3e0;background:#0d1019;border:1px solid #1a1f2c;border-left:2px solid #4ae0a0;padding:8px 12px;border-radius:4px;line-height:1.5}
.member.referrer .member-evidence{border-left-color:#f0a84a}
.member-evidence mark{background:#1f5540;color:#4ae0a0;padding:0 4px;border-radius:3px;font-weight:700}
.member-evidence .em{color:#8b92a3;font-size:.72rem;display:block;margin-top:6px}
.member-evidence .em a{color:#4da3ff}
.show-more{font-size:.72rem;color:#4da3ff;cursor:pointer;margin-top:6px;display:inline-block;user-select:none}
.show-more:hover{text-decoration:underline}
.extra-mentions{display:none;margin-top:6px}
.extra-mentions.open{display:block}
.mini-src{font-size:.75rem;color:#8b92a3;padding:6px 10px;background:#0b0d14;border-radius:4px;margin-top:4px;border-left:2px solid #2d3548}
.mini-src .tag{display:inline-block;padding:1px 6px;border-radius:6px;background:#1a1f2c;color:#cdd3e0;font-size:.62rem;text-transform:uppercase;margin-right:6px;font-weight:600}
.mini-src .tag.comment{background:#2a1f44;color:#b48eff}
.mini-src a{color:#4da3ff}

.tabs{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap}
.tab{padding:8px 14px;background:#161a24;border:1px solid #242a38;border-radius:6px;cursor:pointer;font-size:.82rem;color:#cdd3e0;white-space:nowrap}
.tab.on{background:#1a2744;color:#4da3ff;border-color:#4da3ff}
.export{padding:8px 14px;background:#1d2535;border:1px solid #2d3548;color:#cdd3e0;border-radius:6px;cursor:pointer;font-size:.82rem}
.export:hover{background:#26304a;color:#fff}
@media (max-width:700px){.filter-row{grid-template-columns:1fr}}
</style></head><body>
<div class="topbar">
  <div><h1>Phone Lookup</h1><div class="sub">${allPhones.length.toLocaleString()} numbers · ${withOwner.length.toLocaleString()} have identified owners · ${noOwner.length.toLocaleString()} only mentioned in comments</div></div>
  ${navHtml('phones.html')}
</div>
<div class="wrap">
  <div class="stats">
    <div class="stat"><div class="n">${allPhones.length.toLocaleString()}</div><div class="l">Total phones</div></div>
    <div class="stat"><div class="n">${withOwner.length.toLocaleString()}</div><div class="l">Has owner (posted it)</div></div>
    <div class="stat"><div class="n">${noOwner.length.toLocaleString()}</div><div class="l">Only referred</div></div>
    <div class="stat"><div class="n">${shared.length.toLocaleString()}</div><div class="l">Multiple members</div></div>
    <div class="stat"><div class="n">${singleMember.length.toLocaleString()}</div><div class="l">Single member</div></div>
  </div>

  <div class="filter-row">
    <input type="text" class="search big-search" id="q" placeholder="Search phone or name (e.g., 318..., Juan)..." style="margin:0">
    <select id="catSel">
      <option value="">All services</option>
      ${sortedCats.map(([c, n]) => `<option value="${esc(c)}">${esc(c)} (${n})</option>`).join('')}
    </select>
    <button class="export" onclick="exportCsv()">Export CSV</button>
  </div>

  <div class="tabs">
    <div class="tab on" data-tab="all">All (${allPhones.length.toLocaleString()})</div>
    <div class="tab" data-tab="owned">With owner (${withOwner.length.toLocaleString()})</div>
    <div class="tab" data-tab="refonly">Referred only (${noOwner.length.toLocaleString()})</div>
    <div class="tab" data-tab="shared">Shared by 2+ (${shared.length.toLocaleString()})</div>
  </div>

  <div id="results"></div>
  <div id="empty" style="display:none;padding:40px;text-align:center;color:#8b92a3">No matches.</div>
  <div id="pager" style="padding:16px;text-align:center"></div>
</div>

<script>
const P=${JSON.stringify(idx)};
const PER=40;let page=1,tab='all',q='',cat='',filt=[];
function esc(s){if(s==null)return '';const d=document.createElement('div');d.textContent=s;return d.innerHTML}
function initials(n){return (n||'?').split(' ').map(x=>x[0]).filter(Boolean).slice(0,2).join('').toUpperCase()}
function highlight(txt,digits){
  const hl=esc(txt);
  const re=new RegExp('('+digits.slice(0,3)+'[^<]{0,3}'+digits.slice(3,6)+'[^<]{0,3}'+digits.slice(6)+')','g');
  return hl.replace(re,'<mark>$1</mark>');
}
function renderMember(m,digits,relation){
  const relLabel=relation==='owner'?'POSTED THEIR OWN NUMBER':'RECOMMENDED IT';
  const tradeStr=m.t&&m.t.length?'<div class="member-trades"><span class="lbl">Works in:</span> '+m.t.map(x=>esc(x)).join(' · ')+'</div>':'';
  const p=m.p;
  let evidenceHtml='';
  if(p){
    const src=relation==='referrer'&&p.pa?'on <strong>'+esc(p.pa)+"</strong>'s post":(p.t==='post'?'in their own post':'in a comment');
    evidenceHtml='<div class="member-evidence">'+highlight(p.x||'',digits)+
      '<span class="em">'+esc(p.t==='post'?'POST':'COMMENT')+' '+src+' · '+esc(p.d||'')+(p.l?' · <a href="'+esc(p.l)+'" target="_blank">View on FB ↗</a>':'')+'</span></div>';
  }
  const extras=(m.s||[]).slice(1,20);
  const extrasHtml=extras.length?'<span class="show-more" onclick="toggleExtras(this)">+ '+extras.length+' more mention'+(extras.length>1?'s':'')+' ▼</span>'+
    '<div class="extra-mentions">'+extras.map(s=>{
      const ctx=s.t==='post'?'in their own post':(s.pa?'on '+esc(s.pa)+"'s post":'in a comment');
      return '<div class="mini-src"><span class="tag '+s.t+'">'+s.t+'</span>'+esc(s.d)+' · '+ctx+(s.l?' · <a href="'+esc(s.l)+'" target="_blank">FB ↗</a>':'')+'<div style="margin-top:4px;color:#cdd3e0">'+highlight(s.x||'',digits)+'</div></div>';
    }).join('')+'</div>':'';
  return '<div class="member '+relation+'">'+
    '<div class="avatar">'+esc(initials(m.n))+'</div>'+
    '<div class="member-body">'+
      '<div class="member-name"><a href="'+esc(m.u)+'" target="_blank">'+esc(m.n)+'</a>'+
        '<span class="relation-badge '+relation+'">'+relLabel+'</span>'+
      '</div>'+
      tradeStr+
      evidenceHtml+
      extrasHtml+
    '</div>'+
  '</div>';
}
function apply(){
  const qq=q.toLowerCase().trim();
  const qDigits=qq.replace(/\\D/g,'');
  filt=P.filter(p=>{
    const members=p.o.concat(p.r);
    if(tab==='owned'&&p.o.length===0)return false;
    if(tab==='refonly'&&p.o.length>0)return false;
    if(tab==='shared'&&members.length<2)return false;
    if(cat&&!p.s.includes(cat))return false;
    if(qq){
      const hay=(p.d+' '+p.n+' '+members.map(m=>m.n+' '+(m.t||[]).join(' ')).join(' ')).toLowerCase();
      const ok=hay.indexOf(qq)>=0 || (qDigits.length>=3 && p.d.indexOf(qDigits)>=0);
      if(!ok)return false;
    }
    return true;
  });
  filt.sort((a,b)=>{
    // Owners first, then by total member count
    if((b.o.length>0?1:0)!==(a.o.length>0?1:0))return (b.o.length>0?1:0)-(a.o.length>0?1:0);
    return (b.o.length+b.r.length)-(a.o.length+a.r.length);
  });
  page=1;render();
}
function render(){
  const tot=Math.ceil(filt.length/PER)||1;
  const slice=filt.slice((page-1)*PER,page*PER);
  const r=document.getElementById('results');
  const emp=document.getElementById('empty');
  if(!slice.length){r.innerHTML='';emp.style.display='block';document.getElementById('pager').innerHTML='';return}
  emp.style.display='none';
  r.innerHTML=slice.map(p=>{
    const servicesHtml=p.s.length?'<div class="services">'+p.s.map(x=>'<span class="svc">'+esc(x)+'</span>').join('')+'</div>':'';
    const ownersHtml=p.o.length?
      '<div class="section-label owner">✓ Owner'+(p.o.length>1?'s':'')+' <span class="count">'+p.o.length+'</span></div>'+
      p.o.map(m=>renderMember(m,p.d,'owner')).join(''):'';
    const refsHtml=p.r.length?
      '<div class="section-label referrer">⤷ Also mentioned by <span class="count">'+p.r.length+'</span></div>'+
      p.r.map(m=>renderMember(m,p.d,'referrer')).join(''):'';
    return '<div class="pcard">'+
      '<div class="pcard-head">'+
        '<div><div class="pnum">'+esc(p.n)+'</div>'+servicesHtml+'</div>'+
        '<a class="call-btn" href="tel:'+esc(p.n)+'">📞 Call</a>'+
      '</div>'+
      ownersHtml+refsHtml+
    '</div>';
  }).join('');
  document.getElementById('pager').innerHTML=tot>1?
    '<button onclick="go(1)"'+(page<=1?' disabled':'')+' class="export" style="margin:0 4px">« First</button>'+
    '<button onclick="go('+(page-1)+')"'+(page<=1?' disabled':'')+' class="export" style="margin:0 4px">‹ Prev</button>'+
    '<span style="margin:0 14px;color:#8b92a3">Page '+page+' of '+tot+' · '+filt.length.toLocaleString()+' phones</span>'+
    '<button onclick="go('+(page+1)+')"'+(page>=tot?' disabled':'')+' class="export" style="margin:0 4px">Next ›</button>'+
    '<button onclick="go('+tot+')"'+(page>=tot?' disabled':'')+' class="export" style="margin:0 4px">Last »</button>':
    '<span style="color:#8b92a3">'+filt.length.toLocaleString()+' phones</span>';
}
function go(p){page=p;render();window.scrollTo({top:0,behavior:'smooth'})}
function toggleExtras(el){
  const nx=el.nextElementSibling;
  const open=nx.classList.toggle('open');
  el.innerHTML=open?el.innerHTML.replace('+','−').replace('▼','▲'):el.innerHTML.replace('−','+').replace('▲','▼');
}
function exportCsv(){
  const rows=['phone,digits,services,owners,referrers'];
  const esc2=s=>{s=String(s==null?'':s).replace(/"/g,'""').replace(/\\n/g,' ');return /[",]/.test(s)?'"'+s+'"':s};
  filt.forEach(p=>{
    rows.push([p.n,p.d,p.s.join('; '),p.o.map(m=>m.n).join('; '),p.r.map(m=>m.n).join('; ')].map(esc2).join(','));
  });
  const blob=new Blob([rows.join('\\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='phones-filtered.csv';a.click();
}
document.getElementById('q').addEventListener('input',e=>{q=e.target.value;apply()});
document.getElementById('catSel').addEventListener('change',e=>{cat=e.target.value;apply()});
document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',e=>{
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('on'));
  e.target.classList.add('on');tab=e.target.dataset.tab;apply();
}));
apply();
</script>
</body></html>`;
}

function compactMember(m) {
  return {
    i: m.userId, n: m.name, u: m.profileUrl,
    t: m.trades,
    p: m.primary ? {
      t: m.primary.type,
      l: m.primary.link || '',
      d: m.primary.date ? m.primary.date.slice(0, 10) : '',
      x: m.primary.excerpt || '',
      pa: m.primary.postAuthor || '',
    } : null,
    s: (m.sources || []).slice(1, 20).map(s => ({
      t: s.type,
      l: s.link || '',
      d: s.date ? s.date.slice(0, 10) : '',
      x: s.excerpt || '',
      pa: s.postAuthor || '',
    })),
  };
}

module.exports = { buildPhonesPage };
