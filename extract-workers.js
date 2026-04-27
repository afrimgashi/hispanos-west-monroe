const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'hispanos members facebook', 'database_posts.json');
const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

const phoneRegex = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g;

const workKeywords = [
  'pintura','pintar','painter','painting',
  'limpieza','limpiar','cleaning','clean','limpio',
  'construccion','construcción','construction','build',
  'plomero','plomería','plomeria','plumber','plumbing',
  'electricista','electric','electrician','electrical',
  'carpintero','carpintería','carpinteria','carpenter','carpentry',
  'mecanico','mecánico','mechanic','mechanical',
  'jardinero','jardín','jardin','landscaping','lawn','yard','pasto','cortar pasto',
  'roofing','roof','techo','techos',
  'drywall','sheetrock',
  'tile','tiles','piso','pisos','flooring','floor',
  'concrete','concreto','cemento','cement',
  'hvac','aire acondicionado','heating','calefaccion','calefacción',
  'mudanza','moving','mover',
  'fencing','fence','cerca','cercas',
  'welding','welder','soldador','soldadura',
  'pressure wash','presion','presión','power wash',
  'handyman','todero','mantenimiento',
  'remodelacion','remodelación','remodel','remodeling',
  'demolition','demolicion','demolición',
  'framing','frame','siding','stucco',
  'insulation','aislamiento',
  'cabinets','gabinetes','countertop','countertops',
  'window','windows','ventana','ventanas',
  'door','doors','puerta','puertas',
  'deck','decks','patio',
  'pool','piscina','alberca',
  'tree','trees','arboles','árboles','tree removal','tree trimming',
  'hauling','junk removal','basura','escombro',
  'notario','notary','taxes','impuestos','tax',
  'costura','sewing','costurera','seamstress','tailor',
  'peluquero','peluquera','barber','barbero','barbería','barberia','haircut','corte',
  'nails','uñas','manicure','pedicure',
  'makeup','maquillaje','maquillista',
  'photography','fotografia','fotografía','fotografo','fotógrafo',
  'catering','comida','cocina','chef','cook',
  'baker','bakery','panadero','panadería','panaderia','pasteles','cakes',
  'daycare','childcare','cuidado de niños','niñera','babysitter','cuido niños',
  'tutor','tutoring','clases','enseño',
  'translation','traduccion','traducción','traductor','interpreter','interprete','intérprete',
  'trabajo','trabajar','work','job','empleo','employment',
  'busco trabajo','necesito trabajo','looking for work','need work',
  'se busca','se necesita','hiring','contratando',
  'ofrezco','ofresco','ofrecemos','servicios','services','servicio',
  'experiencia','experience','años de experiencia',
  'disponible','available','contactar','contact','llamar','call','llame','llamen',
  'cobro','precio','price','estimate','estimado','presupuesto','cotizacion','cotización','free estimate',
  'crew','cuadrilla','equipo',
  'contractor','contratista',
  'helper','ayudante',
  'warehouse','bodega','almacen','almacén',
  'restaurant','restaurante',
  'delivery','entrega',
  'driver','chofer','chófer','conductor'
];

const workRegex = new RegExp('\\b(' + workKeywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'gi');

function extractPhones(text) {
  if (!text) return [];
  return (text.match(phoneRegex) || []).filter(m => {
    const d = m.replace(/\D/g, '');
    return d.length >= 7 && d.length <= 11;
  });
}

function extractWork(text) {
  if (!text) return [];
  return [...new Set((text.match(workRegex) || []).map(m => m.toLowerCase()))];
}

function trunc(s, n) { return !s ? '' : s.length > n ? s.substring(0, n) + '...' : s; }

const results = [];
const posts = data.posts || {};

for (const post of Object.values(posts)) {
  const msg = post.message || '';
  const ph = extractPhones(msg);
  const sk = extractWork(msg);
  if (ph.length || sk.length) {
    results.push({ t:'POST', n:post.authorName, id:post.authorId,
      d:post.timestamp?post.timestamp.split('T')[0]:'',
      p:ph, s:sk, hp:ph.length>0, hw:sk.length>0,
      m:trunc(msg,300), l:post.permalink });
  }
  if (post.comments && Array.isArray(post.comments)) {
    for (const c of post.comments) {
      const ct = c.text || '';
      const cp = extractPhones(ct);
      const ck = extractWork(ct);
      if (cp.length || ck.length) {
        results.push({ t:'CMT', n:c.author, id:c.authorId,
          d:c.timestamp?c.timestamp.split('T')[0]:'',
          p:cp, s:ck, hp:cp.length>0, hw:ck.length>0,
          m:trunc(ct,300), l:post.permalink });
      }
    }
  }
}

const d0 = results.filter(r => r.hp && r.hw);
const d1 = results.filter(r => r.hp);
const d2 = results.filter(r => r.hw);

console.log('Workers WITH phone numbers:', d0.length);
console.log('All entries with phones:', d1.length);
console.log('All work-related:', d2.length);

const jsonData = JSON.stringify([d0, d1, d2]);
const postCount = Object.keys(posts).length;

// Build HTML using string concatenation to avoid template literal escaping issues
const jsCode = [
  'var DATA=' + jsonData + ';',
  'var PP=50,tab=0,rows=[],filt=[],page=1,sCol=-1,sAsc=true,aSk=null;',
  'function setTab(i,el){tab=i;page=1;sCol=-1;aSk=null;document.getElementById("si").value="";document.querySelectorAll(".tab").forEach(function(t){t.classList.remove("on")});if(el)el.classList.add("on");rows=DATA[i];buildChips();apply()}',
  'function buildChips(){var c={};rows.forEach(function(r){r.s.forEach(function(s){c[s]=(c[s]||0)+1})});var top=Object.entries(c).sort(function(a,b){return b[1]-a[1]}).slice(0,25);document.getElementById("chips").innerHTML=\'<span style="color:#666;font-size:.8rem;margin-right:4px">Filter:</span>\'+top.map(function(e){return\'<span class="chip\'+(aSk===e[0]?\' on\':\'\')+\'" onclick="togSk(this)" data-s="\'+esc(e[0])+\'">\'+esc(e[0])+\' (\'+e[1]+\')</span>\'}).join("")}',
  'function togSk(el){var s=el.getAttribute("data-s");aSk=aSk===s?null:s;page=1;buildChips();apply()}',
  'function apply(){var q=document.getElementById("si").value.toLowerCase().trim();filt=rows.filter(function(r){if(aSk&&r.s.indexOf(aSk)<0)return false;if(q){var txt=(r.n+" "+r.p.join(" ")+" "+r.s.join(" ")+" "+r.m+" "+r.d).toLowerCase();return txt.indexOf(q)>=0}return true});if(sCol>=0)doSort();renderStats();renderTable();renderPg()}',
  'function onSearch(){page=1;apply()}',
  'function doSort(){var keys=["n","id","p","s","d","t","m","l"];var k=keys[sCol];filt.sort(function(a,b){var va=Array.isArray(a[k])?a[k].join(" "):(a[k]||"");var vb=Array.isArray(b[k])?b[k].join(" "):(b[k]||"");return sAsc?va.localeCompare(vb):vb.localeCompare(va)})}',
  'function sortBy(c){if(sCol===c)sAsc=!sAsc;else{sCol=c;sAsc=true}doSort();renderTable()}',
  'function renderStats(){var phones={},names={};filt.forEach(function(r){r.p.forEach(function(p){phones[p]=1});if(r.n)names[r.n]=1});document.getElementById("statsEl").innerHTML=\'<div class="sc"><div class="num">\'+filt.length+\'</div><div class="lbl">Results</div></div><div class="sc"><div class="num">\'+Object.keys(names).length+\'</div><div class="lbl">Unique Names</div></div><div class="sc"><div class="num">\'+Object.keys(phones).length+\'</div><div class="lbl">Unique Phones</div></div>\'}',
  'function esc(s){if(!s)return"";var d=document.createElement("div");d.textContent=s;return d.innerHTML}',
  'function hl(text,q){if(!q)return esc(text);var s=esc(text);var re=/[.*+?^${}()|[\\]\\\\]/g;var qe=q.replace(re,"\\\\$&");try{return s.replace(new RegExp("("+qe+")","gi"),\'<span class="hl">$1</span>\')}catch(e){return s}}',
  'var hdrs=["Name","ID","Phone Numbers","Skills","Date","Type","Message","Link"];',
  'function renderTable(){var q=document.getElementById("si").value.toLowerCase().trim();var st=(page-1)*PP,pg=filt.slice(st,st+PP);document.getElementById("th").innerHTML="<tr>"+hdrs.map(function(h,i){return\'<th class="\'+(sCol===i?"so":"")+\'" onclick="sortBy(\'+i+\')">\'+h+\'<span class="ar">\'+(sCol===i?(sAsc?"\\u25B2":"\\u25BC"):"\\u21C5")+\'</span></th>\'}).join("")+"</tr>";if(!pg.length){document.getElementById("tb").innerHTML="";document.getElementById("nr").style.display="block";return}document.getElementById("nr").style.display="none";document.getElementById("tb").innerHTML=pg.map(function(r){var tc=r.t==="POST"?"tp-p":"tp-c";return\'<tr><td class="nm">\'+hl(r.n||"",q)+\'</td><td>\'+esc(r.id||"")+\'</td><td class="ph">\'+hl(r.p.join("; "),q)+\'</td><td class="sk">\'+r.s.map(function(s){return\'<span class="b">\'+hl(s,q)+"</span>"}).join("")+\'</td><td class="dt">\'+esc(r.d)+\'</td><td><span class="tp \'+tc+\'">\'+esc(r.t)+\'</span></td><td class="mg">\'+hl(r.m||"",q)+\'</td><td>\'+(r.l?\'<a class="fl" href="\'+esc(r.l)+\'" target="_blank">View</a>\':"")+\'</td></tr>\'}).join("")}',
  'function renderPg(){var tot=Math.ceil(filt.length/PP)||1;document.getElementById("pg").innerHTML=\'<button onclick="goP(1)"\'+(page<=1?" disabled":"")+\'>\\u00AB</button><button onclick="goP(\'+(page-1)+\')"\'+(page<=1?" disabled":"")+\'>\\u2039</button><span class="pi">Page \'+page+" of "+tot+\'</span><button onclick="goP(\'+(page+1)+\')"\'+(page>=tot?" disabled":"")+\'>\\u203A</button><button onclick="goP(\'+tot+\')"\'+(page>=tot?" disabled":"")+\'>\\u00BB</button>\'}',
  'function goP(p){var tot=Math.ceil(filt.length/PP)||1;page=Math.max(1,Math.min(tot,p));renderTable();renderPg();window.scrollTo({top:0,behavior:"smooth"})}',
  'setTab(0,document.querySelector(".tab"));'
].join('\n');

const htmlParts = [];
htmlParts.push('<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Workers &amp; Phone Numbers</title>');
htmlParts.push('<style>');
htmlParts.push('*{box-sizing:border-box;margin:0;padding:0}body{font-family:"Segoe UI",Tahoma,sans-serif;background:#0f1117;color:#e0e0e0;padding:20px}h1{text-align:center;margin-bottom:6px;font-size:1.6rem;color:#fff}.sub{text-align:center;color:#888;margin-bottom:20px;font-size:.9rem}.controls{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:16px}.tabs{display:flex;gap:8px}.tab{padding:8px 18px;border:2px solid #333;background:#1a1d27;color:#ccc;border-radius:8px;cursor:pointer;font-size:.85rem;transition:all .2s}.tab:hover{border-color:#555;background:#22263a}.tab.on{border-color:#4a9eff;color:#4a9eff;background:#1a2744}.sbar{flex:1;min-width:250px;position:relative}.sbar input{width:100%;padding:10px 14px 10px 38px;border:2px solid #333;background:#1a1d27;color:#e0e0e0;border-radius:8px;font-size:.95rem;outline:none;transition:border-color .2s}.sbar input:focus{border-color:#4a9eff}.sbar svg{position:absolute;left:12px;top:50%;transform:translateY(-50%);fill:#666;width:16px;height:16px}.chips{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}.chip{padding:5px 14px;border:1px solid #333;background:#1a1d27;color:#aaa;border-radius:20px;cursor:pointer;font-size:.8rem;transition:all .2s}.chip:hover{border-color:#555}.chip.on{border-color:#4a9eff;color:#4a9eff;background:#1a2744}.stats{display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap}.sc{background:#1a1d27;border:1px solid #2a2d37;border-radius:10px;padding:14px 20px;min-width:140px}.sc .num{font-size:1.6rem;font-weight:700;color:#4a9eff}.sc .lbl{font-size:.75rem;color:#888;text-transform:uppercase;letter-spacing:.5px}.tw{overflow-x:auto;border-radius:10px;border:1px solid #2a2d37}table{width:100%;border-collapse:collapse;font-size:.85rem}thead th{background:#1a1d27;color:#aaa;padding:12px 14px;text-align:left;border-bottom:2px solid #2a2d37;position:sticky;top:0;cursor:pointer;user-select:none;white-space:nowrap}thead th:hover{color:#fff}thead th .ar{margin-left:4px;font-size:.7rem;color:#555}thead th.so .ar{color:#4a9eff}tbody tr{border-bottom:1px solid #1e2130;transition:background .15s}tbody tr:hover{background:#1a1d27}tbody td{padding:10px 14px;vertical-align:top;max-width:400px}.ph{color:#4ae0a0;font-weight:600;white-space:nowrap;font-size:.95rem}.nm{color:#fff;font-weight:500;white-space:nowrap}.sk .b{display:inline-block;padding:2px 8px;margin:2px 3px 2px 0;background:#2a1f44;color:#b48eff;border-radius:12px;font-size:.75rem}.mg{color:#999;line-height:1.4}.dt{white-space:nowrap;color:#888}.tp{padding:2px 8px;border-radius:10px;font-size:.75rem}.tp-p{background:#1a3a2a;color:#4ae0a0}.tp-c{background:#2a2a1a;color:#e0c04a}a.fl{color:#4a9eff;text-decoration:none}a.fl:hover{text-decoration:underline}.pg{display:flex;justify-content:center;align-items:center;gap:8px;margin-top:16px}.pg button{padding:6px 14px;border:1px solid #333;background:#1a1d27;color:#ccc;border-radius:6px;cursor:pointer;font-size:.85rem}.pg button:hover:not(:disabled){border-color:#4a9eff;color:#4a9eff}.pg button:disabled{opacity:.3;cursor:default}.pg .pi{color:#888;font-size:.85rem}.hl{background:#4a3a00;color:#ffd54f;border-radius:2px}.nr{text-align:center;padding:60px 20px;color:#666;font-size:1.1rem}');
htmlParts.push('</style></head><body>');
htmlParts.push('<h1>Workers &amp; Phone Numbers</h1>');
htmlParts.push('<p class="sub">Extracted from Hispanos Facebook Group &mdash; ' + postCount + ' posts scanned</p>');
htmlParts.push('<div class="controls"><div class="tabs">');
htmlParts.push('<div class="tab on" onclick="setTab(0,this)">Workers + Phones (' + d0.length + ')</div>');
htmlParts.push('<div class="tab" onclick="setTab(1,this)">All Phones (' + d1.length + ')</div>');
htmlParts.push('<div class="tab" onclick="setTab(2,this)">All Work-Related (' + d2.length + ')</div>');
htmlParts.push('</div><div class="sbar">');
htmlParts.push('<svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>');
htmlParts.push('<input type="text" id="si" placeholder="Search name, phone, skill, message..." oninput="onSearch()">');
htmlParts.push('</div></div>');
htmlParts.push('<div class="chips" id="chips"></div>');
htmlParts.push('<div class="stats" id="statsEl"></div>');
htmlParts.push('<div class="tw"><table><thead id="th"></thead><tbody id="tb"></tbody></table></div>');
htmlParts.push('<div class="nr" id="nr" style="display:none">No results found</div>');
htmlParts.push('<div class="pg" id="pg"></div>');
htmlParts.push('<script>' + jsCode + '<\/script>');
htmlParts.push('</body></html>');

const html = htmlParts.join('\n');

const outPath = path.join(__dirname, 'hispanos members facebook', 'workers-viewer.html');
fs.writeFileSync(outPath, html, 'utf8');
console.log('HTML saved:', outPath);
console.log('File size:', (Buffer.byteLength(html) / 1024 / 1024).toFixed(1), 'MB');
