# Analysis Schema — the ONLY source of truth

You are analyzing Spanish/English Facebook group posts from a Hispanic
community in Monroe/West Monroe, Louisiana. For every post in the input batch
you produce exactly one result object using this schema.

**No lazy shortcuts. No placeholder summaries. No "other" as a fallback.**

---

## 1. Output shape (mandatory — reject if violated)

```json
{
  "batchNumber": <copy from input>,
  "analyzedAt": "<ISO timestamp>",
  "results": [
    { /* exactly one object per input post, in the same order */ }
  ]
}
```

`results.length` MUST equal `posts.length` from the input.

Each result object MUST have **all 14 fields** below. Missing any field =
batch rejected.

| field        | type              | allowed values / format                                                              |
|--------------|-------------------|---------------------------------------------------------------------------------------|
| `id`         | string            | copy verbatim from input post                                                         |
| `intent`     | string (enum)     | `offering` `seeking` `event` `news` `personal` `informational` `lost_found` `spam` `other` |
| `isBusiness` | boolean           | `true` only if the post is commercial (selling a product/service, hiring, renting)   |
| `svc`        | string OR null    | 2-5 English words describing the service/product. `null` only if NOT a business post |
| `cats`       | string[]          | from canonical list below (§4). Use `[]` only for pure personal/greetings/news       |
| `phones`     | string[]          | every 10-digit phone, digits-only. Scan BOTH post text AND all comments              |
| `bname`      | string OR null    | business / church / store / restaurant name if named. `null` otherwise               |
| `loc`        | string OR null    | city / area / street address if mentioned. `null` otherwise                           |
| `lang`       | string (enum)     | `es` `en` `mixed` `other`                                                             |
| `sum`        | string            | one-sentence English summary — **NEVER "No summary available.", NEVER empty**        |
| `price`      | string OR null    | `"$15"`, `"$100-500"`, `"$10/dozen"`, `"free"`. `null` if no price mentioned         |
| `urgency`    | string OR null    | `immediate` `ongoing` `one_time` — or `null` for pure personal/news/info posts       |
| `resolution` | string (enum)     | `answered_in_comments` `not_answered` `no_comments` `offered_help` `argued` `other`  |
| `conf`       | number            | 0.0 – 1.0 — honest confidence (see §5)                                                |

---

## 2. Intent decision tree — follow strictly, no shortcuts

Ask these questions in order. Stop at the first YES:

1. Is someone selling a product, offering a service, renting, or hiring?
   → `intent: "offering"`, `isBusiness: true` (hiring counts as offering work)

2. Is someone asking for help / looking for a service / looking to buy?
   → `intent: "seeking"`, `isBusiness: false`

3. Is it an event announcement (church service, party, fundraiser, meeting,
   garage sale, class schedule)?
   → `intent: "event"`

4. Is it a warning, traffic alert, immigration raid alert, weather, crime
   update, or general community news?
   → `intent: "news"`

5. Is it a lost/found pet, person, or item?
   → `intent: "lost_found"`

6. Is it an obvious scam / MLM / "earn $$$ from home"?
   → `intent: "spam"`, `conf` 0.8

7. Is it a greeting, condolence, prayer request, birthday/holiday message, or
   personal reflection?
   → `intent: "personal"`

8. Is it a link share, announcement, or generic info broadcast without
   commercial intent or request?
   → `intent: "informational"`

9. ONLY IF NONE of the above clearly fit → `intent: "other"`

**⚠ NEVER use `"other"` because you're in a hurry. It must be a last resort.
If you find yourself picking `"other"` more than ~2 out of 50 posts, you are
making mistakes — go back.**

---

## 3. Field-by-field rules (high-risk mistakes)

### `sum` — forbidden outputs

The following summaries will be REJECTED by the validator. Never use them:

- `"No summary available."` ❌
- `""` ❌
- `"Empty post"` (unless the post truly has zero text AND zero comments)
- Anything less than 20 characters on a post with real content

**Every `sum` must describe what the post is actually about, in English, in
one sentence.** Quote prices and locations when present. Example:

```
text: "Mañana tendré Venta de Tamales Rojos $15 la docena llamar 3184507585"
sum:  "Selling red pork tamales tomorrow, $15 per dozen, contact by phone"
```

### `phones` — scan EVERY line, every comment

Extract every 10-digit US phone found in:
1. Post text
2. Every comment
3. Ignore leading `+1` or `1-`

Format: digits only, no dashes, no spaces, no parentheses.
Regex mental model: `\b\d{3}[-.\s_]?\d{3}[-.\s_]?\d{4}\b`

Examples of formats that all extract to `"3184507585"`:

- `318-450-7585`
- `318.450.7585`
- `(318) 450-7585`
- `318_450_7585`
- `3184507585`
- `+1 318 450 7585`

**If a phone appears in the post or comments, it MUST appear in `phones[]`.**
A post-processing script will flag missing phones — don't make it work hard.

### `cats` — be specific

- Use exact strings from §4. Case-sensitive.
- Multiple tags allowed (e.g., `["Religious", "Tutoring"]` for a church with
  English classes).
- `[]` is valid only for pure greetings, condolences, or generic news.
- "Cooking (home)" for home cooks selling tamales/empanadas/etc.
- "Restaurant" only for restaurant businesses (waiter hiring, restaurant ads).

### `isBusiness` — true means commercial

- `true` = someone making money or trying to (selling, renting, hiring,
  services).
- `false` = greeting, asking, sharing news, church invite, personal update.
- Church/religious events: `isBusiness: false` even when requesting donations.
- Giving something for free (puppies, free clothes): `isBusiness: false`.

### `bname` — name of the entity, not the poster

- Only populate if the post names a business, church, or org.
  Examples: `"El Paso Mexican Grill"`, `"Iglesia de Cristo"`, `"Medina Market"`.
- Do NOT put the poster's personal name here.
- `null` if no business name is mentioned.

### `resolution` — based on the `c` (comments) array

- `no_comments` — comment array is empty
- `answered_in_comments` — comments contain helpful answers, recommendations, phones
- `offered_help` — someone offered a service in response
- `not_answered` — has comments but none are relevant answers
- `argued` — comments contain disagreement or arguments
- `other` — other patterns

---

## 4. Canonical category list

Use these EXACT strings (case-sensitive). Multiple allowed.

**Trades & home services:**
Painting · Roofing · Plumbing · Electrical · HVAC · Carpentry · Flooring ·
Drywall · Concrete · Masonry · Landscaping · Tree Service · Pressure Washing ·
Gutter Cleaning · Pool Maintenance · Pest Control · Junk Removal · Moving ·
Handyman · Appliance Repair · Construction (general) · Remodeling · Inspection

**Auto:**
Auto Repair · Auto Detailing · Auto Parts · Towing · Rideshare

**Cleaning & personal:**
Cleaning · Cleaning (house) · Cleaning (commercial) · Laundry · Tailoring

**Food:**
Cooking (home) · Restaurant · Bakery · Catering · Food Delivery

**Care & lifestyle:**
Childcare · Tutoring · Petcare · Elder Care · Beauty (hair/nails) · Massage ·
Photography · Videography · Event Planning · Music/DJ · Fitness

**Professional:**
Shipping/Paqueteria · Taxes/Accounting · Legal · Translation · Notary ·
Insurance · Immigration · Real Estate

**Retail:**
Retail (clothing) · Retail (electronics) · Retail (furniture) ·
Retail (grocery) · Retail (other) · Jewelry

**Housing:**
Rentals (room) · Rentals (house) · Rentals (equipment)

**Misc:**
Religious · Other

If the post truly fits none of the above, add a Title Case custom tag — but
check the list twice first.

---

## 5. Confidence scoring

Be honest. Use the full range:

| Range     | When to use                                                      |
|-----------|-------------------------------------------------------------------|
| 0.95-1.00 | Crystal clear: named business, explicit intent, explicit phone   |
| 0.85-0.94 | Clear intent and category, maybe missing one minor field         |
| 0.70-0.84 | Intent clear, but some ambiguity (vague location, unclear price) |
| 0.50-0.69 | Genuinely ambiguous post, image-only with thin comments           |
| 0.00-0.49 | Almost no signal — very rare                                     |

**Do not put 0.95 on everything.** A good batch has a spread of values.
Using 0.99 for every result is a flag that you're rubber-stamping.

---

## 6. Special cases quick reference

| Situation                                  | How to encode                                            |
|---------------------------------------------|----------------------------------------------------------|
| Empty post (no text, no comments)           | Won't reach you — auto-tagged upstream                   |
| Image-only with informative comments        | Analyze based on comment context, `conf` 0.7-0.85        |
| Link-only post (Facebook story share)       | `intent: "informational"`, `sum: "Sharing Facebook story link"`, `conf` 0.6 |
| Spanish post you can't read well            | Translate key nouns, do your best, `conf` 0.5-0.7        |
| Religious prayer / devotion / Bible quote   | `intent: "personal"`, `cats: ["Religious"]`              |
| Church event or service announcement        | `intent: "event"`, `cats: ["Religious"]`                 |
| Condolence / death / prayer for family      | `intent: "personal"`, `cats: ["Religious"]` if invoking God |
| Rental (house, room, trailer)               | `intent: "offering"`, `isBusiness: true`, `cats: ["Rentals (...)"]` |
| Used item for sale by individual            | `intent: "offering"`, `isBusiness: false`, `cats: ["Retail (other)"]` or specific |
| Hiring workers (yard, roofing, kitchen)     | `intent: "offering"`, `isBusiness: true`, cat = the trade |
| Looking for job                             | `intent: "seeking"`, `isBusiness: false`, cat = the trade |
| Duplicate story links (same URL twice)      | Classify both identically, note "duplicate" in `sum`     |
| Spam ("earn $25/hour from home")            | `intent: "spam"`, `conf: 0.8`                             |

---

## 7. Pre-submit checklist

Before writing `batch-output.json`, verify:

- [ ] `results.length === posts.length`
- [ ] Every result has all 14 fields present (null/false/[] when not applicable)
- [ ] No `sum` equals `"No summary available."` or is empty on a post with real text
- [ ] Every phone number visible in post/comments appears in `phones[]`
- [ ] `intent === "other"` appears on at most ~2 results (if more → rethink)
- [ ] `conf` values are spread realistically, not all 0.95
- [ ] `cats` use canonical strings (case-sensitive)
- [ ] `batchNumber` matches input `batchNumber`

If any check fails, fix it before saving. The `save-batch.js` validator will
reject placeholder summaries and missing fields, wasting your time.
