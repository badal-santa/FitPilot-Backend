import { json, requireAdmin, type Router } from "../../http";
import {
	getAdminAppVersions,
	isPlatform,
	updateAdminAppVersion,
} from "../../handlers/app-version";

// GET /admin/app-versions
// PUT /admin/app-versions/:platform   (android | ios)

const ADMIN_APP_VERSION_PATH =
	/^\/admin\/app-versions(?:\/([^/]+))?$/;

export const adminAppVersionsRouter: Router = async (request, env, url) => {
	const match = url.pathname.match(ADMIN_APP_VERSION_PATH);

	if (
		!match ||
		!["GET", "PUT"].includes(request.method)
	) {
		return null;
	}

	const admin = await requireAdmin(request, env);

	if (admin instanceof Response) {
		return admin;
	}

	const platform = match[1];

	if (request.method === "GET" && !platform) {
		return getAdminAppVersions(request, env);
	}

	if (request.method === "PUT" && isPlatform(platform)) {
		return updateAdminAppVersion(
			request,
			env,
			platform,
			admin.email,
		);
	}

	return json(
		{
			success: false,
			message: "Invalid app version route",
		},
		400,
	);
};
