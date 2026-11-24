# Ladleful: Story

## The problem

Recipes are scattered: a bookmarked page that loads slowly, a screenshot, a chat message from an aunt, a note in a phone. In the kitchen the page will not load on weak data, the ads cover the steps, the screen locks mid-stir and doubling a recipe for guests means doing fractions in your head. Making the weekly shopping list from three recipes means copying and adding up quantities by hand.

None of this needs a server. It needs the recipes on the phone, a good parser and a few well-chosen tools.

## Who it's for

- **The home cook:** wants their recipes in one place that works without data and does the scaling and shopping math.
- **The weekly planner:** wants a merged shopping list across several recipes, shareable in a chat.

(Validation note, fill in after talking to 3 people who cook regularly: where their recipes live now, what they screenshot, how they make shopping lists.)

## Honest framing

Recipe managers are a mature category (Paprika and Samsung Food are well known). Ladleful does not try to beat them on features. It is a vehicle for demonstrating engineering you can feel: instant full-text search over local data, a tested ingredient parser, careful unit merging, safe handling of untrusted imports, and a versioned backup you can round-trip. Import and export are the point: people should own their data. I say that plainly in interviews.

## What I set out to prove

1. I can make reads instant and fully offline: FTS5 search, local images, no loading states for local data.
2. I can keep a derived search index consistent with its source by updating both in one transaction, and prove it with a rebuild-and-compare test.
3. I can turn messy human text into structured data (ingredient lines, web page data, pasted recipes) with explicit rules, tests and a review step.
4. I can treat every import as untrusted: size limits, schema validation, plain-text rendering and clear errors.
5. I can design a versioned export format and prove a lossless round trip.
6. I can solve a real arithmetic problem (merging and scaling quantities) without silently producing wrong numbers.

## Key decisions

| Decision | Why |
|---|---|
| Recipe stored as one document with ingredients and steps as structured JSON | Edited as a unit, simple to sync and export |
| Keep the raw ingredient line | A parser mistake never loses the user's words |
| FTS5 index updated in the same transaction as the recipe | Always consistent; repairable with a rebuild |
| Ingredient entry as one line per ingredient with live parse preview | Fastest way to type on a phone, errors visible immediately |
| Unit merging within families only (mass, metric volume, spoons and cups, count) | Converting between families is guesswork; wrong merges are worse than separate lines |
| Local measures kept as written (for example derica, tin, bunch) | Honest and useful in the target kitchens |
| Link import reads structured recipe data, not scraped text | Reliable when present; the failure mode is a clear message |
| Review before save for every import | Parsing is imperfect; the user decides |
| Timers store an absolute end time | Survives the app being backgrounded or killed |
| Share as plain text | Works in any chat app with nothing to install |
| Versioned JSON backup, validated with a schema | Round trips, forward-compatible, safe against bad files |
| Optional account | Time-to-value first; same pattern as my previous projects |

## What happened (fill in after the build)

- Built in: __ hours over two days
- Measured on [device]: search latency with 1,000 recipes __ ms; library scroll __ fps; recipe open __ ms; cold start __ ms; APK size __ MB
- Ingredient parser: __ test cases, __ real-world lines that surprised me (write the best one)
- Link import success rate on __ sites I tried: __ worked, __ needed paste text
- Round trip test: __ recipes exported and re-imported, __ field differences
- Bugs worth telling: (the unit, fraction or parsing edge case)
- What I would change: (honest list)

## What I'd do next

Photos in backups and image sync, receiving links from the share sheet, public share links, meal planning, and moving the backend to Go or Python on Postgres.

## Interview pitch (2 minutes)

"Ladleful is an offline-first recipe box. Recipes are stored as documents in SQLite, with an FTS5 index and a tag table updated in the same transaction, so search is instant and always consistent. A pure ingredient parser turns lines like '1 1/2 cups rice, rinsed' into quantity, unit, name and note, keeping the raw line so nothing is lost. Shopping lists merge quantities only within safe unit families and group by aisle. Imports treat input as untrusted: web pages are read through their structured recipe data, pasted text goes through a splitter, and backup files are validated by a schema with size limits, and everything lands on a review screen first. The backup format is versioned and I tested a lossless round trip. Cooking mode keeps the screen awake and runs timers off absolute end times so they survive backgrounding."

## Likely deep-dive questions

| Question | Short answer |
|---|---|
| Why FTS5 instead of LIKE? | Ranking, prefix matching, tokenization and speed on thousands of rows. LIKE scans everything and has no relevance. |
| How do you keep the index correct? | The repository updates the recipe, tag rows and FTS row in one transaction. A test compares the index to a full rebuild after random operations. |
| How does the ingredient parser work? | Normalize unicode fractions, extract a leading quantity (fractions, mixed numbers, ranges), match a known unit or alias, split the name from notes after commas or in parentheses, and keep the raw line. Unknown units are kept as written. |
| Why not convert cups to millilitres? | Cup sizes differ by region and by ingredient density, so a silent conversion can be wrong. Merging stays within a family and lines stay separate otherwise. |
| How do you handle web pages? | I fetch with limits (timeout, size, content type), find JSON-LD blocks, locate the Recipe object (including graphs and sections), map fields and parse durations. If none, I say so and offer paste text. |
| Is importing from a URL legal? | It is a personal, user-initiated import; the source link is kept and included when sharing. I do not republish or crawl. |
| How do you protect against bad backup files? | Size and count limits, schema validation, unknown fields stripped, IDs validated, strings length-limited, versions checked. Content is rendered as plain text. |
| How do timers survive backgrounding? | They store an absolute end timestamp and compute remaining time from the clock, so intervals pausing in the background does not matter. Notifications cover the locked-screen case. |
| How does sync work? | Same outbox pattern as my earlier projects: client IDs, LWW per record, tombstones, idempotent retries. Images are local only for now. |
| What would break at scale? | A huge library would want pagination in the list query and background indexing; 5,000 recipes is the tested ceiling. |