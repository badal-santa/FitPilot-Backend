import { Env } from "../index";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

// An exercise counts as "new" (the app shows a NEW ribbon) for this many
// days after an admin adds it. Exercises from the initial seed batch — all
// created within an hour of the very first one — never count as new, so a
// fresh database doesn't ribbon the whole catalog.
const NEW_EXERCISE_DAYS = 7;

const IS_NEW_SQL = `
  CASE
    WHEN created_at >= datetime('now', '-${NEW_EXERCISE_DAYS} days')
     AND created_at > datetime((SELECT MIN(created_at) FROM exercises), '+1 hour')
    THEN 1 ELSE 0
  END AS is_new`;

export async function getExercises(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const url = new URL(request.url);

    const muscleGroup = url.searchParams.get("muscleGroup");
    const category = url.searchParams.get("category");
    const difficulty = url.searchParams.get("difficulty");
    const equipment = url.searchParams.get("equipment");

    const page = Math.max(
      Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1,
      1,
    );

    const limit = Math.min(
      Math.max(
        Number.parseInt(url.searchParams.get("limit") ?? "20", 10) || 20,
        1,
      ),
      100,
    );

    const offset = (page - 1) * limit;

    const conditions: string[] = ["is_active = 1"];
    const bindings: string[] = [];

    if (muscleGroup) {
      conditions.push("muscle_group = ?");
      bindings.push(muscleGroup);
    }

    if (category) {
      conditions.push("category = ?");
      bindings.push(category);
    }

    if (difficulty) {
      conditions.push("difficulty = ?");
      bindings.push(difficulty);
    }

    if (equipment) {
      conditions.push("equipment = ?");
      bindings.push(equipment);
    }

    const whereClause = conditions.join(" AND ");

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM exercises
      WHERE ${whereClause}
    `;

    const countResult = await env.fitpilot_db
      .prepare(countQuery)
      .bind(...bindings)
      .first<{ total: number }>();

    const dataQuery = `
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
        video_url,
        created_at,
        ${IS_NEW_SQL}
      FROM exercises
      WHERE ${whereClause}
      ORDER BY name ASC
      LIMIT ? OFFSET ?
    `;

    const exercises = await env.fitpilot_db
      .prepare(dataQuery)
      .bind(...bindings, limit, offset)
      .all();

    const total = countResult?.total ?? 0;

    return json({
      success: true,
      data: exercises.results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
      },
    });
  } catch (error) {
    console.error("Get exercises error:", error);

    return json(
      {
        success: false,
        message: "Something went wrong",
      },
      500,
    );
  }
}

export async function getExerciseById(
  request: Request,
  env: Env,
  exerciseId: string,
): Promise<Response> {
  try {
    const exercise = await env.fitpilot_db
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
            video_url,
            created_at,
            ${IS_NEW_SQL}
          FROM exercises
          WHERE id = ?
            AND is_active = 1
          LIMIT 1
        `,
      )
      .bind(exerciseId)
      .first();

    if (!exercise) {
      return json(
        {
          success: false,
          message: "Exercise not found",
        },
        404,
      );
    }

    return json({
      success: true,
      data: exercise,
    });
  } catch (error) {
    console.error("Get exercise error:", error);

    return json(
      {
        success: false,
        message: "Something went wrong",
      },
      500,
    );
  }
}