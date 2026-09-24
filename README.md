# Kynetropo Ops

The operations app at project.kynetropo.com: clients and projects, bugs and meetings, finance and AMC, pitches, hiring, reports, and the sales module (leads → calls → follow-ups → meetings → customers, with tasks and challenges).

- **Web:** React 18, TypeScript, Vite, Tailwind, shadcn/ui.
- **API:** a plain PHP 8 JSON API with JWT.
- **Database:** MySQL / MariaDB.

## Layout

| Folder | What is in it |
|---|---|
| `api/` | PHP API. `index.php` boots it; each module's routes are in `api/routes/NN_<module>.php` |
| `database/` | `NNN_*.sql` migrations and `migrate.php`. `legacy/` holds scripts that were run by hand |
| `src/` | Web app. Pages in `src/pages/<module>/`, routes in `src/routes/<module>.tsx`, API calls in `src/lib/api/` |
| `public/` | Static files copied into every build (`.htaccess`, icons, manifest, service worker) |
| `scripts/` | `build-release.mjs`, which packages a deployable `release/` |
| `tests/` | `tests/parsers/`: invoice-parser scripts and their sample PDFs |
| `docs/` | Architecture, deployment and project notes |

## Run locally

Prerequisites: Node 20+, PHP 8.1+ (with `pdo_mysql`, `mbstring`, `openssl`), and a MySQL database.

```bash
npm install
cp .env.example .env                                   # fill in DB_*, JWT_SECRET
echo VITE_API_BASE_URL=http://127.0.0.1:8020/api > .env.local

npm run db:migrate    # apply database/NNN_*.sql
npm run api:serve     # API on http://127.0.0.1:8020/api
npm run dev           # web app on http://localhost:5173
```

## Checks

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

## Deploy

`npm run release` builds the web app and packages `release/`, whose contents are uploaded into Hostinger's `public_html/`. Then run `php database/migrate.php` there. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Documentation

| Document | Purpose |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the API, routes, database and web app are put together |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Releasing to Hostinger, migrations, rollback |
| [docs/Kynetropo_Sales_App_Final_Implementation.md](docs/Kynetropo_Sales_App_Final_Implementation.md) | Sales module specification |
