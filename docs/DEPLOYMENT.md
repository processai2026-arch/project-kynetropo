# Deployment

project.kynetropo.com runs on Hostinger. The deployment root is the site's `public_html/`, which holds the built web app with `api/` and `database/` beside it.

The repository is **not** uploaded as it is. `npm run release` (`node scripts/build-release.mjs`) builds the web app and packages exactly what the server needs into `release/`:

| In `release/` | Comes from |
|---|---|
| `index.html`, `assets/`, icons, `sw.js`, `manifest.webmanifest`, `pdf.worker.min.mjs` | `npm run build` (`dist/`) |
| `.htaccess` | `public/.htaccess`: SPA routing, cache headers, and deny rules for `database/`, source and dotfiles |
| `api/` | `api/` without `router.php`, logs, or anything in `uploads/`, `storage/` or `backups/` |
| `database/` | `NNN_*.sql` and `migrate.php` only |
| `.env.example` | Template for the server's `.env` |
| `DEPLOY-NOTES.txt` | Step-by-step notes. Read it, but do not upload it |

The web app is built with `VITE_API_BASE_URL=/api` (same origin). To call a different host, pass `--api-base=https://…/api`. `--skip-build` packages the existing `dist/`.

The script refuses to leave a release that contains `.env`, logs, `src/`, `tests/`, `docs/`, `node_modules/`, `database/legacy/`, `api/router.php` or uploaded files. It also runs `php -l` over every PHP file it ships.

## Upgrade

1. Back up: export the database from phpMyAdmin, and download `.env`, `api/uploads/`, `api/storage/` and `api/backups/`.
2. Upload the contents of `release/` over `public_html/`, uploading `index.html` last. Never delete `public_html/`, `.env` or the three runtime folders.
3. Over SSH: `cd public_html && php database/migrate.php`. Read any `WARN` lines.
4. Sign in and open a page from each module.

## Rollback

Re-upload the previous release. If the new migrations changed tables that the old code cannot use, also restore the database export from step 1.

## Server files that are not in the repository

- `public_html/.env` holds the database credentials, JWT secret and API keys (see `.env.example`).
- `fast25sms.txt` sits in the folder above `api/` (`public_html/`) and holds the SMS API key read by `AuthController`.
- Cron jobs call `public_html/api/cron/*.php`. Those paths did not change.
