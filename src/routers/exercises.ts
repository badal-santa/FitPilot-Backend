import { json, type Router } from "../http";
import { getExerciseById, getExercises } from "../handlers/exercises";

// GET /exercises
//   ?page=1&limit=20
//   ?muscleGroup=chest | ?difficulty=beginner | ?equipment=dumbbell | ?category=strength
// GET /exercises/:id   (e.g. /exercises/ex_chest_001)

export const exercisesRouter: Router = async (request, env, url) => {
	if (request.method !== "GET") {
		return null;
	}

	if (url.pathname === "/exercises") {
		return getExercises(request, env);
	}

	if (url.pathname.startsWith("/exercises/")) {
		const exerciseId = url.pathname.split("/")[2];

		if (!exerciseId) {
			return json(
				{
					success: false,
					message: "Exercise ID is required",
				},
				400,
			);
		}

		return getExerciseById(request, env, exerciseId);
	}

	return null;
};
