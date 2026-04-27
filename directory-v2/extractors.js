// Encoding fix, phone extraction, intent detection, category matching.
const CATEGORIES = require('./categories');

function fixMojibake(s) {
  if (!s || typeof s !== 'string') return s;
  if (!/Ã[\u0080-\u00BF]|Â[\u0080-\u00BF]|â€[\u0099\u009C\u009D\u0094\u0093]/.test(s)) return s;
  try {
    const fixed = Buffer.from(s, 'latin1').toString('utf8');
    if (fixed.includes('\uFFFD')) return s;
    return fixed;
  } catch (_) { return s; }
}

const OFFERING_PATTERNS = [
  /\bofrezco\b/i, /\bofresco\b/i, /\bofrecemos\b/i,
  /\bhago\b/i, /\bhacemos\b/i, /\bse hace\b/i, /\bse hacen\b/i,
  /\bdisponible\b/i, /\bdisponibles\b/i, /\btengo disponible\b/i,
  /\bvendo\b/i, /\bvendemos\b/i, /\bse vende\b/i, /\bse venden\b/i,
  /\bservicio de\b/i, /\bservicios de\b/i, /\bse ofrece\b/i, /\bse ofrecen\b/i,
  /\bsoy\s+(pintor|plomero|electricista|mecanico|mecánico|carpintero|jardinero|cocinero|chofer|contador|abogado|enfermera|maestro|costurera)/i,
  /\btrabajo como\b/i, /\btrabajo de\b/i, /\bme dedico a\b/i,
  /\bcobro\b/i, /\bcobramos\b/i,
  /\bpresupuesto\s+(gratis|sin compromiso)\b/i, /\bestimados?\s+gratis\b/i, /\bcotizaci[oó]n(es)?\s+gratis\b/i,
  /\bfree\s+estimate/i,
  /\bllam[ae]n? al\b/i, /\bllamar al\b/i, /\bcontactar al\b/i, /\bescribir al\b/i,
  /\bmi\s+(n[uú]mero|cel|celular|whatsapp|wsp|tel|tel[eé]fono)\b/i,
  /\bmessage me\b/i, /\btext me\b/i, /\bcall me\b/i, /\bhit me up\b/i,
  /\bi\s+(do|offer|provide|make|sell)\b/i,
  /\bwe\s+(do|offer|provide)\b/i,
  /\bavailable\s+(for|to)\b/i, /\bin business\b/i, /\bnow hiring\b/i,
  /\bcontacto:\b/i, /\bcontact:\b/i,
];

const SEEKING_PATTERNS = [
  /\bbusco\b/i, /\bbuscando\b/i, /\bestoy buscando\b/i, /\bse busca\b/i, /\bse buscan\b/i,
  /\bnecesito\b/i, /\bnecesitan?\b/i,
  /\balguien que\b/i, /\balguien sepa\b/i, /\balguien conozca\b/i,
  /\brecomiend[ae]n?\b/i, /\brecomendaci[oó]n/i, /\brecomendable\b/i,
  /\bconocen a\b/i, /\bsaben de\b/i,
  /\bd[oó]nde\s+(puedo|consigo|encuentro|hay)\b/i,
  /\blooking for\b/i, /\bneed (a|an|some|someone)\b/i,
  /\banyone know\b/i, /\bany recommendations?\b/i, /\bany suggestions?\b/i,
  /\bwhere can i (find|get)\b/i,
];

function detectIntent(text) {
  if (!text) return 'unclear';
  const off = OFFERING_PATTERNS.some(p => p.test(text));
  const seek = SEEKING_PATTERNS.some(p => p.test(text));
  if (off && !seek) return 'offering';
  if (seek && !off) return 'seeking';
  if (off && seek) return 'mixed';
  return 'unclear';
}

const PHONE_RE = /(?:\+?1[-.\s]?)?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})/g;
function extractPhones(text) {
  if (!text) return [];
  const out = [];
  const seen = new Set();
  PHONE_RE.lastIndex = 0;
  let m;
  while ((m = PHONE_RE.exec(text)) !== null) {
    const [raw, a, b, c] = m;
    const digits = a + b + c;
    if (/^(\d)\1+$/.test(digits)) continue;
    if (a === '000' || a === '111' || a.startsWith('0')) continue;
    const ctx = text.slice(Math.max(0, m.index - 3), m.index);
    if (/\$\s*$/.test(ctx)) continue;
    if (seen.has(digits)) continue;
    seen.add(digits);
    out.push({ raw: raw.trim(), normalized: `(${a}) ${b}-${c}`, digits });
  }
  return out;
}

function matchCategories(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  const hits = new Map();
  for (const [cat, kws] of Object.entries(CATEGORIES)) {
    for (const kw of kws) {
      if (lower.includes(kw.toLowerCase())) {
        if (!hits.has(cat)) hits.set(cat, new Set());
        hits.get(cat).add(kw);
      }
    }
  }
  return [...hits.entries()].map(([c, k]) => ({ category: c, keywords: [...k] }));
}

module.exports = { fixMojibake, detectIntent, extractPhones, matchCategories };
