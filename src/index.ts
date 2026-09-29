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

// Every API route is served under this prefix, e.g. /v1/auth/login.
const API_PREFIX = "/v1";

// Each router owns one area of the API; see src/routers/ for its paths.
// Router paths are written without API_PREFIX; fetch() strips it first.
const apiRoute = combineRouters(
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

		const url = new URL(request.url);

		let response: Response | null;

		if (
			url.pathname === API_PREFIX ||
			url.pathname.startsWith(`${API_PREFIX}/`)
		) {
			url.pathname =
				url.pathname.slice(API_PREFIX.length) || "/";

			response = await apiRoute(request, env, url);
		} else {
			// Unprefixed: only /, /health, /docs and /openapi.json.
			response = await systemRouter(request, env, url);
		}

		return response ?? json(
			{
				success: false,
				message: "Route not found",
			},
			404,
		);
	},
};
