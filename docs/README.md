# FitPilot Backend

FitPilot's backend is a single Cloudflare Worker written in TypeScript. It serves a JSON API to the FitPilot mobile app and the admin panel, stores data in a Cloudflare D1 (SQLite) database, and sends push notifications through OneSignal. Completed workouts earn XP, with bonuses for workout streaks.

| Document | What it covers |
| --- | --- |
| [Folder structure](folder-structure.md) | What lives where in `src/`, how a request flows, how to add an endpoint |
| [Endpoints](endpoints.md) | Every route: method, path, who can call it, what it does |
| [Database](database.md) | Tables, what each one is used for, relationships, migrations and seed data |

The request and response schemas for each route are in the OpenAPI spec. While the worker is running, open `/docs` for Swagger UI or `/openapi.json` for the raw spec.

## Quick start

```bash
npm install
npx wrangler d1 migrations apply fitpilot-db --local   # create tables locally
npx wrangler d1 execute fitpilot-db --local --file=seeds/exercises.sql   # sample exercises
npm run dev                                             # http://localhost:8787
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Run the worker locally with a local D1 database |
| `npm run deploy` | Deploy to Cloudflare |
| `npm run cf-typegen` | Regenerate `worker-configuration.d.ts` after changing bindings in `wrangler.jsonc` |
| `npx tsc --noEmit` | Type-check the project |

## Configuration

| Name | Kind | Used for |
| --- | --- | --- |
| `fitpilot_db` | D1 binding (`wrangler.jsonc`) | The database |
| `ONESIGNAL_REST_API_KEY` | Secret | Sending push notifications |
| `GOOGLE_CLIENT_IDS` | Secret, comma-separated | Accepted audiences for Google sign-in ID tokens |

Set secrets with `npx wrangler secret put <NAME>`. For local development, put them in a `.dev.vars` file. The OneSignal app ID is not secret, so it lives in code as `ONESIGNAL_APP_ID` in `src/services/notifications.ts`.

## Known quirks

- `GET /test-db` is public and lists every table name. Remove it or require admin login before production.
- `GET /progress` returns errors under an `error` key; every other route uses `message`.
- A GET to a deeper session path such as `/workouts/sessions/abc/other` is treated as `GET /workouts/:id` with the ID `sessions`.
- Nothing writes to `weight_logs`, so the progress weight chart shows only the current weight. See [Database](database.md#known-gap-weight_logs-is-never-written).
- On Mondays, `workoutsThisWeek` on `/admin/dashboard` counts last week's workouts instead of this week's.
- `test/index.spec.ts` still contains the Cloudflare template's "Hello World" tests, and both fail.
