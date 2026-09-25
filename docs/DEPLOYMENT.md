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

1. **Back up first.** On the server over SSH:
   ```
   cd public_html
   mysqldump -u DB_USER -p'DB_PASS' DB_NAME > ~/backup_$(date +%Y%m%d_%H%M).sql
   tar -czf ~/backup_api_uploads_$(date +%Y%m%d).tar.gz api/uploads/ api/storage/ api/backups/
   ```
   Also download `.env` locally.

2. **Upload the release.** Use cPanel File Manager or `scp`/`rsync`.
   - Upload everything **except** `index.html` first.
   - Upload `index.html` **last** so the app is never half-deployed.
   - Never delete `public_html/`, `.env`, or the three runtime folders (`api/uploads/`, `api/storage/`, `api/backups/`).

3. **Fix permissions after upload.** On the server:
   ```
   umask 022
   find public_html -type d -exec chmod 755 {} +
   find public_html -type f -name "*.php" -exec chmod 644 {} +
   find public_html -type f -name "*.html" -exec chmod 644 {} +
   chmod -R 775 public_html/api/uploads public_html/api/storage public_html/api/backups
   ```
   If uploading via `tar`: `tar -xzf release.tar.gz --no-same-permissions --no-same-owner -C /path/to/public_html/`

4. **Run migrations.** Over SSH:
   ```
   cd public_html && php database/migrate.php
   ```
   Re-applying every `NNN_*.sql` is safe (all statements are guarded). Read any `WARN` lines.

5. **Smoke test.** Over SSH, from the deployment root:
   ```
   php scripts/smoke.php https://project.kynetropo.com/api
   ```
   The script mints a 2-minute admin JWT, GETs every list endpoint, checks auth rejection, and exits non-zero on failure. Run it before considering the deploy live.

6. **Verify manually.** Sign in and open a page from each module. Check the browser console and `api/error_log` for new errors.

7. **Cloudflare cache.** If any page returns 404 after a correct deploy, purge the Cloudflare cache for that URL (Dashboard → Caching → Purge Cache → Custom Purge).

## Rollback

Re-upload the previous release. If the new migrations changed tables that the old code cannot use, also restore the database export from step 1.

## Server files that are not in the repository

- `public_html/.env` holds the database credentials, JWT secret and API keys (see `.env.example`).
- `fast25sms.txt` sits in the folder above `api/` (`public_html/`) and holds the SMS API key read by `AuthController`.
- Cron jobs call `public_html/api/cron/*.php`. Those paths did not change.
