import type { Router } from "../http";
import { getAppVersion } from "../handlers/app-version";

// Public — the mobile app checks this on launch (update sheet).
//
// GET /app/version?platform=android|ios

export const appVersionRouter: Router = async (request, env, url) => {
	if (
		request.method === "GET" &&
		url.pathname === "/app/version"
	) {
		return getAppVersion(request, env);
	}

	return null;
};
