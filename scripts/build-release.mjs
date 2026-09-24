#!/usr/bin/env node
/**
 * Package a deployable release into release/. See docs/DEPLOYMENT.md.
 *
 *   node scripts/build-release.mjs                runs `npm run build`, then packages
 *   node scripts/build-release.mjs --skip-build   packages the existing dist/, or none (with a warning)
 *
 * Options:
 *   --api-base=<url>   VITE_API_BASE_URL baked into the web app (default /api: same origin,
 *                      which is how project.kynetropo.com is served). Only used when building.
 *   --out=<dir>        output folder inside the project (default release)
 *   --skip-lint        skip the `php -l` pass over the packaged PHP
 *
 * The release/ folder mirrors the server's deployment root (Hostinger public_html/):
 *   .htaccess, index.html, assets/   web app (dist/ contents; .htaccess comes from public/)
 *   api/                             PHP API. No router.php (dev only), no uploads, backups or logs
 *   database/                        NNN_*.sql + migrate.php (CLI only; denied over HTTP).
 *                                    database/legacy/ (hand-run scripts) is never shipped
 *   .env.example                     template for the server's .env. A real .env never ships
 *   DEPLOY-NOTES.txt                 read it, but do NOT upload it
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const API = path.join(ROOT, 'api');
const DB = path.join(ROOT, 'database');

// ── Arguments ───────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const KNOWN = ['--skip-build', '--skip-lint', '--help', '--api-base=', '--out='];
const flag = (name) => argv.includes(`--${name}`);
const option = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const tty = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code, s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const warnings = [];
const info = (m) => console.log(`[release] ${m}`);
const warn = (m) => {
  warnings.push(m);
  console.warn(paint(33, `[release] WARNING: ${m}`));
};
function fail(m) {
  console.error(paint(31, `[release] ERROR: ${m}`));
  process.exit(1);
}

if (flag('help')) {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].replace(/^#!.*\n\/\*\*\n?/, ''));
  process.exit(0);
}
for (const a of argv) {
  if (!KNOWN.some((k) => (k.endsWith('=') ? a.startsWith(k) : a === k))) fail(`unknown option ${a} (see --help)`);
}

const SKIP_BUILD = flag('skip-build');
const API_BASE = option('api-base', '/api');
const OUT = path.resolve(ROOT, option('out', 'release'));
{
  const r = path.relative(ROOT, OUT);
  if (!r || r.startsWith('..') || path.isAbsolute(r)) fail('--out must be a folder inside the project');
  const top = r.split(path.sep)[0].toLowerCase();
  const sources = ['api', 'database', 'src', 'public', 'dist', 'docs', 'tests', 'scripts', 'node_modules'];
  if (sources.includes(top)) fail(`--out may not point inside ${top}/`);
}

// ── Helpers ─────────────────────────────────────────────────────────────────
const posix = (p) => p.split(path.sep).join('/');
const relTo = (base, p) => posix(path.relative(base, p));

/** Every regular file below dir (absolute paths). */
function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else if (ent.isFile()) out.push(p);
  }
  return out;
}

/** Files that never belong on a server, wherever they turn up. */
const isJunk = (name) =>
  (/^\.env(\..+)?$/i.test(name) && name !== '.env.example') ||
  /\.(log|bak|swp|tmp|orig)$/i.test(name) ||
  ['error_log', '.DS_Store', 'Thumbs.db', 'desktop.ini', '.user.ini', '.git'].includes(name);

/**
 * Folders the running API writes into. They hold customer files, invoice scans and
 * database backups, so they are created empty in the release and never overwritten
 * on the server.
 */
const RUNTIME_DIRS = ['uploads/', 'storage/', 'backups/'];
const KEEP_IN_RUNTIME = new Set(['.htaccess', '.gitkeep']);
const counts = { spa: 0, api: 0, database: 0, runtimeLeftBehind: 0 };

/** Recursive copy; keep(absSrc, dirent) decides. Directories are created lazily. */
function copyTree(src, dest, keep, bucket) {
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, ent.name);
    const d = path.join(dest, ent.name);
    if (!keep(s, ent)) continue;
    if (ent.isDirectory()) {
      copyTree(s, d, keep, bucket);
    } else if (ent.isFile()) {
      fs.mkdirSync(dest, { recursive: true });
      fs.copyFileSync(s, d);
      counts[bucket]++;
    }
  }
}

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const version = readJson(path.join(ROOT, 'package.json')).version || '0.0.0';

// ── 1. Web app ──────────────────────────────────────────────────────────────
let spa; // 'built' | 'existing' | 'missing'
if (!SKIP_BUILD) {
  if (!fs.existsSync(path.join(ROOT, 'node_modules'))) fail('node_modules/ is missing. Run npm install first.');
  info(`npm run build  (VITE_API_BASE_URL=${API_BASE}, VITE_USE_MOCK_API=false)`);
  // Process env beats .env/.env.local in Vite, so a developer's local API URL
  // (http://127.0.0.1:8020/api) cannot leak into the release.
  const r = spawnSync('npm run build', {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, VITE_API_BASE_URL: API_BASE, VITE_USE_MOCK_API: 'false' },
  });
  if (r.status !== 0) {
    fail(`npm run build failed (exit ${r.status ?? r.error?.message}). Fix the build, or package an existing dist/ with --skip-build.`);
  }
  if (!fs.existsSync(path.join(DIST, 'index.html'))) fail('npm run build succeeded but dist/index.html is missing');
  spa = 'built';
} else if (fs.existsSync(path.join(DIST, 'index.html'))) {
  spa = 'existing';
  const when = fs.statSync(path.join(DIST, 'index.html')).mtime.toISOString();
  warn(`--skip-build: packaging the EXISTING dist/ (built ${when}). Its API base URL is whatever it was built with.`);
} else {
  spa = 'missing';
  warn('--skip-build and there is no dist/index.html, so this release has the API and database only and NO web app.');
}

if (spa !== 'missing') {
  const devUrl = /\b(?:127\.0\.0\.1|localhost):(?:8020|8010|8000|5173)\b/;
  const leaks = walk(DIST).filter((f) => /\.(m?js|html)$/i.test(f) && !f.endsWith('pdf.worker.min.mjs') && devUrl.test(fs.readFileSync(f, 'utf8')));
  if (leaks.length) {
    const m = `the web app has a local dev API URL baked in (${leaks.map((f) => relTo(ROOT, f)).join(', ')}). Rebuild without --skip-build.`;
    if (spa === 'built') fail(m);
    warn(m);
  }
}

// ── 2. Fresh output folder ──────────────────────────────────────────────────
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
info(`packaging into ${relTo(ROOT, OUT)}/`);

if (spa !== 'missing') copyTree(DIST, OUT, (_s, ent) => !isJunk(ent.name), 'spa');

// Web-root deny rules must ship even without the web app.
const publicHtaccess = path.join(ROOT, 'public', '.htaccess');
const outHtaccess = path.join(OUT, '.htaccess');
if (!fs.existsSync(outHtaccess)) {
  fs.copyFileSync(publicHtaccess, outHtaccess);
} else if (!fs.readFileSync(outHtaccess).equals(fs.readFileSync(publicHtaccess))) {
  warn('dist/.htaccess differs from public/.htaccess (stale dist/?). Shipping public/.htaccess.');
  fs.copyFileSync(publicHtaccess, outHtaccess);
}

// ── 3. API ──────────────────────────────────────────────────────────────────
copyTree(
  API,
  path.join(OUT, 'api'),
  (s, ent) => {
    const r = relTo(API, s);
    if (isJunk(ent.name)) return false;
    if (r === 'router.php') return false; // php -S dev router only
    if (RUNTIME_DIRS.some((d) => r.startsWith(d)) && ent.isFile() && !KEEP_IN_RUNTIME.has(ent.name)) {
      counts.runtimeLeftBehind++; // local uploads / scans / backups never leave this machine
      return false;
    }
    return true;
  },
  'api',
);
const keepFile = path.join(OUT, 'api', 'uploads', '.gitkeep');
if (!fs.existsSync(keepFile)) {
  fs.mkdirSync(path.dirname(keepFile), { recursive: true });
  fs.writeFileSync(keepFile, '');
}

// ── 4. Database migrations ──────────────────────────────────────────────────
const migrations = [];
const skippedDb = [];
for (const name of fs.readdirSync(DB).sort()) {
  const s = path.join(DB, name);
  if (!fs.statSync(s).isFile()) continue; // legacy/ stays behind
  if (name === 'migrate.php' || /^\d{3}_.+\.sql$/.test(name)) {
    fs.mkdirSync(path.join(OUT, 'database'), { recursive: true });
    fs.copyFileSync(s, path.join(OUT, 'database', name));
    counts.database++;
    if (name.endsWith('.sql')) migrations.push(name);
  } else {
    skippedDb.push(name);
  }
}
if (skippedDb.length) warn(`database/: not shipped (only NNN_*.sql and migrate.php are): ${skippedDb.join(', ')}`);

// ── 5. .env template ────────────────────────────────────────────────────────
fs.copyFileSync(path.join(ROOT, '.env.example'), path.join(OUT, '.env.example'));

// ── 6. PHP syntax check ─────────────────────────────────────────────────────
const phpFiles = walk(OUT).filter((f) => f.endsWith('.php'));
if (flag('skip-lint')) {
  warn('--skip-lint: PHP syntax was not checked');
} else if (spawnSync('php', ['-v'], { windowsHide: true }).error) {
  warn('php is not on PATH, so the PHP syntax check was skipped');
} else {
  const broken = [];
  for (const f of phpFiles) {
    const r = spawnSync('php', ['-l', f], { encoding: 'utf8', windowsHide: true });
    if (r.status !== 0) broken.push(`${relTo(OUT, f)}: ${(r.stdout + r.stderr).trim()}`);
  }
  if (broken.length) fail(`php -l failed:\n  ${broken.join('\n  ')}`);
  info(`php -l: ${phpFiles.length} files, no syntax errors`);
}

// ── 7. Audit: nothing that must never ship ──────────────────────────────────
const FORBIDDEN_DIRS = new Set(['node_modules', 'tests', 'docs', 'src', 'legacy', '.git', '.vscode', '.claude']);
const problems = [];
const sourceMaps = [];
for (const f of walk(OUT)) {
  const r = relTo(OUT, f);
  const parts = r.split('/');
  const name = parts.at(-1);
  if (parts.slice(0, -1).some((p) => FORBIDDEN_DIRS.has(p)) || isJunk(name) || r === 'api/router.php') problems.push(r);
  else if (RUNTIME_DIRS.some((d) => r.startsWith(`api/${d}`)) && !KEEP_IN_RUNTIME.has(name)) problems.push(r);
  if (name.endsWith('.map')) sourceMaps.push(r);
}
if (problems.length) {
  fs.rmSync(OUT, { recursive: true, force: true });
  fail(`refusing to leave a release containing: ${problems.join(', ')}`);
}
const required = ['.htaccess', 'api/.htaccess', 'api/index.php', 'api/config/app.php', 'database/migrate.php', '.env.example'];
if (spa !== 'missing') required.push('index.html');
const missing = required.filter((r) => !fs.existsSync(path.join(OUT, r)));
if (missing.length) fail(`release is missing required files: ${missing.join(', ')}`);
if (sourceMaps.length) warn(`${sourceMaps.length} source map(s) included; they publish the original TypeScript. Delete them if that matters.`);

// ── 8. Deploy notes ─────────────────────────────────────────────────────────
const spaLine = {
  built: `built now with VITE_API_BASE_URL=${API_BASE}`,
  existing: 'EXISTING dist/ packaged (--skip-build). Check its API base URL before uploading',
  missing: 'NOT INCLUDED (--skip-build with no dist/). Upload a web-app build separately',
}[spa];
const notes = `Kynetropo Ops - release ${version}
Packaged: ${new Date().toISOString()}
Web app:  ${spaLine}
Files:    web app ${counts.spa}, api ${counts.api}, database ${counts.database}
Migrations included: ${migrations.length} (${migrations[0] ?? '-'} .. ${migrations.at(-1) ?? '-'})
${warnings.length ? `Warnings at packaging time:\n${warnings.map((w) => `  - ${w}`).join('\n')}\n` : ''}
DO NOT UPLOAD THIS FILE. Upload everything else in this folder.

SERVER LAYOUT  (deployment root = web root: Hostinger public_html/)
  .htaccess  index.html  assets/ ...   the web app (SPA)
  .env         lives on the server only; never shipped. api/config/*.php read
               <deployment root>/.env and so does database/migrate.php.
  api/         PHP API, served at https://<domain>/api
  api/uploads/ api/storage/ api/backups/
               customer files, invoice scans and DB backups written by the API.
               Must be writable by PHP. NEVER delete or overwrite them.
  database/    migrations, run from SSH only (migrate.php refuses web requests)

UPGRADE (the usual case)
  1. Back up first: export the database (hPanel -> phpMyAdmin), and download
     .env and api/uploads/, api/storage/, api/backups/.
  2. Upload this folder's contents over public_html/. Never delete
     public_html/, .env or the three runtime folders above. Upload index.html last.
  3. From SSH:  cd public_html && php database/migrate.php
     It re-applies every NNN_*.sql; each is guarded, so re-running is safe.
     Lines marked WARN name a statement the database refused - read them.
  4. Open the site, sign in, and check a page from each module.

FIRST DEPLOY
  1. PHP 8.1+ with pdo_mysql, mbstring, openssl, json; MySQL 8 or MariaDB; HTTPS.
  2. Create the database and user (hPanel -> Databases).
  3. Upload this folder's contents into public_html/.
  4. Create public_html/.env from .env.example (DB_*, JWT_SECRET, CORS_ORIGIN).
  5. Import the base tables by hand, as before (see database/legacy/README.md in
     the source repo), then run: cd public_html && php database/migrate.php

ROLLBACK
  Re-upload the previous release. If this release's migrations changed tables
  the old code cannot use, restore the database export from step 1 too.

Full guide: docs/DEPLOYMENT.md in the source repo.
`;
// CRLF on Windows so Notepad shows it properly; the server never reads it.
fs.writeFileSync(path.join(OUT, 'DEPLOY-NOTES.txt'), process.platform === 'win32' ? notes.replace(/\n/g, '\r\n') : notes);

// ── Summary ─────────────────────────────────────────────────────────────────
info(`done: ${relTo(ROOT, OUT)}/  (web app: ${spa}; api ${counts.api} files; database ${counts.database} files)`);
if (counts.runtimeLeftBehind) info(`${counts.runtimeLeftBehind} local upload/backup file(s) under api/ were left out, as intended`);
if (warnings.length) console.warn(paint(33, `[release] ${warnings.length} warning(s). See above and in DEPLOY-NOTES.txt`));
