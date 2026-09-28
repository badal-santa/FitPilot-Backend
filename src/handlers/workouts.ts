import { getCurrentStreak } from "./progress";
import { Env } from "../index";
import { getAuthenticatedUserId } from "../services/auth";
import { awardWorkoutRewards } from "../services/rewards";

function json(
    data: unknown,
    status = 200,
): Response {
    return new Response(
        JSON.stringify(data),
        {
            status,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers":
                    "Content-Type, Authorization",
                "Access-Control-Allow-Methods":
                    "GET, POST, PUT, DELETE, OPTIONS",
            },
        },
    );
}

type ExerciseRow = {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    category: string;
    muscle_group: string;
    equipment: string | null;
    difficulty: string;
    instructions: string | null;
    image_url: string | null;
    video_url: string | null;
};

type DayTemplate = {
    dayName: string;
    title: string;
    muscleGroups: string[];
};

// ========================================
// GET /workouts
// ========================================

export async function getWorkouts(
    request: Request,
    env: Env,
): Promise<Response> {
    try {
        const userId =
            await getAuthenticatedUserId(
                request,
                env,
            );

        if (!userId) {
            return json(
                {
                    success: false,
                    message: "Unauthorized",
                },
                401,
            );
        }

        const plans =
            await env.fitpilot_db
                .prepare(
                    `
					SELECT
						id,
						name,
						description,
						goal,
						days_per_week,
						duration_weeks,
						status,
						started_at,
						ended_at,
						created_at,
						updated_at
					FROM workout_plans
					WHERE user_id = ?
					ORDER BY created_at DESC
					`,
                )
                .bind(userId)
                .all();

        return json({
            success: true,
            data: plans.results,
        });
    } catch (error) {
        console.error(
            "Get workouts error:",
            error,
        );

        return json(
            {
                success: false,
                message: "Something went wrong",
            },
            500,
        );
    }
}

export async function addExerciseToWorkoutDay(
    request: Request,
    env: Env,
    planId: string,
    dayId: string,
): Promise<Response> {
    try {
        const userId = await getAuthenticatedUserId(request, env);

        if (!userId) {
            return json(
                {
                    success: false,
                    message: "Unauthorized",
                },
                401,
            );
        }

        const body = await request.json<{
            exerciseId?: string;
            sets?: number;
            reps?: number;
            durationSeconds?: number;
            restSeconds?: number;
            targetWeightKg?: number;
            notes?: string;
        }>();

        if (!body.exerciseId) {
            return json(
                {
                    success: false,
                    message: "exerciseId is required",
                },
                400,
            );
        }

        // Verify that this workout plan belongs to the logged-in user.
        const plan = await env.fitpilot_db
            .prepare(
                `
                SELECT id
                FROM workout_plans
                WHERE id = ?
                  AND user_id = ?
                  AND status = 'active'
                LIMIT 1
                `,
            )
            .bind(planId, userId)
            .first<{ id: string }>();

        if (!plan) {
            return json(
                {
                    success: false,
                    message: "Workout plan not found",
                },
                404,
            );
        }

        // Verify that the selected day belongs to this plan.
        const day = await env.fitpilot_db
            .prepare(
                `
                SELECT id, day_number, day_name, title
                FROM workout_plan_days
                WHERE id = ?
                  AND workout_plan_id = ?
                LIMIT 1
                `,
            )
            .bind(dayId, planId)
            .first<{
                id: string;
                day_number: number;
                day_name: string;
                title: string | null;
            }>();

        if (!day) {
            return json(
                {
                    success: false,
                    message: "Workout day not found",
                },
                404,
            );
        }

        // Verify that the exercise exists.
        const exercise = await env.fitpilot_db
            .prepare(
                `
                SELECT
                    id,
                    name,
                    slug,
                    category,
                    muscle_group,
                    equipment,
                    difficulty
                FROM exercises
                WHERE id = ?
                  AND is_active = 1
                LIMIT 1
                `,
            )
            .bind(body.exerciseId)
            .first<{
                id: string;
                name: string;
                slug: string;
                category: string;
                muscle_group: string;
                equipment: string | null;
                difficulty: string;
            }>();

        if (!exercise) {
            return json(
                {
                    success: false,
                    message: "Exercise not found",
                },
                404,
            );
        }

        // Prevent adding the same exercise twice to the same day.
        const existing = await env.fitpilot_db
            .prepare(
                `
                SELECT id
                FROM workout_plan_exercises
                WHERE workout_plan_day_id = ?
                  AND exercise_id = ?
                LIMIT 1
                `,
            )
            .bind(dayId, body.exerciseId)
            .first<{ id: string }>();

        if (existing) {
            return json(
                {
                    success: false,
                    message: "Exercise already exists in this workout day",
                },
                409,
            );
        }

        // Put the new exercise at the end of the workout.
        const lastExercise = await env.fitpilot_db
            .prepare(
                `
                SELECT MAX(exercise_order) AS max_order
                FROM workout_plan_exercises
                WHERE workout_plan_day_id = ?
                `,
            )
            .bind(dayId)
            .first<{ max_order: number | null }>();

        const exerciseOrder = (lastExercise?.max_order ?? 0) + 1;

        const id = crypto.randomUUID();

        const sets = body.sets ?? 3;
        const reps = body.reps ?? 10;
        const restSeconds = body.restSeconds ?? 45;

        await env.fitpilot_db
            .prepare(
                `
                INSERT INTO workout_plan_exercises (
                    id,
                    workout_plan_day_id,
                    exercise_id,
                    exercise_order,
                    sets,
                    reps,
                    duration_seconds,
                    rest_seconds,
                    target_weight_kg,
                    notes
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
            )
            .bind(
                id,
                dayId,
                exercise.id,
                exerciseOrder,
                sets,
                reps,
                body.durationSeconds ?? null,
                restSeconds,
                body.targetWeightKg ?? null,
                body.notes ?? "Added from exercise library.",
            )
            .run();

        return json(
            {
                success: true,
                message: "Exercise added to workout",
                data: {
                    id,
                    exerciseOrder,
                    sets,
                    reps,
                    restSeconds,
                    targetWeightKg: body.targetWeightKg ?? null,
                    day: {
                        id: day.id,
                        dayNumber: day.day_number,
                        dayName: day.day_name,
                        title: day.title,
                    },
                    exercise,
                },
            },
            201,
        );
    } catch (error) {
        console.error("Add exercise to workout error:", error);

        return json(
            {
                success: false,
                message: "Unable to add exercise to workout",
            },
            500,
        );
    }
}

// ========================================
// GET /workouts/:id
// ========================================

export async function getWorkoutById(
    request: Request,
    env: Env,
    workoutId: string,
): Promise<Response> {
    try {
        const userId =
            await getAuthenticatedUserId(
                request,
                env,
            );

        if (!userId) {
            return json(
                {
                    success: false,
                    message: "Unauthorized",
                },
                401,
            );
        }

        const plan =
            await env.fitpilot_db
                .prepare(
                    `
					SELECT
						id,
						name,
						description,
						goal,
						days_per_week,
						duration_weeks,
						status,
						started_at,
						ended_at,
						created_at,
						updated_at
					FROM workout_plans
					WHERE id = ?
					AND user_id = ?
					LIMIT 1
					`,
                )
                .bind(
                    workoutId,
                    userId,
                )
                .first();

        if (!plan) {
            return json(
                {
                    success: false,
                    message:
                        "Workout plan not found",
                },
                404,
            );
        }

        const days =
            await env.fitpilot_db
                .prepare(
                    `
					SELECT
						id,
						day_number,
						day_name,
						title,
						description,
						rest_day,
						created_at
					FROM workout_plan_days
					WHERE workout_plan_id = ?
					ORDER BY day_number ASC
					`,
                )
                .bind(workoutId)
                .all();

        const daysWithExercises =
            await Promise.all(
                days.results.map(
                    async (day: any) => {
                        const exercises =
                            await env.fitpilot_db
                                .prepare(
                                    `
									SELECT
										wpe.id,
										wpe.exercise_order,
										wpe.sets,
										wpe.reps,
										wpe.duration_seconds,
										wpe.rest_seconds,
										wpe.target_weight_kg,
										wpe.notes,

										e.id AS exercise_id,
										e.name,
										e.slug,
										e.description,
										e.category,
										e.muscle_group,
										equipment,
										e.difficulty,
										e.instructions,
										e.image_url,
										e.video_url

									FROM workout_plan_exercises wpe

									INNER JOIN exercises e
										ON e.id = wpe.exercise_id

									WHERE wpe.workout_plan_day_id = ?

									ORDER BY wpe.exercise_order ASC
									`,
                                )
                                .bind(day.id)
                                .all();

                        return {
                            ...day,
                            rest_day:
                                Boolean(
                                    day.rest_day,
                                ),
                            exercises:
                                exercises.results,
                        };
                    },
                ),
            );

        return json({
            success: true,
            data: {
                ...plan,
                days:
                    daysWithExercises,
            },
        });
    } catch (error) {
        console.error(
            "Get workout error:",
            error,
        );

        return json(
            {
                success: false,
                message: "Something went wrong",
            },
            500,
        );
    }
}

export async function getTodayWorkout(
    request: Request,
    env: Env,
): Promise<Response> {
    const userId = await getAuthenticatedUserId(request, env);

    if (!userId) {
        return json(
            {
                success: false,
                message: "Unauthorized",
            },
            401,
        );
    }

    const plan = await env.fitpilot_db
        .prepare(
            `
      SELECT
        id,
        name,
        description,
        goal,
        days_per_week,
        duration_weeks,
        status,
        started_at
      FROM workout_plans
      WHERE user_id = ?
        AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1
      `,
        )
        .bind(userId)
        .first<{
            id: string;
            name: string;
            description: string | null;
            goal: string;
            days_per_week: number;
            duration_weeks: number | null;
            status: string;
            started_at: string | null;
        }>();

    if (!plan) {
        return json(
            {
                success: false,
                message: "No active workout plan found",
            },
            404,
        );
    }

    const weekday = new Date().getDay(); // Sunday = 0, Monday = 1–Saturday = 6
    const dayNumber =
        weekday >= 1 && weekday <= plan.days_per_week
            ? weekday
            : null;

    if (dayNumber === null) {
        return json({
            success: true,
            data: {
                plan,
                isRestDay: true,
                day: null,
                exercises: [],
            },
        });
    }

    const day = await env.fitpilot_db
        .prepare(
            `
      SELECT
        id,
        day_number,
        day_name,
        title,
        description,
        rest_day,
        created_at
      FROM workout_plan_days
      WHERE workout_plan_id = ?
        AND day_number = ?
      LIMIT 1
      `,
        )
        .bind(plan.id, dayNumber)
        .first<{
            id: string;
            day_number: number;
            day_name: string;
            title: string | null;
            description: string | null;
            rest_day: number;
            created_at: string;
        }>();

    if (!day) {
        return json(
            {
                success: false,
                message: "Today's workout was not found",
            },
            404,
        );
    }

    const todaySession = await env.fitpilot_db
        .prepare(
            `
      SELECT
        ws.id,
        ws.started_at,
        ws.completed_at,
        ws.status,
        ws.duration_seconds,
        ws.calories_burned,
        ws.notes
      FROM workout_sessions ws
      JOIN workout_plan_days wpd ON wpd.id = ws.workout_plan_day_id
      WHERE ws.user_id = ?
        -- Only a session started today counts — otherwise next week's
        -- same weekday would show last week's workout as already done.
        -- UTC day, matching the UTC weekday used to pick the plan day above.
        AND date(ws.started_at) = date('now')
        -- Today's day in the active plan, or the same day number in a plan
        -- that was regenerated after the session started (its day id
        -- changed, but it's the same workout for today).
        AND (ws.workout_plan_day_id = ? OR wpd.day_number = ?)
      -- Prefer an exact day match, then the most recent.
      ORDER BY (ws.workout_plan_day_id = ?) DESC, ws.started_at DESC
      LIMIT 1
      `,
        )
        .bind(userId, day.id, day.day_number, day.id)
        .first<{
            id: string;
            started_at: string;
            completed_at: string | null;
            status: string;
            duration_seconds: number | null;
            calories_burned: number | null;
            notes: string | null;
        }>();

    const exercises = await env.fitpilot_db
        .prepare(
            `
      SELECT
        wpe.id,
        wpe.exercise_order,
        wpe.sets,
        wpe.reps,
        wpe.duration_seconds,
        wpe.rest_seconds,
        wpe.target_weight_kg,
        wpe.notes,

        e.id AS exercise_id,
        e.name,
        e.slug,
        e.description,
        e.category,
        e.muscle_group,
        e.equipment,
        e.difficulty,
        e.instructions,
        e.image_url,
        e.video_url

      FROM workout_plan_exercises wpe

      INNER JOIN exercises e
        ON e.id = wpe.exercise_id

      WHERE wpe.workout_plan_day_id = ?

      ORDER BY wpe.exercise_order ASC
      `,
        )
        .bind(day.id)
        .all();

    return json({
        success: true,
        data: {
            plan,

            isRestDay: Boolean(day.rest_day),

            day: {
                id: day.id,
                dayNumber: day.day_number,
                dayName: day.day_name,
                title: day.title,
                description: day.description,
            },

            session: todaySession
                ? {
                    id: todaySession.id,
                    startedAt: todaySession.started_at,
                    completedAt: todaySession.completed_at,
                    status: todaySession.status,
                    durationSeconds: todaySession.duration_seconds,
                    caloriesBurned: todaySession.calories_burned,
                    notes: todaySession.notes,
                }
                : null,

            workoutStatus: todaySession?.status ?? "not_started",

            exercises: exercises.results,
        },
    });
}

// Start Workout
export async function startWorkoutSession(
    request: Request,
    env: Env,
): Promise<Response> {
    const userId = await getAuthenticatedUserId(request, env);

    if (!userId) {
        return json(
            {
                success: false,
                message: "Unauthorized",
            },
            401,
        );
    }

    let body: {
        workoutPlanDayId?: string;
    };

    try {
        body = await request.json();
    } catch {
        return json(
            {
                success: false,
                message: "Invalid JSON body",
            },
            400,
        );
    }

    if (!body.workoutPlanDayId) {
        return json(
            {
                success: false,
                message: "workoutPlanDayId is required",
            },
            400,
        );
    }

    const day = await env.fitpilot_db
        .prepare(
            `
      SELECT
        wpd.id,
        wpd.workout_plan_id,
        wpd.day_number,
        wpd.title,
        wpd.rest_day
      FROM workout_plan_days wpd

      INNER JOIN workout_plans wp
        ON wp.id = wpd.workout_plan_id

      WHERE wpd.id = ?
        AND wp.user_id = ?
        AND wp.status = 'active'

      LIMIT 1
      `,
        )
        .bind(body.workoutPlanDayId, userId)
        .first<{
            id: string;
            workout_plan_id: string;
            day_number: number;
            title: string | null;
            rest_day: number;
        }>();

    if (!day) {
        return json(
            {
                success: false,
                message: "Workout day not found",
            },
            404,
        );
    }

    if (day.rest_day) {
        return json(
            {
                success: false,
                message: "Cannot start a rest day",
            },
            400,
        );
    }

    // Prevent multiple active sessions.
    const existingSession = await env.fitpilot_db
        .prepare(
            `
      SELECT
        id,
        workout_plan_day_id,
        started_at,
        status
      FROM workout_sessions
      WHERE user_id = ?
        AND status = 'started'
        -- Only resume a session for this same day — resuming whatever was
        -- left open made "Start Day 3" silently continue an old Day 1
        -- session (or one from a plan that has since been regenerated).
        AND workout_plan_day_id = ?
      ORDER BY started_at DESC
      LIMIT 1
      `,
        )
        .bind(userId, body.workoutPlanDayId)
        .first<{
            id: string;
            workout_plan_day_id: string | null;
            started_at: string;
            status: string;
        }>();

    if (existingSession) {
        return json({
            success: true,
            data: {
                id: existingSession.id,
                workoutPlanDayId: existingSession.workout_plan_day_id,
                startedAt: existingSession.started_at,
                status: existingSession.status,
                resumed: true,
            },
        });
    }

    const sessionId = crypto.randomUUID();
    const startedAt = new Date().toISOString();

    await env.fitpilot_db
        .prepare(
            `
      INSERT INTO workout_sessions (
        id,
        user_id,
        workout_plan_day_id,
        started_at,
        status
      )
      VALUES (?, ?, ?, ?, 'started')
      `,
        )
        .bind(
            sessionId,
            userId,
            body.workoutPlanDayId,
            startedAt,
        )
        .run();

    return json(
        {
            success: true,
            data: {
                id: sessionId,
                workoutPlanDayId: body.workoutPlanDayId,
                dayNumber: day.day_number,
                title: day.title,
                startedAt,
                status: "started",
                resumed: false,
            },
        },
        201,
    );
}

// Session Excerise
export async function addSessionExercise(
    request: Request,
    env: Env,
    sessionId: string,
): Promise<Response> {
    const userId = await getAuthenticatedUserId(request, env);

    if (!userId) {
        return json(
            {
                success: false,
                message: "Unauthorized",
            },
            401,
        );
    }

    let body: {
        exerciseId?: string;
        exerciseOrder?: number;
    };

    try {
        body = await request.json();
    } catch {
        return json(
            {
                success: false,
                message: "Invalid JSON body",
            },
            400,
        );
    }

    if (!body.exerciseId) {
        return json(
            {
                success: false,
                message: "exerciseId is required",
            },
            400,
        );
    }

    if (
        body.exerciseOrder === undefined ||
        !Number.isInteger(body.exerciseOrder) ||
        body.exerciseOrder < 1
    ) {
        return json(
            {
                success: false,
                message: "exerciseOrder must be a positive integer",
            },
            400,
        );
    }

    // Make sure the session belongs to the authenticated user.
    const session = await env.fitpilot_db
        .prepare(
            `
      SELECT
        ws.id,
        ws.user_id,
        ws.workout_plan_day_id,
        ws.status
      FROM workout_sessions ws
      WHERE ws.id = ?
        AND ws.user_id = ?
      LIMIT 1
      `,
        )
        .bind(sessionId, userId)
        .first<{
            id: string;
            user_id: string;
            workout_plan_day_id: string | null;
            status: string;
        }>();

    if (!session) {
        return json(
            {
                success: false,
                message: "Workout session not found",
            },
            404,
        );
    }

    if (session.status !== "started") {
        return json(
            {
                success: false,
                message: "Workout session is not active",
            },
            400,
        );
    }

    // Make sure the exercise exists.
    const exercise = await env.fitpilot_db
        .prepare(
            `
      SELECT
        id,
        name,
        slug,
        muscle_group,
        equipment,
        difficulty
      FROM exercises
      WHERE id = ?
        AND is_active = 1
      LIMIT 1
      `,
        )
        .bind(body.exerciseId)
        .first<{
            id: string;
            name: string;
            slug: string;
            muscle_group: string;
            equipment: string | null;
            difficulty: string;
        }>();

    if (!exercise) {
        return json(
            {
                success: false,
                message: "Exercise not found",
            },
            404,
        );
    }

    // Prevent adding the same exercise twice to the same session.
    const existing = await env.fitpilot_db
        .prepare(
            `
      SELECT id
      FROM workout_session_exercises
      WHERE workout_session_id = ?
        AND exercise_id = ?
      LIMIT 1
      `,
        )
        .bind(sessionId, body.exerciseId)
        .first<{ id: string }>();

    if (existing) {
        return json(
            {
                success: false,
                message: "Exercise already exists in this session",
                data: {
                    id: existing.id,
                },
            },
            409,
        );
    }

    const sessionExerciseId = crypto.randomUUID();

    await env.fitpilot_db
        .prepare(
            `
      INSERT INTO workout_session_exercises (
        id,
        workout_session_id,
        exercise_id,
        exercise_order
      )
      VALUES (?, ?, ?, ?)
      `,
        )
        .bind(
            sessionExerciseId,
            sessionId,
            body.exerciseId,
            body.exerciseOrder,
        )
        .run();

    return json(
        {
            success: true,
            data: {
                id: sessionExerciseId,
                workoutSessionId: sessionId,
                exerciseId: exercise.id,
                exerciseOrder: body.exerciseOrder,
                exercise: {
                    id: exercise.id,
                    name: exercise.name,
                    slug: exercise.slug,
                    muscleGroup: exercise.muscle_group,
                    equipment: exercise.equipment,
                    difficulty: exercise.difficulty,
                },
            },
        },
        201,
    );
}

// Record Workout Set
export async function recordWorkoutSet(
    request: Request,
    env: Env,
    sessionId: string,
): Promise<Response> {
    const userId = await getAuthenticatedUserId(request, env);

    if (!userId) {
        return json(
            {
                success: false,
                message: "Unauthorized",
            },
            401,
        );
    }

    let body: {
        sessionExerciseId?: string;
        setNumber?: number;
        reps?: number | null;
        weightKg?: number | null;
        durationSeconds?: number | null;
        distanceMeters?: number | null;
        completed?: boolean;
    };

    try {
        body = await request.json();
    } catch {
        return json(
            {
                success: false,
                message: "Invalid JSON body",
            },
            400,
        );
    }

    if (!body.sessionExerciseId) {
        return json(
            {
                success: false,
                message: "sessionExerciseId is required",
            },
            400,
        );
    }

    if (
        body.setNumber === undefined ||
        !Number.isInteger(body.setNumber) ||
        body.setNumber < 1
    ) {
        return json(
            {
                success: false,
                message: "setNumber must be a positive integer",
            },
            400,
        );
    }

    // Verify session belongs to user and is active.
    const session = await env.fitpilot_db
        .prepare(
            `
      SELECT id, status
      FROM workout_sessions
      WHERE id = ?
        AND user_id = ?
      LIMIT 1
      `,
        )
        .bind(sessionId, userId)
        .first<{
            id: string;
            status: string;
        }>();

    if (!session) {
        return json(
            {
                success: false,
                message: "Workout session not found",
            },
            404,
        );
    }

    if (session.status !== "started") {
        return json(
            {
                success: false,
                message: "Workout session is not active",
            },
            400,
        );
    }

    // Verify the session exercise belongs to this session.
    const sessionExercise = await env.fitpilot_db
        .prepare(
            `
      SELECT
        wse.id,
        wse.exercise_id,
        e.name
      FROM workout_session_exercises wse
      INNER JOIN exercises e
        ON e.id = wse.exercise_id
      WHERE wse.id = ?
        AND wse.workout_session_id = ?
      LIMIT 1
      `,
        )
        .bind(body.sessionExerciseId, sessionId)
        .first<{
            id: string;
            exercise_id: string;
            name: string;
        }>();

    if (!sessionExercise) {
        return json(
            {
                success: false,
                message: "Session exercise not found",
            },
            404,
        );
    }

    // Prevent duplicate set numbers.
    const existingSet = await env.fitpilot_db
        .prepare(
            `
      SELECT id
      FROM workout_sets
      WHERE workout_session_exercise_id = ?
        AND set_number = ?
      LIMIT 1
      `,
        )
        .bind(body.sessionExerciseId, body.setNumber)
        .first<{ id: string }>();

    if (existingSet) {
        return json(
            {
                success: false,
                message: "This set number already exists",
            },
            409,
        );
    }

    const setId = crypto.randomUUID();

    const completed = body.completed === false ? 0 : 1;

    await env.fitpilot_db
        .prepare(
            `
      INSERT INTO workout_sets (
        id,
        workout_session_exercise_id,
        set_number,
        reps,
        weight_kg,
        duration_seconds,
        distance_meters,
        completed
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
        )
        .bind(
            setId,
            body.sessionExerciseId,
            body.setNumber,
            body.reps ?? null,
            body.weightKg ?? null,
            body.durationSeconds ?? null,
            body.distanceMeters ?? null,
            completed,
        )
        .run();

    return json(
        {
            success: true,
            data: {
                id: setId,
                workoutSessionId: sessionId,
                sessionExerciseId: body.sessionExerciseId,
                exercise: {
                    id: sessionExercise.exercise_id,
                    name: sessionExercise.name,
                },
                setNumber: body.setNumber,
                reps: body.reps ?? null,
                weightKg: body.weightKg ?? null,
                durationSeconds: body.durationSeconds ?? null,
                distanceMeters: body.distanceMeters ?? null,
                completed: Boolean(completed),
            },
        },
        201,
    );
}

// Get Workout Session
export async function getWorkoutSession(
    request: Request,
    env: Env,
    sessionId: string,
): Promise<Response> {
    const userId = await getAuthenticatedUserId(request, env);

    if (!userId) {
        return json(
            {
                success: false,
                message: "Unauthorized",
            },
            401,
        );
    }

    const session = await env.fitpilot_db
        .prepare(
            `
      SELECT
        ws.id,
        ws.user_id,
        ws.workout_plan_day_id,
        ws.started_at,
        ws.completed_at,
        ws.status,
        ws.duration_seconds,
        ws.calories_burned,
        ws.notes,

        wpd.day_number,
        wpd.day_name,
        wpd.title,
        wpd.description

      FROM workout_sessions ws

      LEFT JOIN workout_plan_days wpd
        ON wpd.id = ws.workout_plan_day_id

      WHERE ws.id = ?
        AND ws.user_id = ?

      LIMIT 1
      `,
        )
        .bind(sessionId, userId)
        .first<{
            id: string;
            user_id: string;
            workout_plan_day_id: string | null;
            started_at: string;
            completed_at: string | null;
            status: string;
            duration_seconds: number | null;
            calories_burned: number | null;
            notes: string | null;
            day_number: number | null;
            day_name: string | null;
            title: string | null;
            description: string | null;
        }>();

    if (!session) {
        return json(
            {
                success: false,
                message: "Workout session not found",
            },
            404,
        );
    }

    const exercises = await env.fitpilot_db
        .prepare(
            `
      SELECT
        wse.id,
        wse.exercise_id,
        wse.exercise_order,

        e.name,
        e.slug,
        e.description,
        e.category,
        e.muscle_group,
        e.equipment,
        e.difficulty,
        e.instructions,
        e.image_url,
        e.video_url

      FROM workout_session_exercises wse

      INNER JOIN exercises e
        ON e.id = wse.exercise_id

      WHERE wse.workout_session_id = ?

      ORDER BY wse.exercise_order ASC
      `,
        )
        .bind(sessionId)
        .all();

    const sets = await env.fitpilot_db
        .prepare(
            `
      SELECT
        ws.id,
        ws.workout_session_exercise_id,
        ws.set_number,
        ws.reps,
        ws.weight_kg,
        ws.duration_seconds,
        ws.distance_meters,
        ws.completed,
        ws.created_at

      FROM workout_sets ws

      INNER JOIN workout_session_exercises wse
        ON wse.id = ws.workout_session_exercise_id

      WHERE wse.workout_session_id = ?

      ORDER BY
        wse.exercise_order ASC,
        ws.set_number ASC
      `,
        )
        .bind(sessionId)
        .all();

    const setRows = sets.results as Array<{
        id: string;
        workout_session_exercise_id: string;
        set_number: number;
        reps: number | null;
        weight_kg: number | null;
        duration_seconds: number | null;
        distance_meters: number | null;
        completed: number;
        created_at: string;
    }>;

    const exercisesWithSets = (
        exercises.results as Array<{
            id: string;
            exercise_id: string;
            exercise_order: number;
            name: string;
            slug: string;
            description: string | null;
            category: string;
            muscle_group: string;
            equipment: string | null;
            difficulty: string;
            instructions: string | null;
            image_url: string | null;
            video_url: string | null;
        }>
    ).map((exercise) => ({
        ...exercise,
        sets: setRows
            .filter(
                (set) =>
                    set.workout_session_exercise_id === exercise.id,
            )
            .map((set) => ({
                id: set.id,
                setNumber: set.set_number,
                reps: set.reps,
                weightKg: set.weight_kg,
                durationSeconds: set.duration_seconds,
                distanceMeters: set.distance_meters,
                completed: Boolean(set.completed),
                createdAt: set.created_at,
            })),
    }));

    return json({
        success: true,
        data: {
            id: session.id,
            workoutPlanDayId: session.workout_plan_day_id,
            startedAt: session.started_at,
            completedAt: session.completed_at,
            status: session.status,
            durationSeconds: session.duration_seconds,
            caloriesBurned: session.calories_burned,
            notes: session.notes,

            day: {
                dayNumber: session.day_number,
                dayName: session.day_name,
                title: session.title,
                description: session.description,
            },

            exercises: exercisesWithSets,
        },
    });
}

// Complete Workout Session
export async function completeWorkoutSession(
    request: Request,
    env: Env,
    sessionId: string,
): Promise<Response> {
    const userId = await getAuthenticatedUserId(request, env);

    if (!userId) {
        return json(
            {
                success: false,
                message: "Unauthorized",
            },
            401,
        );
    }

    let body: {
        caloriesBurned?: number | null;
        notes?: string | null;
    } = {};

    try {
        if (request.method === "POST") {
            body = await request.json();
        }
    } catch {
        return json(
            {
                success: false,
                message: "Invalid JSON body",
            },
            400,
        );
    }

    const session = await env.fitpilot_db
        .prepare(
            `
      SELECT
        id,
        workout_plan_day_id,
        started_at,
        status
      FROM workout_sessions
      WHERE id = ?
        AND user_id = ?
      LIMIT 1
      `,
        )
        .bind(sessionId, userId)
        .first<{
            id: string;
            workout_plan_day_id: string | null;
            started_at: string;
            status: string;
        }>();

    if (!session) {
        return json(
            {
                success: false,
                message: "Workout session not found",
            },
            404,
        );
    }

    if (session.status === "completed") {
        return json(
            {
                success: false,
                message: "Workout session is already completed",
            },
            400,
        );
    }

    if (session.status !== "started") {
        return json(
            {
                success: false,
                message: "Workout session cannot be completed",
            },
            400,
        );
    }

    const completedAt = new Date();

    const startedAt = new Date(session.started_at);

    const durationSeconds = Math.max(
        0,
        Math.floor(
            (completedAt.getTime() - startedAt.getTime()) / 1000,
        ),
    );

    const caloriesBurned =
        body.caloriesBurned !== undefined &&
            body.caloriesBurned !== null
            ? Number(body.caloriesBurned)
            : null;

    if (
        caloriesBurned !== null &&
        (!Number.isFinite(caloriesBurned) || caloriesBurned < 0)
    ) {
        return json(
            {
                success: false,
                message: "caloriesBurned must be a valid positive number",
            },
            400,
        );
    }

    const notes =
        typeof body.notes === "string"
            ? body.notes.trim() || null
            : null;

    await env.fitpilot_db
        .prepare(
            `
      UPDATE workout_sessions
      SET
        completed_at = ?,
        status = 'completed',
        duration_seconds = ?,
        calories_burned = ?,
        notes = ?
      WHERE id = ?
        AND user_id = ?
      `,
        )
        .bind(
            completedAt.toISOString(),
            durationSeconds,
            caloriesBurned,
            notes,
            sessionId,
            userId,
        )
        .run();

    const currentStreak = await getCurrentStreak(
        env.fitpilot_db,
        userId,
    );

    const rewardResult = await awardWorkoutRewards(
        env.fitpilot_db,
        userId,
        sessionId,
        currentStreak,
    );

    return json({
        success: true,
        data: {
            id: session.id,
            workoutPlanDayId: session.workout_plan_day_id,
            startedAt: session.started_at,
            completedAt: completedAt.toISOString(),
            status: "completed",
            durationSeconds,
            caloriesBurned,
            notes,
            currentStreak,
            rewards: rewardResult.rewards,
            totalXpEarned: rewardResult.totalXpEarned,
        },
    });
}

// ========================================
// Exercise selection helper
// ========================================

async function getExercisesForMuscleGroups(
    env: Env,
    muscleGroups: string[],
    limitPerGroup = 2,
): Promise<ExerciseRow[]> {
    const exercises: ExerciseRow[] = [];

    for (const muscleGroup of muscleGroups) {
        const result = await env.fitpilot_db
            .prepare(
                `
                SELECT
                    id,
                    name,
                    slug,
                    description,
                    category,
                    muscle_group,
                    equipment,
                    difficulty,
                    instructions,
                    image_url,
                    video_url
                FROM exercises
                WHERE is_active = 1
                  AND muscle_group = ?
                ORDER BY
                    CASE difficulty
                        WHEN 'beginner' THEN 1
                        WHEN 'intermediate' THEN 2
                        WHEN 'advanced' THEN 3
                        ELSE 4
                    END,
                    name ASC
                LIMIT ?
                `,
            )
            .bind(muscleGroup, limitPerGroup)
            .all<ExerciseRow>();

        exercises.push(...result.results);
    }

    return exercises;
}

// ========================================
// POST /workouts/generate
// ========================================

export async function generateWorkout(
    request: Request,
    env: Env,
): Promise<Response> {
    try {
        const userId =
            await getAuthenticatedUserId(
                request,
                env,
            );

        if (!userId) {
            return json(
                {
                    success: false,
                    message: "Unauthorized",
                },
                401,
            );
        }

        // --------------------------------
        // 1. Get user profile
        // --------------------------------

        const user =
            await env.fitpilot_db
                .prepare(
                    `
					SELECT
						id,
						name,
						goal,
						activity_level,
						workout_days,
						age,
						height_cm,
						weight_kg,
						gender,
						onboarding_completed
					FROM users
					WHERE id = ?
					LIMIT 1
					`,
                )
                .bind(userId)
                .first<{
                    id: string;
                    name: string | null;
                    goal: string | null;
                    activity_level: string | null;
                    workout_days: number | null;
                    age: number | null;
                    height_cm: number | null;
                    weight_kg: number | null;
                    gender: string | null;
                    onboarding_completed: number;
                }>();

        if (!user) {
            return json(
                {
                    success: false,
                    message: "User not found",
                },
                404,
            );
        }

        if (!user.onboarding_completed) {
            return json(
                {
                    success: false,
                    message:
                        "Please complete onboarding first",
                },
                400,
            );
        }

        if (!user.goal) {
            return json(
                {
                    success: false,
                    message:
                        "Workout goal is missing",
                },
                400,
            );
        }

        const daysPerWeek =
            user.workout_days ?? 5;

        // --------------------------------
        // 2. Check existing active plan
        // --------------------------------

        const existingPlan =
            await env.fitpilot_db
                .prepare(
                    `
					SELECT id
					FROM workout_plans
					WHERE user_id = ?
					AND status = 'active'
					ORDER BY created_at DESC
					LIMIT 1
					`,
                )
                .bind(userId)
                .first<{ id: string }>();

        if (existingPlan) {
            return getWorkoutById(
                request,
                env,
                existingPlan.id,
            );
        }

        // --------------------------------
        // 3. Create workout structure
        // --------------------------------

        const templates =
            getDayTemplates(
                user.goal,
                daysPerWeek,
            );

        const planId =
            crypto.randomUUID();

        const goalLabel =
            getGoalLabel(user.goal);

        const planName =
            `${goalLabel} — ${daysPerWeek} Day Plan`;

        const planDescription =
            `Personalized ${goalLabel.toLowerCase()} workout plan based on your profile and ${daysPerWeek} training days per week.`;

        const now =
            new Date().toISOString();

        // --------------------------------
        // 4. Create workout plan
        // --------------------------------

        await env.fitpilot_db
            .prepare(
                `
				INSERT INTO workout_plans (
					id,
					user_id,
					name,
					description,
					goal,
					days_per_week,
					duration_weeks,
					status,
					started_at
				)
				VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
				`,
            )
            .bind(
                planId,
                userId,
                planName,
                planDescription,
                user.goal,
                daysPerWeek,
                4,
                now,
            )
            .run();

        // --------------------------------
        // 5. Create days + exercises
        // --------------------------------

        for (
            let index = 0;
            index < templates.length;
            index++
        ) {
            const template =
                templates[index];

            const dayId =
                crypto.randomUUID();

            await env.fitpilot_db
                .prepare(
                    `
					INSERT INTO workout_plan_days (
						id,
						workout_plan_id,
						day_number,
						day_name,
						title,
						description,
						rest_day
					)
					VALUES (?, ?, ?, ?, ?, ?, ?)
					`,
                )
                .bind(
                    dayId,
                    planId,
                    index + 1,
                    template.dayName,
                    template.title,
                    `${template.title} workout`,
                    0,
                )
                .run();

            // Get up to 2 exercises from EACH target muscle group.
            // This prevents one muscle group from consuming the entire
            // exercise limit for the day.
            const exercises =
                await getExercisesForMuscleGroups(
                    env,
                    template.muscleGroups,
                    2,
                );

            for (
                let exerciseIndex = 0;
                exerciseIndex <
                exercises.length;
                exerciseIndex++
            ) {
                const exercise =
                    exercises[exerciseIndex];

                const prescription =
                    getPrescription(
                        exercise,
                        user.goal,
                    );

                await env.fitpilot_db
                    .prepare(
                        `
						INSERT INTO workout_plan_exercises (
							id,
							workout_plan_day_id,
							exercise_id,
							exercise_order,
							sets,
							reps,
							duration_seconds,
							rest_seconds,
							target_weight_kg,
							notes
						)
						VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
						`,
                    )
                    .bind(
                        crypto.randomUUID(),
                        dayId,
                        exercise.id,
                        exerciseIndex + 1,
                        prescription.sets,
                        prescription.reps,
                        prescription.durationSeconds,
                        prescription.restSeconds,
                        null,
                        prescription.notes,
                    )
                    .run();
            }
        }

        // --------------------------------
        // 6. Return generated plan
        // --------------------------------

        return getWorkoutById(
            request,
            env,
            planId,
        );
    } catch (error) {
        console.error(
            "Generate workout error:",
            error,
        );

        return json(
            {
                success: false,
                message:
                    "Unable to generate workout plan",
            },
            500,
        );
    }
}

// ========================================
// POST /workouts/regenerate
// ========================================

export async function regenerateWorkout(
    request: Request,
    env: Env,
): Promise<Response> {
    try {
        const userId =
            await getAuthenticatedUserId(
                request,
                env,
            );

        if (!userId) {
            return json(
                {
                    success: false,
                    message: "Unauthorized",
                },
                401,
            );
        }

        // Find the current active workout plan.
        const activePlan =
            await env.fitpilot_db
                .prepare(
                    `
                    SELECT
                        id
                    FROM workout_plans
                    WHERE user_id = ?
                      AND status = 'active'
                    ORDER BY created_at DESC
                    LIMIT 1
                    `,
                )
                .bind(userId)
                .first<{
                    id: string;
                }>();

        // If an active plan exists, deactivate it.
        if (activePlan) {
            const endedAt =
                new Date().toISOString();

            await env.fitpilot_db
                .prepare(
                    `
                    UPDATE workout_plans
                    SET
                        status = 'completed',
                        ended_at = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                      AND user_id = ?
                      AND status = 'active'
                    `,
                )
                .bind(
                    endedAt,
                    activePlan.id,
                    userId,
                )
                .run();
        }

        // generateWorkout() will now create
        // a completely new plan because there
        // is no active plan anymore.
        return generateWorkout(
            request,
            env,
        );
    } catch (error) {
        console.error(
            "Regenerate workout error:",
            error,
        );

        return json(
            {
                success: false,
                message:
                    "Unable to regenerate workout plan",
            },
            500,
        );
    }
}

// Workout Stats
export async function getWorkoutStats(
    request: Request,
    env: Env,
): Promise<Response> {
    const userId = await getAuthenticatedUserId(request, env);

    if (!userId) {
        return json(
            {
                success: false,
                message: "Unauthorized",
            },
            401,
        );
    }

    // Total completed workouts
    const completedResult = await env.fitpilot_db
        .prepare(
            `
            SELECT COUNT(*) AS count
            FROM workout_sessions
            WHERE user_id = ?
              AND status = 'completed'
            `,
        )
        .bind(userId)
        .first<{ count: number }>();

    // Calories burned today
    const caloriesResult = await env.fitpilot_db
        .prepare(
            `
            SELECT COALESCE(SUM(calories_burned), 0) AS calories
            FROM workout_sessions
            WHERE user_id = ?
              AND status = 'completed'
              AND DATE(completed_at) = DATE('now')
            `,
        )
        .bind(userId)
        .first<{ calories: number }>();

    // Completed workouts this week
    const weeklyResult = await env.fitpilot_db
        .prepare(
            `
            SELECT COUNT(*) AS count
            FROM workout_sessions
            WHERE user_id = ?
              AND status = 'completed'
              AND DATE(completed_at) >= DATE('now', 'weekday 1', '-7 days')
              AND DATE(completed_at) < DATE('now', 'weekday 1', '+7 days')
            `,
        )
        .bind(userId)
        .first<{ count: number }>();

    return json({
        success: true,
        data: {
            workoutsCompleted: Number(completedResult?.count ?? 0),
            caloriesToday: Number(caloriesResult?.calories ?? 0),
            weeklyWorkouts: Number(weeklyResult?.count ?? 0),
            currentStreak: await getCurrentStreak(env.fitpilot_db, userId),
        },
    });
}

// Weekly Progress
export async function getWeeklyProgress(
    request: Request,
    env: Env,
): Promise<Response> {
    const userId = await getAuthenticatedUserId(request, env);

    if (!userId) {
        return json(
            {
                success: false,
                message: "Unauthorized",
            },
            401,
        );
    }

    // Get completed workouts for the current week
    const result = await env.fitpilot_db
        .prepare(
            `
            SELECT
                DATE(completed_at) AS workout_date,
                COUNT(*) AS workout_count
            FROM workout_sessions
            WHERE user_id = ?
              AND status = 'completed'
              AND completed_at IS NOT NULL
              AND DATE(completed_at) >= DATE('now', 'weekday 1', '-7 days')
              AND DATE(completed_at) < DATE('now', 'weekday 1', '+7 days')
            GROUP BY DATE(completed_at)
            ORDER BY workout_date ASC
            `,
        )
        .bind(userId)
        .all<{
            workout_date: string;
            workout_count: number;
        }>();

    // Map database results by date
    const completedByDate = new Map(
        result.results.map((row) => [
            row.workout_date,
            Number(row.workout_count),
        ]),
    );

    // Find Monday of the current week
    const today = new Date();
    const dayOfWeek = today.getDay();

    const diffToMonday =
        dayOfWeek === 0
            ? -6
            : 1 - dayOfWeek;

    const monday = new Date(today);
    monday.setDate(
        today.getDate() + diffToMonday,
    );

    // Build Monday → Sunday
    const days = Array.from(
        { length: 7 },
        (_, index) => {
            const date = new Date(monday);

            date.setDate(
                monday.getDate() + index,
            );

            const dateString =
                date.toISOString().slice(0, 10);

            const workoutCount =
                completedByDate.get(dateString) ?? 0;

            return {
                day: date
                    .toLocaleDateString(
                        "en-US",
                        {
                            weekday: "short",
                        },
                    )
                    .slice(0, 1),

                date: dateString,

                completed:
                    workoutCount > 0,

                value: workoutCount > 0 ? 1 : 0,
            };
        },
    );

    const daysTrained = days.filter(
        (day) => day.completed,
    ).length;

    return json({
        success: true,
        data: {
            days,
            daysTrained,
            totalDays: 7,
        },
    });
}

// ========================================
// Workout templates
// ========================================

function getDayTemplates(
    goal: string,
    daysPerWeek: number,
): DayTemplate[] {
    if (goal === "build-muscle") {
        if (daysPerWeek === 2) {
            return [
                {
                    dayName: "Day 1",
                    title: "Full Body A",
                    muscleGroups: [
                        "chest",
                        "legs",
                        "shoulders",
                    ],
                },
                {
                    dayName: "Day 2",
                    title: "Full Body B",
                    muscleGroups: [
                        "back",
                        "biceps",
                        "triceps",
                    ],
                },
            ];
        }

        if (daysPerWeek === 3) {
            return [
                {
                    dayName: "Day 1",
                    title: "Chest & Triceps",
                    muscleGroups: [
                        "chest",
                        "triceps",
                    ],
                },
                {
                    dayName: "Day 2",
                    title: "Back & Biceps",
                    muscleGroups: [
                        "back",
                        "biceps",
                    ],
                },
                {
                    dayName: "Day 3",
                    title: "Legs & Shoulders",
                    muscleGroups: [
                        "legs",
                        "shoulders",
                    ],
                },
            ];
        }

        if (daysPerWeek === 4) {
            return [
                {
                    dayName: "Day 1",
                    title: "Chest & Triceps",
                    muscleGroups: [
                        "chest",
                        "triceps",
                    ],
                },
                {
                    dayName: "Day 2",
                    title: "Back & Biceps",
                    muscleGroups: [
                        "back",
                        "biceps",
                    ],
                },
                {
                    dayName: "Day 3",
                    title: "Legs",
                    muscleGroups: [
                        "legs",
                        "hamstrings",
                    ],
                },
                {
                    dayName: "Day 4",
                    title: "Shoulders & Core",
                    muscleGroups: [
                        "shoulders",
                        "core",
                    ],
                },
            ];
        }

        if (daysPerWeek === 5) {
            return [
                {
                    dayName: "Day 1",
                    title: "Chest & Triceps",
                    muscleGroups: [
                        "chest",
                        "triceps",
                    ],
                },
                {
                    dayName: "Day 2",
                    title: "Back & Biceps",
                    muscleGroups: [
                        "back",
                        "biceps",
                    ],
                },
                {
                    dayName: "Day 3",
                    title: "Legs & Glutes",
                    muscleGroups: [
                        "legs",
                        "hamstrings",
                        "glutes",
                    ],
                },
                {
                    dayName: "Day 4",
                    title: "Shoulders & Arms",
                    muscleGroups: [
                        "shoulders",
                        "triceps",
                        "biceps",
                    ],
                },
                {
                    dayName: "Day 5",
                    title: "Full Body Strength",
                    muscleGroups: [
                        "chest",
                        "back",
                        "legs",
                    ],
                },
            ];
        }

        // 6 days
        return [
            {
                dayName: "Day 1",
                title: "Chest & Triceps",
                muscleGroups: [
                    "chest",
                    "triceps",
                ],
            },
            {
                dayName: "Day 2",
                title: "Back & Biceps",
                muscleGroups: [
                    "back",
                    "biceps",
                ],
            },
            {
                dayName: "Day 3",
                title: "Legs & Glutes",
                muscleGroups: [
                    "legs",
                    "hamstrings",
                    "glutes",
                ],
            },
            {
                dayName: "Day 4",
                title: "Shoulders",
                muscleGroups: [
                    "shoulders",
                ],
            },
            {
                dayName: "Day 5",
                title: "Arms",
                muscleGroups: [
                    "biceps",
                    "triceps",
                ],
            },
            {
                dayName: "Day 6",
                title: "Full Body Strength",
                muscleGroups: [
                    "chest",
                    "back",
                    "legs",
                ],
            },
        ];
    }

    if (goal === "lose-weight") {
        if (daysPerWeek === 2) {
            return [
                {
                    dayName: "Day 1",
                    title: "Full Body Strength",
                    muscleGroups: [
                        "legs",
                        "chest",
                        "back",
                    ],
                },
                {
                    dayName: "Day 2",
                    title: "Full Body Conditioning",
                    muscleGroups: [
                        "full-body",
                        "core",
                        "cardio",
                    ],
                },
            ];
        }

        if (daysPerWeek === 3) {
            return [
                {
                    dayName: "Day 1",
                    title: "Full Body Strength",
                    muscleGroups: [
                        "legs",
                        "chest",
                        "back",
                    ],
                },
                {
                    dayName: "Day 2",
                    title: "Cardio & Core",
                    muscleGroups: [
                        "cardio",
                        "core",
                    ],
                },
                {
                    dayName: "Day 3",
                    title: "Full Body Conditioning",
                    muscleGroups: [
                        "full-body",
                        "legs",
                        "core",
                    ],
                },
            ];
        }

        const templates: DayTemplate[] = [
            {
                dayName: "Day 1",
                title: "Full Body Strength",
                muscleGroups: ["legs", "chest", "back"],
            },
            {
                dayName: "Day 2",
                title: "Cardio & Core",
                muscleGroups: ["cardio", "core"],
            },
            {
                dayName: "Day 3",
                title: "Upper Body",
                muscleGroups: ["chest", "back", "shoulders"],
            },
            {
                dayName: "Day 4",
                title: "Lower Body",
                muscleGroups: ["legs", "glutes", "hamstrings"],
            },
            {
                dayName: "Day 5",
                title: "Conditioning",
                muscleGroups: ["cardio", "full-body", "core"],
            },
            {
                dayName: "Day 6",
                title: "Full Body Burn",
                muscleGroups: ["full-body", "legs", "core"],
            },
        ];

        return templates.slice(0, daysPerWeek);
    }

    // stay-fit
    const templates: DayTemplate[] = [
        {
            dayName: "Day 1",
            title: "Upper Body",
            muscleGroups: ["chest", "back", "shoulders"],
        },
        {
            dayName: "Day 2",
            title: "Lower Body",
            muscleGroups: ["legs", "glutes", "hamstrings"],
        },
        {
            dayName: "Day 3",
            title: "Full Body",
            muscleGroups: ["full-body", "core"],
        },
        {
            dayName: "Day 4",
            title: "Strength & Core",
            muscleGroups: ["shoulders", "core", "triceps"],
        },
        {
            dayName: "Day 5",
            title: "Cardio & Conditioning",
            muscleGroups: ["cardio", "full-body"],
        },
        {
            dayName: "Day 6",
            title: "Full Body & Core",
            muscleGroups: ["full-body", "legs", "core"],
        },
    ];

    return templates.slice(0, daysPerWeek);
}

// ========================================
// Goal label
// ========================================

function getGoalLabel(
    goal: string,
): string {
    switch (goal) {
        case "build-muscle":
            return "Build Muscle";

        case "lose-weight":
            return "Lose Weight";

        case "stay-fit":
            return "Stay Fit";

        default:
            return "Fitness";
    }
}

// ========================================
// Exercise prescription
// ========================================

function getPrescription(
    exercise: ExerciseRow,
    goal: string,
) {
    if (
        exercise.category === "cardio"
    ) {
        return {
            sets: null,
            reps: null,
            durationSeconds: 600,
            restSeconds: 60,
            notes:
                "Maintain a comfortable and controlled pace.",
        };
    }

    if (
        exercise.category === "core"
    ) {
        return {
            sets: 3,
            reps: exercise.name
                .toLowerCase()
                .includes("plank")
                ? null
                : 15,
            durationSeconds:
                exercise.name
                    .toLowerCase()
                    .includes("plank")
                    ? 30
                    : null,
            restSeconds: 45,
            notes:
                "Focus on controlled movement and good form.",
        };
    }

    if (goal === "build-muscle") {
        return {
            sets: 3,
            reps: 10,
            durationSeconds: null,
            restSeconds: 45,
            notes:
                "Use a challenging weight while maintaining good form.",
        };
    }

    if (goal === "lose-weight") {
        return {
            sets: 3,
            reps: 12,
            durationSeconds: null,
            restSeconds: 60,
            notes:
                "Keep rest periods controlled and maintain steady intensity.",
        };
    }

    return {
        sets: 3,
        reps: 10,
        durationSeconds: null,
        restSeconds: 60,
        notes:
            "Use controlled movement and maintain good form.",
    };
}