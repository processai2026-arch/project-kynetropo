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

2. **Upload the release.** Use hPanel File Manager, `scp` or a tarball.
   - Upload everything **except** `index.html` first, then `index.html` **last** so the app is never half-deployed.
   - Never delete `public_html/`, `.env` or `api/uploads/`.
   - Extracting a tarball on the server: run `umask 022` first and use `tar -xzf release.tgz --no-same-permissions --no-same-owner -C public_html`.

3. **Check permissions.** Both commands must print nothing:
   ```
   find public_html -type d -perm 0700
   find public_html -type f -perm 0600 ! -name .env
   ```
   Fix only what they list (`chmod 755` folders, `chmod 644` files). On 2026-09-25 a deploy extracted under `umask 077` left files readable only by their owner, and every URL returned 403/404 until this was fixed.

4. **Apply only the new migrations.** Over SSH, one file at a time, for each `NNN_*.sql` that is new in this release:
   ```
   mysql DB_NAME < public_html/database/NNN_name.sql
   ```
   Do **not** run `php database/migrate.php` on production. It re-applies every migration and has never been run there; test it on a copy of the production database first if you ever need it.

5. **Smoke test.** Over SSH:
   ```
   cd public_html && php scripts/smoke.php https://project.kynetropo.com/api
   ```
   It mints a 2-minute admin token, GETs every list endpoint, checks that bad tokens and a wrong current password are refused, prints any `api/error_log` lines from the run, and exits non-zero on failure. Fix or roll back before calling the deploy done.

   Then remove the files this release deleted from the repository (a dry run first, then with `--delete`):
   ```
   cd public_html && bash scripts/server-cleanup.sh
   ```

6. **Verify manually.** Sign in and open a page from each module. Check the browser console and `api/error_log` for new errors.

7. **Cloudflare cache.** If any page returns 404 after a correct deploy, purge the Cloudflare cache for that URL (Dashboard → Caching → Purge Cache → Custom Purge).

## Rollback

Re-upload the previous release. If the new migrations changed tables that the old code cannot use, also restore the database export from step 1.

## Server files that are not in the repository

- `public_html/.env` holds the database credentials, JWT secret and API keys (see `.env.example`).
- `fast25sms.txt` sits in the folder above `api/` (`public_html/`) and holds the SMS API key read by `AuthController`.
- Cron jobs call `public_html/api/cron/*.php`. Those paths did not change.
