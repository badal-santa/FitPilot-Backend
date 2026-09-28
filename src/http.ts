import type { Env } from "./index";
import { getAuthenticatedAdmin } from "./services/admin-auth";
import { getAuthenticatedUserId } from "./services/auth";

export const CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"Content-Type, Authorization",
	"Access-Control-Allow-Methods":
		"GET, POST, PUT, DELETE, OPTIONS",
};

export function json(
	data: unknown,
	status = 200,
): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			"Content-Type": "application/json",
			...CORS_HEADERS,
		},
	});
}

// A router returns a Response when it owns the route, or null so the
// next router gets a chance to handle it.
export type Router = (
	request: Request,
	env: Env,
	url: URL,
) => Promise<Response | null>;

export function combineRouters(...routers: Router[]): Router {
	return async (request, env, url) => {
		for (const router of routers) {
			const response = await router(request, env, url);

			if (response) {
				return response;
			}
		}

		return null;
	};
}

export type Admin = NonNullable<
	Awaited<ReturnType<typeof getAuthenticatedAdmin>>
>;

// Returns the signed-in admin, or a 401 response to send back as-is.
export async function requireAdmin(
	request: Request,
	env: Env,
): Promise<Admin | Response> {
	const admin = await getAuthenticatedAdmin(
		env.fitpilot_db,
		request,
	);

	return admin ?? json(
		{
			success: false,
			message: "Unauthorized",
		},
		401,
	);
}

// Returns the signed-in user's ID, or a 401 response to send back as-is.
export async function requireUser(
	request: Request,
	env: Env,
): Promise<string | Response> {
	const userId = await getAuthenticatedUserId(request, env);

	return userId ?? json(
		{
			success: false,
			message: "Unauthorized",
		},
		401,
	);
}

// Reads ?page and ?limit. limit is clamped to 1..100.
export function readPagination(
	url: URL,
	defaultLimit: number,
) {
	const page = Math.max(
		1,
		Number(url.searchParams.get("page")) || 1,
	);

	const limit = Math.min(
		100,
		Math.max(
			1,
			Number(url.searchParams.get("limit")) || defaultLimit,
		),
	);

	return {
		page,
		limit,
		offset: (page - 1) * limit,
	};
}
