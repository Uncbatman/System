# Websites tracker implementation plan

## Implementation

Add a `websites` section to the existing `S` state object in `public/app.js`, with records stored as small JPEG data URLs plus URL, business name, creation date, current status, Sent date, and optional note. This automatically reuses the existing local-first `save()` path and Google/Firebase account sync; no new Firebase collections, storage service, billing, or security-rule changes are needed. Migrate missing `websites` to an empty array. When restoring a legacy JSON backup that has no `websites` property, preserve the current websites list. Keep quest scoring, progression formulas, and task completion logic unchanged.

Add a fifth Websites navigation tab with a subdued summary, newest-first rows, real follow-up filtering, an add flow requiring a valid HTTP(S) URL, image, and business name, and a detail view with the full saved image, live link, status transitions, and optional notes. Capture from camera or select from gallery; resize and JPEG-compress in the browser before saving, with a small-size ceiling. Include website data in the existing JSON progress backup.

## Design

- **Chosen style:** the existing System dark productivity UI, made quieter for the Websites view: near-black background, muted surfaces, thin low-contrast dividers, pale text, restrained blue accents, and generous whitespace.
- **Core principles:** additive and familiar; business records are distinct from quest progression; state and dates remain explicit; images are compressed before persistence.
- **Layout and interactions:** preserve the app’s compact mobile-first shell and fixed navigation. Summary figures lead; follow-up is a quiet line; each site is a simple thumbnail row. The circular plus control is only visible on Websites. Details keep image, outbound link, one status row, and optional note in that order.
- **Motion and type:** use the current system font and existing transition conventions; the save moment is a small, brief Built-count celebration, not XP or level mutation. Respect reduced-motion preferences.

## Project structure

- `public/index.html`: existing shared dark styles, Websites-specific styles, image input controls, and fifth navigation item.
- `public/app.js`: record defaults, summaries/filtering, add/detail rendering, image resize, website events, and legacy-backup preservation.
- `public/sw.js`: retain the current cached app shell; no new network assets are planned.
- `tests/app.test.mjs`: regression and Website state/render/validation checks.
- `README.md` and `TODO.md`: describe the additive Google-sync behavior and record delivered criteria.
