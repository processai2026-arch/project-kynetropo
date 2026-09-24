# database/legacy

Scripts that were run **by hand** (phpMyAdmin or the mysql CLI), never by
`database/migrate.php`. They keep their original names; the runner does not
read this folder, and `scripts/build-release.mjs` does not ship it.

Their original run order was never recorded, so they were not numbered.

| File | What it is |
|---|---|
| `KYNETROPO_OPS_COMPLETE_SETUP.sql` | One-file setup of the Ops tables (`users`, `ops_*`), for phpMyAdmin |
| `FULL_SETUP.sql` | One-file setup of the invoice-module tables. Its `users` table differs from the Ops one — do not run both |
| `auth_tables.sql` | `users`, token and session tables |
| `create_*.sql`, `add_*.sql`, `normalize_*.sql` | Module tables and column changes applied one at a time |
| `migrate_sales_tasks.php` | Column additions for sales tasks: `php database/legacy/migrate_sales_tasks.php` |
| `remove_lead_clients.php` | One-off (2026-09-24): deletes the clients that were only leads (Krish agency vendor, Gokul Tours, GE, BrickMe Constructions, Krish Agencies, VaramBlessing, Data Corp) with their projects. Previews by default; `--yes` deletes |
| `set_admin_credentials.sql` | **Resets the founding admin's login to a known password.** Never run it on a live database unless that is the intent |
