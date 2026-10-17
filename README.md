# Audit Management System (AMS) – COA Quirino

One app with modules for the Commission on Audit, COA Quirino.

## Status
- Core: **Login**, **Dashboard**, and Admin screens (**Users & Roles**, **Teams**, **LGU Master List**) built (Demo Mode until the AMS database and Google sign-in are set up).
- Next: connect the AMS database (Apps Script + Google Sheet under the AMS Gmail) and Google sign-in.

## Modules (built one at a time, each tested separately before it is moved in)
Records Management · Periodic Reports · Other Reports · Cash Examination Report (CER) ·
Annual Audit Report (AAR) · Barangay Annual Audit Report (BAAR) · SK SAOR · plus the Urgent Reports reminder.

## Folder layout
- `index.html` – entry page
- `css/app.css` – shared look for all screens
- `js/` – shared Core (sign-in, storage on the device, helpers)
- `js/views/` – Core screens
- `modules/<name>/` – each module, added when it is ready
