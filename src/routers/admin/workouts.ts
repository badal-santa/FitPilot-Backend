import { json, requireAdmin, type Router } from "../../http";
import { getAdminWorkouts } from "../../handlers/admin";

// GET /admin/workouts

export const adminWorkoutsRouter: Router = async (request, env, url) => {
	if (
		request.method !== "GET" ||
		url.pathname !== "/admin/workouts"
	) {
		return null;
	}

	const admin = await requireAdmin(request, env);

	if (admin instanceof Response) {
		return admin;
	}

	try {
		const result = await getAdminWorkouts(request, env);

		return json({
			success: true,
			data: result,
		});
	} catch (error) {
		console.error("Admin workouts error:", error);

		return json(
			{
				success: false,
				message: "Failed to load workouts",
			},
			500,
		);
	}
};
