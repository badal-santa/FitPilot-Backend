type ProgressPeriod = "weekly" | "monthly" | "yearly";

function getPeriodDates(period: ProgressPeriod) {
  const now = new Date();

  if (period === "weekly") {
    const day = now.getUTCDay();
    const diff = day === 0 ? 6 : day - 1;

    const start = new Date(now);
    start.setUTCDate(now.getUTCDate() - diff);
    start.setUTCHours(0, 0, 0, 0);

    return {
      start,
      end: now,
    };
  }

  if (period === "monthly") {
    const start = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        1,
      ),
    );

    return {
      start,
      end: now,
    };
  }

  const start = new Date(
    Date.UTC(now.getUTCFullYear(), 0, 1),
  );

  return {
    start,
    end: now,
  };
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Consecutive days (UTC) with at least one completed workout, counting back
 * from today — or from yesterday if the user hasn't trained yet today, so
 * the streak doesn't drop to 0 before they've had a chance to. Shared by
 * /progress and /workouts/stats (the Home header's streak).
 */
export async function getCurrentStreak(db: D1Database, userId: string): Promise<number> {
  const streakResult = await db
    .prepare(
      `
      SELECT DISTINCT date(started_at) AS workout_date
      FROM workout_sessions
      WHERE user_id = ?
        AND status = 'completed'
      ORDER BY workout_date DESC
      `,
    )
    .bind(userId)
    .all<{ workout_date: string }>();

  const completedDates = new Set(
    streakResult.results?.map((item) => item.workout_date) ?? [],
  );

  let currentStreak = 0;
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);

  if (!completedDates.has(formatDate(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  while (completedDates.has(formatDate(cursor))) {
    currentStreak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return currentStreak;
}

function getDayLabel(date: Date) {
  return ["S", "M", "T", "W", "T", "F", "S"][
    date.getUTCDay()
  ];
}

export async function getProgress(
  db: D1Database,
  userId: string,
  period: ProgressPeriod = "weekly",
) {
  const validPeriods: ProgressPeriod[] = [
    "weekly",
    "monthly",
    "yearly",
  ];

  if (!validPeriods.includes(period)) {
    throw new Error("Invalid progress period");
  }

  const { start, end } = getPeriodDates(period);

  const startDate = formatDate(start);
  const endDate = formatDate(end);

  /*
   * ---------------------------------------------------------
   * WORKOUT SESSIONS
   * ---------------------------------------------------------
   */

  const sessionsResult = await db
    .prepare(
      `
      SELECT
        id,
        started_at,
        completed_at,
        calories_burned
      FROM workout_sessions
      WHERE user_id = ?
        AND status = 'completed'
        AND date(started_at) BETWEEN date(?) AND date(?)
      ORDER BY started_at ASC
      `,
    )
    .bind(userId, startDate, endDate)
    .all<{
      id: string;
      started_at: string;
      completed_at: string | null;
      calories_burned: number | null;
    }>();

  const sessions = sessionsResult.results ?? [];

  /*
   * ---------------------------------------------------------
   * BASIC STATS
   * ---------------------------------------------------------
   */

  const totalWorkouts = sessions.length;

  const totalCalories = sessions.reduce(
    (total, session) =>
      total + (session.calories_burned ?? 0),
    0,
  );

  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  const daysElapsed =
    Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;

  const avgCaloriesPerDay = Math.round(
    totalCalories / daysElapsed,
  );

  /*
   * ---------------------------------------------------------
   * ACTIVITY BARS
   * ---------------------------------------------------------
   */

  const workoutDates = new Set(
    sessions.map((session) =>
      session.started_at.slice(0, 10),
    ),
  );

  const activityBars: {
    label: string;
    value: number;
  }[] = [];

  if (period === "weekly") {
    const current = new Date(start);

    for (let i = 0; i < 7; i++) {
      const date = new Date(current);
      date.setUTCDate(start.getUTCDate() + i);

      const dateString = formatDate(date);

      activityBars.push({
        label: getDayLabel(date),
        value: workoutDates.has(dateString) ? 1 : 0,
      });
    }
  } else {
    const days =
      period === "monthly"
        ? new Date(
          Date.UTC(
            start.getUTCFullYear(),
            start.getUTCMonth() + 1,
            0,
          ),
        ).getUTCDate()
        : 12;

    if (period === "monthly") {
      for (let i = 0; i < days; i++) {
        const date = new Date(start);
        date.setUTCDate(i + 1);

        const dateString = formatDate(date);

        activityBars.push({
          label: `${i + 1}`,
          value: workoutDates.has(dateString) ? 1 : 0,
        });
      }
    } else {
      for (let i = 0; i < 12; i++) {
        const month = i + 1;

        const monthPrefix = `${start.getUTCFullYear()}-${String(
          month,
        ).padStart(2, "0")}`;

        const active = sessions.some((session) =>
          session.started_at.startsWith(monthPrefix),
        );

        activityBars.push({
          label: new Date(
            Date.UTC(
              start.getUTCFullYear(),
              i,
              1,
            ),
          ).toLocaleString("en-US", {
            month: "short",
            timeZone: "UTC",
          }),
          value: active ? 1 : 0,
        });
      }
    }
  }

  const activeCount = activityBars.filter(
    (bar) => bar.value > 0,
  ).length;

  /*
   * ---------------------------------------------------------
   * CALORIES
   * ---------------------------------------------------------
   */

  const caloriesBars = activityBars.map((bar) => ({
    label: bar.label,
    value: 0,
  }));

  if (period === "weekly") {
    for (const session of sessions) {
      const date = session.started_at.slice(0, 10);
      const index = activityBars.findIndex((_, index) => {
        const dateValue = new Date(start);
        dateValue.setUTCDate(
          start.getUTCDate() + index,
        );

        return formatDate(dateValue) === date;
      });

      if (index >= 0) {
        caloriesBars[index].value +=
          session.calories_burned ?? 0;
      }
    }
  } else if (period === "monthly") {
    for (const session of sessions) {
      const day = Number(
        session.started_at.slice(8, 10),
      );

      const index = day - 1;

      if (caloriesBars[index]) {
        caloriesBars[index].value +=
          session.calories_burned ?? 0;
      }
    }
  } else {
    for (const session of sessions) {
      const month =
        Number(session.started_at.slice(5, 7)) - 1;

      if (caloriesBars[month]) {
        caloriesBars[month].value +=
          session.calories_burned ?? 0;
      }
    }
  }

  /*
   * ---------------------------------------------------------
   * WEIGHT
   * ---------------------------------------------------------
   */

  const weightResult = await db
    .prepare(
      `
      SELECT
        weight_kg,
        recorded_at
      FROM weight_logs
      WHERE user_id = ?
        AND date(recorded_at) BETWEEN date(?) AND date(?)
      ORDER BY recorded_at ASC
      `,
    )
    .bind(userId, startDate, endDate)
    .all<{
      weight_kg: number;
      recorded_at: string;
    }>();

  const weightLogs = weightResult.results ?? [];

  /*
   * Current weight is the latest log (any date),
   * falling back to the weight on the user's profile.
   */

  const latestWeightResult = await db
    .prepare(
      `
      SELECT
        COALESCE(
          (
            SELECT weight_kg
            FROM weight_logs
            WHERE user_id = ?
            ORDER BY recorded_at DESC
            LIMIT 1
          ),
          (
            SELECT weight_kg
            FROM users
            WHERE id = ?
          )
        ) AS weight_kg
      `,
    )
    .bind(userId, userId)
    .first<{ weight_kg: number | null }>();

  const currentWeight = latestWeightResult?.weight_kg ?? 0;

  const weightPoints =
    weightLogs.length > 0
      ? weightLogs.map((item) => ({
        label: item.recorded_at.slice(5, 10),
        value: item.weight_kg,
      }))
      : [
        {
          label: "Now",
          value: currentWeight,
        },
      ];

  const firstWeight =
    weightPoints[0]?.value ?? currentWeight;

  const lastWeight =
    weightPoints[weightPoints.length - 1]?.value ??
    currentWeight;

  const weightDelta =
    Math.round((lastWeight - firstWeight) * 10) / 10;

  /*
   * ---------------------------------------------------------
   * STREAK
   * ---------------------------------------------------------
   */

  const currentStreak = await getCurrentStreak(db, userId);

  /*
 * ---------------------------------------------------------
 * XP & REWARDS
 * ---------------------------------------------------------
 */

  const rewardSummary = await db
    .prepare(
      `
    SELECT
      COALESCE(SUM(xp), 0) AS total_xp,
      COUNT(*) AS total_rewards
    FROM reward_events
    WHERE user_id = ?
    `,
    )
    .bind(userId)
    .first<{
      total_xp: number;
      total_rewards: number;
    }>();

  const rewardHistoryResult = await db
    .prepare(
      `
    SELECT
      event_type,
      xp,
      event_key,
      created_at
    FROM reward_events
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 10
    `,
    )
    .bind(userId)
    .all<{
      event_type: string;
      xp: number;
      event_key: string;
      created_at: string;
    }>();

  const rewards = {
    totalXp: rewardSummary?.total_xp ?? 0,
    totalRewards: rewardSummary?.total_rewards ?? 0,
    history: rewardHistoryResult.results ?? [],
  };

  return {
    period,

    stats: {
      currentStreak,
      totalWorkouts,
      avgCaloriesPerDay,
    },
    rewards,
    weight: {
      current: currentWeight,
      delta: weightDelta,
      points: weightPoints,
    },

    activity: {
      activeCount,
      total: activityBars.length,
      unitLabel:
        period === "weekly"
          ? "days"
          : period === "monthly"
            ? "days"
            : "months",
      bars: activityBars,
    },

    calories: {
      total: totalCalories,
      average: avgCaloriesPerDay,
      bars: caloriesBars,
    },
  };
}
