# System: 90 Day Quest

A lightweight, installable productivity PWA that turns reading, learning, strength training, and business outreach into a 90-day daily-quest progression. It tracks XP, hunter levels, ranks, streaks, gate-boss days, and a blue shadow army.

## What it includes

- A 90-day schedule with daily reading, learning, outreach, scheduled strength training, rest days, and a gate boss every 15 days.
- XP, character levels, ranks, streaks, optional bonus workouts, and a shadow-army roster.
- A day 18–33 persuasion series: daily drills, short learning cards, and a tracked five-owner-message baseline on drill days.
- A Library with PDF import and in-app reading, plus an optional book link.
- Local progress storage and optional Google-account sync through the supplied Firebase configuration.
- An installable PWA manifest, service worker, supplied icons, and offline-cached app/PDF-reader assets.

The current quest plan starts on **October 24, 2026**. The business-lead quest is shown as **“Business leads reach out.”** After the day's required tasks are complete, the level-up screen reveals a blue shadow and says **“A new shadow has arisen.”** Shadow bodies remain blue; their edges become redder and their silhouettes larger at higher shadow levels.

## Run locally

Python 3 is sufficient; no package installation or build step is needed. From this repository's root, run:

```sh
python3 -m http.server 3000 --bind 0.0.0.0 --directory public
```

Open `http://localhost:3000` in a browser. Use `http://localhost` or another secure origin for service-worker and PWA install behavior; opening the HTML directly as a `file://` URL is not equivalent.

## Verify changes

Run the focused checks with Node.js:

```sh
node --test tests/app.test.mjs
```

The checks cover the persuasion curriculum and message-count gate, shadow progression, exact copy, quest completion, service-worker assets, and byte-for-byte preservation of the original schedule, scoring, completion, and sync logic.

## Data and sign-in

Quest progress uses the browser's `localStorage` key `sys90`; the PDF Library uses IndexedDB. Browser-local progress is tied to its origin, so data on a different hostname does not automatically appear in a new Preview or deployment. Google sign-in can sync through the existing Firebase project. When self-hosting on a new domain, that hostname may need to be added to Firebase's authorized-domain settings; this update does not change the supplied Firebase project or its account configuration.

## Project layout

- `public/index.html` — quest UI, learning-card display, daily task completion, Library/PDF reader, persistence, and sync.
- `public/persuasion-quests.json` — day-mapped persuasion drills and learning cards, loaded by the app and cached for offline use.
- `public/shadow-art.js` and `public/shadows.css` — cosmetic blue-wraith silhouettes, army layout, and daily reveal.
- `public/manifest.json`, `public/sw.js`, icons, and PDF.js files — PWA install/offline and PDF-reader assets.
- `tests/app.test.mjs` and `tests/original-rules.json` — focused behavior checks and frozen source rules for regression comparison.
