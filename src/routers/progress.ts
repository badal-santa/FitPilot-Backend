import { json, type Router } from "../http";
import { getProgress } from "../handlers/progress";
import { getAuthenticatedUserId } from "../services/auth";

// GET /progress?period=weekly|monthly|yearly   (default weekly)
//
// Errors on this route use an `error` key rather than `message`.

export const progressRouter: Router = async (request, env, url) => {
	if (
		request.method !== "GET" ||
		url.pathname !== "/progress"
	) {
		return null;
	}

	const userId = await getAuthenticatedUserId(request, env);

	if (!userId) {
		return json(
			{
				success: false,
				error: "Unauthorized",
			},
			401,
		);
	}

	const period =
		url.searchParams.get("period") ?? "weekly";

	if (
		period !== "weekly" &&
		period !== "monthly" &&
		period !== "yearly"
	) {
		return json(
			{
				success: false,
				error: "Invalid period",
			},
			400,
		);
	}

	try {
		const data = await getProgress(
			env.fitpilot_db,
			userId,
			period,
		);

		return json({
			success: true,
			data,
		});
	} catch (error) {
		console.error("Progress error:", error);

		return json(
			{
				success: false,
				error: "Failed to get progress",
			},
			500,
		);
	}
};
