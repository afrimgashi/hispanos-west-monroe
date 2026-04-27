// Builds the interactive directory.html viewer.
// Embeds compact person data as JSON + renders via client-side JS.

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function compact(people) {
  // Keys are single letters to shrink JSON. Client-side code decodes them.
  return people.map(p => ({
    i: p.userId,
    n: p.name,
    u: p.profileUrl,
    b: p.bio || '',
    jd: p.joinDate || '',
    rl: p.role || '',
    tp: p.totalPosts,
    tc: p.totalComments,
    tr: p.totalReactions,
    fs: p.firstSeen ? p.firstSeen.slice(0, 10) : '',
    ls: p.lastSeen ? p.lastSeen.slice(0, 10) : '',
    ph: p.phones.map(x => x.normalized),
    os: p.offersService ? 1 : 0,
    ss: p.seeksService ? 1 : 0,
    tt: p.topTrade || '',
    tcf: p.topTradeConfidence,
    td: p.trades.map(t => ({
      c: t.category, k: t.keywords, in: t.primaryIntent,
      cf: t.confidence, oc: t.offeringCount, sc: t.seekingCount,
    })),
    po: p.posts.map(pp => ({
      m: pp.message || '', t: pp.timestamp ? pp.timestamp.slice(0, 10) : '',
      l: pp.permalink || '', ic: pp.imageCount, rc: pp.reactions,
      cc: pp.commentCount, in: pp.intent,
    })),
    co: p.comments.map(cc => ({
      m: cc.text || '', t: cc.timestamp ? cc.timestamp.slice(0, 10) : '',
      l: cc.postPermalink || '', pa: cc.postAuthorName || '',
      rc: cc.reactionCount, ir: cc.isReply ? 1 : 0, in: cc.intent,
    })),
  }));
}

function buildHtml(people, stats) {
  const data = compact(people);
  const json = JSON.stringify(data);

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Hispanos Facebook Directory — Every Member, Every Post</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#0b0d14;color:#e4e6eb;line-height:1.5}
a{color:#4da3ff;text-decoration:none}a:hover{text-decoration:underline}
.topbar{position:sticky;top:0;z-index:10;background:#11141d;border-bottom:1px solid #222836;padding:14px 20px;box-shadow:0 2px 8px rgba(0,0,0,.3)}
.topbar h1{font-size:1.15rem;color:#fff;margin-bottom:2px}
.topbar .sub{font-size:.78rem;color:#8b92a3}
.stats{display:flex;gap:10px;padding:14px 20px;flex-wrap:wrap;background:#0d1019;border-bottom:1px solid #1a1f2c}
.stat{background:#161a24;border:1px solid #242a38;border-radius:8px;padding:8px 14px;min-width:130px}
.stat .n{font-size:1.2rem;font-weight:700;color:#4da3ff}
.stat .l{font-size:.7rem;color:#8b92a3;text-transform:uppercase;letter-spacing:.5px}
.controls{padding:14px 20px;background:#0d1019;border-bottom:1px solid #1a1f2c;display:grid;grid-template-columns:1fr auto auto auto auto;gap:10px;align-items:center}
.controls input,.controls select{background:#161a24;border:1px solid #242a38;color:#e4e6eb;padding:8px 12px;border-radius:6px;font-size:.88rem;outline:none}
.controls input:focus,.controls select:focus{border-color:#4da3ff}
.controls input[type=text]{min-width:0}
.controls button{background:#1d2535;border:1px solid #2d3548;color:#cdd3e0;padding:8px 14px;border-radius:6px;cursor:pointer;font-size:.82rem;white-space:nowrap}
.controls button:hover{background:#26304a;color:#fff}
.chips{padding:10px 20px;background:#0d1019;border-bottom:1px solid #1a1f2c;display:flex;flex-wrap:wrap;gap:6px}
.chip{padding:4px 12px;background:#161a24;border:1px solid #242a38;border-radius:14px;font-size:.74rem;color:#8b92a3;cursor:pointer}
.chip:hover{border-color:#4da3ff;color:#cdd3e0}
.chip.on{background:#1a2744;color:#4da3ff;border-color:#4da3ff}
.pager{padding:16px 20px;display:flex;justify-content:center;align-items:center;gap:8px;border-bottom:1px solid #1a1f2c;background:#0d1019}
.pager button{background:#1d2535;border:1px solid #2d3548;color:#cdd3e0;padding:6px 12px;border-radius:5px;cursor:pointer;font-size:.8rem}
.pager button:disabled{opacity:.4;cursor:not-allowed}
.pager .info{color:#8b92a3;font-size:.82rem;margin:0 10px}
.list{padding:16px 20px;display:flex;flex-direction:column;gap:10px}
.card{background:#11141d;border:1px solid #1f2432;border-radius:10px;overflow:hidden;transition:border-color .15s}
.card:hover{border-color:#2d3548}
.card.offer{border-left:3px solid #4ae0a0}
.card.seek{border-left:3px solid #f0a84a}
.card-head{padding:12px 16px;display:flex;gap:14px;align-items:flex-start;cursor:pointer}
.avatar{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#4da3ff,#b48eff);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:1.05rem;flex-shrink:0}
.head-body{flex:1;min-width:0}
.name-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:4px}
.name{font-size:1.02rem;font-weight:600;color:#fff}
.role{font-size:.68rem;background:#2a1f44;color:#b48eff;padding:1px 7px;border-radius:10px}
.meta{font-size:.75rem;color:#8b92a3;display:flex;gap:14px;flex-wrap:wrap;margin-bottom:6px}
.meta span{display:inline-flex;align-items:center;gap:4px}
.trades{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:6px}
.trade{font-size:.72rem;padding:3px 10px;border-radius:12px;background:#1a2744;color:#4da3ff;border:1px solid #2c3f5e}
.trade.offering{background:#0f2d22;color:#4ae0a0;border-color:#1f5540}
.trade.seeking{background:#2d220f;color:#f0a84a;border-color:#55401f}
.trade .cf{opacity:.6;font-size:.65rem;margin-left:4px}
.phones{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:4px}
.phone{font-size:.84rem;font-weight:600;color:#4ae0a0;padding:3px 10px;background:#0f2d22;border-radius:6px;border:1px solid #1f5540}
.bio{font-size:.78rem;color:#8b92a3;font-style:italic;margin-top:4px}
.expand{padding:0 16px 16px;display:none;border-top:1px solid #1f2432;margin-top:0}
.card.open .expand{display:block}
.expand-section{margin-top:14px}
.expand-section h4{font-size:.8rem;color:#8b92a3;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #1f2432}
.post-item,.cmt-item{padding:8px 12px;background:#0d1019;border:1px solid #1a1f2c;border-radius:6px;margin-bottom:6px;font-size:.82rem}
.post-item .head,.cmt-item .head{display:flex;justify-content:space-between;gap:10px;margin-bottom:4px;font-size:.72rem;color:#8b92a3}
.post-item .body,.cmt-item .body{color:#cdd3e0;white-space:pre-wrap;word-wrap:break-word}
.post-item.offer,.cmt-item.offer{border-left:2px solid #4ae0a0}
.post-item.seek,.cmt-item.seek{border-left:2px solid #f0a84a}
.img-badge{display:inline-block;padding:1px 6px;background:#1a2744;color:#4da3ff;border-radius:8px;font-size:.65rem;margin-left:4px}
.empty{padding:40px;text-align:center;color:#8b92a3}
.toggle{color:#4da3ff;font-size:.75rem;cursor:pointer;user-select:none}
.toggle:hover{text-decoration:underline}
.tag-dot{display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:4px}
.tag-offer{background:#4ae0a0}.tag-seek{background:#f0a84a}.tag-unclear{background:#8b92a3}.tag-mixed{background:#b48eff}
@media (max-width:900px){.controls{grid-template-columns:1fr 1fr}}
@media (max-width:600px){.stats .stat{min-width:100px}.controls{grid-template-columns:1fr}}
</style></head><body>
<div class="topbar">
  <h1>Hispanos Facebook Directory</h1>
  <div class="sub">${stats.totalPeople.toLocaleString()} people &middot; ${stats.totalPosts.toLocaleString()} posts &middot; ${stats.totalComments.toLocaleString()} comments &middot; Generated ${new Date().toISOString().slice(0, 10)}</div>
</div>
<div class="stats">
  <div class="stat"><div class="n">${stats.totalPeople.toLocaleString()}</div><div class="l">People indexed</div></div>
  <div class="stat"><div class="n">${stats.peopleWithPosts.toLocaleString()}</div><div class="l">Active posters</div></div>
  <div class="stat"><div class="n">${stats.peopleWithPhones.toLocaleString()}</div><div class="l">With phone #</div></div>
  <div class="stat"><div class="n">${stats.peopleOffering.toLocaleString()}</div><div class="l">Offering services</div></div>
  <div class="stat"><div class="n">${stats.uniquePhones.toLocaleString()}</div><div class="l">Unique phones</div></div>
  <div class="stat"><div class="n">${stats.categories}</div><div class="l">Categories</div></div>
</div>
<div class="controls">
  <input type="text" id="q" placeholder="Search name, phone, keyword, message text...">
  <select id="cat"><option value="">All categories</option></select>
  <select id="intent"><option value="">Any intent</option><option value="offering">Offering only</option><option value="seeking">Seeking only</option></select>
  <select id="filt"><option value="">All people</option><option value="phone">Has phone</option><option value="active">Active posters</option></select>
  <button onclick="exportCsv()">Export CSV</button>
</div>
<div class="chips" id="chips"></div>
<div class="pager" id="pagerTop"></div>
<div class="list" id="list"></div>
<div class="pager" id="pagerBot"></div>

<script>
const D=__DATA__;
const PER_PAGE=50;
let page=1, filtered=D, activeCat='', activeIntent='', activeFilter='', q='';

const catCounts={};
D.forEach(p=>p.td.forEach(t=>{catCounts[t.c]=(catCounts[t.c]||0)+1}));
const catSorted=Object.entries(catCounts).sort((a,b)=>b[1]-a[1]);
const catSel=document.getElementById('cat');
catSorted.forEach(([c,n])=>{const o=document.createElement('option');o.value=c;o.textContent=c+' ('+n+')';catSel.appendChild(o)});

function esc(s){if(s==null)return '';const d=document.createElement('div');d.textContent=s;return d.innerHTML}
function initials(n){return (n||'?').split(' ').map(x=>x[0]).filter(Boolean).slice(0,2).join('').toUpperCase()}
function tradeBadge(t){
  const cls=t.in==='offering'?'offering':t.in==='seeking'?'seeking':'';
  return '<span class="trade '+cls+'">'+esc(t.c)+'<span class="cf">'+(t.cf*100|0)+'%</span></span>';
}
function intentDot(i){
  const m={offering:'tag-offer',seeking:'tag-seek',mixed:'tag-mixed',unclear:'tag-unclear'};
  return '<span class="tag-dot '+(m[i]||'tag-unclear')+'"></span>';
}
function renderChips(){
  const wrap=document.getElementById('chips');
  const top=catSorted.slice(0,20);
  wrap.innerHTML='<span class="chip'+(activeCat===''?' on':'')+'" onclick="setCat(\\'\\')">All</span>'+
    top.map(([c,n])=>'<span class="chip'+(activeCat===c?' on':'')+'" onclick="setCat(\\''+c.replace(/\\'/g,"\\\\'")+'\\')">'+esc(c)+' ('+n+')</span>').join('');
}
function setCat(c){activeCat=c;catSel.value=c;page=1;apply()}
function apply(){
  const qq=q.toLowerCase().trim();
  filtered=D.filter(p=>{
    if(activeCat&&!p.td.some(t=>t.c===activeCat))return false;
    if(activeIntent){
      if(activeIntent==='offering'&&!p.os)return false;
      if(activeIntent==='seeking'&&!p.ss)return false;
    }
    if(activeFilter==='phone'&&p.ph.length===0)return false;
    if(activeFilter==='active'&&p.tp===0)return false;
    if(qq){
      const hay=(p.n+' '+p.ph.join(' ')+' '+p.td.map(t=>t.c+' '+t.k.join(' ')).join(' ')+' '+p.b+' '+
        p.po.slice(0,5).map(x=>x.m).join(' ')+' '+p.co.slice(0,5).map(x=>x.m).join(' ')).toLowerCase();
      if(hay.indexOf(qq)<0)return false;
    }
    return true;
  });
  render();
}
function render(){
  const tot=Math.ceil(filtered.length/PER_PAGE)||1;
  if(page>tot)page=tot;
  const slice=filtered.slice((page-1)*PER_PAGE,page*PER_PAGE);
  const list=document.getElementById('list');
  if(slice.length===0){list.innerHTML='<div class="empty">No results. Try a different search.</div>';renderPager(tot);return}
  list.innerHTML=slice.map((p,idx)=>{
    const cls=p.os?'offer':p.ss?'seek':'';
    const tradesHtml=p.td.slice(0,8).map(tradeBadge).join('');
    const phonesHtml=p.ph.length?'<div class="phones">'+p.ph.map(ph=>'<span class="phone" onclick="event.stopPropagation()"><a href="tel:'+esc(ph)+'" style="color:inherit">'+esc(ph)+'</a></span>').join('')+'</div>':'';
    const bioHtml=p.b?'<div class="bio">'+esc(p.b)+'</div>':'';
    const globalIdx=(page-1)*PER_PAGE+idx;
    return '<div class="card '+cls+'" id="c'+globalIdx+'">'+
      '<div class="card-head" onclick="toggle('+globalIdx+')">'+
        '<div class="avatar">'+esc(initials(p.n))+'</div>'+
        '<div class="head-body">'+
          '<div class="name-row"><span class="name">'+esc(p.n)+'</span>'+(p.rl&&p.rl!=='member'?'<span class="role">'+esc(p.rl)+'</span>':'')+'<a href="'+esc(p.u)+'" target="_blank" onclick="event.stopPropagation()" style="font-size:.75rem">Facebook ↗</a></div>'+
          '<div class="meta">'+
            '<span>📝 '+p.tp+' posts</span>'+
            '<span>💬 '+p.tc+' comments</span>'+
            '<span>❤️ '+p.tr+' reactions</span>'+
            (p.ls?'<span>🕒 last: '+esc(p.ls)+'</span>':'')+
            (p.jd?'<span>📅 '+esc(p.jd)+'</span>':'')+
          '</div>'+
          (tradesHtml?'<div class="trades">'+tradesHtml+'</div>':'')+
          phonesHtml+
          bioHtml+
        '</div>'+
        '<div class="toggle">▼</div>'+
      '</div>'+
      '<div class="expand" id="x'+globalIdx+'"></div>'+
    '</div>';
  }).join('');
  renderPager(tot);
}
function renderPager(tot){
  const h='<button onclick="goto(1)"'+(page<=1?' disabled':'')+'>« First</button>'+
    '<button onclick="goto('+(page-1)+')"'+(page<=1?' disabled':'')+'>‹ Prev</button>'+
    '<span class="info">Page '+page+' of '+tot+' &middot; '+filtered.length.toLocaleString()+' results</span>'+
    '<button onclick="goto('+(page+1)+')"'+(page>=tot?' disabled':'')+'>Next ›</button>'+
    '<button onclick="goto('+tot+')"'+(page>=tot?' disabled':'')+'>Last »</button>';
  document.getElementById('pagerTop').innerHTML=h;
  document.getElementById('pagerBot').innerHTML=h;
}
function goto(p){page=p;render();window.scrollTo({top:0,behavior:'smooth'})}
function toggle(idx){
  const c=document.getElementById('c'+idx);
  const x=document.getElementById('x'+idx);
  if(c.classList.contains('open')){c.classList.remove('open');return}
  const p=filtered[idx-((page-1)*PER_PAGE)];
  if(!p){c.classList.add('open');return}
  let html='';
  if(p.td.length){
    html+='<div class="expand-section"><h4>All Trades Detected ('+p.td.length+')</h4>';
    html+='<div class="trades">'+p.td.map(tradeBadge).join('')+'</div>';
    html+='<div style="font-size:.75rem;color:#8b92a3;margin-top:6px">Keywords matched: '+p.td.flatMap(t=>t.k).filter((v,i,a)=>a.indexOf(v)===i).slice(0,30).map(esc).join(', ')+'</div>';
    html+='</div>';
  }
  if(p.po.length){
    html+='<div class="expand-section"><h4>All Posts ('+p.po.length+')</h4>';
    html+=p.po.slice(0,100).map(pp=>{
      const cls=pp.in==='offering'?'offer':pp.in==='seeking'?'seek':'';
      return '<div class="post-item '+cls+'"><div class="head"><span>'+intentDot(pp.in)+esc(pp.t)+(pp.ic?' <span class="img-badge">📷 '+pp.ic+'</span>':'')+' ❤️ '+pp.rc+' 💬 '+pp.cc+'</span><a href="'+esc(pp.l)+'" target="_blank">View on FB ↗</a></div><div class="body">'+esc(pp.m||'[no text — image/video only]')+'</div></div>';
    }).join('');
    if(p.po.length>100)html+='<div style="font-size:.75rem;color:#8b92a3">… '+(p.po.length-100)+' more posts</div>';
    html+='</div>';
  }
  if(p.co.length){
    html+='<div class="expand-section"><h4>All Comments ('+p.co.length+')</h4>';
    html+=p.co.slice(0,100).map(cc=>{
      const cls=cc.in==='offering'?'offer':cc.in==='seeking'?'seek':'';
      return '<div class="cmt-item '+cls+'"><div class="head"><span>'+intentDot(cc.in)+esc(cc.t)+' on '+esc(cc.pa)+'\\'s post'+(cc.ir?' (reply)':'')+' ❤️ '+cc.rc+'</span><a href="'+esc(cc.l)+'" target="_blank">View ↗</a></div><div class="body">'+esc(cc.m)+'</div></div>';
    }).join('');
    if(p.co.length>100)html+='<div style="font-size:.75rem;color:#8b92a3">… '+(p.co.length-100)+' more comments</div>';
    html+='</div>';
  }
  x.innerHTML=html;
  c.classList.add('open');
}
function exportCsv(){
  const rows=['name,userId,profileUrl,phones,trades,topTrade,confidence,offers,seeks,posts,comments,firstSeen,lastSeen,bio'];
  filtered.forEach(p=>{
    const esc2=s=>{s=String(s==null?'':s).replace(/"/g,'""').replace(/\\n/g,' ');return /[",]/.test(s)?'"'+s+'"':s};
    rows.push([p.n,p.i,p.u,p.ph.join('; '),p.td.map(t=>t.c).join('; '),p.tt,p.tcf,p.os,p.ss,p.tp,p.tc,p.fs,p.ls,p.b].map(esc2).join(','));
  });
  const blob=new Blob([rows.join('\\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='directory-filtered.csv';a.click();
}
document.getElementById('q').addEventListener('input',e=>{q=e.target.value;page=1;apply()});
document.getElementById('cat').addEventListener('change',e=>{activeCat=e.target.value;page=1;apply();renderChips()});
document.getElementById('intent').addEventListener('change',e=>{activeIntent=e.target.value;page=1;apply()});
document.getElementById('filt').addEventListener('change',e=>{activeFilter=e.target.value;page=1;apply()});
renderChips();apply();
</script>
</body></html>`.replace('__DATA__', json);
}

module.exports = { buildHtml };
