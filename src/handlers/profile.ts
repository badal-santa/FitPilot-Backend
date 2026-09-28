import type { Env } from "../index";

function json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json",
        },
    });
}

async function hashToken(token: string): Promise<string> {
    const data = new TextEncoder().encode(token);

    const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        data,
    );

    return btoa(
        String.fromCharCode(...new Uint8Array(hashBuffer)),
    );
}

function getAccessToken(request: Request): string | null {
    const authHeader = request.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
        return null;
    }

    const token = authHeader.slice(7).trim();

    return token || null;
}

async function getAuthenticatedUserId(
    request: Request,
    env: Env,
): Promise<string | null> {
    const accessToken = getAccessToken(request);

    if (!accessToken) {
        return null;
    }

    const tokenHash = await hashToken(accessToken);

    const session = await env.fitpilot_db
        .prepare(
            `SELECT user_id
       FROM sessions
       WHERE token_hash = ?
       AND expires_at > CURRENT_TIMESTAMP
       LIMIT 1`,
        )
        .bind(tokenHash)
        .first<{ user_id: string }>();

    return session?.user_id ?? null;
}

export async function updateProfile(
    request: Request,
    env: Env,
): Promise<Response> {
    try {
        const userId = await getAuthenticatedUserId(
            request,
            env,
        );

        if (!userId) {
            return json(
                {
                    success: false,
                    message: "Invalid or expired session",
                },
                401,
            );
        }

        const body = await request.json<{
            goal?: string;
            gender?: string;
            age?: number;
            heightCm?: number;
            weightKg?: number;
            activityLevel?: string;
            workoutDays?: number;
            remindersEnabled?: boolean;
            onboardingCompleted?: boolean;
        }>();

        const {
            goal,
            gender,
            age,
            heightCm,
            weightKg,
            activityLevel,
            workoutDays,
            remindersEnabled,
            onboardingCompleted,
        } = body;

        // Validation
        const validGoals = [
            "lose-weight",
            "build-muscle",
            "stay-fit",
        ];

        if (goal !== undefined && !validGoals.includes(goal)) {
            return json(
                {
                    success: false,
                    message: "Invalid goal",
                },
                400,
            );
        }

        const validGenders = ["male", "female"];

        if (
            gender !== undefined &&
            !validGenders.includes(gender)
        ) {
            return json(
                {
                    success: false,
                    message: "Invalid gender",
                },
                400,
            );
        }

        if (
            age !== undefined &&
            (!Number.isInteger(age) || age < 13 || age > 100)
        ) {
            return json(
                {
                    success: false,
                    message: "Age must be between 13 and 100",
                },
                400,
            );
        }

        if (
            heightCm !== undefined &&
            (typeof heightCm !== "number" ||
                heightCm < 100 ||
                heightCm > 250)
        ) {
            return json(
                {
                    success: false,
                    message: "Invalid height",
                },
                400,
            );
        }

        if (
            weightKg !== undefined &&
            (typeof weightKg !== "number" ||
                weightKg < 30 ||
                weightKg > 300)
        ) {
            return json(
                {
                    success: false,
                    message: "Invalid weight",
                },
                400,
            );
        }

        if (
            workoutDays !== undefined &&
            (!Number.isInteger(workoutDays) ||
                workoutDays < 2 ||
                workoutDays > 6)
        ) {
            return json(
                {
                    success: false,
                    message:
                        "Workout days must be between 2 and 6",
                },
                400,
            );
        }

        const updates: string[] = [];
        const values: unknown[] = [];

        if (goal !== undefined) {
            updates.push("goal = ?");
            values.push(goal);
        }

        if (gender !== undefined) {
            updates.push("gender = ?");
            values.push(gender);
        }

        if (age !== undefined) {
            updates.push("age = ?");
            values.push(age);
        }

        if (heightCm !== undefined) {
            updates.push("height_cm = ?");
            values.push(heightCm);
        }

        if (weightKg !== undefined) {
            updates.push("weight_kg = ?");
            values.push(weightKg);
        }

        if (activityLevel !== undefined) {
            updates.push("activity_level = ?");
            values.push(activityLevel);
        }

        if (workoutDays !== undefined) {
            updates.push("workout_days = ?");
            values.push(workoutDays);
        }

        if (remindersEnabled !== undefined) {
            updates.push("reminders_enabled = ?");
            values.push(remindersEnabled ? 1 : 0);
        }

        if (onboardingCompleted !== undefined) {
            updates.push("onboarding_completed = ?");
            values.push(onboardingCompleted ? 1 : 0);
        }

        if (updates.length === 0) {
            return json(
                {
                    success: false,
                    message: "No profile data provided",
                },
                400,
            );
        }

        updates.push("updated_at = CURRENT_TIMESTAMP");

        values.push(userId);

        await env.fitpilot_db
            .prepare(
                `UPDATE users
         SET ${updates.join(", ")}
         WHERE id = ?`,
            )
            .bind(...values)
            .run();

        const user = await env.fitpilot_db
            .prepare(
                `SELECT
          id,
          email,
          name,
          avatar_url,
          date_of_birth,
          gender,
          age,
          height_cm,
          weight_kg,
          goal,
          activity_level,
          workout_days,
          reminders_enabled,
          onboarding_completed,
          created_at,
          updated_at
         FROM users
         WHERE id = ?
         LIMIT 1`,
            )
            .bind(userId)
            .first();

        return json({
            success: true,
            message: "Profile updated successfully",
            user: {
                ...user,
                reminders_enabled:
                    Boolean((user as any)?.reminders_enabled),
                onboarding_completed:
                    Boolean((user as any)?.onboarding_completed),
            },
        });
    } catch (error) {
        console.error("Update profile error:", error);

        return json(
            {
                success: false,
                message: "Something went wrong",
            },
            500,
        );
    }
}

export async function getProfile(
    request: Request,
    env: Env,
): Promise<Response> {
    try {
        const userId = await getAuthenticatedUserId(
            request,
            env,
        );

        if (!userId) {
            return json(
                {
                    success: false,
                    message: "Invalid or expired session",
                },
                401,
            );
        }

        const user = await env.fitpilot_db
            .prepare(
                `SELECT
          id,
          email,
          name,
          avatar_url,
          date_of_birth,
          gender,
          age,
          height_cm,
          weight_kg,
          goal,
          activity_level,
          workout_days,
          reminders_enabled,
          onboarding_completed,
          created_at,
          updated_at
         FROM users
         WHERE id = ?
         LIMIT 1`,
            )
            .bind(userId)
            .first();

        if (!user) {
            return json(
                {
                    success: false,
                    message: "User not found",
                },
                404,
            );
        }

        return json({
            success: true,
            user: {
                ...user,
                reminders_enabled:
                    Boolean((user as any).reminders_enabled),
                onboarding_completed:
                    Boolean((user as any).onboarding_completed),
            },
        });
    } catch (error) {
        console.error("Get profile error:", error);

        return json(
            {
                success: false,
                message: "Something went wrong",
            },
            500,
        );
    }
}