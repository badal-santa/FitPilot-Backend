import {
	json,
	readPagination,
	requireUser,
	type Router,
} from "../http";
import type { Env } from "../index";
import {
	ONESIGNAL_APP_ID,
	sendOneSignalNotification,
} from "../services/notifications";

// GET  /notifications?page=1&limit=20   broadcasts sent to all users, newest first
// POST /notifications/test              push a test notification to yourself

async function listNotifications(
	request: Request,
	env: Env,
	url: URL,
): Promise<Response> {
	const userId = await requireUser(request, env);

	if (userId instanceof Response) {
		return userId;
	}

	try {
		const { page, limit, offset } = readPagination(url, 20);

		const [countResult, notificationsResult] = await Promise.all([
			env.fitpilot_db
				.prepare(
					`SELECT COUNT(*) AS total FROM notification_history WHERE audience = 'all' AND status = 'sent'`,
				)
				.first<{ total: number }>(),

			env.fitpilot_db
				.prepare(`
          SELECT
            id,
            title,
            message,
            created_at
          FROM notification_history
          WHERE audience = 'all' AND status = 'sent'
          ORDER BY created_at DESC
          LIMIT ? OFFSET ?
        `)
				.bind(limit, offset)
				.all(),
		]);

		const total = countResult?.total ?? 0;
		const totalPages = Math.ceil(total / limit);

		return json({
			success: true,
			data: {
				notifications: notificationsResult.results,
				pagination: {
					page,
					limit,
					total,
					totalPages,
					hasNextPage: page < totalPages,
				},
			},
		});
	} catch (error) {
		console.error("User notifications error:", error);

		return json(
			{
				success: false,
				message: "Failed to load notifications",
			},
			500,
		);
	}
}

async function sendTestNotification(
	request: Request,
	env: Env,
): Promise<Response> {
	const userId = await requireUser(request, env);

	if (userId instanceof Response) {
		return userId;
	}

	try {
		const result = await sendOneSignalNotification(
			env.ONESIGNAL_REST_API_KEY,
			ONESIGNAL_APP_ID,
			userId,
			"FitPilot 💪",
			"Your backend notification system is working!",
		);

		return json({
			success: true,
			data: result,
		});
	} catch (error) {
		console.error("Notification test error:", error);

		return json(
			{
				success: false,
				message: "Failed to send notification",
			},
			500,
		);
	}
}

export const notificationsRouter: Router = async (request, env, url) => {
	if (
		request.method === "GET" &&
		url.pathname === "/notifications"
	) {
		return listNotifications(request, env, url);
	}

	if (
		request.method === "POST" &&
		url.pathname === "/notifications/test"
	) {
		return sendTestNotification(request, env);
	}

	return null;
};
