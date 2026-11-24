# Ladleful: Design

## 1. Design goals

1. **Readable with messy hands.** Big type in cooking mode, a screen that stays on, controls you can hit with a knuckle.
2. **Fast to find, fast to add.** Search is always one tap away; adding a recipe takes a minute, not ten.
3. **Honest about imports.** Imported data is always reviewed before saving, and parse doubts are shown, not hidden.
4. **Offline is the normal state.** No spinners for local data, no scary banners.
5. **Light on low-end phones.** System fonts, thumbnails in lists, virtualized lists.

## 2. Patterns replicated from top apps

| Pattern | Seen in | How Ladleful uses it | Why it works |
|---|---|---|---|
| Always-visible search | Spotify, Gmail | Search field pinned at the top of the library | The library is a lookup tool |
| Live filter chips | Google Maps, Airbnb | Favorites, Under 30 min, tag chips under search | One-tap narrowing |
| Servings stepper with live scaling | NYT Cooking, Paprika | Stepper on the recipe screen rescales every quantity | Cooking for a different crowd without math |
| Cooking mode (big text, screen on) | NYT Cooking, Samsung Food | Full-screen step view with keep-awake | Hands are busy and dirty |
| Timers inside steps | Recipe apps | Time phrases become tappable timer chips | No app switching |
| Review before save on import | Pocket-style importers | Imported recipe opens in the editor with a banner and warnings | Parsing is imperfect; the user stays in control |
| Combined shopping list by aisle | Instacart, AnyList | Merged quantities grouped by aisle | Fewer trips around the shop |
| Share as plain text | WhatsApp culture | One tap shares a recipe or a list as text | Works in any chat, with no app needed on the other end |
| Check-off with haptic and strike-through | Todoist | Same on ingredients and shopping items | Confirms the tap |
| Undo toast instead of confirm | Gmail | Delete recipe or item shows "Removed. Undo" | Fast and recoverable |
| Skeletons only where the network is unavoidable | Instagram | Only while fetching a link for import | Local reads are instant |

## 3. Design tokens

All colors are targets; confirm contrast with a checker before release.

### Color (light)

| Token | Hex | Use | Approx. contrast |
|---|---|---|---|
| `bg` | `#F6F7F3` | Screen background | n/a |
| `surface` | `#FFFFFF` | Cards, sheets | n/a |
| `text` | `#1F2A24` | Primary text | about 14:1 on bg |
| `textSecondary` | `#55635B` | Secondary text | about 5.7:1 on bg |
| `primary` | `#2F6B3B` | Buttons, active states | about 6.4:1 with white text |
| `primaryPressed` | `#25552E` | Pressed | higher |
| `accent` | `#B45309` | Timers, highlights | about 5:1 on white |
| `danger` | `#B91C1C` | Destructive actions, errors | about 6.5:1 on white |
| `warning` | `#92400E` | Parse doubts | about 7:1 on white |
| `border` | `#DDE3DC` | Dividers | decorative |

### Color (dark)

| Token | Hex |
|---|---|
| `bg` | `#101512` |
| `surface` | `#192019` |
| `text` | `#EEF3EE` |
| `textSecondary` | `#A5B3A9` |
| `primary` | `#7BC48B` (use `#101512` text on it) |
| `accent` | `#FBBF24` |
| `danger` / `warning` | `#F87171` / `#FBBF24` |
| `border` | `#2A352B` |

### Typography (system fonts)

| Style | Size / line height | Weight |
|---|---|---|
| Title | 28 / 34 | Bold |
| Heading | 20 / 26 | Semibold |
| Body | 16 / 24 | Regular |
| Label | 14 / 20 | Medium |
| Caption | 13 / 18 | Regular |
| Cook step | 24 / 34 | Medium (scales with the system setting) |
| Timer | 32 / 36 | Bold, tabular digits |

Layout must hold at 200% text scale.

### Spacing, shape, motion

| Token | Value |
|---|---|
| Spacing scale | 4, 8, 12, 16, 24, 32 |
| Screen horizontal padding | 16 |
| Minimum touch target | 48 x 48 (cooking mode controls 64 x 64) |
| Radius | 12 (cards, inputs), 999 (chips) |
| Motion | 120 ms taps, 200 ms layout, 250 ms sheets, ease-out |

## 4. Information architecture

```text
Onboarding (first run)
Main tabs
  Recipes (Library)
    Recipe detail
      Cooking mode
      Edit recipe
    Add menu: Write, Import from link, Paste text, Import file
      Import review (editor with banner)
  Shopping
    List detail
      Add from recipes (picker)
  Settings
    Pantry staples
    Backup and restore (export, import, conflict choice)
    Account and sync (P1)
```

Rules: three tabs, any screen within 3 taps, back always pops one level, leaving the editor saves a draft.

## 5. Screen specifications

### S1. Onboarding
- Short pitch, a toggle "Add 3 sample recipes" (on), Start button. No account prompt.

### S2. Library
- Search field (pinned); filter chips (Favorites, Under 30 min, plus tag chips from existing tags)
- List of recipe cards: 64 dp thumbnail (or initial tile), title, time and servings, heart
- Results update as you type (debounced); matched ingredient words are shown in a small caption ("matches: rice, tomato")
- FAB opens the Add menu
- Empty library: "Your recipe box is empty." with buttons: Write one, Import from link, Import a backup
- No results: "Nothing matches 'xyz'." with a clear button

```text
+------------------------------------------+
| [ Search recipes, ingredients... ]       |
| (Favorites) (Under 30 min) (Soup) (Rice) |
+------------------------------------------+
| [img] Jollof rice               (heart)  |
|       55 min  Serves 6                   |
| [img] Tomato stew base                   |
|       40 min  Serves 8        matches: tomato |
+------------------------------------------+
| Recipes      Shopping      Settings      |
+------------------------------------------+
```

### S3. Recipe detail
- Hero image (or color tile), title, meta chips (prep, cook, servings), tags, source name (link)
- Servings stepper (minus, value, plus) with a reset link; all quantities rescale instantly
- Ingredients grouped (if groups exist); tap to strike through (session only)
- Steps numbered; notes section
- Actions bar: Cook, Add to list, Favorite, Share (text), More (Share file, Edit, Delete)
- States: scaled (shows "Scaled for 8, originally 6"), parse-warning lines marked with a small info icon

### S4. Cooking mode
- Full-screen, keep-awake, one step per card with the step number and total
- Swipe or large Next and Back buttons (64 dp); progress dots
- Ingredient sheet (pull up) shows scaled ingredients
- Timer chips appear under steps containing durations ("10 min"); tap to start; running timers show in a persistent bar with remaining time, pause and cancel
- Timer end: strong haptic, banner "Timer done: simmer" (notification when backgrounded in P1)
- Exit button with a confirm only if timers are running

### S5. Edit recipe
- Fields: title (required), description, servings (number), prep and cook minutes, tags (chip input), ingredients (multiline, one per line), steps (multiline, one per line or numbered), notes, source link, cover photo (P1)
- Under the ingredients field, a live preview shows parsed pills: quantity, unit, name, note; lines the parser is unsure about are marked with a warning icon and tap-to-fix
- Group lines: a line ending with ":" starts an ingredient group ("For the sauce:")
- Draft autosaved; leaving asks nothing and restores the draft next time
- Save is enabled when the title is present and at least one ingredient exists

### S6. Import from link
- URL field with Paste button, Import button
- States: fetching (skeleton), offline ("Importing needs a connection. Your recipes still work offline."), timeout, not a web page, no recipe data found ("This page doesn't publish structured recipe data. Try Paste text."), success (opens the review editor)
- Review editor shows a banner "Imported from example.com. Check the details before saving." with a list of parse warnings

### S7. Paste text
- Large text area, hint text showing the expected layout (title, Ingredients, Steps), Continue button
- Splits into title, ingredients and steps with simple heading detection; opens the review editor

### S8. Shopping
- Lists overview (name, items left, last updated), New list
- List detail: grouped by aisle with collapsible headers; item row with checkbox, name, quantity and unit, small "from 2 recipes" caption
- Quick add field at the bottom for manual items
- Actions: Add from recipes (picker with servings per recipe), Clear checked, Share as text, pantry chip ("Skipping 5 pantry items")
- Merge summary toast after adding recipes: "Added 12 items, combined 3"
- Empty list: "Add recipes to build your list, or type an item below."

### S9. Settings
- Pantry staples (chips), theme, display units note (shown as written), Backup and restore, Account and sync (P1), storage used, About

### S10. Backup and restore
- Export: "Export backup" creates a JSON file and opens the share sheet; shows counts and size
- Import: pick a file, validation summary ("42 recipes, 3 lists. 5 recipes already here."), conflict choice (Skip existing, Replace existing, Keep both), Import button, result summary

### S11. Account (P1)
- Optional sign in or sign up; copy: "Optional. Your recipes stay on this phone unless you sign in."
- Different-account prompt as in earlier projects; sync chip and sync center

## 6. Component inventory

`Screen`, `SearchBar`, `FilterChips`, `RecipeCard`, `ServingsStepper`, `IngredientRow`, `StepCard`, `TimerChip`, `TimerBar`, `ParsedIngredientPill`, `TagInput`, `AisleSection`, `ShoppingItemRow`, `ImportBanner`, `WarningList`, `FileSummary`, `BottomSheet`, `Toast` (with action), `EmptyState`, `Skeleton`, `Button`, `TextField`, `ErrorBoundaryFallback`. Tokens only; no raw hex or magic numbers.

## 7. Parse feedback

| Parser result | Treatment |
|---|---|
| Quantity, unit and name found | Normal pills |
| Name only (for example "salt to taste") | Name pill with "to taste" note; no warning |
| Quantity found, unit unknown | Unit shown as written; info icon (kept as a local measure) |
| Line looks like a heading | Offered as a group heading |
| Nothing sensible parsed | Warning icon and the raw text kept as the name |

The raw line is always kept, so nothing is lost by a parse mistake.

## 8. Motion and haptics

- Check-off: 120 ms strike and fade, light haptic
- Servings stepper: values crossfade 120 ms
- Timer end: strong haptic pattern plus a visible flash
- Sheets 250 ms
- Respect reduce motion: replace movement with fades and skip flashes

## 9. Accessibility

- Every control has a role, label and state; timers announce "10 minute timer started" and completion through accessibility announcements
- Quantities read naturally ("one and a half cups")
- Targets at least 48 dp (cooking controls 64 dp); text contrast at least 4.5:1
- Layout holds at 200% text scale; cooking step text scales with the system setting
- Parsed pills are not the only cue: warning rows also have text

## 10. Microcopy

| Situation | Copy |
|---|---|
| Empty library | "Your recipe box is empty." |
| Offline import | "Importing needs a connection. Your recipes still work offline." |
| No structured data | "This page doesn't publish structured recipe data. Try Paste text." |
| Parse doubt | "Not sure about this line. Check it." |
| Scaled | "Scaled for 8, originally 6" |
| Steps not scaled | "Amounts inside steps aren't scaled." |
| Recipe removed | "Recipe removed. Undo" |
| Backup done | "Backup ready: 42 recipes and 3 lists." |
| Newer file | "This file was made by a newer version of Ladleful. Update the app to import it." |
| Invalid file | "This file isn't a Ladleful backup." |
| Different account | "This phone has data from another account. Replace it with this account's data, or cancel?" |

Tone: short, calm, plain. No exclamation marks.

## 11. Low-end device considerations

- System fonts; thumbnails (about 400 px) in lists, never full images
- FlashList with memoized cards; search debounced at about 120 ms
- Parsing and HTML extraction run off the interaction path (after a frame) and are bounded by size limits
- Defer sync boot, catalog loading and index checks until after the first interactive frame
- Test on a phone with 3 GB RAM or less with 1,000 generated recipes