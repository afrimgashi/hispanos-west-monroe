const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'hispanos members facebook', 'database_posts.json');
const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

const phoneRegex = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g;

// Trade categories with their keywords
const trades = {
  'Painting / Pintura': ['pintura','pintar','painter','painting'],
  'Plumbing / Plomería': ['plomero','plomería','plomeria','plumber','plumbing'],
  'Electrical / Electricista': ['electricista','electric','electrician','electrical'],
  'Roofing / Techos': ['roofing','roof','techo','techos'],
  'Drywall / Sheetrock': ['drywall','sheetrock'],
  'Tile & Flooring / Pisos': ['tile','tiles','piso','pisos','flooring','floor'],
  'Concrete / Concreto': ['concrete','concreto','cemento','cement'],
  'Remodeling / Remodelación': ['remodelacion','remodelación','remodel','remodeling'],
  'Construction / Construcción': ['construccion','construcción','construction'],
  'Carpentry / Carpintería': ['carpintero','carpintería','carpinteria','carpenter','carpentry'],
  'Framing': ['framing','frame'],
  'Landscaping & Lawn / Jardín': ['jardinero','jardín','jardin','landscaping','lawn','yard','pasto','cortar pasto'],
  'Tree Services / Árboles': ['tree','trees','arboles','árboles','tree removal','tree trimming'],
  'Fencing / Cercas': ['fencing','fence','cerca','cercas'],
  'HVAC / Aire Acondicionado': ['hvac','aire acondicionado','heating','calefaccion','calefacción'],
  'Welding / Soldadura': ['welding','welder','soldador','soldadura'],
  'Pressure Washing': ['pressure wash','power wash'],
  'Demolition / Demolición': ['demolition','demolicion','demolición'],
  'Siding & Stucco': ['siding','stucco'],
  'Cabinets & Countertops': ['cabinets','gabinetes','countertop','countertops'],
  'Windows & Doors': ['window','windows','ventana','ventanas','door','doors','puerta','puertas'],
  'Deck & Patio': ['deck','decks','patio'],
  'Pool / Piscina': ['pool','piscina','alberca'],
  'Insulation': ['insulation','aislamiento'],
  'Moving / Mudanza': ['mudanza','moving'],
  'Hauling & Junk Removal': ['hauling','junk removal','basura','escombro'],
  'Handyman / Todero': ['handyman','todero','mantenimiento'],
  'Mechanic / Mecánico': ['mecanico','mecánico','mechanic'],
  'Cleaning / Limpieza': ['limpieza','limpiar','cleaning','clean','limpio'],
  'Barber & Hair / Peluquería': ['peluquero','peluquera','barber','barbero','barbería','barberia','haircut','corte de pelo'],
  'Nails & Beauty': ['nails','uñas','manicure','pedicure','makeup','maquillaje','maquillista'],
  'Photography / Fotografía': ['photography','fotografia','fotografía','fotografo','fotógrafo'],
  'Cooking & Catering / Cocina': ['catering','comida','cocina','chef','cook','baker','bakery','panadero','panadería','panaderia','pasteles','cakes'],
  'Childcare / Niñera': ['daycare','childcare','cuidado de niños','niñera','babysitter','cuido niños'],
  'Tutoring & Classes': ['tutor','tutoring','clases','enseño'],
  'Translation / Traducción': ['translation','traduccion','traducción','traductor','interpreter','interprete','intérprete'],
  'Sewing / Costura': ['costura','sewing','costurera','seamstress','tailor'],
  'Taxes & Notary': ['notario','notary','taxes','impuestos','tax'],
  'Contractor / Contratista': ['contractor','contratista'],
  'Driver / Chofer': ['driver','chofer','chófer','conductor'],
  'Restaurant': ['restaurant','restaurante'],
  'Warehouse / Bodega': ['warehouse','bodega','almacen','almacén'],
  'Delivery / Entrega': ['delivery','entrega']
};

function extractPhones(text) {
  if (!text) return [];
  return (text.match(phoneRegex) || []).filter(m => {
    const d = m.replace(/\D/g, '');
    return d.length >= 7 && d.length <= 11;
  });
}

function matchTrades(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  const matched = [];
  for (const [trade, keywords] of Object.entries(trades)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) { matched.push(trade); break; }
    }
  }
  return matched;
}

function trunc(s, n) { return !s ? '' : s.length > n ? s.substring(0, n) + '...' : s; }

// Extract all entries with phone + trade
const entries = [];
const posts = data.posts || {};

for (const post of Object.values(posts)) {
  const msg = post.message || '';
  const ph = extractPhones(msg);
  const tr = matchTrades(msg);
  if (ph.length > 0 && tr.length > 0) {
    entries.push({
      name: post.authorName || 'Unknown',
      phones: ph,
      trades: tr,
      msg: trunc(msg, 200),
      date: post.timestamp ? post.timestamp.split('T')[0] : '',
      link: post.permalink,
      type: 'post'
    });
  }
  if (post.comments && Array.isArray(post.comments)) {
    for (const c of post.comments) {
      const ct = c.text || '';
      const cp = extractPhones(ct);
      const ck = matchTrades(ct);
      if (cp.length > 0 && ck.length > 0) {
        entries.push({
          name: c.author || 'Unknown',
          phones: cp,
          trades: ck,
          msg: trunc(ct, 200),
          date: c.timestamp ? c.timestamp.split('T')[0] : '',
          link: post.permalink,
          type: 'comment'
        });
      }
    }
  }
}

// Deduplicate: group by person name + phone combo, keep unique
const personMap = new Map();
for (const e of entries) {
  const key = e.name + '|' + e.phones.sort().join(',');
  if (!personMap.has(key)) {
    personMap.set(key, { ...e, allTrades: new Set(e.trades) });
  } else {
    const existing = personMap.get(key);
    e.trades.forEach(t => existing.allTrades.add(t));
    if (e.date > existing.date) { existing.date = e.date; existing.msg = e.msg; existing.link = e.link; }
  }
}
const uniquePeople = [...personMap.values()].map(p => ({ ...p, trades: [...p.allTrades] }));

// Group by trade
const byTrade = {};
for (const [trade] of Object.entries(trades)) byTrade[trade] = [];
for (const person of uniquePeople) {
  for (const t of person.trades) {
    byTrade[t].push(person);
  }
}

// Sort each trade by date desc
for (const t of Object.keys(byTrade)) {
  byTrade[t].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

// Count stats
const activeTrades = Object.entries(byTrade).filter(([,v]) => v.length > 0).sort((a,b) => b[1].length - a[1].length);
console.log('Unique workers with phones:', uniquePeople.length);
console.log('Active trade categories:', activeTrades.length);
activeTrades.forEach(([t, v]) => console.log('  ' + t + ': ' + v.length));

// Build HTML
function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

let sections = '';
let tocItems = '';
let idx = 0;
for (const [trade, people] of activeTrades) {
  idx++;
  const id = 'trade-' + idx;
  tocItems += '<a href="#' + id + '" class="toc-item"><span class="toc-name">' + esc(trade) + '</span><span class="toc-count">' + people.length + '</span></a>\n';
  
  sections += '<div class="trade-section" id="' + id + '">\n';
  sections += '<div class="trade-header"><h2>' + esc(trade) + '</h2><span class="badge">' + people.length + ' workers</span></div>\n';
  sections += '<div class="cards">\n';
  
  for (let i = 0; i < people.length; i++) {
    const p = people[i];
    const otherTrades = p.trades.filter(t => t !== trade);
    sections += '<div class="card">\n';
    sections += '  <div class="card-num">' + (i + 1) + '</div>\n';
    sections += '  <div class="card-body">\n';
    sections += '    <div class="card-name">' + esc(p.name) + '</div>\n';
    sections += '    <div class="card-phone">' + esc(p.phones.join(' / ')) + '</div>\n';
    if (otherTrades.length > 0) {
      sections += '    <div class="card-also">Also: ' + otherTrades.map(t => '<span class="tag">' + esc(t) + '</span>').join(' ') + '</div>\n';
    }
    sections += '    <div class="card-msg">' + esc(p.msg) + '</div>\n';
    sections += '    <div class="card-footer"><span class="card-date">' + esc(p.date) + '</span>';
    if (p.link) sections += ' <a href="' + esc(p.link) + '" target="_blank" class="fb-link">View on Facebook</a>';
    sections += '</div>\n';
    sections += '  </div>\n';
    sections += '</div>\n';
  }
  
  sections += '</div></div>\n';
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Workers Directory by Trade</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #0f1117; color: #e0e0e0; }
.layout { display: flex; min-height: 100vh; }

/* Sidebar */
.sidebar { width: 280px; background: #161822; border-right: 1px solid #2a2d37; padding: 20px 0; position: fixed; top: 0; left: 0; height: 100vh; overflow-y: auto; }
.sidebar h1 { font-size: 1.1rem; color: #fff; padding: 0 20px 6px; }
.sidebar .sub { font-size: .75rem; color: #666; padding: 0 20px 16px; border-bottom: 1px solid #2a2d37; margin-bottom: 12px; }
.sidebar .search { padding: 0 12px 12px; }
.sidebar .search input { width: 100%; padding: 8px 12px; background: #1a1d27; border: 1px solid #333; border-radius: 6px; color: #e0e0e0; font-size: .85rem; outline: none; }
.sidebar .search input:focus { border-color: #4a9eff; }
.toc-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 20px; text-decoration: none; color: #aaa; font-size: .85rem; transition: all .15s; border-left: 3px solid transparent; }
.toc-item:hover { background: #1a1d27; color: #fff; border-left-color: #4a9eff; }
.toc-count { background: #1a2744; color: #4a9eff; padding: 2px 8px; border-radius: 10px; font-size: .75rem; font-weight: 600; }

/* Main */
.main { margin-left: 280px; padding: 30px 40px; flex: 1; }
.summary { display: flex; gap: 16px; margin-bottom: 30px; flex-wrap: wrap; }
.stat { background: #161822; border: 1px solid #2a2d37; border-radius: 10px; padding: 16px 24px; }
.stat .n { font-size: 2rem; font-weight: 700; color: #4a9eff; }
.stat .l { font-size: .75rem; color: #888; text-transform: uppercase; letter-spacing: .5px; }

/* Trade sections */
.trade-section { margin-bottom: 40px; scroll-margin-top: 20px; }
.trade-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding-bottom: 10px; border-bottom: 2px solid #2a2d37; }
.trade-header h2 { font-size: 1.3rem; color: #fff; }
.trade-header .badge { background: #1a2744; color: #4a9eff; padding: 4px 12px; border-radius: 16px; font-size: .8rem; font-weight: 600; }

/* Cards */
.cards { display: flex; flex-direction: column; gap: 8px; }
.card { display: flex; gap: 14px; background: #161822; border: 1px solid #2a2d37; border-radius: 10px; padding: 14px 18px; transition: border-color .2s; }
.card:hover { border-color: #3a3d47; }
.card-num { min-width: 28px; height: 28px; background: #1a2744; color: #4a9eff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: .8rem; font-weight: 700; flex-shrink: 0; margin-top: 2px; }
.card-body { flex: 1; min-width: 0; }
.card-name { font-size: 1rem; font-weight: 600; color: #fff; margin-bottom: 4px; }
.card-phone { font-size: 1.05rem; color: #4ae0a0; font-weight: 700; margin-bottom: 6px; letter-spacing: .5px; }
.card-also { margin-bottom: 6px; }
.tag { display: inline-block; padding: 2px 8px; margin: 2px 4px 2px 0; background: #2a1f44; color: #b48eff; border-radius: 10px; font-size: .72rem; }
.card-msg { font-size: .82rem; color: #888; line-height: 1.4; margin-bottom: 6px; word-wrap: break-word; }
.card-footer { display: flex; align-items: center; gap: 12px; }
.card-date { font-size: .75rem; color: #666; }
.fb-link { font-size: .75rem; color: #4a9eff; text-decoration: none; }
.fb-link:hover { text-decoration: underline; }

/* Search highlight */
.hidden { display: none !important; }

/* Back to top */
.top-btn { position: fixed; bottom: 24px; right: 24px; width: 44px; height: 44px; background: #1a2744; border: 1px solid #4a9eff; color: #4a9eff; border-radius: 50%; cursor: pointer; font-size: 1.2rem; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity .3s; z-index: 100; }
.top-btn.show { opacity: 1; }

@media (max-width: 768px) {
  .sidebar { display: none; }
  .main { margin-left: 0; padding: 16px; }
}
</style>
</head>
<body>
<div class="layout">
<aside class="sidebar">
  <h1>Workers Directory</h1>
  <p class="sub">${uniquePeople.length} workers &bull; ${activeTrades.length} trades</p>
  <div class="search"><input type="text" id="sideSearch" placeholder="Search trades..." oninput="filterTOC(this.value)"></div>
  <div id="toc">
${tocItems}
  </div>
</aside>
<div class="main">
  <div class="summary">
    <div class="stat"><div class="n">${uniquePeople.length}</div><div class="l">Unique Workers</div></div>
    <div class="stat"><div class="n">${activeTrades.length}</div><div class="l">Trade Categories</div></div>
    <div class="stat"><div class="n">${new Set(uniquePeople.flatMap(p => p.phones)).size}</div><div class="l">Unique Phone Numbers</div></div>
  </div>
  <div id="mainSearch" style="margin-bottom:24px">
    <input type="text" id="globalSearch" placeholder="Search by name, phone, or keyword..." oninput="filterCards(this.value)" style="width:100%;max-width:500px;padding:10px 14px;background:#161822;border:2px solid #333;border-radius:8px;color:#e0e0e0;font-size:.95rem;outline:none">
  </div>
${sections}
</div>
</div>
<button class="top-btn" id="topBtn" onclick="window.scrollTo({top:0,behavior:'smooth'})">&#8593;</button>
<script>
function filterTOC(q) {
  q = q.toLowerCase();
  document.querySelectorAll('.toc-item').forEach(function(el) {
    el.classList.toggle('hidden', q && el.textContent.toLowerCase().indexOf(q) < 0);
  });
}
function filterCards(q) {
  q = q.toLowerCase();
  document.querySelectorAll('.trade-section').forEach(function(sec) {
    var cards = sec.querySelectorAll('.card');
    var anyVisible = false;
    cards.forEach(function(card) {
      var text = card.textContent.toLowerCase();
      var show = !q || text.indexOf(q) >= 0;
      card.classList.toggle('hidden', !show);
      if (show) anyVisible = true;
    });
    sec.classList.toggle('hidden', !anyVisible);
  });
}
window.addEventListener('scroll', function() {
  document.getElementById('topBtn').classList.toggle('show', window.scrollY > 400);
});
</script>
</body>
</html>`;

const outPath = path.join(__dirname, 'hispanos members facebook', 'workers-directory.html');
fs.writeFileSync(outPath, html, 'utf8');
console.log('\nSaved:', outPath);
console.log('Size:', (Buffer.byteLength(html) / 1024).toFixed(0), 'KB');
