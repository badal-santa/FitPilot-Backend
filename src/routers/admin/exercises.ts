import { json, requireAdmin, type Router } from "../../http";
import {
	createAdminExercise,
	deleteAdminExercise,
	getAdminExercises,
	permanentlyDeleteAdminExercise,
	updateAdminExercise,
} from "../../handlers/admin-exercises";

// GET    /admin/exercises
// POST   /admin/exercises
// PUT    /admin/exercises/:id
// DELETE /admin/exercises/:id             soft delete
// DELETE /admin/exercises/:id/permanent

const ADMIN_EXERCISE_PATH =
	/^\/admin\/exercises(?:\/([^/]+)(\/permanent)?)?$/;

export const adminExercisesRouter: Router = async (request, env, url) => {
	const match = url.pathname.match(ADMIN_EXERCISE_PATH);

	if (
		!match ||
		!["GET", "POST", "PUT", "DELETE"].includes(request.method)
	) {
		return null;
	}

	const admin = await requireAdmin(request, env);

	if (admin instanceof Response) {
		return admin;
	}

	const exerciseId = match[1];
	const isPermanentDelete = match[2] === "/permanent";

	if (isPermanentDelete) {
		if (request.method === "DELETE" && exerciseId) {
			return permanentlyDeleteAdminExercise(
				request,
				env,
				exerciseId,
			);
		}

		return json(
			{
				success: false,
				message: "Invalid permanent delete route",
			},
			400,
		);
	}

	if (request.method === "GET" && !exerciseId) {
		return getAdminExercises(request, env);
	}

	if (request.method === "POST" && !exerciseId) {
		return createAdminExercise(request, env);
	}

	if (request.method === "PUT" && exerciseId) {
		return updateAdminExercise(request, env, exerciseId);
	}

	if (request.method === "DELETE" && exerciseId) {
		return deleteAdminExercise(request, env, exerciseId);
	}

	return json(
		{
			success: false,
			message: "Invalid exercise route",
		},
		400,
	);
};
