# Ladleful

[![Platform](https://img.shields.io/badge/platform-Android%20%7C%20iOS-lightgrey)](https://expo.dev/)
[![Expo](https://img.shields.io/badge/Expo-React%20Native-000020?logo=expo)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Backend](https://img.shields.io/badge/backend-PocketBase-B8DBE4)](https://pocketbase.io/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Tests](https://img.shields.io/badge/Tests-96%20Passing-brightgreen)]()
[![Postman](https://img.shields.io/badge/Postman-55%20Passing-brightgreen)]()

An offline-first recipe box for Android and iOS. Project 5 of a 15-week mobile portfolio.

Recipes are scattered everywhere: bookmarked pages that won't load on weak data, screenshots, chat messages from relatives, notes in a dozen apps. Ladleful fixes this by making the **phone the database** — every recipe lives in SQLite, search is instant, quantities scale to any serving count, and a few taps build a merged shopping list from several recipes at once. Import from a link, pasted text, or a backup file. Export any time. No ads, no server required.

---

## Architectural Core: The Three Pillars

Ladleful is designed around three foundational principles documented in `docs/ARCHITECTURE.MD`:

### 1. The Phone Is the Source of Truth

Every read, search, scale, and merge runs against local SQLite — no network required for any P0 flow. A derived full-text index (`recipes_fts`) and a tag table (`recipe_tags`) are updated **in the same transaction** as every recipe write, so the index is always consistent and repairable with a single rebuild call.

```sql
-- FTS5 virtual table with prefix indexes and unicode tokenization
CREATE VIRTUAL TABLE recipes_fts USING fts5(
  recipe_id UNINDEXED,
  title, ingredients, tags, notes,
  tokenize = 'unicode61 remove_diacritics 2',
  prefix = '2 3'
);
```

Search performance: **sub-50 ms** over 1,000 recipes on a low-end device. Queries use BM25 ranking with title weighted higher, prefix matching (`"tok"*`), and a 200-result cap. The list query never parses per-row JSON — ingredients and steps are loaded lazily on the detail screen only.

| Write path | Consistency guarantee |
|---|---|
| Recipe create / update / delete | FTS row + tag rows replaced atomically in the same tx |
| Backup import | Full rebuild after the transaction; tested round-trip |
| Sync pull (bulk) | Tags and FTS updated per-recipe inside the same tx |
| `rebuildSearchIndex()` | Drop and recreate both tables from `recipes`; used as the test oracle |

### 2. Parsing Is Explicit, Not Magic

`parseIngredient(line) → Ingredient` follows a deterministic grammar with no ML. The raw line is **always preserved**, so a parse mistake never loses the user's words.

**Grammar steps:**
1. Trim; remove list markers (`-`, `*`, bullets, `1.` only before a space + non-digit)
2. If the line ends with `:` and has no quantity → group heading
3. Normalize unicode fractions (`½` → `1/2`, `1½` → `1 1/2`), en-dashes in ranges, `to` in ranges
4. Parse leading quantity: integer, decimal, `a/b`, mixed `a b/c`, or range `x–y` / `x to y`
5. Match unit: next token against the unit table and aliases (case-insensitive, optional trailing period); unknown short words accepted only when a quantity precedes and ≥2 tokens remain → `warn = true`
6. Parentheses: `(400 g)` → note, unless it contains the only quantity
7. Split name and note at the first comma; strip leading `of`
8. No name remaining → `name = raw`, `warn = true`

**Parser test cases (starter set — 60+ in the suite):**

| Input | qty | unit | name | note |
|---|---|---|---|---|
| `2 cups rice` | 2 | cup | rice | — |
| `1 1/2 tbsp olive oil` | 1.5 | tbsp | olive oil | — |
| `½ tsp salt` | 0.5 | tsp | salt | — |
| `500g tomatoes, chopped` | 500 | g | tomatoes | chopped |
| `2-3 cloves garlic` | 2 (max 3) | clove | garlic | — |
| `salt to taste` | null | null | salt | to taste |
| `3 large eggs` | 3 | null | large eggs | — |
| `1 (400 g) tin tomatoes` | 1 | tin | tomatoes | 400 g |
| `2 derica rice` | 2 | derica ⚠️ | rice | — |
| `A pinch of nutmeg` | 1 | pinch | nutmeg | — |
| `For the sauce:` | — | — | *(group heading)* | — |
| `Pepper` | null | null | pepper | — |

**Unit families** (no cross-family conversion — silent wrong merges are worse than separate lines):

| Family | Canonical units | Base |
|---|---|---|
| mass | g, kg, oz, lb | g |
| volume_metric | ml, l | ml |
| volume_spoon | tsp, tbsp, cup | tsp |
| count | piece, pc | count |
| other | clove, slice, pinch, bunch, tin, can, derica, … | exact string |

### 3. Every Import Is Untrusted

Three import paths exist. All three funnel through a **review screen before anything is saved**.

**Link import:** `15 s timeout · 2 MB cap · HTML only → JSON-LD → Recipe object → mapped fields → draft`

```
URL entered → Online? → Fetch (bounded) → Extract ld+json blocks
  → Recipe object found? → Map fields + parse durations + parse ingredients
  → Draft + warnings → Review editor → Save (repository transaction)
```

If no structured data is found, the importer says so and offers paste-text as the fallback. The source URL is always kept and included when sharing.

**Backup import — validation chain:**

```json
{
  "app": "ladleful",
  "schemaVersion": 1,
  "exportedAt": 1764000000000,
  "recipes": [
    {
      "id": "abc123def456ghi",
      "title": "Tomato stew base",
      "servings": 8,
      "ingredients": [
        { "raw": "6 large tomatoes", "qty": 6, "qtyMax": null,
          "unit": null, "name": "large tomatoes", "note": null,
          "group": null, "warn": false }
      ],
      "steps": [{ "text": "Blend the tomatoes." }],
      "tags": ["stew"],
      "isFavorite": true
    }
  ],
  "shoppingLists": []
}
```

| Validation layer | Rule |
|---|---|
| File size | 20 MB hard cap before JSON parse |
| App identity | `app === "ladleful"` |
| Schema version | Reject if newer than supported |
| Record count | ≤ 5,000 recipes |
| String lengths | title 200, notes 5,000, step text 2,000 |
| ID format | Regex-validated; non-matching IDs regenerated |
| Unknown fields | Stripped silently |
| Conflict modes | `skip` (default) · `replace` · `keepBoth` |
| Transaction | All-or-nothing; failure leaves nothing changed |

---

## Additional Systems

- **Servings scaling:** `scaleIngredients(ingredients, base, target)` multiplies `qty` and `qtyMax` by `target / base`; null-quantity lines (e.g. "salt to taste") are unchanged; friendly fractions on output (`1½`, `⅓`, `2⅔`)
- **Timer detection:** `detectTimers(stepText)` extracts durations from natural language; timers store absolute `endAt` timestamps — remaining time is `endAt − now`, surviving backgrounding, app kills and device restarts; a 1 s ticker runs only while the cooking screen is visible
- **Shopping merge:** quantities merged only within unit families; `merge_key = normalizedName + familyKey`; checked items unchecked when more arrives; manual items never merge with recipe items; grouped by aisle via a 150-entry static catalog
- **Outbox sync (P1):** every recipe or list write inserts an outbox row in the same transaction when signed in; drain by `seq`, coalescing create+update and dropping create+delete; exponential backoff with ±20% jitter; LWW per record; PocketBase conflict guard rejects stale writes (409 `stale_write`)
- **Aisle classification:** ~150-entry catalog in `src/data/aisles.ts` covering common local ingredients (egusi, ogbono, crayfish, palm oil, garri, yam, plantain, ugu, scotch bonnet, tatashe, iru, stockfish); normalized name + word-boundary matching; default `other`

---

## System Architecture

```
  User ──────────────────────────────────────────────────────────
                                                                  │
  ┌──────────────────────────────────────────────────────────┐   │
  │  React Native UI (Expo Router screens)                    │   │
  │  Zustand: sheet visibility, theme, toasts, timers cache   │   │
  └────────┬────────────────────────────────────┬────────────┘   │
           │ live queries / search              │ user actions   │
           ▼                                    ▼                │
  ┌─────────────────┐              ┌────────────────────────┐    │
  │ SQLite (Drizzle) │◀────────────│ Repositories           │    │
  │  recipes         │  one tx:    │  create/update/delete  │    │
  │  recipes_fts     │  recipe +   │  search query builder  │    │
  │  recipe_tags     │  fts + tags │                        │    │
  │  shopping_*      │             └────────────────────────┘    │
  │  outbox          │                        ▲                   │
  │  settings        │                        │ review → save     │
  └─────────────────┘              ┌──────────┴─────────────┐    │
                                   │ Importers              │    │
  ┌──────────────────┐             │  link  │ text  │ file  │    │
  │ Domain (pure)     │◀────────── │                        │    │
  │  parser · units  │  parse      └────────────────────────┘    │
  │  scale · merge   │                        │                   │
  │  timers · format │             ┌──────────▼─────────────┐    │
  └──────────────────┘             │ Exporters              │    │
                                   │  share text │ backup   │    │
  ┌──────────────────┐             └────────────────────────┘    │
  │ Sync engine (P1) │──▶ outbox ──▶ PocketBase API              │
  │  push · pull     │             (optional, when signed in)    │
  │  backoff · LWW   │                                           │
  └──────────────────┘                                           │
  ────────────────────────────────────────────────────────────────
```

---

## Project Structure

```
ladleful/
├── app/                    Expo Router routes (screens only)
├── src/
│   ├── db/                 Drizzle schema, migrations, repositories, search index
│   ├── domain/             ingredient parser, units, quantity format, scaling, merge, timers (pure)
│   ├── import/             jsonld extractor, link importer, text importer, backup importer
│   ├── export/             share text, markdown, backup builder
│   ├── sync/               outbox, engine, push, pull, backoff, merge
│   ├── api/                PocketBase client, auth, error mapping
│   ├── features/           screen components and hooks by feature
│   ├── ui/                 design tokens and shared components
│   ├── lib/                ids, clock, logger, html helpers
│   └── data/               aisle catalog, units table, starter recipes
├── backend/
│   ├── pb_hooks/           validation and conflict guard hooks
│   └── pb_migrations/      collections and API rules as code
├── docs/                   ARCHITECTURE.MD, STORY.MD, DESIGN.MD, PRD.MD, DEMO.MD, CURSOR_CONTEXT.MD
└── README.MD               This file
```

---

## Getting Started

### Prerequisites

- Node.js LTS and npm
- Android emulator or a physical device with Expo Go
- *(Optional)* PocketBase binary — pinned version in `backend/PB_VERSION`

### 1. Run the App (local-only, no backend needed)

```bash
npm install
cp .env.example .env
npx expo start
```

Scan the QR code with Expo Go, or press `a` for Android emulator / `i` for iOS simulator.

### 2. Run the Backend (optional sync)

```bash
cd backend
./pocketbase superuser create you@example.com 'choose-a-strong-password'
./pocketbase serve --http=0.0.0.0:8090
```

Set `EXPO_PUBLIC_API_URL` in `.env`:

| Device | URL |
|---|---|
| Android emulator | `http://10.0.2.2:8090` |
| Phone on the same Wi-Fi | `http://<your-LAN-IP>:8090` |
| Phone over USB (after `adb reverse tcp:8090 tcp:8090`) | `http://localhost:8090` |

Use HTTPS beyond local demos.

### Scripts

| Command | Purpose |
|---|---|
| `npm start` | Start Expo dev server |
| `npm test` | Run all Jest unit and integration tests |
| `npm run typecheck` | TypeScript strict check |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate a Drizzle migration after schema changes |

---

## Feature Overview

| Feature | Priority | Description |
|---|---|---|
| Recipe library | P0 | Full-text search across titles, ingredients, tags and notes; instant, offline |
| Quick filters | P0 | Favorites, under 30 minutes, by tag |
| Recipe editor | P0 | One-line-per-ingredient entry with live parse preview |
| Link import | P0 | Fetch structured recipe data (JSON-LD) from a URL; review before save |
| Paste-text import | P0 | Split pasted recipe text into title, ingredients and steps |
| Backup import | P0 | Versioned JSON file; zod schema validation; conflict resolution modes |
| Servings scaler | P0 | Multiply quantities to any serving count; friendly fraction output |
| Cooking mode | P0 | Large steps, screen kept awake, ingredient sheet, timer chips |
| Timers | P0 | Absolute end times; survive backgrounding and app restart |
| Shopping list | P0 | Build from multiple recipes; quantities merged within unit families; grouped by aisle |
| Share as plain text | P0 | Recipe or shopping list via any chat app |
| Backup export | P0 | Versioned JSON; round-trip tested |
| Optional account / sync | P1 | PocketBase outbox sync; LWW per record |
| Timer notifications | P1 | Local notification at `endAt` |
| Cover images | P1 | Local storage and sync |
| Markdown export | P1 | Recipe as `.md` file |
| Public share links | Roadmap | Server-hosted recipe URLs |
| Meal planning | Roadmap | Plan a week of recipes |

---

## Test Suite

```bash
npm test
```

| Test area | What it proves |
|---|---|
| Parser table (60+ cases) | Every grammar rule fires correctly on real ingredient lines |
| Unit families and aliases | All canonical units and aliases resolve; unknown units warn |
| Quantity formatting | `1.5 cup` → `1½ cup`; `0.333 tsp` → `⅓ tsp`; `1500 g` → `1.5 kg` |
| Quantity parsing | `parseQuantity` is the exact inverse of `formatQuantity` for editing |
| Scaling | `qty × (target/base)`; null-qty lines unchanged; factor must be positive |
| Shopping merge | Within-family sums correct; cross-family kept separate; manual items isolated |
| Timer detection | Natural-language durations extracted; ranges use upper bound |
| ISO duration parsing | `PT1H15M` → 75 minutes; edge cases (missing fields, fractional) |
| JSON-LD extraction (fixtures) | Recipe object found inside graphs, sections and nested arrays |
| Text splitter | Heading detection (Ingredients / Steps / Method) on fixture pastes |
| Backup schema validation | Valid file passes; oversized / wrong-app / newer-version files rejected with typed errors |
| Backup import planning | `new`, `existing`, `invalid` counts correct; conflict modes behave |
| Share text formatting | Plain-text recipe and shopping list match the specified format |
| FTS query builder | Tokens quoted and prefixed; operator chars stripped; empty query returns unfiltered |
| Index consistency | FTS and tag tables equal a full rebuild after 500 random write operations |
| Backup round trip | `import(export(R))` deep-equals `R` for all exported fields |
| Outbox coalescing | create+update → one create; create+delete → both dropped; update+delete → delete |
| Sync engine | Drain, pull, backoff, 401 refresh, 409 resolution, duplicate-create as success — against a fake server with injected failures |

---

## Postman Collection

A Postman collection covering the PocketBase sync API (auth, recipes, shopping lists, shopping items, conflict scenarios):

```
docs/ladleful.postman_collection.json
```

Import into Postman, or run via Newman CLI:

```bash
newman run docs/ladleful.postman_collection.json \
  --env-var "baseUrl=http://localhost:8090" \
  --env-var "userEmail=you@example.com" \
  --env-var "userPassword=your-password"
```

---

## Design Decisions (Settled — Don't Relitigate)

1. **Recipe as one document with JSON ingredients and steps.** Edited and synced as a unit; simpler to export and round-trip than normalized ingredient tables.
2. **FTS5 for search.** Ranking, prefix matching, unicode tokenization and speed on thousands of rows. LIKE scans everything and has no relevance ordering.
3. **Derived index updated in the same transaction.** Explicit and testable; repairable by rebuild. Triggers would hide the dependency; lazy indexing would allow stale reads.
4. **Keep the raw ingredient line always.** A parse mistake never loses the user's words. The raw line is the safety net.
5. **Merge only within unit families.** Cross-family conversion (cups to ml) depends on ingredient density and regional conventions — a silent wrong merge is worse than two separate lines.
6. **Structured-data link import with a review screen.** Reliable where JSON-LD is present; honest failure otherwise. HTML scraping would be fragile and hard to test.
7. **Versioned, schema-validated backup.** Portable, safe, and forward-compatible. A raw database dump is not portable and reveals internal schema.
8. **Absolute end times for timers.** `remaining = endAt − now` survives backgrounding, process kills and device restarts. Interval counters do not.
9. **Share as plain text.** Works in any chat app with nothing to install. Deep links and app-specific formats require the recipient to have the app.
10. **Images local only in v1.** Keeps backups small and the first version simple. The upgrade path is documented.
11. **LWW per record for sync.** Single-user data with low conflict risk. CRDTs add complexity that is not justified here.
12. **Optional account.** Time-to-value first. The app is fully useful with no sign-up, following the same pattern as my earlier portfolio projects.

---

## Known Limitations & Out of Scope

- Link import only works for pages that publish structured recipe data (JSON-LD); others require paste-text import
- Quantities written inside step text are not scaled (documented in the UI)
- Unit merging does not convert between metric and cup/spoon measures; local measures (derica, tin, bunch) are kept as written
- Cover images are local only in v1 — not synced, not included in backups
- Imported recipes are for personal use; the source link is kept and included when sharing; no crawling or republishing
- Local database is not encrypted at rest
- Last-write-wins sync per record (no CRDTs)
- PocketBase is a single-node SQLite backend — suitable for personal libraries at portfolio scale; the upgrade path to Go/Python + Postgres is documented in `docs/ARCHITECTURE.MD`

## Roadmap

- Photos in backups and image sync
- Receive links from the system share sheet
- Public share links
- Meal planning
- Backend move to Go or Python with Postgres using the same outbox protocol

---

## Documentation

| Doc | Contents |
|---|---|
| [ARCHITECTURE.MD](docs/ARCHITECTURE.MD) | Data model, search, parsing, import and export, sync, ADRs |
| [PRD.MD](docs/PRD.MD) | Problem, scope, user stories, acceptance criteria |
| [DESIGN.MD](docs/DESIGN.MD) | UI/UX, tokens, screens, patterns |
| [STORY.MD](docs/STORY.MD) | Engineering narrative and interview talking points |
| [DEMO.MD](docs/DEMO.MD) | Demo script and recording guide |
| [CURSOR_CONTEXT.MD](docs/CURSOR_CONTEXT.MD) | Instructions for the AI coding agent |

---

## License

MIT licensed. Engineering design and architecture only.
