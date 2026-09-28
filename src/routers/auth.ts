import type { Router } from "../http";
import {
	googleLogin,
	login,
	logout,
	me,
	refresh,
	register,
} from "../handlers/auth";

// POST /auth/register
// POST /auth/login
// POST /auth/google   (ID token from the app)
// POST /auth/refresh
// POST /auth/logout
// GET  /auth/me

export const authRouter: Router = async (request, env, url) => {
	if (request.method === "POST") {
		switch (url.pathname) {
			case "/auth/register":
				return register(request, env);
			case "/auth/login":
				return login(request, env);
			case "/auth/google":
				return googleLogin(request, env);
			case "/auth/refresh":
				return refresh(request, env);
			case "/auth/logout":
				return logout(request, env);
		}
	}

	if (
		request.method === "GET" &&
		url.pathname === "/auth/me"
	) {
		return me(request, env);
	}

	return null;
};
