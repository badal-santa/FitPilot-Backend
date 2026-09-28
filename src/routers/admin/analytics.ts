import { json, requireAdmin, type Router } from "../../http";
import { getAdminAnalytics } from "../../handlers/admin";

// GET /admin/analytics

export const adminAnalyticsRouter: Router = async (request, env, url) => {
	if (
		request.method !== "GET" ||
		url.pathname !== "/admin/analytics"
	) {
		return null;
	}

	const admin = await requireAdmin(request, env);

	if (admin instanceof Response) {
		return admin;
	}

	try {
		const data = await getAdminAnalytics(env);

		return json({
			success: true,
			data,
		});
	} catch (error) {
		console.error("Admin analytics error:", error);

		return json(
			{
				success: false,
				message: "Failed to load analytics",
			},
			500,
		);
	}
};
