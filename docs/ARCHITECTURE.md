# Architecture

## API (`api/`)

`api/index.php` sets CORS and error handling, checks the JWT secret, loads `config/` and `core/`, registers an autoloader, then loads every file in `api/routes/` in name order and dispatches.

- **Autoloading.** Helpers, middleware, services, models and controllers load on first use. Each file holds one class named after the file, for example `controllers/AdminOpsClientController.php` holds `AdminOpsClientController`. Controllers live directly in `controllers/`, with no subfolders.
- **Routes.** Each `api/routes/NN_<module>.php` registers one module's routes on `$router`. The router is **first-match-wins**, so file order is registration order: `/x/search` must be registered before `/x/{id}`, in the same file or an earlier one. To add routes, edit the module's file; for a new module, add the next free number.

| File | Routes |
|---|---|
| `00_platform_billing.php` | Signup |
| `01_auth.php` | Login, refresh, sign-out, current user |
| `02_storefront.php` | Change password (`PUT /users/{id}/password`). Its `UserController` is not in this build, so this call fails today |
| `10_admin_users_customers.php` | Admin users, customer health and merge |
| `22_notifications_reports_quotes.php` | Notifications, reports |
| `30_settings_data_insights.php` | Settings |
| `60_chat.php` | Chat widget |
| `61_krish_portals.php` | Krish customers and employees (User Management), plus the Krish portal endpoints, which the web app no longer calls |
| `70_ops.php` | Ops: dashboard, clients, projects, bugs, meetings, finance, AMC, pitches, hiring, employees |
| `71_sales.php` | Sales module, Sales AI assistant, push notifications, ops reports |
| `72_search.php` | Global search |
| `73_sales_ai_actions.php` | CRM and invoice routes that only the Sales AI assistant calls (see `api/ai/sales-endpoint-catalog.json`) |

Only the routes the web app calls are registered. The other modules (products, procurement, inventory, invoicing, GST, accounting, HR, invoice processing and the Krish Agencies CRM) were removed from the routes along with their pages.

- **Runtime folders.** `api/uploads/`, `api/storage/` and `api/backups/` are written by the API. Stored file paths in the database are relative to `api/` (for example `uploads/meetings/2026/09/x.pdf`), so these folders must stay where they are.
- **Configuration.** `api/config/*.php` read `.env` from the project root, which is the folder that contains `api/`.
- **Local dev.** `api/router.php` sends `/api/*` to `index.php` under `php -S` (`npm run api:serve`). It is never deployed.

## Database (`database/`)

`php database/migrate.php` applies every `NNN_*.sql` on every run. Each file is guarded (`CREATE TABLE IF NOT EXISTS`, or `ALTER`s gated on `information_schema`), and a failing statement is reported as `WARN` without stopping the run.

1. `001`–`099`: base and reconciliation tables.
2. The tenant pass: adds `tenant_id` to every business table that lacks it, widens the `document_sequences` primary key, and re-scopes natural unique keys to `(tenant_id, col)`.
3. `100`+: feature schemas that extend those tables.

Number a new migration below 100 only if the tenant pass must stamp a table it creates.

`database/legacy/` holds scripts that were run by hand, including setup snapshots and a credential reset. The runner never reads them, and releases never ship them.

## Web app (`src/`)

- `src/routes/<module>.tsx` declares a module's pages as `RouteDef`s (`path`, a lazy `element`, and optional `salesScope`). `src/routes/index.ts` collects them, and `App.tsx` renders them inside the dashboard layout. To add a page, edit only the module's route file.
- `src/pages/<module>/` holds the pages: `dashboard`, `crm`, `delivery`, `finance`, `invoicing`, `growth`, `reports`, `sales`, `team`, `inventory`, `admin`, plus the `customer`, `employee` and `platform` portals. `Login`, `NotFound`, `Signup` and `Index` sit at the top of `src/pages/`.
- `src/lib/api/` has one file per API area, all built on `client.ts`.
- `src/routes/routes.test.ts` checks the registry: every path once, the exact page list, and which sales pages use the colleague view.
