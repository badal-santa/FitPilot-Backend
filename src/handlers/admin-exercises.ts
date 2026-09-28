import { Env } from "../index";


function json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        },
    });
}

function createSlug(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

interface ExerciseInput {
    name?: string;
    description?: string | null;
    category?: string;
    muscle_group?: string;
    equipment?: string | null;
    difficulty?: string;
    instructions?: string | null;
    image_url?: string | null;
    video_url?: string | null;
    is_active?: number;
}

// The app filters exercises by exact muscle_group ("full-body", "chest"…),
// so store one canonical form: "Full Body" / "full_body" → "full-body".
function normalizeMuscleGroup(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/[\s_]+/g, "-")
        .replace(/-+/g, "-");
}

function validateExercise(body: ExerciseInput): string | null {
    if (
        !body.name?.trim() ||
        !body.category?.trim() ||
        !body.muscle_group?.trim() ||
        !body.difficulty?.trim()
    ) {
        return "Name, category, muscle group and difficulty are required";
    }

    if (body.name.trim().length > 150) {
        return "Exercise name must be 150 characters or less";
    }

    return null;
}

// GET /admin/exercises
export async function getAdminExercises(
    request: Request,
    env: Env,
): Promise<Response> {
    try {
        const url = new URL(request.url);
        const page = Math.max(
            1,
            Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1,
        );
        const limit = Math.min(
            100,
            Math.max(
                1,
                Number.parseInt(url.searchParams.get("limit") ?? "10", 10) || 10,
            ),
        );
        const search = url.searchParams.get("search")?.trim() ?? "";
        const offset = (page - 1) * limit;

        const searchColumns = [
            "name",
            "muscle_group",
            "category",
            "equipment",
            "difficulty",
        ];
        const where = search
            ? `WHERE ${searchColumns.map((column) => `${column} LIKE ?`).join(" OR ")}`
            : "";
        const bindings = search
            ? searchColumns.map(() => `%${search}%`)
            : [];

        const count = await env.fitpilot_db
            .prepare(`SELECT COUNT(*) AS total FROM exercises ${where}`)
            .bind(...bindings)
            .first<{ total: number }>();

        const result = await env.fitpilot_db
            .prepare(
                `SELECT id, name, slug, description, category, muscle_group,
                equipment, difficulty, instructions, image_url, video_url,
                is_active, created_at, updated_at
         FROM exercises ${where}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
            )
            .bind(...bindings, limit, offset)
            .all();

        const total = count?.total ?? 0;

        return json({
            success: true,
            data: {
                exercises: result.results,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            },
        });
    } catch (error) {
        console.error("Admin exercises error:", error);
        return json({ success: false, message: "Failed to load exercises" }, 500);
    }
}

// POST /admin/exercises
export async function createAdminExercise(
    request: Request,
    env: Env,
): Promise<Response> {
    try {
        const body = await request.json<ExerciseInput>();
        const validationError = validateExercise(body);

        if (validationError) {
            return json({ success: false, message: validationError }, 400);
        }

        const name = body.name!.trim();
        const slug = createSlug(name);

        if (!slug) {
            return json({ success: false, message: "Invalid exercise name" }, 400);
        }

        const existing = await env.fitpilot_db
            .prepare("SELECT id FROM exercises WHERE slug = ?")
            .bind(slug)
            .first();

        if (existing) {
            return json(
                { success: false, message: "An exercise with this slug already exists" },
                409,
            );
        }

        const id = `ex_${crypto.randomUUID()}`;

        await env.fitpilot_db
            .prepare(
                `INSERT INTO exercises (
          id, name, slug, description, category, muscle_group, equipment,
          difficulty, instructions, image_url, video_url, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(
                id,
                name,
                slug,
                body.description?.trim() || null,
                body.category!.trim(),
                normalizeMuscleGroup(body.muscle_group!),
                body.equipment?.trim() || null,
                body.difficulty!.trim(),
                body.instructions?.trim() || null,
                body.image_url?.trim() || null,
                body.video_url?.trim() || null,
                body.is_active === 0 ? 0 : 1,
            )
            .run();

        return json({
            success: true,
            message: "Exercise created successfully",
            data: { id, name, slug },
        }, 201);
    } catch (error) {
        console.error("Create exercise error:", error);
        return json({ success: false, message: "Failed to create exercise" }, 500);
    }
}

// PUT /admin/exercises/:id
export async function updateAdminExercise(
    request: Request,
    env: Env,
    exerciseId: string,
): Promise<Response> {
    try {
        const body = await request.json<ExerciseInput>();
        const validationError = validateExercise(body);

        if (validationError) {
            return json({ success: false, message: validationError }, 400);
        }

        const existing = await env.fitpilot_db
            .prepare("SELECT id FROM exercises WHERE id = ?")
            .bind(exerciseId)
            .first();

        if (!existing) {
            return json({ success: false, message: "Exercise not found" }, 404);
        }

        const name = body.name!.trim();
        const slug = createSlug(name);

        const duplicate = await env.fitpilot_db
            .prepare("SELECT id FROM exercises WHERE slug = ? AND id != ?")
            .bind(slug, exerciseId)
            .first();

        if (duplicate) {
            return json(
                { success: false, message: "An exercise with this slug already exists" },
                409,
            );
        }

        await env.fitpilot_db
            .prepare(
                `UPDATE exercises SET
          name = ?, slug = ?, description = ?, category = ?,
          muscle_group = ?, equipment = ?, difficulty = ?,
          instructions = ?, image_url = ?, video_url = ?,
          is_active = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
            )
            .bind(
                name,
                slug,
                body.description?.trim() || null,
                body.category!.trim(),
                normalizeMuscleGroup(body.muscle_group!),
                body.equipment?.trim() || null,
                body.difficulty!.trim(),
                body.instructions?.trim() || null,
                body.image_url?.trim() || null,
                body.video_url?.trim() || null,
                body.is_active === 0 ? 0 : 1,
                exerciseId,
            )
            .run();

        return json({
            success: true,
            message: "Exercise updated successfully",
        });
    } catch (error) {
        console.error("Update exercise error:", error);
        return json({ success: false, message: "Failed to update exercise" }, 500);
    }
}

// DELETE /admin/exercises/:id (soft delete)
export async function deleteAdminExercise(
    _request: Request,
    env: Env,
    exerciseId: string,
): Promise<Response> {
    try {
        const result = await env.fitpilot_db
            .prepare(
                `UPDATE exercises
         SET is_active = 0, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND is_active = 1`,
            )
            .bind(exerciseId)
            .run();

        if (!result.meta.changes) {
            return json(
                { success: false, message: "Active exercise not found" },
                404,
            );
        }

        return json({
            success: true,
            message: "Exercise deleted successfully",
        });
    } catch (error) {
        console.error("Delete exercise error:", error);
        return json({ success: false, message: "Failed to delete exercise" }, 500);
    }
}

// DELETE /admin/exercises/:id/permanent
export async function permanentlyDeleteAdminExercise(
    _request: Request,
    env: Env,
    exerciseId: string,
): Promise<Response> {
    try {
        const exercise = await env.fitpilot_db
            .prepare("SELECT id FROM exercises WHERE id = ?")
            .bind(exerciseId)
            .first();

        if (!exercise) {
            return json(
                { success: false, message: "Exercise not found" },
                404,
            );
        }

        const planReference = await env.fitpilot_db
            .prepare(
                `SELECT COUNT(*) AS count
                 FROM workout_plan_exercises
                 WHERE exercise_id = ?`,
            )
            .bind(exerciseId)
            .first<{ count: number }>();

        const sessionReference = await env.fitpilot_db
            .prepare(
                `SELECT COUNT(*) AS count
                 FROM workout_session_exercises
                 WHERE exercise_id = ?`,
            )
            .bind(exerciseId)
            .first<{ count: number }>();

        const planCount = planReference?.count ?? 0;
        const sessionCount = sessionReference?.count ?? 0;

        if (planCount > 0 || sessionCount > 0) {
            return json(
                {
                    success: false,
                    message:
                        "Cannot permanently delete this exercise because it is used in workout plans or sessions. Deactivate it instead.",
                    references: {
                        workoutPlans: planCount,
                        workoutSessions: sessionCount,
                    },
                },
                409,
            );
        }

        await env.fitpilot_db
            .prepare("DELETE FROM exercises WHERE id = ?")
            .bind(exerciseId)
            .run();

        return json({
            success: true,
            message: "Exercise permanently deleted successfully",
        });
    } catch (error) {
        console.error("Permanent delete exercise error:", error);
        return json(
            {
                success: false,
                message: "Failed to permanently delete exercise",
            },
            500,
        );
    }
}
