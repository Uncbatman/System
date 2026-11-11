# System: 90 Day Quest

A lightweight, installable productivity PWA for tracking reading, learning, strength training, and business outreach. It records daily quest completion, XP, levels, streaks, Gate Boss days, and a shadow-army roster.

## What it includes

- A 90-day default schedule with reading, learning, outreach, scheduled strength training, a weekly rest day, and a Gate Boss every 15 days.
- A day 18–33 persuasion curriculum with daily drills and learning cards; drill days require the configurable owner-message target (five by default).
- A Library for importing and reading PDFs on the current device, plus an optional book link.
- Local progress tracking that works without signing in, versioned JSON export/restore, one-step local recovery, and preview-first `.txt` activity import.
- Optional Google-account sync. The Firebase sign-in module is loaded only when the user chooses to sign in; signing in and cloud sync require connectivity.
- A PWA shell and app assets cached for later offline use, including the persuasion data and PDF reader.

The default program starts **October 24, 2026**. The recurring business task is **“Business leads reach out.”** After the day's required tasks are complete, the level-up screen reveals a blue shadow and says **“A new shadow has arisen.”**

## Offline use

Open the deployed app once while online so the service worker can install and cache its app shell and assets. Thereafter, activity tracking and locally stored progress work offline. Google sign-in and Firebase sync are optional online features; neither is required to record activities. If already signed in, changes made offline remain on the device and sync when connectivity returns.

Progress is stored in browser `localStorage` under `sys90`; PDF files are stored in IndexedDB. Both are device- and origin-specific. Use **Status → Progress backup → Export JSON** for a portable progress backup. JSON backups do not contain PDF files. Importing JSON replaces progress after confirmation and stores a recovery copy first; importing a `.txt` file previews recognized day/activity lines, reports ignored lines, and merges the selected records. Unchecked or explicitly planned lines are ignored; unmarked recognized activity lines are treated as completed, and persuasion drills are imported only when the message target is present—review the preview before confirming.

Each local save keeps the immediately previous progress state as a one-step recovery point. The browser's storage-persistence request is best-effort, not a substitute for an exported backup. Browser data can still be cleared by the user, browser settings, or device loss. A deployment on another hostname also has separate local storage; signing in can sync progress, but PDFs remain on the device where they were added.

## Configuration and maintenance

`public/program-config.js` is the single editable defaults file for the program start date, duration, rest/workout weekdays, Gate Boss interval and prompts, learning topics, business task text, and daily owner-message target. The **Status → Program setup** date control changes the active start date for the current saved progress and asks for confirmation because day-numbered records will map to different calendar dates. Other configuration edits require redeploying/reloading the app. The existing XP formula and completion handler remain unchanged; the configured duration and calendar rules determine the schedule and reporting ranges.

The app logic, program settings, and optional online authentication are separate files. There is no build step or JavaScript framework.

## Run locally

Python 3 is sufficient; no package installation or build step is needed. From the repository root, run:

```sh
python3 -m http.server 3000 --bind 0.0.0.0 --directory public
```

Open `http://localhost:3000` in a browser. Use `http://localhost` or another secure origin for service-worker and PWA install behavior; opening the HTML directly as a `file://` URL is not equivalent. A fresh local copy needs an online visit to install its service-worker cache before it can be used offline.

## Verify changes

Run the focused checks with Node.js:

```sh
node --test tests/app.test.mjs
```

The 12 checks cover the supplied persuasion data and five-message gate, configurable scheduling, actual text import and rolling recovery, backup parsing, quest completion, shadow progression, exact user-facing copy, offline cache assets, and preservation of the XP formula and original completion handler.

## Sign-in and cloud-data security

The Firebase browser configuration is client-side configuration, not a secret. Cloud access must be restricted by Firestore Security Rules: users should only be able to read and write their own `users/{uid}` document. This repository does not contain deployable Firestore rules (the `tests/original-rules.json` file is a regression fixture, not a security policy). Verify the live Firebase rules and authorized domains in the Firebase console before relying on cloud sync, especially if deploying to a new hostname. This update does not modify Firebase project settings or cloud rules.

## Project layout

- `public/index.html` — PWA entry page and styling.
- `public/app.js` — quest, status, Library, persistence, backup/import, and rendering logic.
- `public/program-config.js` — editable campaign defaults.
- `public/firebase-auth.js` — optional Firebase/Google sign-in and Firestore sync, loaded on demand.
- `public/persuasion-quests.json` — day-mapped drills and learning cards, used and cached offline.
- `public/shadow-art.js` and `public/shadows.css` — shadow visuals and army layout.
- `public/manifest.json`, `public/sw.js`, icons, and PDF.js files — install, offline, and PDF-reader assets.
- `tests/app.test.mjs` and `tests/original-rules.json` — focused behavior checks and frozen source rules for regression comparison.
