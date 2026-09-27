# Task Outcomes — September 2026 Sprint

All 9 planned tasks completed on branch `chore/dead-code-cleanup`, merged to `main` on 2026-09-27.

---

## Task A — Remove unreferenced backend files

**Commit:** `a4f0795`

Deleted 130 PHP files that were loaded by the autoloader but never referenced by any route:
- 78 controllers (Admin\*, Inventory\*, ReorderIntelligence)
- 42 models (Account, Employee, Inventory\*, Leave\*, Payroll\*, Vendor\*, …)
- 8 services (ApprovalWorkflow, ImportEngine, SmartAllocationEngine, …)
- 2 helpers (GroqAPI, InventoryPermissions)

Added `scripts/verify-classes.php` to confirm all route-referenced classes still resolve. Updated `docs/ARCHITECTURE.md` with accurate file counts (38 controllers, 21 models, 5 services, 9 helpers remaining).

---

## Task B — Fix global search

**Commit:** `e6c745e`

`AdminGlobalSearchController` was querying columns that do not exist in the production schema:
- `ops_bugs.title` → corrected to `ops_bugs.description`
- `employees` → corrected to `ops_employees`

Added `information_schema` guards (`Database::tableExists()`) so missing tables are silently skipped rather than throwing a 500.

---

## Task C — Apply chennis design to sales pages

**Commit:** `1cb3660`

**SalesLeadDetail** — replaced plain back button + hero section with:
- `RecordProfileHeader` (wave header, breadcrumb, mark initials, eyebrow, status badges, facts strip)
- `DetailStats` with `StatCard` tiles for Calls / Follow-ups / Meetings
- `DetailTimeline` replacing the manual `<ol>` activity log

**SalesChallengeDetail** — added `RecordProfileHeader` above the existing challenge shell. The shell and its `data-destroy-group` attributes were preserved intact so `ChallengeExpiredAnimation` continues to function. `<ol>` history replaced with `DetailTimeline`.

**SalesClients** — rewrote the data layer with `useClientList` (single fetch, client-side filter + search, localStorage page-size). Keeps identical `ClientCard` UI and money totals; removed the URL-sync that this page did not need.

Pages kept on their current pattern (server-side counts or intentional URL sync): SalesLeads, SalesMeetings, SalesTasks, SalesFollowUps, SalesChallenges, SalesCallHistory. Minor pages (SalesDashboard, SalesActivity, SalesMentions, SalesMore, SalesAssistant) already used `RecordListPage` + `PageHeader` — no structural changes needed.

---

## Task D — Resolve ESLint warnings

**Commit:** `bdbdcb2`

Eliminated all 40 ESLint warnings to reach zero. Changes were spread across 18 files:
- Added missing `displayName` on forwarded-ref components
- Added `key` props on mapped elements that were missing them
- Replaced `any` types with proper TypeScript types
- Fixed unused variable shadowing in catch blocks
- Corrected React Hook dependency arrays

---

## Task E — Smoke test script

**Commit:** `0235742`

Added `scripts/smoke.php` — a CLI script that runs after every deploy:
- Mints a 2-minute admin JWT from the live database
- GETs every list endpoint in the API
- Verifies that unauthenticated requests are rejected (401)
- Exits non-zero on any failure, so it can gate a deploy pipeline

Run from the server's deployment root: `php scripts/smoke.php https://project.kynetropo.com/api`

---

## Task F — Safe-deploy build tooling

**Commit:** `0235742`

**`scripts/build-release.mjs`** — rewrote the release packager:
- Builds with `VITE_API_BASE_URL=/api` and `VITE_USE_MOCK_API=false` baked in
- Detects and fails if a dev URL (`localhost:8020`, `127.0.0.1:5173`, …) leaks into the built JS
- Refuses to package `.env`, logs, `src/`, `docs/`, `tests/`, `node_modules/`, `database/legacy/`, `api/router.php`, or any uploaded files
- Runs `php -l` over every PHP file it ships
- Emits `DEPLOY-NOTES.txt` with step-by-step upgrade and first-deploy instructions

**`docs/DEPLOYMENT.md`** — full upgrade guide (backup, upload, permissions, migrations, smoke test, Cloudflare cache purge, rollback).

---

## Task G — Server clean-up script

**Commit:** `b97e29d`

Added `scripts/server-cleanup.sh`. The 130 files removed in Task A are still present on the live server because a normal file-upload deploy only adds/overwrites, never deletes. The script:
- Lists every stale file (dry-run by default)
- Removes them when called with `--delete`

Run from `public_html/` after the deploy: `bash api/scripts/server-cleanup.sh --delete`

---

## Task H — AI feature verification

No code changes required. Verified:

| Component | Status |
|---|---|
| `api/routes/73_sales_ai_actions.php` | Present, syntax clean |
| `api/ai/sales-endpoint-catalog.json` | Present |
| `SalesAiChatController` | Uses `AI_PROVIDER` env var; defaults to Gemini, falls back to Groq |
| `ChatController` + `GroqClient` | Ops dashboard AI; reads `GROQ_API_KEY` / `GROQ_MODEL` |
| `.env.example` | Documents `AI_PROVIDER`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`, `GROQ_API_KEY`, `GROQ_MODEL` |

---

## Task I — Final checks, merge, branch clean-up

All pre-merge checks passed:

| Check | Result |
|---|---|
| `npx tsc -p tsconfig.app.json --noEmit` | 0 errors |
| `npx vitest run` | 7/7 tests pass |
| `npx eslint . --max-warnings 0` | 0 warnings |
| `npm run build` | Clean, no dev-URL leaks |

Merged `chore/dead-code-cleanup` → `main` with `--no-ff` (`faad0cf`). Branch deleted.

---

## Deploy checklist

1. `npm run release` — builds and packages into `release/`
2. Back up the server database and `.env`
3. Upload `release/` contents to `public_html/` (index.html last)
4. Fix permissions (see `docs/DEPLOYMENT.md`)
5. `php database/migrate.php` — run migrations
6. `php scripts/smoke.php https://project.kynetropo.com/api` — smoke test
7. `bash api/scripts/server-cleanup.sh --delete` — remove stale files from Task A
8. Sign in and open a page from each module
