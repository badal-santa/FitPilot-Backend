import type { Env } from "../index";
import { GOOGLE_ONLY_PASSWORD_HASH } from "./auth";

export async function getAdminDashboard(
    env: Env,
) {
    const db = env.fitpilot_db;

    const [
        totalUsersResult,
        newUsersTodayResult,
        workoutsTodayResult,
        workoutsThisWeekResult,
        remindersEnabledResult,
        onboardingCompletedResult,
    ] = await Promise.all([
        db
            .prepare(
                `
        SELECT COUNT(*) AS count
        FROM users
        `,
            )
            .first<{ count: number }>(),

        db
            .prepare(
                `
        SELECT COUNT(*) AS count
        FROM users
        WHERE date(created_at) = date('now')
        `,
            )
            .first<{ count: number }>(),

        db
            .prepare(
                `
        SELECT COUNT(*) AS count
        FROM workout_sessions
        WHERE status = 'completed'
          AND date(completed_at) = date('now')
        `,
            )
            .first<{ count: number }>(),

        db
            .prepare(
                `
        SELECT COUNT(*) AS count
        FROM workout_sessions
        WHERE status = 'completed'
          AND date(completed_at) >= date(
            'now',
            'weekday 1',
            '-7 days'
          )
          AND date(completed_at) < date(
            'now',
            'weekday 1'
          )
        `,
            )
            .first<{ count: number }>(),

        db
            .prepare(
                `
        SELECT COUNT(*) AS count
        FROM users
        WHERE reminders_enabled = 1
        `,
            )
            .first<{ count: number }>(),

        db
            .prepare(
                `
        SELECT COUNT(*) AS count
        FROM users
        WHERE onboarding_completed = 1
        `,
            )
            .first<{ count: number }>(),
    ]);

    return {
        totalUsers: Number(
            totalUsersResult?.count ?? 0,
        ),

        newUsersToday: Number(
            newUsersTodayResult?.count ?? 0,
        ),

        workoutsToday: Number(
            workoutsTodayResult?.count ?? 0,
        ),

        workoutsThisWeek: Number(
            workoutsThisWeekResult?.count ?? 0,
        ),

        remindersEnabled: Number(
            remindersEnabledResult?.count ?? 0,
        ),

        onboardingCompleted: Number(
            onboardingCompletedResult?.count ?? 0,
        ),
    };
}

export async function getAdminUsers(
    request: Request,
    env: Env,
) {
    const url = new URL(request.url);

    const search = (
        url.searchParams.get("search") ?? ""
    ).trim();

    const page = Math.max(
        1,
        Number(url.searchParams.get("page") ?? 1) || 1,
    );

    const limit = Math.min(
        100,
        Math.max(
            1,
            Number(url.searchParams.get("limit") ?? 10) || 10,
        ),
    );

    const offset = (page - 1) * limit;

    const searchPattern = `%${search
        .replace(/\\/g, "\\\\")
        .replace(/%/g, "\\%")
        .replace(/_/g, "\\_")}%`;

    const whereClause = search
        ? `WHERE name LIKE ? ESCAPE '\\'
       OR email LIKE ? ESCAPE '\\'`
        : "";

    const query = env.fitpilot_db.prepare(
        `
    SELECT
      id,
      name,
      email,
      goal,
      onboarding_completed,
      reminders_enabled,
      created_at,
      CASE
        WHEN google_id IS NULL THEN 'email'
        WHEN password_hash = '${GOOGLE_ONLY_PASSWORD_HASH}' THEN 'google'
        ELSE 'both'
      END AS auth_provider
    FROM users
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
    `,
    );

    const countQuery = env.fitpilot_db.prepare(
        `
    SELECT COUNT(*) AS total
    FROM users
    ${whereClause}
    `,
    );

    const bindings = search
        ? [searchPattern, searchPattern]
        : [];

    const [usersResult, countResult] = await Promise.all([
        query
            .bind(...bindings, limit, offset)
            .all(),

        countQuery
            .bind(...bindings)
            .first<{ total: number }>(),
    ]);

    const total = Number(countResult?.total ?? 0);

    return {
        users: usersResult.results,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}


export async function getAdminAnalytics(env: Env) {
    const workoutActivity = await env.fitpilot_db
        .prepare(`
      SELECT
        date(completed_at) AS date,
        COUNT(*) AS workouts
      FROM workout_sessions
      WHERE status = 'completed'
        AND date(completed_at) >= date('now', '-6 days')
        AND date(completed_at) <= date('now')
      GROUP BY date(completed_at)
      ORDER BY date ASC
    `)
        .all();

    const userGrowth = await env.fitpilot_db
        .prepare(`
      SELECT
        date(created_at) AS date,
        COUNT(*) AS users
      FROM users
      WHERE date(created_at) >= date('now', '-6 days')
        AND date(created_at) <= date('now')
      GROUP BY date(created_at)
      ORDER BY date ASC
    `)
        .all();

    return {
        workoutActivity: workoutActivity.results,
        userGrowth: userGrowth.results,
    };
}


export async function getAdminWorkouts(
  request: Request,
  env: Env,
) {
  const url = new URL(request.url);

  const search = (
    url.searchParams.get("search") ?? ""
  ).trim();

  const page = Math.max(
    1,
    Number(url.searchParams.get("page") ?? 1) || 1,
  );

  const limit = Math.min(
    100,
    Math.max(
      1,
      Number(url.searchParams.get("limit") ?? 10) || 10,
    ),
  );

  const offset = (page - 1) * limit;

  const searchPattern = `%${search
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_")}%`;

  const whereClause = search
    ? `WHERE u.name LIKE ? ESCAPE '\\'
       OR u.email LIKE ? ESCAPE '\\'`
    : "";

  const query = env.fitpilot_db.prepare(`
    SELECT
      ws.id,
      ws.user_id,
      u.name AS user_name,
      u.email AS user_email,
      ws.workout_plan_day_id,
      ws.started_at,
      ws.completed_at,
      ws.status,
      ws.duration_seconds,
      ws.calories_burned,
      ws.notes,
      ws.created_at
    FROM workout_sessions ws
    LEFT JOIN users u ON u.id = ws.user_id
    ${whereClause}
    ORDER BY ws.started_at DESC
    LIMIT ? OFFSET ?
  `);

  const countQuery = env.fitpilot_db.prepare(`
    SELECT COUNT(*) AS total
    FROM workout_sessions ws
    LEFT JOIN users u ON u.id = ws.user_id
    ${whereClause}
  `);

  const bindings = search
    ? [searchPattern, searchPattern]
    : [];

  const [workoutsResult, countResult] = await Promise.all([
    query
      .bind(...bindings, limit, offset)
      .all(),

    countQuery
      .bind(...bindings)
      .first<{ total: number }>(),
  ]);

  const total = Number(countResult?.total ?? 0);

  return {
    workouts: workoutsResult.results,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}