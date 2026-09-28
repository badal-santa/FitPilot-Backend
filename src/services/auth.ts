import { Env } from "../index";

async function hashToken(token: string): Promise<string> {
	const data = new TextEncoder().encode(token);

	const hashBuffer = await crypto.subtle.digest(
		"SHA-256",
		data,
	);

	const hashArray = Array.from(
		new Uint8Array(hashBuffer),
	);

	return btoa(
		String.fromCharCode(...hashArray),
	);
}

export async function getAuthenticatedUserId(
	request: Request,
	env: Env,
): Promise<string | null> {
	const authHeader =
		request.headers.get("Authorization");

	if (!authHeader?.startsWith("Bearer ")) {
		return null;
	}

	const accessToken = authHeader
		.slice(7)
		.trim();

	if (!accessToken) {
		return null;
	}

	const tokenHash =
		await hashToken(accessToken);

	const session =
		await env.fitpilot_db
			.prepare(
				`
				SELECT user_id
				FROM sessions
				WHERE token_hash = ?
				AND expires_at > datetime('now')
				LIMIT 1
				`,
			)
			.bind(tokenHash)
			.first<{ user_id: string }>();

	return session?.user_id ?? null;
}