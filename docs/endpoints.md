# Endpoints

All responses are JSON with a `success` boolean. Errors carry a `message` (on `/progress`, an `error`). For full request and response schemas, open `/docs` (Swagger UI) on a running worker.

**Auth column**
- **Public**: no token needed.
- **User**: `Authorization: Bearer <accessToken>` from `/auth/login`, `/auth/register` or `/auth/google`.
- **Admin**: `Authorization: Bearer <accessToken>` from `/admin/auth/login`. User tokens are not accepted.

A missing or expired token returns 401.

## System

| Method | Path | Auth | What it does |
| --- | --- | --- | --- |
| GET | `/` | Public | API name and version |
| GET | `/health` | Public | Health check |
| GET | `/docs` | Public | Swagger UI |
| GET | `/openapi.json` | Public | OpenAPI spec |
| GET | `/test-db` | Public | Lists database tables (remove before production) |

## Auth

| Method | Path | Auth | What it does |
| --- | --- | --- | --- |
| POST | `/auth/register` | Public | Create an account with email, password and name |
| POST | `/auth/login` | Public | Log in with email and password |
| POST | `/auth/google` | Public | Sign in with a Google ID token from the app |
| POST | `/auth/refresh` | Public (refresh token in body) | Swap a refresh token for new access and refresh tokens |
| POST | `/auth/logout` | User | End the current session |
| GET | `/auth/me` | User | The logged-in user |

Access tokens last 7 days and refresh tokens last 30 days.

## Profile

| Method | Path | Auth | What it does |
| --- | --- | --- | --- |
| GET | `/profile` | User | The user's profile |
| PUT | `/profile` | User | Update profile and onboarding fields (age, height, weight, goal, workout days and so on) |

## Exercises

| Method | Path | Auth | What it does |
| --- | --- | --- | --- |
| GET | `/exercises` | Public | Active exercises, sorted by name |
| GET | `/exercises/:id` | Public | One exercise |

`/exercises` query parameters: `page`, `limit` (default 20, max 100), `muscleGroup`, `category`, `difficulty`, `equipment`. Filters are exact matches and can be combined.

## Workout plans

| Method | Path | Auth | What it does |
| --- | --- | --- | --- |
| GET | `/workouts` | User | The user's workout plans |
| POST | `/workouts/generate` | User | Generate a plan from the user's profile |
| POST | `/workouts/regenerate` | User | Replace the active plan with a newly generated one |
| GET | `/workouts/today` | User | Today's workout from the active plan |
| GET | `/workouts/stats` | User | Workout totals for the home dashboard |
| GET | `/workouts/weekly-progress` | User | Which days this week have a completed workout |
| GET | `/workouts/:id` | User | A plan with its days and exercises |
| POST | `/workouts/:id/days/:dayId/exercises` | User | Add an exercise to a day of the active plan |

## Workout sessions

A session is one real workout the user does, with the sets they record.

| Method | Path | Auth | What it does |
| --- | --- | --- | --- |
| POST | `/workouts/sessions` | User | Start a session |
| GET | `/workouts/sessions/:sessionId` | User | A session with its exercises and sets |
| POST | `/workouts/sessions/:sessionId/exercises` | User | Add an exercise to an in-progress session |
| POST | `/workouts/sessions/:sessionId/sets` | User | Record a set |
| POST | `/workouts/sessions/:sessionId/complete` | User | Mark the session completed and award XP |

Completing a session returns the XP it earned, which the app can show on the completion screen:

```json
{
  "success": true,
  "data": {
    "id": "…",
    "status": "completed",
    "durationSeconds": 2710,
    "caloriesBurned": 320,
    "currentStreak": 7,
    "rewards": [
      { "type": "workout_completed", "xp": 20 },
      { "type": "streak_milestone", "xp": 150, "streak": 7 }
    ],
    "totalXpEarned": 170
  }
}
```

Every completed workout earns 20 XP. Reaching a 3, 7, 30 or 100-day streak adds a one-time bonus of 50, 150, 500 or 2000 XP. See [Rewards and XP](database.md#rewards-and-xp).

## Progress

| Method | Path | Auth | What it does |
| --- | --- | --- | --- |
| GET | `/progress?period=weekly` | User | Progress numbers for `weekly` (default), `monthly` or `yearly`. Any other value returns 400 |

The response includes `rewards`: all-time `totalXp`, `totalRewards` and the 10 most recent reward events in `history`. Unlike the other numbers, rewards are not limited to the period.

## Notifications

| Method | Path | Auth | What it does |
| --- | --- | --- | --- |
| GET | `/notifications` | User | In-app inbox: notifications sent to all users, newest first |
| POST | `/notifications/test` | User | Send a test push to your own devices |

`/notifications` takes `page` and `limit` (default 20, max 100) and returns:

```json
{
  "success": true,
  "data": {
    "notifications": [
      { "id": "…", "title": "…", "message": "…", "created_at": "2026-09-28 10:15:00" }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 42, "totalPages": 3, "hasNextPage": true }
  }
}
```

`created_at` is UTC in `YYYY-MM-DD HH:MM:SS` form, with no timezone marker. Pushes reach the device through OneSignal, not through this API. The app must log in to the OneSignal SDK with the user's ID as `external_id`.

## App version

| Method | Path | Auth | What it does |
| --- | --- | --- | --- |
| GET | `/app/version?platform=android` | Public | Latest and minimum app version for `android` or `ios`. The app checks this on launch to show an update sheet |

Below `latestVersion` the app suggests an update; below `minVersion` it forces one.

## Admin: account

| Method | Path | Auth | What it does |
| --- | --- | --- | --- |
| POST | `/admin/setup` | Public, one time | Create the first admin. Returns 403 once any admin exists |
| POST | `/admin/auth/login` | Public | Admin login; returns an access token |
| GET | `/admin/auth/me` | Admin | The logged-in admin |
| POST | `/admin/auth/logout` | Admin token | End the admin session |

## Admin: pages

| Method | Path | Auth | What it does |
| --- | --- | --- | --- |
| GET | `/admin/dashboard` | Admin | Dashboard totals |
| GET | `/admin/users` | Admin | User list |
| GET | `/admin/analytics` | Admin | Analytics numbers |
| GET | `/admin/workouts` | Admin | Workout list |
| GET | `/admin/exercises` | Admin | Exercise list, including inactive ones (`page`, `limit` default 10, `search`) |
| POST | `/admin/exercises` | Admin | Create an exercise |
| PUT | `/admin/exercises/:id` | Admin | Update an exercise |
| DELETE | `/admin/exercises/:id` | Admin | Deactivate an exercise (hidden from the app, kept in the database) |
| DELETE | `/admin/exercises/:id/permanent` | Admin | Delete for good. Returns 409 if any plan or session uses it |
| POST | `/admin/notifications/send` | Admin | Push `{ title, message }` to all users and save it to history. Title max 100 characters, message max 1000 |
| GET | `/admin/notifications/history` | Admin | Sent notifications, newest first (`page`, `limit` default 10) |
| GET | `/admin/app-versions` | Admin | Version config for both platforms |
| PUT | `/admin/app-versions/:platform` | Admin | Update version config for `android` or `ios` |
