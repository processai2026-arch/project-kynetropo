# Sales AI Assistant

A write-capable, conversational AI interface for the Kynetropo Sales CRM,
modelled on the platform's reference assistant. It **says everything and does
every action through the existing API + DB**, using JSON contracts and metadata.

## What it does

- **Ask anything** — answers questions from live, tenant-scoped data (leads,
  follow-ups, meetings, calls, challenges). The model never writes SQL: it names
  a dataset and supplies filter values that are bound as parameters into queries
  written in the controller.
- **Do actions** — add a lead, log a call, schedule a follow-up or meeting,
  create a task or challenge. Every write is replayed through the real REST API
  with the caller's own JWT, so all permission checks and validators apply.
- **Three tasks in one prompt** — a single message can produce several confirm
  cards (`type: "actions"`), each confirmed independently.
- **Memory** — conversations are stored server-side and survive a refresh.
- **Safety** — writes are never auto-executed. Each becomes a single-use,
  15-minute token, re-validated against live data at confirm time.

## Endpoints (all `admin`-guarded)

| Method | Path | Purpose |
|--------|------|---------|
| POST   | `/admin/sales-ai/message`            | Send a message, get a structured reply |
| POST   | `/admin/sales-ai/execute`            | Run a confirmed action by token |
| GET    | `/admin/sales-ai/conversations`      | This user's recent threads |
| GET    | `/admin/sales-ai/conversations/{id}` | Reopen one thread in full |
| DELETE | `/admin/sales-ai/conversations/{id}` | Delete a thread |

## Files

- `api/controllers/admin/SalesAiChatController.php` — the assistant
- `api/ai/sales-endpoint-catalog.json` — metadata: every action, its required
  and optional fields, and their types (drives validation + the prompt)
- `database/create_sales_ai.sql` — `sales_ai_conversations`, `sales_ai_messages`,
  `sales_ai_intents` (registered in `database/migrate.php`)
- `src/pages/sales/SalesAssistant.tsx` — the chat UI (`/sales/assistant`)
- `src/lib/api/salesAi.ts`, `src/types/salesAi.ts` — client + types

## Activation

1. Run the DB migration (already registered): `php database/migrate.php`
   — or apply `database/create_sales_ai.sql` directly.
2. Ensure `public_html/.env` has a Groq key and (optionally) app URL:
   ```
   groq_api_key=YOUR_KEY
   groq_model=llama-3.3-70b-versatile
   APP_URL=https://your-domain.com
   ```
   The model provider is swappable and never named to the user.

## Safety model (defence in depth)

1. **Whitelist** — only the 7 method+path prefixes in `ALLOWED_PATHS` can ever
   be proposed or executed; checked at propose time and again at execute time.
2. **Metadata validation** — every field is coerced and range-checked against
   `sales-endpoint-catalog.json` (types, enums, dates, min/max).
3. **Reference existence** — a `ref` field (lead / user / client) must point at
   a record that exists **in this tenant**; the table→primary-key map is a fixed
   allowlist, never taken from the model.
4. **Confirm tokens** — no write runs on the model's say-so. It becomes a
   single-use, 15-minute token, re-validated against live data at confirm time.
5. **Caller's own JWT** — execution replays through the real REST API, so the
   target controller re-runs every permission check, record-scope and validator.
6. **Tenant scoping** — reads and memory are scoped by `Database::tenantId()`;
   a conversation id that is not the caller's own opens a fresh thread.

Deliberately **out of scope** for the assistant (require a human flow): lead
conversion to a customer (irreversible), permission/role changes, deletions.

## Example prompts

- "Add a lead: Acme Corp, contact Priya, phone 9876543210, mark it hot"
- "Which follow-ups are overdue?"
- "Log a call with Acme — interested — and schedule a follow-up next Monday"
- "Book a virtual meeting with Acme tomorrow at 3pm"
- "Add a lead for Beta Ltd, log a call, and create a task to send a proposal"
  (three actions, confirmed one at a time)
