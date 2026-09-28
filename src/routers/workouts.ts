import { json, type Router } from "../http";
import {
	addExerciseToWorkoutDay,
	addSessionExercise,
	completeWorkoutSession,
	generateWorkout,
	getTodayWorkout,
	getWeeklyProgress,
	getWorkoutById,
	getWorkouts,
	getWorkoutSession,
	getWorkoutStats,
	recordWorkoutSet,
	regenerateWorkout,
	startWorkoutSession,
} from "../handlers/workouts";

// GET  /workouts
// GET  /workouts/stats
// GET  /workouts/weekly-progress
// GET  /workouts/today
// GET  /workouts/:id
// POST /workouts/generate
// POST /workouts/regenerate
// POST /workouts/:planId/days/:dayId/exercises
//
// POST /workouts/sessions
// GET  /workouts/sessions/:sessionId
// POST /workouts/sessions/:sessionId/exercises
// POST /workouts/sessions/:sessionId/sets
// POST /workouts/sessions/:sessionId/complete
//
// Order matters: the fixed paths must be checked before GET /workouts/:id.

function sessionIdRequired(): Response {
	return json(
		{
			success: false,
			message: "Session ID is required",
		},
		400,
	);
}

export const workoutsRouter: Router = async (request, env, url) => {
	const { pathname } = url;

	if (
		pathname !== "/workouts" &&
		!pathname.startsWith("/workouts/")
	) {
		return null;
	}

	if (request.method === "GET") {
		switch (pathname) {
			case "/workouts":
				return getWorkouts(request, env);
			case "/workouts/stats":
				return getWorkoutStats(request, env);
			case "/workouts/weekly-progress":
				return getWeeklyProgress(request, env);
			case "/workouts/today":
				return getTodayWorkout(request, env);
		}
	}

	if (
		request.method === "POST" &&
		pathname === "/workouts/sessions"
	) {
		return startWorkoutSession(request, env);
	}

	if (pathname.startsWith("/workouts/sessions/")) {
		const parts = pathname.split("/");
		const sessionId = parts[3];

		if (request.method === "POST") {
			if (pathname.endsWith("/exercises")) {
				return sessionId
					? addSessionExercise(request, env, sessionId)
					: sessionIdRequired();
			}

			if (pathname.endsWith("/sets")) {
				return sessionId
					? recordWorkoutSet(request, env, sessionId)
					: sessionIdRequired();
			}
		}

		// /workouts/sessions/:sessionId only; deeper GET paths fall
		// through to GET /workouts/:id below.
		if (
			request.method === "GET" &&
			parts.length === 4
		) {
			return sessionId
				? getWorkoutSession(request, env, sessionId)
				: sessionIdRequired();
		}

		if (
			request.method === "POST" &&
			pathname.endsWith("/complete")
		) {
			return sessionId
				? completeWorkoutSession(request, env, sessionId)
				: sessionIdRequired();
		}
	}

	if (
		request.method === "POST" &&
		/^\/workouts\/[^/]+\/days\/[^/]+\/exercises$/.test(pathname)
	) {
		const parts = pathname.split("/");

		return addExerciseToWorkoutDay(
			request,
			env,
			parts[2],
			parts[4],
		);
	}

	if (request.method === "GET") {
		const workoutId = pathname.split("/")[2];

		if (!workoutId) {
			return json(
				{
					success: false,
					message: "Workout ID is required",
				},
				400,
			);
		}

		return getWorkoutById(request, env, workoutId);
	}

	if (request.method === "POST") {
		switch (pathname) {
			case "/workouts/regenerate":
				return regenerateWorkout(request, env);
			case "/workouts/generate":
				return generateWorkout(request, env);
		}
	}

	return null;
};
