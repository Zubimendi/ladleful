# Ladleful: Agent Context (Cursor)

Read this file, `docs/architecture.md`, `docs/prd.md` and `docs/design.md` before writing code. Work one task at a time from section 12. After each task, stop, summarize what changed, and wait for the next instruction.

## 1. Project snapshot

Ladleful is an offline-first recipe box. React Native (Expo, TypeScript strict). SQLite (Drizzle) is the source of truth, with an FTS5 search index and a tag table updated in the same transaction as every recipe write. Pure domain modules handle ingredient parsing, units, scaling, merging and timers. Imports treat all input as untrusted and land on a review screen. An optional account syncs through a custom outbox to PocketBase. No paid services, no analytics SDKs.

If the Hearthlist repository's `src/sync` and `src/lib` folders are available, copy and generalize them (entities: recipe, shopping_list, shopping_item). If not, implement the sync design in `docs/architecture.md` section 9.

## 2. Non-negotiable rules

1. UI code never calls the network. Only `src/import` (link fetch) and `src/sync` and `src/api` do.
2. UI code never writes tables directly. All writes go through repositories in `src/db/repositories/`.
3. Every recipe write runs in **one transaction**: recipe row, tag rows, FTS row, and (if signed in) an outbox row. `rebuildSearchIndex()` must reproduce the index exactly.
4. UI reads via Drizzle live queries; search queries go through `src/db/search.ts` only.
5. **Domain modules are pure** (no React, no Expo, no database): `parseIngredient`, `units`, `formatQuantity`, `scale`, `mergeShopping`, `detectTimers`, `parseDuration`, `splitPastedText`, `jsonld` extraction, `shareText`, `backupSchema`.
6. **All imported content is untrusted.** Enforce size and count limits, validate with schema, strip unknown fields, limit string lengths, render as plain text (never as HTML or markdown that executes), open only `http` and `https` links.
7. Never save an imported draft without the user pressing Save in the editor.
8. Always keep `raw` on every ingredient line; never discard what the user typed or what the source said.
9. Time comes from `src/lib/clock.ts`; timers store an absolute `endAt` (ms epoch) and compute remaining time from the clock, never from counting intervals.
10. Tokens live in `expo-secure-store` only.
11. No new dependency without a one-line justification and my approval.
12. No raw color, spacing or font-size literals in components; use tokens.
13. No `any`. No `// @ts-ignore` without an explanatory comment and my approval.
14. Minimal diffs when editing existing files; do not rewrite whole files or reformat unrelated code.
15. Do not invent library APIs. If unsure, read installed types or docs and say what you checked.
16. Never log recipe content, URLs, notes or emails. Log ids, counts and error classes.
17. No silent TODOs. State anything deferred in your summary.

## 3. Tech stack and install policy

- Expo (current SDK), Expo Router, TypeScript strict
- Install Expo-compatible packages with `npx expo install <pkg>`
- Data: `expo-sqlite`, `drizzle-orm`, `drizzle-kit`; follow Drizzle's Expo SQLite guide; open DB with change listeners enabled for live queries (verify). **First task: verify FTS5 works in the installed expo-sqlite** with a throwaway query and report the result
- UI state: Zustand
- Lists and motion: `@shopify/flash-list`, `react-native-reanimated`, `react-native-gesture-handler`, `expo-haptics`
- Kitchen: `expo-keep-awake`, `expo-notifications` (P1 timers)
- Files and sharing: `expo-file-system`, `expo-document-picker`, `expo-sharing` or React Native `Share` (pick the one that supports text and files on both platforms; justify)
- Images (P1): `expo-image`, `expo-image-picker`, `expo-image-manipulator`
- Validation: `zod`
- Network and storage: PocketBase JS SDK, `@react-native-community/netinfo`, `expo-secure-store`
- IDs: 15-character lowercase alphanumeric strings (PocketBase-compatible)
- Tests: Jest (`jest-expo` where RN is needed; plain Jest for pure logic); HTML and JSON fixtures stored under `test/fixtures` (hand-written, not copied from real sites)
- Lint and format: ESLint, Prettier

## 4. Folder structure

```text
app/                         routes only
  (onboarding)/welcome.tsx
  (tabs)/index.tsx           Library
  (tabs)/shopping.tsx
  (tabs)/settings.tsx
  recipe/[id].tsx, recipe/edit.tsx, recipe/cook.tsx
  import/link.tsx, import/text.tsx, import/backup.tsx
  shopping/[id].tsx
src/
  db/
    schema.ts, client.ts, migrations/
    repositories/            recipes.ts, shopping.ts, settings.ts, outbox.ts
    search.ts                query builder and executor; index maintenance; rebuild
  domain/
    ingredient.ts            parseIngredient, parseLines
    units.ts                 table, aliases, families, convert within family
    quantity.ts              formatQuantity, parseQuantity
    scale.ts                 scaleIngredients
    shopping.ts              mergeShopping, aisle classification
    timers.ts                detectTimers, remaining
    duration.ts              parseDuration (ISO 8601 and plain)
  import/
    jsonld.ts                extract Recipe from HTML
    link.ts                  fetch with limits, call jsonld
    text.ts                  splitPastedText
    backup.ts                zod schema, validate, plan import, apply
  export/
    shareText.ts, markdown.ts, backup.ts
  sync/                      engine, outbox, push, pull, backoff, merge, status
  api/                       pb.ts, auth.ts, errors.ts
  features/                  hooks and components per feature
  ui/                        theme tokens, shared components
  lib/                       id.ts, clock.ts, logger.ts, html.ts
  data/                      aisles.ts, units.ts data, starterRecipes.ts
backend/
docs/
```

## 5. Data model

Defined in `docs/architecture.md` section 4. Recipes store `ingredients` and `steps` as JSON text. Derived tables (`recipe_tags`, `recipes_fts`) are local only and never synced.

## 6. Domain rules (specify exactly; see architecture section 5)

- Ingredient line grammar: optional leading quantity (integer, decimal, fraction `1/2`, mixed `1 1/2`, unicode `½`, range `2-3` or `2 to 3`), optional unit (from the table, case-insensitive, trailing period allowed), then name; text after the first comma or inside parentheses becomes `note`; a trailing `:` makes a group heading; no quantity means `qty = null` (for example "salt to taste").
- Unknown unit words directly after a quantity are kept as the unit as written (local measures).
- Ranges store `qty` (lower) and `qtyMax` (upper); scaling scales both.
- Unit families: `mass` (g, kg, oz, lb), `volume_metric` (ml, l), `volume_spoon` (tsp, tbsp, cup), `count` (none, piece), `other` (anything else, merged only when the unit string is identical).
- Merge key: normalized name plus family key (`other:<unit>` for others). Normalize names: lowercase, trim, strip a trailing plural `s` or `es` for words longer than 3 letters (not `ss`), collapse spaces, drop prep words after commas.
- Merging sums within a family after converting to the family base (g, ml, tsp), then formats using the largest unit whose value is at least 1.
- Quantity formatting: nearest of 1/8, 1/4, 1/3, 1/2, 2/3, 3/4 for values under 10 in spoon, cup and count; whole numbers above 10; mass and volume metric round to a sensible step (nearest 5 above 100) and switch to kg or l at 1000; use unicode fractions for 1/8, 1/4, 1/3, 1/2, 2/3, 3/4.
- Timers: detect `N unit` and `N-M unit` with units seconds, minutes, hours (and abbreviations); use the upper bound of ranges.
- Aisles: Produce, Grains and staples, Proteins, Dairy and eggs, Oils and spices, Drinks, Household, Other; keyword catalog in `src/data/aisles.ts`; default Other.

## 7. Import and export rules

- **Link import:** validate scheme, fetch with 15 s timeout, 2 MB cap, accept HTML only, no credentials, generic user agent. Extract `application/ld+json` blocks with a bounded regex; skip invalid JSON blocks; find a Recipe (in arrays, `@graph`, or nested); map name, description, image (first string or url), recipeYield (first number), times (ISO 8601), recipeIngredient, recipeInstructions (string, strings, HowToStep, HowToSection), keywords and category to tags, author and url to source. Return `{draft, warnings}` or a typed failure (`offline`, `timeout`, `notHtml`, `tooLarge`, `noRecipeData`).
- **Paste text:** detect headings "Ingredients" and "Method", "Steps", "Directions", "Instructions" (case-insensitive); first non-empty line is the title; otherwise return a draft with everything in notes and a warning.
- **Backup:** `{app: 'ladleful', schemaVersion: 1, exportedAt, recipes: [...], shoppingLists: [...]}`; reject unknown major versions with a typed error; plan import before writing (counts of new, existing, invalid), apply in one transaction; conflict modes `skip`, `replace`, `keepBoth` (new id, title suffix " (imported)").
- **Share text format:** title, servings and time line, blank line, ingredients as "- qty unit name", blank line, numbered steps, blank line, source link and "Shared from Ladleful".

## 8. Sync rules (only when signed in; P1)

- Entities: recipe, shopping_list, shopping_item. One LWW timestamp (`updated_at`) per record.
- Outbox: coalesce before drain (create+updates becomes one create; create+delete for an unsynced entity drops both; updates+delete becomes delete). Order: lists before items.
- Retryable (network, timeout, 5xx, 429): backoff base 2 s, factor 2, jitter plus or minus 20%, cap 5 minutes; stop the drain to preserve order. Permanent (400, 403, 422): park the op and continue. 401: refresh once, then flag "needs sign-in", keep local use intact. 409 `stale_write`: fetch the server record, apply, drop the op. Duplicate create: GET and treat as success. Delete 404: success.
- Pull `updated >= cursor`, sorted `updated,id`, 200 per page, idempotent apply, skip entities with pending outbox ops. After applying recipes, update tag and FTS rows in the same transaction.
- Account guard: store `sync_owner_id`; signing in as a different user prompts "Replace local data or cancel".
- Cover images are local only; do not sync or back them up in this version.
- Start the engine after the first interactive render, never at module load.

## 9. Error handling rules

- Use a `Result<T, AppError>` pattern in repositories, importers and API wrappers.
- Error classes: `network`, `transient`, `auth`, `forbidden`, `validation`, `conflict`, `notFound`, `local`, `import` (with subtype), `unknown`.
- UI never shows raw error strings; use microcopy from `docs/design.md`.
- Each route exports an Expo Router `ErrorBoundary`.
- A database failure shows a recovery screen with Restart; never auto-delete data.

## 10. UI rules

- Follow `docs/design.md`: tokens, 48 dp targets (64 dp in cooking mode), plain-text rendering of recipe content.
- Every interactive element gets `accessibilityRole`, label and state. Respect reduce motion.
- Use FlashList for the library and shopping items with memoized rows and stable keys.
- Cooking mode uses `useKeepAwake` only while mounted and focused.
- System fonts only.

## 11. Testing rules

- Pure modules first, with tests before use: parser (60+ table cases), units and families, quantity formatting and scaling, merge, timers, duration, jsonld (fixtures: single object, array, `@graph`, HowToSection, string instructions, malformed block, no recipe), text splitter, backup validate and plan (valid, wrong app, newer version, oversized, malformed, conflicts), share text, FTS query builder (operator stripping, prefix, empty).
- Index consistency: after random create, edit, tag change and delete, assert `recipes_fts` and `recipe_tags` equal `rebuildSearchIndex()` output (use a device or SQLite build with FTS5; if not possible in Jest, say so and cover it with a dev-only on-device check).
- Round trip: export a generated library, wipe, import, assert deep equality of recipe fields (except ids when `keepBoth`).
- Sync integration test with a fake server (network, 500, 429, 401, 409, duplicate create, crash between success and outbox delete).
- Run `npm run typecheck`, `npm run lint` and `npm test` before declaring a task done.

## 12. Build order

Each task is done only when its acceptance check passes.

| Task | Work | Acceptance |
|---|---|---|
| T1 | Scaffold Expo app, strict TS, Expo Router, ESLint, Prettier, alias; verify FTS5 in expo-sqlite | App boots; FTS5 check reported |
| T2 | Theme tokens and base components | Light and dark render; no raw literals |
| T3 | Drizzle schema (including FTS and tag tables), client, migration | DB created on first launch |
| T4 | `units`, `quantity`, `scale` with tests | Tests pass |
| T5 | `ingredient` parser with the 60+ case table | Tests pass |
| T6 | `timers`, `duration` with tests | Tests pass |
| T7 | `search.ts` (query builder, index maintenance, rebuild) and recipe repository with transactional writes | Index consistency test passes |
| T8 | Starter recipes and onboarding | Samples appear on first run |
| T9 | Library: search, filters, favorites, cards | Works in airplane mode; search under 50 ms on a generated library |
| T10 | Recipe editor with live parse preview and drafts | Save creates recipe, tags and index in one transaction |
| T11 | Recipe detail with servings scaling, cooked counter, delete with undo | Scaling matches tests |
| T12 | Share as text (recipe) | Output matches format |
| T13 | `shopping` merge, aisles and catalog with tests | Merge tests pass |
| T14 | Shopping list screens, add from recipes, pantry staples, share list | All shopping stories pass |
| T15 | Cooking mode: steps, keep-awake, ingredient sheet, in-app timers with absolute end times | Timer survives backgrounding |
| T16 | Backup export | File validates against the schema |
| T17 | Backup import: validate, plan, conflict modes, apply | Round trip test passes; malformed files rejected |
| T18 | `jsonld` extractor with fixtures and `link` fetcher | Fixtures pass; limits enforced |
| T19 | Link import screen with review editor | All error states reachable |
| T20 | Paste-text import (P1) | Splitter tests pass |
| T21 | Markdown export (P1), dark theme (P1) | Opens and applies |
| T22 | Cover photos (P1, local only) | Thumbnail shown in the library |
| T23 | Notification timers (P1) | Notification fires when backgrounded |
| T24 | Backend: collections, rules, hooks, migrations | Cross-user access rejected (manual) |
| T25 | Auth, owner guard, outbox, push, pull, sync chip (P1) | Second device shows the same recipes |
| T26 | Error boundaries, accessibility pass, empty states | Screen reader and 200% font checks pass |
| T27 | Dev demo-library generator, performance pass, measurements | Budgets recorded in `story.md` |
| T28 | README, scripts, docs sync | New clone runs from README alone |

## 13. Definition of done (every task)

- Acceptance check passes
- `npm run typecheck`, `npm run lint`, `npm test` green
- No new dependency without approval
- No raw literals in UI; accessibility props present
- Summary lists files changed, decisions made and anything deferred

## 14. Stop and ask when

- FTS5 is not available in the installed expo-sqlite
- A requirement conflicts with a library's actual behavior
- A new dependency seems necessary
- The data model would need to change

## 15. Starter prompts

> "Read cursorcontext.md, architecture.md, prd.md and design.md. Do T1 only. Stop when its acceptance check passes and summarize, including whether FTS5 works."

> "Do T5. First write the full table of parser test cases (input line and expected quantity, unit, name, note), show it to me, then implement the parser to pass it."