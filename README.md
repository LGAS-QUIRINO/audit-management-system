# Audit Management System (AMS) – COA Quirino

One app with modules for the Commission on Audit, COA Quirino.

## Status
- Core: **Login**, **Dashboard**, and Admin screens (**Users & Roles**, **Teams**, **LGU Master List**) built.
- Connected to the AMS Database (Apps Script under the AMS Gmail) with Google sign-in. Setup steps: **SETUP.md**.

## Modules (built one at a time, each tested separately before it is moved in)
Records Management · Periodic Reports · Other Reports · Cash Examination Report (CER) ·
Annual Audit Report (AAR) · Barangay Annual Audit Report (BAAR) · SK SAOR · plus the Urgent Reports reminder.

## Folder layout
- `index.html` – entry page
- `css/app.css` – shared look for all screens
- `js/` – shared Core (sign-in, storage on the device, helpers)
- `js/views/` – Core screens
- `modules/<name>/` – each module, added when it is ready
- `js/api.js`, `js/sync.js` – sending and fetching changes to/from the AMS database (works offline, sends when back online)
- `backend/Code.gs` – the database script (Apps Script in the AMS Database Google Sheet). Rebuild after changing the starting data: `node backend/build.mjs`
