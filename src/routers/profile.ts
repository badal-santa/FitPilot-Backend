import type { Router } from "../http";
import { getProfile, updateProfile } from "../handlers/profile";

// GET /profile
// PUT /profile

export const profileRouter: Router = async (request, env, url) => {
	if (url.pathname !== "/profile") {
		return null;
	}

	if (request.method === "GET") {
		return getProfile(request, env);
	}

	if (request.method === "PUT") {
		return updateProfile(request, env);
	}

	return null;
};
