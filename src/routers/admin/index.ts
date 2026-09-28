import { combineRouters, type Router } from "../../http";
import { adminAnalyticsRouter } from "./analytics";
import { adminAppVersionsRouter } from "./app-versions";
import { adminAuthRouter } from "./auth";
import { adminDashboardRouter } from "./dashboard";
import { adminExercisesRouter } from "./exercises";
import { adminNotificationsRouter } from "./notifications";
import { adminUsersRouter } from "./users";
import { adminWorkoutsRouter } from "./workouts";

// Every /admin/* route. Each page router checks the admin session itself,
// so /admin/setup and /admin/auth/login stay public.

const routeAdmin = combineRouters(
	adminAuthRouter,
	adminDashboardRouter,
	adminUsersRouter,
	adminAnalyticsRouter,
	adminWorkoutsRouter,
	adminExercisesRouter,
	adminNotificationsRouter,
	adminAppVersionsRouter,
);

export const adminRouter: Router = async (request, env, url) => {
	if (!url.pathname.startsWith("/admin/")) {
		return null;
	}

	return routeAdmin(request, env, url);
};
