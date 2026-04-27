# Agent Loop — run until ALL DONE

You are analyzing a large corpus of Facebook group posts. Your job is exactly
this loop, repeated until completion:

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. Read   analysis/batch-input.json                              │
│ 2. Write  analysis/batch-output.json   (one result per post)     │
│ 3. Run    node analysis/next-batch.js                            │
│ 4. GOTO 1  — unless step 3 printed "🎉 ALL DONE" or "❌"          │
└──────────────────────────────────────────────────────────────────┘
```

Nothing else. No questions. No pauses. No "shall I continue?". Just loop.

---

## The three non-negotiable rules

1. **Follow `analysis/SCHEMA.md` exactly.** Every result has 14 fields.
   Never skip fields, never use `"No summary available."`, never default to
   `intent: "other"`.

2. **Never stop between batches unless you see `❌` or `🎉 ALL DONE`.**
   A successful `next-batch.js` run means: immediately read the new
   `batch-input.json` and keep analyzing.

3. **Don't ask the user for anything mid-loop.** No confirmation prompts,
   no "is this right?" summaries between batches. The user expects you to
   grind through until done.

---

## Step detail

### Step 1 — Read `analysis/batch-input.json`

Shape: `{ batchNumber, generatedAt, size, posts: [...] }`

Each post: `{ id, by, t (date), url, text, imgs, rx, c (comments[]) }`

### Step 2 — Write `analysis/batch-output.json`

```json
{
  "batchNumber": <same number from input>,
  "analyzedAt": "<ISO timestamp>",
  "results": [
    { /* one object per input post, in same order, following SCHEMA.md */ }
  ]
}
```

**Before saving, run the mental checklist from SCHEMA.md §7.**

### Step 3 — Run the loop command

```
node analysis/next-batch.js
```

This single command does all of the following atomically:

1. Validates your output (14 required fields, no placeholder summaries)
2. Merges results into `analysis/analysis-db.json`
3. Auto-patches any phone numbers you missed (regex scan of raw text)
4. Archives the batch to `analysis/history/batch-NNNN-*.json`
5. Deletes `batch-output.json`
6. Prepares the next `batch-input.json`

**Read the output of this command carefully:**

- `🎉 ALL DONE` — STOP. You're finished. Do not loop.
- `❌` — STOP looping. Read the error, fix `batch-output.json`, re-run. The
  most common errors are:
  - A required field is missing on some post → add it, don't guess
  - A `sum` is `"No summary available."` or empty → write a real summary
  - `batchNumber` doesn't match input → set it correctly
- Anything else → success. Go to step 1 immediately.

---

## What good output looks like

Spread your confidence values. A typical 100-post batch has roughly:

- 20-40 posts at `conf` 0.90-0.99 (clear commercial or personal posts)
- 40-60 posts at `conf` 0.75-0.89 (clear but with minor ambiguity)
- 10-20 posts at `conf` 0.55-0.74 (image-only, link shares, cryptic text)
- 0-5 posts at `conf` 0.5 or below

`intent` distribution typically breaks down roughly like:

- `offering`: 25-40% (lots of food/services/rentals/hiring)
- `seeking`: 15-25%
- `personal`: 10-20% (greetings, religious)
- `event`: 8-15%
- `informational`: 5-15%
- `news`: 2-8%
- `other`: 0-5% — **if you're using this for >10% of a batch, you are
  being lazy. Re-read SCHEMA.md §2.**

---

## Forbidden patterns (these will be rejected by the validator)

❌ `"sum": "No summary available."`
❌ `"sum": ""`
❌ Missing any of the 14 required fields
❌ `batchNumber` that doesn't match the input
❌ Fewer results than input posts
❌ A phone number visible in the raw text but missing from `phones[]`
❌ Using `intent: "other"` on an obvious church/food/rental/hiring post

---

## Starting the loop (first time in a session)

1. Read `analysis/SCHEMA.md` once — memorize the 14 fields and intent tree.
2. Read `analysis/AGENT-LOOP.md` (this file) once.
3. Read `analysis/batch-input.json`.
4. Begin analyzing. Do not stop until `🎉 ALL DONE` or `❌`.

## Resuming (if interrupted)

Just start the loop. If you're unsure whether the last output was saved, run
`node analysis/next-batch.js` first — it's safe: if nothing is pending to
save, it just prepares the next batch.

---

## Progress snapshot (optional — check whenever curious)

```
node -e "const d=require('./analysis/analysis-db.json');console.log(Object.keys(d.results).length,'done /',32429,'total | nextBatch',d.meta.nextBatch)"
```

Total posts in corpus: **32,429**. Batch size default: **100**.
That's ~320 batches. Keep going.
