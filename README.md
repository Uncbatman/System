# System: 90 Day Quest

This update preserves the full `index.html` PWA supplied in the user's ZIP. The duplicate `system-quest.html` and nested output HTML were older variants with fewer features and are not used as the runtime entry.

## Run

From the project root, run `python3 -m http.server 3000 --bind 0.0.0.0 --directory public`. The `public/` directory is the complete static deployment output. No package installation or build step is required.

## Structure

`public/index.html` contains the existing quest application, task data, XP/rank formulas, Library/PDF reader, account synchronization, and all event handling. `public/shadow-art.js` contains only the angular blue-wraith rendering and its color/size mapping. `public/shadows.css` styles the shadow roster and completion reveal. The supplied manifest, icons, PDF.js files, and service worker remain in `public/`. `tests/app.test.mjs` checks the changed presentation and unchanged core logic without contacting Firebase or changing real progress.

## Shadow presentation

A cleared non-rest day represents one shadow, following the app's original counting rule. Shadow level is a cosmetic derivation using the app's existing `lv()` curve over recorded task XP from the day that shadow arose through today. Earlier shadows therefore grow as subsequent quest XP is recorded. This adds no rewards, no storage keys, and no changes to the hunter's XP, rank, completion conditions, streaks, or sync payload. All bodies stay blue; outline color moves progressively from blue toward crimson through level 16. Silhouette size increases monotonically with level while remaining bounded for the phone-width army view. The end-of-day reveal uses the same shadow renderer and computed level as the roster.

## Persistence and account sync

The original `sys90` localStorage key, IndexedDB PDF store, supplied Firebase project configuration, and sync behavior remain unchanged. Browser-local progress belongs to its origin: existing progress on a different hostname does not automatically move to this Preview or a newly published hostname. Google account sign-in on a new hostname remains subject to the existing Firebase project's authorized-domain settings; this update does not change those external settings.
