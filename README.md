# System: 90 Day Quest

A lightweight, installable productivity PWA for tracking reading, learning, strength training, and business outreach. It records daily quest completion, XP, levels, streaks, Gate Boss days, and a shadow-army roster.

## What it includes

- A 90-day default schedule with reading, learning, outreach, scheduled strength training, a weekly rest day, and a Gate Boss every 15 days.
- A day 18–33 persuasion curriculum with daily drills and learning cards; drill days require the configurable owner-message target (five by default).
- A Library for importing and reading PDFs on the current device, plus an optional book link.
- Local progress tracking that works without signing in, versioned JSON export/restore, one-step local recovery, and preview-first `.txt` activity import.
- Optional Google-account sync. The Firebase sign-in module is loaded only when the user chooses to sign in; signing in and cloud sync require connectivity.
- A Websites tracker for built sites, outreach status, follow-up dates, and notes. Website screenshots are reduced and JPEG-compressed in the browser, then saved as part of the existing progress state and synced through the existing Google-account document when signed in. No paid storage or new Firebase service is used.
- A PWA shell and app assets cached for later offline use, including System progression modules, persuasion data and the PDF reader.
- A Status home with four point-based attributes, rank trials, optional gates, seven-step momentum, Saturday reports and the Website Shadow Army. Legacy quest XP, streaks, levels, daily logs and campaign schedule remain additive/unchanged. New stat weights, rank windows, workout targets, effects and rewards are editable in `public/program-config.js`.

The default program starts **October 24, 2026**. The recurring business task is **“Business leads reach out.”** Status is the home view; Today retains the established quest flow and completed activities. Reopening a completed day is factual and does not replay a milestone. Level-ups, rank-ups and Website ARISE are tied to their recorded actions.

The Websites tracker retains URL, business name, compressed screenshot, creation date, status, Sent date and optional note in the existing `sys90` state. Real Sent/Reply/Sold transitions feed the additive System stats and rank evidence; the legacy XP formula and daily quest completion scores remain unchanged. Sign in through **Status → Progress, account & settings** for sync; without sign-in, changes remain on this device as before. Older JSON backups that omit Websites or System fields do not erase those existing records.

## Offline use

Open the deployed app once while online so the service worker can install and cache its app shell and assets. Thereafter, activity tracking and locally stored progress work offline. Google sign-in and Firebase sync are optional online features; neither is required to record activities. If already signed in, changes made offline remain on the device and sync when connectivity returns.

Progress and Websites records are stored in browser `localStorage` under `sys90`; PDF files are stored in IndexedDB. Both are device- and origin-specific until Google sync completes. Use **Status → Progress backup → Export JSON** for a portable progress backup. JSON backups do not contain PDF files. Importing JSON replaces progress after confirmation and stores a recovery copy first; importing an older JSON backup that has no Websites field keeps current site records. Importing a `.txt` file previews recognized day/activity lines, reports ignored lines, and merges the selected records. Unchecked or explicitly planned lines are ignored; unmarked recognized activity lines are treated as completed, and persuasion drills are imported only when the message target is present—review the preview before confirming.

Each local save keeps the immediately previous progress state as a one-step recovery point. The browser's storage-persistence request is best-effort, not a substitute for an exported backup. Browser data can still be cleared by the user, browser settings, or device loss. A deployment on another hostname also has separate local storage; signing in can sync progress, but PDFs remain on the device where they were added.

## Configuration and maintenance

`public/program-config.js` keeps the existing campaign defaults and is the single editable settings file for new System stat weights, three rank-trial targets/windows, adaptive targets, Gate challenges, momentum rewards and effect durations. Its rank-trial assumptions are E→D 14 days (specified), D→C 21 and C→B 28 days (editable defaults); an on-time finish leaves the next trial as written. B-rank and higher trials remain unconfigured. The **Status → Progress, account & settings** disclosure retains the cycle-start control; changing it confirms that day-numbered entries will map to other calendar dates. The legacy XP formula and completion handler remain unchanged.

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

The 21 checks cover the legacy XP/completion invariants, Website tracking, additive progress/backup preservation, Status layout and opening card, real-action scoring, rank-trial promotion/timestamps/Saturday rest, Saturday reporting, shadow color roles, and PWA/offline assets. Run `TZ=America/Los_Angeles node --test tests/app.test.mjs` as well when changing date handling.

## Sign-in and cloud-data security

The Firebase browser configuration is client-side configuration, not a secret. Cloud access must be restricted by Firestore Security Rules: users should only be able to read and write their own `users/{uid}` document. This repository does not contain deployable Firestore rules (the `tests/original-rules.json` file is a regression fixture, not a security policy). Verify the live Firebase rules and authorized domains in the Firebase console before relying on cloud sync, especially if deploying to a new hostname. This update does not modify Firebase project settings or cloud rules.

## Project layout

- `public/index.html` — PWA entry page and styling.
- `public/app.js` — quest, status, Library, Websites tracker, persistence, backup/import, and rendering logic.
- `public/program-config.js` — existing campaign defaults and all editable System progression targets/point values.
- `public/system-progression.js`, `public/system-trials.js`, `public/system-dashboard.js`, `public/system-app.js`, `public/system.css` — additive progression state, trial calculations, Status/army templates, app adapter and presentation.
- `public/firebase-auth.js` — optional Firebase/Google sign-in and Firestore sync, loaded on demand.
- `public/persuasion-quests.json` — day-mapped drills and learning cards, used and cached offline.
- `public/shadow-art.js` and `public/shadows.css` — shadow visuals and army layout.
- `public/manifest.json`, `public/sw.js`, icons, and PDF.js files — install, offline, and PDF-reader assets.
- `tests/app.test.mjs` and `tests/original-rules.json` — focused behavior checks and a frozen rules fixture for regression comparison (not deployable security rules).
