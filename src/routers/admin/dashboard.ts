import { json, requireAdmin, type Router } from "../../http";
import { getAdminDashboard } from "../../handlers/admin";

// GET /admin/dashboard

export const adminDashboardRouter: Router = async (request, env, url) => {
	if (
		request.method !== "GET" ||
		url.pathname !== "/admin/dashboard"
	) {
		return null;
	}

	const admin = await requireAdmin(request, env);

	if (admin instanceof Response) {
		return admin;
	}

	try {
		const dashboard = await getAdminDashboard(env);

		return json({
			success: true,
			data: dashboard,
		});
	} catch (error) {
		console.error("Admin dashboard error:", error);

		return json(
			{
				success: false,
				message: "Failed to load dashboard",
			},
			500,
		);
	}
};
