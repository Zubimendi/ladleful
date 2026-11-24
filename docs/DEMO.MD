# Ladleful: Demo Guide

## Goals

- A 90 to 120 second recorded demo for the README and portfolio
- A 5 minute live version for interviews
- Prove three things: everything works offline, imports are fast and reviewed, and your data is portable

## Setup (the evening before)

| Item | Detail |
|---|---|
| Demo data | A dev-only "Load demo library" action that generates about 1,000 fictional recipes (for the search and scroll segment), plus the 3 sample recipes |
| Import pages | Two or three real recipe pages you know publish structured data, plus one that does not, so you can show both outcomes. Check them before recording |
| Backup file | A backup exported from the app, saved on the phone |
| Backend | PocketBase running and reachable, only for the sync segment |
| Network control | Airplane mode toggle ready |
| Recording | Android built-in recorder or `adb shell screenrecord`; iOS Simulator (Mac only): `xcrun simctl io booted recordVideo demo.mp4` |
| Cleanup | Notifications off, battery above 50%, clean wallpaper |

Respect source sites: use single imports for the demo and keep the source attribution visible.

## 90 second script

| Time | Screen | Action | Voiceover |
|---|---|---|---|
| 0:00 | Library | Show the library | "Ladleful is a recipe box that works with no data." |
| 0:06 | Phone | Turn on airplane mode | "I'm offline. Nothing changes." |
| 0:10 | Library | Type "tom"; results filter instantly; open Tomato stew | "Search is instant: it's a full-text index on the phone." |
| 0:20 | Recipe | Change servings from 6 to 10; show quantities | "Quantities rescale with friendly fractions." |
| 0:30 | Cooking mode | Tap Cook; show big step, tap a timer chip | "Cooking mode keeps the screen awake and suggests timers from the step text." |
| 0:42 | Shopping | Add two recipes to a new list | "Two recipes become one shopping list: quantities merged and grouped by aisle." |
| 0:52 | Shopping | Point at "combined 3" toast, check an item | "Same ingredient, same unit family, merged." |
| 0:58 | Shopping | Tap Share as text, show the preview | "And it shares as plain text to any chat." |
| 1:05 | Phone | Turn airplane mode off; Library, Add, Import from link, paste URL | "Importing needs a connection, so I'm back online." |
| 1:15 | Review | Show the review editor with parsed pills and a warning | "It reads the page's structured data and always shows a review screen." |
| 1:25 | Settings | Export backup, show the summary | "And everything exports as a versioned backup file." |
| 1:32 | Close | Show the repo and architecture doc | "Local-first, parsed, validated, portable." |

## Import demos (live version)

1. **Link that works:** import, review, fix a warning, save.
2. **Link without structured data:** show the clear message and switch to Paste text.
3. **Offline import attempt:** show the friendly offline message.
4. **Paste text:** paste a recipe from a chat message and show the split into ingredients and steps.

## Backup round trip (live version)

1. Export a backup.
2. Delete a few recipes (or use a second install).
3. Import the file; choose "Skip existing"; show the summary.
4. Show a recipe restored with identical content.
5. Import a deliberately broken file and show the clear error.

## Performance segment (live version)

1. Load the 1,000-recipe demo library.
2. Type a query and show results updating per keystroke.
3. Scroll fast and show the smooth list.

## Sync segment (optional)

1. Sign in on device A and show Up to date.
2. Sign in on device B and see the recipes arrive (images stay local in this version).

## Shots to capture for the README

1. Library with search and chips
2. Recipe with the servings scaler
3. Cooking mode with a timer
4. Shopping list grouped by aisle
5. Import review with parse warnings
6. Dark theme library

## Turning the recording into a GIF

```bash
ffmpeg -i demo.mp4 -vf "fps=12,scale=360:-1:flags=lanczos" -loop 0 demo.gif
```

Keep the GIF under about 8 MB; keep the full MP4 for the portfolio site.

## Pre-demo checklist

- [ ] Demo library and sample recipes loaded
- [ ] Import pages tested the same day
- [ ] Backup file on the phone
- [ ] Airplane mode toggle tested
- [ ] Notifications off, battery above 50%
- [ ] 10 second test recording done
- [ ] Fallback video ready

## If something breaks live

Say what you expect, show the review screen warnings (they explain what the parser understood), and switch to the recorded demo.