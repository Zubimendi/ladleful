# Ladleful: Product Requirements Document

| Field | Value |
|---|---|
| Owner | Francis Offiong |
| Status | Draft v1 |
| Track | Mobile portfolio, Week 3, Project 5 |
| Stack | React Native (Expo) |
| Build window | Tue 24 Nov to Wed 25 Nov 2026 |
| Target ship | Wed 25 Nov 2026, 11 PM (hard stop) |

## 1. Summary

Ladleful is an offline-first recipe box. Users keep recipes on their phone, find them instantly, scale servings, cook with a keep-awake step view and timers, merge several recipes into one shopping list, and import and export their data (link, pasted text, backup file). An optional account backs up and syncs recipes and lists.

## 2. Problem

Recipes are scattered across bookmarks, screenshots and chats; web pages load poorly on weak data and bury the steps; scaling and combining quantities for shopping is manual arithmetic; and many tools lock data in. (Validate with 3 regular cooks before or during the build.)

## 3. Users

| Persona | Needs |
|---|---|
| Home cook | Recipes in one place, instant search, big readable steps, scaling |
| Weekly planner | Combined shopping list across recipes, shareable as text |

## 4. Goals and non-goals

**Goals**
- G1. Every read (browse, search, cook, scale, shop) works with no network and no account
- G2. Search results appear within 50 ms on a library of 1,000 recipes
- G3. Ingredient lines are understood with explicit, tested rules and visible doubts
- G4. Imports are safe: validated, bounded and reviewed before saving
- G5. Export and restore round-trip with no data loss
- G6. Smooth on a low-end Android phone

**Non-goals**
- Meal planning calendars, nutrition calculation, grocery delivery
- Scraping unstructured pages, bulk import, crawling
- Social features, public sharing
- Unit conversion between metric and cup/spoon systems
- Encryption at rest

## 5. Scope and priorities

| Priority | Items |
|---|---|
| **P0** (must ship) | Onboarding with sample recipes; library with FTS search, favorites, tags and under-30 filter; recipe CRUD with line-per-ingredient entry and live parse preview; recipe detail with servings scaling; cooking mode with keep-awake, steps and in-app timers with suggestions; shopping lists built from recipes with merge, aisles and pantry staples; share recipe and list as text; backup export and import (versioned JSON, validation, conflict choice); link import via structured recipe data with review; undo toasts; empty and error states; docs |
| **P1** (should ship) | Paste-text import; Markdown export of a recipe; cover photo (local only); timer notifications when backgrounded; dark theme; optional account with outbox sync and sync chip; draft autosave polish |
| **P2** (if time allows) | Dev demo-library generator; photos in backups; image sync; receive links from the share sheet; tag management screen; per-recipe notes history |

**Cut order if behind schedule:** image-related items, then sync (ship local-only and say so), then dark theme, then Markdown export, then notification timers, then paste-text import. Never cut: the ingredient parser, FTS search, link import, backup export and import.

## 6. User stories and acceptance criteria

| ID | Story | Acceptance criteria | Pri |
|---|---|---|---|
| US-01 | As a new user, I can start without an account | First launch offers sample recipes and no signup | P0 |
| US-02 | I can find recipes instantly | Typing filters results per keystroke (debounced); prefix matching on titles, ingredients, tags and notes; under 50 ms on 1,000 recipes; works offline | P0 |
| US-03 | I can filter the library | Favorites, Under 30 minutes (prep plus cook), and tag chips combine with search | P0 |
| US-04 | I can write a recipe quickly | Title, servings, times, tags, ingredients (one per line), steps (one per line), notes, source link | P0 |
| US-05 | I see how my ingredients are understood | Live pills show quantity, unit, name and note; unsure lines show a warning; raw text always retained | P0 |
| US-06 | I can edit and delete recipes | Edit saves; delete shows an undo toast | P0 |
| US-07 | I can scale servings | Stepper rescales quantities with friendly fractions; "to taste" lines are unchanged; notice that steps are not scaled | P0 |
| US-08 | I can cook with a step view | Full-screen steps, large text, screen stays awake, back and next, ingredient sheet | P0 |
| US-09 | I get timer suggestions | Durations in step text become timer chips; multiple timers; remaining time correct after backgrounding | P0 |
| US-10 | I can mark favorites and track cooking | Favorite toggle; "Cooked it" increments a counter and last cooked date | P0 |
| US-11 | I can build a shopping list from recipes | Pick recipes and servings; quantities merge within safe unit families; unmergeable lines stay separate; grouped by aisle | P0 |
| US-12 | I can manage a shopping list | Check items, add manual items, clear checked, rename and archive lists | P0 |
| US-13 | Pantry staples are skipped | Items in my staples list are omitted from generated lines and the count is shown | P0 |
| US-14 | I can share as text | Recipe or list shares as clean plain text including the source link | P0 |
| US-15 | I can export a backup | JSON file with schema version, recipes and lists; opens in the share sheet | P0 |
| US-16 | I can import a backup safely | File validated (size, count, schema, version); summary shown; conflict choice (skip, replace, keep both); clear errors | P0 |
| US-17 | Backups round-trip | Export, wipe, import yields identical recipe fields (test) | P0 |
| US-18 | I can import from a link | URL fetched with limits; structured recipe data mapped; opens in review; clear messages for offline, timeout, no data | P0 |
| US-19 | Imports are always reviewed | Nothing is saved until I confirm in the editor | P0 |
| US-20 | I can import pasted text | Heuristic split into title, ingredients, steps; review before saving | P1 |
| US-21 | I can export a recipe as Markdown | File through the share sheet | P1 |
| US-22 | I can add a cover photo | Camera or gallery; resized and stored locally; thumbnail in lists | P1 |
| US-23 | Timers notify me when the app is backgrounded | Local notification at the end time; cancelled if the timer is cancelled | P1 |
| US-24 | I can use dark theme | System, light, dark; applies instantly | P1 |
| US-25 | I can sign in to back up and sync | Optional; local data uploads; chip shows state; app fully usable without it | P1 |
| US-26 | Sync is safe | Killing the app mid-sync loses nothing; retries use backoff; no duplicates | P1 |
| US-27 | Accounts never mix silently | Different account than the local data's owner prompts to replace or cancel | P1 |
| US-28 | The app is accessible | Labels, roles, 48 dp targets (64 dp in cooking mode), 200% text scale | P0 |

## 7. Functional requirements

- FR-1. Every read comes from local SQLite; no screen blocks on the network
- FR-2. Recipe writes update the recipe row, tag rows and FTS row in one transaction
- FR-3. The raw ingredient line is always stored with its parsed form
- FR-4. IDs are generated on the client; deletes are soft (tombstones)
- FR-5. Importers return a draft recipe plus warnings; only the editor's Save persists it
- FR-6. Link fetches: http and https only, 15 s timeout, 2 MB cap, HTML content types, no credentials, generic user agent
- FR-7. Backup import: file size cap 20 MB, at most 5,000 recipes, zod schema validation, strings length-limited, unknown fields dropped
- FR-8. Timers persist an absolute end time and survive app restarts
- FR-9. Tokens are stored in secure storage
- FR-10. API rules restrict each user to their own records

## 8. Non-functional requirements

| Area | Requirement (targets, measure on a release build on a low-end Android phone) |
|---|---|
| Startup | Cold start to interactive under 2 s |
| Search | Results under 50 ms per query on 1,000 recipes |
| Open recipe | Detail screen under 100 ms |
| Scrolling | 60 fps in the library with 1,000 recipes |
| Import | Parsing a fetched page under 500 ms (excluding network) |
| Size | Release APK under 40 MB |
| Correctness | Parser table, merge and scaling tests pass; index equals rebuild; round trip lossless |
| Offline | All P0 flows except link import pass in airplane mode |
| Security | Untrusted input validated and bounded; plain-text rendering; token in secure store; owner-scoped rules |
| Privacy | No analytics SDKs; nothing leaves the phone unless the user imports a link or signs in |
| Accessibility | WCAG AA contrast targets; screen reader labels; 200% text scale |

## 9. Success criteria

- [ ] Ingredient parser passes at least 60 table cases, including fractions, ranges, unicode, unknown units and notes
- [ ] Search index equals a full rebuild after 500 random operations
- [ ] Backup round trip test passes with 0 field differences
- [ ] Link import tried on at least 5 real pages; success and failure counts recorded in `story.md`
- [ ] Shopping merge tests pass (families, conversions, unmergeable lines, checked-state rules)
- [ ] Performance budgets measured and recorded
- [ ] All seven docs complete and the demo recorded

## 10. Schedule

| When | Work | Done when |
|---|---|---|
| Tue AM | Docs complete, FTS5 availability check in expo-sqlite | `cursorcontext.md` ready for the agent |
| Tue midday | Scaffold, theme, Drizzle schema with FTS, pure domain modules with tests (parser, units, format, scaling, timers) | T1 to T8 pass |
| Tue PM | Library, search, editor with live parse, detail with scaling, favorites, share text | Fully usable offline, single device |
| Tue evening | Shopping lists: merge, aisles, pantry staples, share | All shopping stories pass |
| Wed AM | Cooking mode with timers, backup export and import, link import with review | All P0 stories pass |
| Wed midday | Paste import, dark theme, photos, notification timers, account sync (as time allows) | P1 per the cut order |
| Wed PM | Performance measurements, docs sync, demo recording | Everything recorded |
| Wed 11 PM | **Hard stop.** Unfinished items go to Known limitations | Shipped |

Thursday morning is not a buffer; Lockleaf starts Thursday.

## 11. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| FTS5 not available in the Expo SQLite build | Search design changes | Check first on Tuesday morning; fallback is an indexed LIKE over a normalized text column, with the limitation noted |
| Parser edge cases eat time | Slow progress | Table-driven tests first; unknown input stays as raw text rather than failing |
| Link import works on fewer sites than expected | Weak demo | Try 8 pages early; keep paste text as the honest fallback |
| Unit merging gives wrong totals | Loss of trust | Merge only within safe families; tests for each family; unmergeable lines stay separate |
| Scope too large for two days | Misses the ship date | Strict P0, cut order, local-only ships alone |
| Keep-awake or notification setup friction | Lost hours | Use the Expo packages' documented setup; test on a real device early |
| Bad backup files crash the app | Data loss risk | Validation before any write; import in one transaction; tests with malformed files |

## 12. Assumptions and open questions

- Assumption: under 5,000 recipes and 100 shopping lists per user
- Assumption: metric display "as written" is acceptable (no unit preference screen in this version)
- Question: should "Keep both" on import add a suffix to titles? (MVP: yes, " (imported)")
- Question: should pantry staples be configurable per list? (MVP: global)

## 13. Future

Photos in backups and image sync, share-sheet links, public share links, meal planning, backend move to Go or Python with Postgres.