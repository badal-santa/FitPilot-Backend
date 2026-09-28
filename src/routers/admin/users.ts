import { json, requireAdmin, type Router } from "../../http";
import { getAdminUsers } from "../../handlers/admin";

// GET /admin/users

export const adminUsersRouter: Router = async (request, env, url) => {
	if (
		request.method !== "GET" ||
		url.pathname !== "/admin/users"
	) {
		return null;
	}

	const admin = await requireAdmin(request, env);

	if (admin instanceof Response) {
		return admin;
	}

	try {
		const result = await getAdminUsers(request, env);

		return json({
			success: true,
			data: result,
		});
	} catch (error) {
		console.error("Admin users error:", error);

		return json(
			{
				success: false,
				message: "Failed to load users",
			},
			500,
		);
	}
};
