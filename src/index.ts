import { combineRouters, CORS_HEADERS, json } from "./http";
import { adminRouter } from "./routers/admin";
import { appVersionRouter } from "./routers/app-version";
import { authRouter } from "./routers/auth";
import { exercisesRouter } from "./routers/exercises";
import { notificationsRouter } from "./routers/notifications";
import { profileRouter } from "./routers/profile";
import { progressRouter } from "./routers/progress";
import { systemRouter } from "./routers/system";
import { workoutsRouter } from "./routers/workouts";

export interface Env {
	fitpilot_db: D1Database;
	ONESIGNAL_REST_API_KEY: string;
	GOOGLE_CLIENT_IDS?: string;
}

// Each router owns one area of the API; see src/routers/ for its paths.
const route = combineRouters(
	systemRouter,
	authRouter,
	profileRouter,
	exercisesRouter,
	workoutsRouter,
	progressRouter,
	notificationsRouter,
	appVersionRouter,
	adminRouter,
);

export default {
	async fetch(
		request: Request,
		env: Env,
	): Promise<Response> {
		// CORS preflight
		if (request.method === "OPTIONS") {
			return new Response(null, {
				status: 204,
				headers: CORS_HEADERS,
			});
		}

		const response = await route(
			request,
			env,
			new URL(request.url),
		);

		return response ?? json(
			{
				success: false,
				message: "Route not found",
			},
			404,
		);
	},
};
