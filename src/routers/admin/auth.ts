import { json, type Router } from "../../http";
import type { Env } from "../../index";
import {
	authenticateAdmin,
	createAdmin,
	createAdminSession,
	deleteAdminSession,
	getAuthenticatedAdmin,
} from "../../services/admin-auth";

// POST /admin/setup          create the first admin (one-time, public)
// POST /admin/auth/login
// GET  /admin/auth/me
// POST /admin/auth/logout

async function setup(
	request: Request,
	env: Env,
): Promise<Response> {
	try {
		const body =
			await request.json<{
				email?: string;
				password?: string;
				name?: string;
			}>();

		const email = body.email?.trim();
		const password = body.password;
		const name = body.name?.trim();

		if (!email || !password || !name) {
			return json(
				{
					success: false,
					message:
						"Name, email and password are required",
				},
				400,
			);
		}

		const existing =
			await env.fitpilot_db
				.prepare(
					`SELECT id FROM admin_users LIMIT 1`,
				)
				.first();

		if (existing) {
			return json(
				{
					success: false,
					message:
						"Admin setup has already been completed",
				},
				403,
			);
		}

		const admin = await createAdmin(
			env.fitpilot_db,
			email,
			password,
			name,
		);

		return json({
			success: true,
			message:
				"Admin account created successfully",
			data: admin,
		});
	} catch (error) {
		console.error(
			"Admin setup error:",
			error,
		);

		return json(
			{
				success: false,
				message:
					"Failed to create admin account",
			},
			500,
		);
	}
}

async function login(
	request: Request,
	env: Env,
): Promise<Response> {
	try {
		const body =
			await request.json<{
				email?: string;
				password?: string;
			}>();

		const email = body.email?.trim();
		const password = body.password;

		if (!email || !password) {
			return json(
				{
					success: false,
					message:
						"Email and password are required",
				},
				400,
			);
		}

		const admin =
			await authenticateAdmin(
				env.fitpilot_db,
				email,
				password,
			);

		if (!admin) {
			return json(
				{
					success: false,
					message:
						"Invalid email or password",
				},
				401,
			);
		}

		const session =
			await createAdminSession(
				env.fitpilot_db,
				admin.id,
			);

		return json({
			success: true,
			data: {
				admin: {
					id: admin.id,
					email: admin.email,
					name: admin.name,
				},
				accessToken:
					session.token,
				expiresAt:
					session.expiresAt,
			},
		});
	} catch (error) {
		console.error(
			"Admin login error:",
			error,
		);

		return json(
			{
				success: false,
				message:
					"Invalid request",
			},
			400,
		);
	}
}

async function me(
	request: Request,
	env: Env,
): Promise<Response> {
	const admin =
		await getAuthenticatedAdmin(
			env.fitpilot_db,
			request,
		);

	if (!admin) {
		return json(
			{
				success: false,
				message:
					"Unauthorized",
			},
			401,
		);
	}

	return json({
		success: true,
		data: {
			id: admin.id,
			email: admin.email,
			name: admin.name,
		},
	});
}

async function logout(
	request: Request,
	env: Env,
): Promise<Response> {
	await deleteAdminSession(
		env.fitpilot_db,
		request,
	);

	return json({
		success: true,
		message:
			"Admin logged out successfully",
	});
}

export const adminAuthRouter: Router = async (request, env, url) => {
	if (request.method === "POST") {
		switch (url.pathname) {
			case "/admin/setup":
				return setup(request, env);
			case "/admin/auth/login":
				return login(request, env);
			case "/admin/auth/logout":
				return logout(request, env);
		}
	}

	if (
		request.method === "GET" &&
		url.pathname === "/admin/auth/me"
	) {
		return me(request, env);
	}

	return null;
};
