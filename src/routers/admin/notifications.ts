import {
	json,
	readPagination,
	requireAdmin,
	type Admin,
	type Router,
} from "../../http";
import type { Env } from "../../index";
import {
	ONESIGNAL_APP_ID,
	sendOneSignalBroadcast,
} from "../../services/notifications";

// POST /admin/notifications/send                      broadcast to all users
// GET  /admin/notifications/history?page=1&limit=10

async function sendBroadcast(
	request: Request,
	env: Env,
	admin: Admin,
): Promise<Response> {
	let body: {
		title?: string;
		message?: string;
	};

	try {
		body = await request.json();
	} catch {
		return json(
			{
				success: false,
				message: "Invalid JSON body",
			},
			400,
		);
	}

	try {
		const title = body.title?.trim();
		const message = body.message?.trim();

		if (
			!title ||
			!message ||
			title.length > 100 ||
			message.length > 1000
		) {
			return json(
				{
					success: false,
					message:
						"Title and message are required. Title must be at most 100 characters and message at most 1000 characters.",
				},
				400,
			);
		}

		const result = await sendOneSignalBroadcast(
			env.ONESIGNAL_REST_API_KEY,
			ONESIGNAL_APP_ID,
			title,
			message,
		);

		// The broadcast has already gone out at this point, so a
		// failure to record it must not be reported as a failed send
		// (the admin would retry and everyone gets it twice).
		try {
			await env.fitpilot_db
				.prepare(
					`
					INSERT INTO notification_history (
						id,
						title,
						message,
						audience,
						status,
						onesignal_id,
						sent_by
					)
					VALUES (?, ?, ?, 'all', 'sent', ?, ?)
					`,
				)
				.bind(
					crypto.randomUUID(),
					title,
					message,
					result.id || null,
					admin.id,
				)
				.run();
		} catch (historyError) {
			console.error(
				"Failed to save notification history:",
				historyError,
			);
		}

		return json({
			success: true,
			message: "Broadcast notification sent",
			data: result,
		});
	} catch (error) {
		console.error("Admin notification error:", error);

		return json(
			{
				success: false,
				message: "Failed to send notification",
			},
			500,
		);
	}
}

async function getHistory(
	env: Env,
	url: URL,
): Promise<Response> {
	try {
		const { page, limit, offset } = readPagination(url, 10);

		const [countResult, historyResult] = await Promise.all([
			env.fitpilot_db
				.prepare(
					`SELECT COUNT(*) AS total FROM notification_history`,
				)
				.first<{ total: number }>(),

			env.fitpilot_db
				.prepare(`
          SELECT
            id,
            title,
            message,
            audience,
            status,
            onesignal_id,
            sent_by,
            created_at
          FROM notification_history
          ORDER BY created_at DESC
          LIMIT ? OFFSET ?
        `)
				.bind(limit, offset)
				.all(),
		]);

		const total = countResult?.total ?? 0;

		return json({
			success: true,
			data: {
				notifications: historyResult.results,
				pagination: {
					page,
					limit,
					total,
					totalPages: Math.ceil(total / limit),
				},
			},
		});
	} catch (error) {
		console.error("Notification history error:", error);

		return json(
			{
				success: false,
				message: "Failed to load notification history",
			},
			500,
		);
	}
}

export const adminNotificationsRouter: Router = async (request, env, url) => {
	const isSend =
		request.method === "POST" &&
		url.pathname === "/admin/notifications/send";

	const isHistory =
		request.method === "GET" &&
		url.pathname === "/admin/notifications/history";

	if (!isSend && !isHistory) {
		return null;
	}

	const admin = await requireAdmin(request, env);

	if (admin instanceof Response) {
		return admin;
	}

	return isSend
		? sendBroadcast(request, env, admin)
		: getHistory(env, url);
};
