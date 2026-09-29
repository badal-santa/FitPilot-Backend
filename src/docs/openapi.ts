// OpenAPI spec + Swagger UI for the FitPilot API.
// Keep this in sync when adding or changing routes in src/routers/.

const errorResponse = (description: string, example: string) => ({
	description,
	content: {
		"application/json": {
			schema: { $ref: "#/components/schemas/Error" },
			example: { success: false, message: example },
		},
	},
});

const serverError = errorResponse("Unexpected server error", "Something went wrong");

const unauthorized = errorResponse("Missing, invalid or expired token", "Unauthorized");

const ok = (description: string, data: object, status = "200") => ({
	[status]: {
		description,
		content: {
			"application/json": {
				schema: {
					type: "object",
					properties: {
						success: { type: "boolean", example: true },
						data,
					},
				},
			},
		},
	},
});

const paginationParams = (defaultLimit: number) => [
	{ name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
	{ name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: defaultLimit } },
];

const searchParam = (description: string) => ({
	name: "search",
	in: "query",
	description,
	schema: { type: "string" },
});

const adminList = (key: string, item: object) => ({
	type: "object",
	properties: {
		[key]: { type: "array", items: item },
		pagination: { $ref: "#/components/schemas/AdminPagination" },
	},
});

const sessionIdParam = {
	name: "sessionId",
	in: "path",
	required: true,
	schema: { type: "string", format: "uuid" },
};

export const openApiSpec = {
	openapi: "3.0.3",
	info: {
		title: "FitPilot API",
		version: "1.0.0",
		description: "FitPilot backend running on Cloudflare Workers + D1.",
	},
	// Relative, so "Try it out" calls whichever host is serving /docs.
	servers: [{ url: "/v1" }],
	tags: [
		{ name: "System", description: "Health and diagnostics" },
		{ name: "Auth", description: "Registration, login and sessions" },
		{ name: "Profile", description: "User profile and onboarding data" },
		{ name: "Exercises", description: "Exercise library" },
		{ name: "Workouts", description: "Generated workout plans" },
		{ name: "Workout Sessions", description: "Logging a workout: start, add exercises, record sets, complete" },
		{ name: "Progress", description: "Progress dashboard: streak, XP, weight, activity and calories" },
		{ name: "Notifications", description: "Push notifications (OneSignal)" },
		{ name: "App Version", description: "Update sheet config the mobile app checks on launch" },
		{ name: "Admin", description: "Admin accounts. Uses adminAuth tokens, not user tokens." },
		{ name: "Admin Dashboard", description: "Admin panel: dashboard, users, analytics and workouts pages" },
		{ name: "Admin Exercises", description: "Admin panel: manage the exercise library" },
		{ name: "Admin Notifications", description: "Admin panel: broadcast pushes and their history" },
		{ name: "Admin App Versions", description: "Admin panel: latest and minimum app version per platform" },
	],
	components: {
		securitySchemes: {
			bearerAuth: {
				type: "http",
				scheme: "bearer",
				description: "Access token returned by /auth/login, /auth/register, /auth/google or /auth/refresh",
			},
			adminAuth: {
				type: "http",
				scheme: "bearer",
				description: "Admin access token returned by /admin/auth/login (valid 7 days). User tokens don't work here.",
			},
		},
		schemas: {
			Error: {
				type: "object",
				properties: {
					success: { type: "boolean", example: false },
					message: { type: "string" },
				},
				required: ["success", "message"],
			},
			UserSummary: {
				type: "object",
				properties: {
					id: { type: "string", format: "uuid" },
					email: { type: "string", format: "email" },
					name: { type: "string", nullable: true },
				},
			},
			User: {
				type: "object",
				properties: {
					id: { type: "string", format: "uuid" },
					email: { type: "string", format: "email" },
					name: { type: "string", nullable: true },
					avatarUrl: { type: "string", nullable: true },
					dateOfBirth: { type: "string", nullable: true },
					gender: { type: "string", nullable: true },
					heightCm: { type: "number", nullable: true },
					weightKg: { type: "number", nullable: true },
					goal: { type: "string", nullable: true },
					activityLevel: { type: "string", nullable: true },
				},
			},
			ProfileUser: {
				type: "object",
				description: "Profile as stored in the database (snake_case keys)",
				properties: {
					id: { type: "string", format: "uuid" },
					email: { type: "string", format: "email" },
					name: { type: "string", nullable: true },
					avatar_url: { type: "string", nullable: true },
					date_of_birth: { type: "string", nullable: true },
					gender: { type: "string", enum: ["male", "female"], nullable: true },
					age: { type: "integer", nullable: true },
					height_cm: { type: "number", nullable: true },
					weight_kg: { type: "number", nullable: true },
					goal: {
						type: "string",
						enum: ["lose-weight", "build-muscle", "stay-fit"],
						nullable: true,
					},
					activity_level: { type: "string", nullable: true },
					workout_days: { type: "integer", nullable: true },
					reminders_enabled: { type: "boolean" },
					onboarding_completed: { type: "boolean" },
					created_at: { type: "string" },
					updated_at: { type: "string" },
				},
			},
			ProfileUpdate: {
				type: "object",
				description: "All fields optional; send at least one",
				minProperties: 1,
				properties: {
					goal: { type: "string", enum: ["lose-weight", "build-muscle", "stay-fit"] },
					gender: { type: "string", enum: ["male", "female"] },
					age: { type: "integer", minimum: 13, maximum: 100 },
					heightCm: { type: "number", minimum: 100, maximum: 250 },
					weightKg: { type: "number", minimum: 30, maximum: 300 },
					activityLevel: { type: "string" },
					workoutDays: { type: "integer", minimum: 2, maximum: 6 },
					remindersEnabled: { type: "boolean" },
					onboardingCompleted: { type: "boolean" },
				},
			},
			Exercise: {
				type: "object",
				properties: {
					id: { type: "string", example: "ex_chest_001" },
					name: { type: "string", example: "Push-up" },
					slug: { type: "string", example: "push-up" },
					description: { type: "string", nullable: true },
					category: { type: "string", example: "strength" },
					muscle_group: { type: "string", example: "chest" },
					equipment: { type: "string", nullable: true, example: "bodyweight" },
					difficulty: { type: "string", example: "beginner" },
					instructions: { type: "string", nullable: true },
					image_url: { type: "string", nullable: true },
					video_url: { type: "string", nullable: true },
				},
			},
			Pagination: {
				type: "object",
				properties: {
					page: { type: "integer", example: 1 },
					limit: { type: "integer", example: 20 },
					total: { type: "integer", example: 42 },
					totalPages: { type: "integer", example: 3 },
					hasNextPage: { type: "boolean", example: true },
				},
			},
			WorkoutPlan: {
				type: "object",
				properties: {
					id: { type: "string", format: "uuid" },
					name: { type: "string", example: "Build Muscle — 4 Day Plan" },
					description: { type: "string", nullable: true },
					goal: { type: "string", enum: ["lose-weight", "build-muscle", "stay-fit"] },
					days_per_week: { type: "integer", example: 4 },
					duration_weeks: { type: "integer", nullable: true, example: 4 },
					status: { type: "string", example: "active" },
					started_at: { type: "string", nullable: true },
					ended_at: { type: "string", nullable: true },
					created_at: { type: "string" },
					updated_at: { type: "string" },
				},
			},
			PlanExercise: {
				type: "object",
				description: "Prescribed exercise in a plan day, joined with exercise details",
				properties: {
					id: { type: "string", format: "uuid", description: "workout_plan_exercises row ID" },
					exercise_order: { type: "integer", example: 1 },
					sets: { type: "integer", nullable: true, example: 3 },
					reps: { type: "integer", nullable: true, example: 10 },
					duration_seconds: { type: "integer", nullable: true },
					rest_seconds: { type: "integer", nullable: true, example: 45 },
					target_weight_kg: { type: "number", nullable: true },
					notes: { type: "string", nullable: true },
					exercise_id: { type: "string", example: "ex_chest_001" },
					name: { type: "string" },
					slug: { type: "string" },
					description: { type: "string", nullable: true },
					category: { type: "string" },
					muscle_group: { type: "string" },
					equipment: { type: "string", nullable: true },
					difficulty: { type: "string" },
					instructions: { type: "string", nullable: true },
					image_url: { type: "string", nullable: true },
					video_url: { type: "string", nullable: true },
				},
			},
			PlanDay: {
				type: "object",
				properties: {
					id: { type: "string", format: "uuid" },
					day_number: { type: "integer", example: 1 },
					day_name: { type: "string", example: "Day 1" },
					title: { type: "string", nullable: true, example: "Chest & Triceps" },
					description: { type: "string", nullable: true },
					rest_day: { type: "boolean" },
					created_at: { type: "string" },
					exercises: { type: "array", items: { $ref: "#/components/schemas/PlanExercise" } },
				},
			},
			WorkoutPlanDetail: {
				allOf: [
					{ $ref: "#/components/schemas/WorkoutPlan" },
					{
						type: "object",
						properties: {
							days: { type: "array", items: { $ref: "#/components/schemas/PlanDay" } },
						},
					},
				],
			},
			WorkoutSet: {
				type: "object",
				properties: {
					id: { type: "string", format: "uuid" },
					setNumber: { type: "integer", example: 1 },
					reps: { type: "integer", nullable: true, example: 10 },
					weightKg: { type: "number", nullable: true, example: 40 },
					durationSeconds: { type: "integer", nullable: true },
					distanceMeters: { type: "number", nullable: true },
					completed: { type: "boolean" },
					createdAt: { type: "string" },
				},
			},
			SessionSummary: {
				type: "object",
				properties: {
					id: { type: "string", format: "uuid" },
					workoutPlanDayId: { type: "string", nullable: true },
					startedAt: { type: "string" },
					completedAt: { type: "string", nullable: true },
					status: { type: "string", enum: ["started", "completed"] },
					durationSeconds: { type: "integer", nullable: true },
					caloriesBurned: { type: "number", nullable: true },
					notes: { type: "string", nullable: true },
				},
			},
			Admin: {
				type: "object",
				properties: {
					id: { type: "string", format: "uuid" },
					email: { type: "string", format: "email" },
					name: { type: "string" },
				},
			},
			RewardEarned: {
				type: "object",
				description: "XP earned by the request that returned it",
				properties: {
					type: { type: "string", enum: ["workout_completed", "streak_milestone"] },
					xp: { type: "integer", example: 20 },
					streak: {
						type: "integer",
						description: "Only on streak_milestone: the streak length reached (3, 7, 30 or 100)",
						example: 7,
					},
				},
			},
			RewardEvent: {
				type: "object",
				description: "A reward_events row",
				properties: {
					event_type: { type: "string", enum: ["workout_completed", "streak_milestone"] },
					xp: { type: "integer", example: 150 },
					event_key: {
						type: "string",
						description: "workout:<sessionId> or streak:<days>",
						example: "streak:7",
					},
					created_at: { type: "string", example: "2026-09-28 10:15:00" },
				},
			},
			ChartPoint: {
				type: "object",
				properties: {
					label: { type: "string" },
					value: { type: "number" },
				},
			},
			Progress: {
				type: "object",
				properties: {
					period: { type: "string", enum: ["weekly", "monthly", "yearly"] },
					stats: {
						type: "object",
						properties: {
							currentStreak: {
								type: "integer",
								description: "Consecutive days with a completed workout, ending today (or yesterday if none today yet)",
								example: 4,
							},
							totalWorkouts: { type: "integer", description: "Completed sessions in the period", example: 3 },
							avgCaloriesPerDay: { type: "integer", description: "Period calories / days elapsed so far", example: 125 },
						},
					},
					rewards: {
						type: "object",
						description: "All-time XP. Not limited to the period.",
						properties: {
							totalXp: { type: "integer", example: 230 },
							totalRewards: { type: "integer", description: "Number of reward events", example: 9 },
							history: {
								type: "array",
								description: "The 10 most recent reward events, newest first",
								items: { $ref: "#/components/schemas/RewardEvent" },
							},
						},
					},
					weight: {
						type: "object",
						properties: {
							current: { type: "number", description: "Latest weight log, else profile weight, else 0", example: 79.2 },
							delta: { type: "number", description: "Last minus first point in the period, 1 decimal", example: -0.8 },
							points: {
								type: "array",
								description: "Weight logs in the period (label MM-DD). If none, a single point labelled \"Now\".",
								items: { $ref: "#/components/schemas/ChartPoint" },
							},
						},
					},
					activity: {
						type: "object",
						properties: {
							activeCount: { type: "integer", description: "Bars with value 1", example: 3 },
							total: { type: "integer", description: "7 (weekly), days in month (monthly) or 12 (yearly)", example: 7 },
							unitLabel: { type: "string", enum: ["days", "months"] },
							bars: {
								type: "array",
								description: "Weekly: M..S labels. Monthly: 1..31. Yearly: Jan..Dec. value is 1 if any workout, else 0.",
								items: { $ref: "#/components/schemas/ChartPoint" },
							},
						},
					},
					calories: {
						type: "object",
						properties: {
							total: { type: "number", example: 500 },
							average: { type: "integer", description: "Same as stats.avgCaloriesPerDay", example: 125 },
							bars: {
								type: "array",
								description: "Same labels as activity.bars; value is calories burned",
								items: { $ref: "#/components/schemas/ChartPoint" },
							},
						},
					},
				},
			},
			Tokens: {
				type: "object",
				properties: {
					accessToken: { type: "string" },
					refreshToken: { type: "string" },
					expiresIn: {
						type: "integer",
						description: "Access token lifetime in seconds",
						example: 604800,
					},
				},
			},
			AuthResponse: {
				allOf: [
					{ $ref: "#/components/schemas/Tokens" },
					{
						type: "object",
						properties: {
							success: { type: "boolean", example: true },
							message: { type: "string" },
							user: { $ref: "#/components/schemas/UserSummary" },
						},
					},
				],
			},
			AdminPagination: {
				type: "object",
				description: "Admin lists have no hasNextPage; compare page with totalPages",
				properties: {
					page: { type: "integer", example: 1 },
					limit: { type: "integer", example: 10 },
					total: { type: "integer", example: 42 },
					totalPages: { type: "integer", example: 5 },
				},
			},
			AppVersion: {
				type: "object",
				properties: {
					platform: { type: "string", enum: ["android", "ios"] },
					latestVersion: {
						type: "string",
						example: "1.2.0",
						description: "Installed version below this → optional update",
					},
					minVersion: {
						type: "string",
						example: "1.0.0",
						description: "Installed version below this → forced update",
					},
					storeUrl: { type: "string", nullable: true },
					releaseNotes: { type: "string", nullable: true },
					updatedAt: { type: "string", example: "2026-09-28 10:15:00" },
					updatedBy: { type: "string", nullable: true, description: "Email of the admin who last saved it" },
				},
			},
			AppVersionUpdate: {
				type: "object",
				required: ["latestVersion", "minVersion"],
				properties: {
					latestVersion: { type: "string", pattern: "^\\d+\\.\\d+\\.\\d+$", example: "1.2.0" },
					minVersion: {
						type: "string",
						pattern: "^\\d+\\.\\d+\\.\\d+$",
						example: "1.0.0",
						description: "Must not be higher than latestVersion",
					},
					storeUrl: {
						type: "string",
						nullable: true,
						description: "Must start with http:// or https://",
						example: "https://play.google.com/store/apps/details?id=com.anonymous.aihealthfitness",
					},
					releaseNotes: { type: "string", nullable: true },
				},
			},
			AdminExercise: {
				allOf: [
					{ $ref: "#/components/schemas/Exercise" },
					{
						type: "object",
						properties: {
							is_active: { type: "integer", enum: [0, 1], description: "0 = deactivated, hidden from the app" },
							created_at: { type: "string" },
							updated_at: { type: "string" },
						},
					},
				],
			},
			ExerciseInput: {
				type: "object",
				description:
					"The slug is made from the name. muscle_group is stored lowercase with hyphens (\"Full Body\" → \"full-body\"). " +
					"PUT replaces every field, so send the whole exercise.",
				required: ["name", "category", "muscle_group", "difficulty"],
				properties: {
					name: { type: "string", maxLength: 150, example: "Push-up" },
					description: { type: "string", nullable: true },
					category: { type: "string", example: "strength" },
					muscle_group: { type: "string", example: "chest" },
					equipment: { type: "string", nullable: true, example: "bodyweight" },
					difficulty: { type: "string", example: "beginner" },
					instructions: { type: "string", nullable: true },
					image_url: { type: "string", nullable: true },
					video_url: { type: "string", nullable: true },
					is_active: { type: "integer", enum: [0, 1], default: 1 },
				},
			},
			AdminUser: {
				type: "object",
				properties: {
					id: { type: "string", format: "uuid" },
					name: { type: "string", nullable: true },
					email: { type: "string", format: "email" },
					goal: { type: "string", nullable: true },
					onboarding_completed: { type: "integer", enum: [0, 1] },
					reminders_enabled: { type: "integer", enum: [0, 1] },
					created_at: { type: "string" },
					auth_provider: {
						type: "string",
						enum: ["email", "google", "both"],
						description: "How the user can sign in",
					},
				},
			},
			AdminWorkout: {
				type: "object",
				description: "A workout session joined with its user",
				properties: {
					id: { type: "string", format: "uuid" },
					user_id: { type: "string", format: "uuid" },
					user_name: { type: "string", nullable: true },
					user_email: { type: "string", nullable: true },
					workout_plan_day_id: { type: "string", nullable: true },
					started_at: { type: "string" },
					completed_at: { type: "string", nullable: true },
					status: { type: "string", enum: ["started", "completed"] },
					duration_seconds: { type: "integer", nullable: true },
					calories_burned: { type: "number", nullable: true },
					notes: { type: "string", nullable: true },
					created_at: { type: "string" },
				},
			},
			NotificationHistoryItem: {
				type: "object",
				properties: {
					id: { type: "string", format: "uuid" },
					title: { type: "string" },
					message: { type: "string" },
					audience: { type: "string", example: "all" },
					status: { type: "string", example: "sent" },
					onesignal_id: { type: "string", nullable: true },
					sent_by: { type: "string", nullable: true, description: "Admin ID" },
					created_at: { type: "string", example: "2026-09-28 10:15:00" },
				},
			},
		},
	},
	paths: {
		"/": {
			get: {
				tags: ["System"],
				security: [],
				summary: "API info",
				responses: { "200": { description: "API is running" } },
			},
		},
		"/health": {
			get: {
				tags: ["System"],
				security: [],
				summary: "Health check",
				responses: { "200": { description: "Service is healthy" } },
			},
		},
		"/test-db": {
			get: {
				tags: ["System"],
				security: [],
				summary: "List database tables",
				responses: { "200": { description: "Tables in the D1 database" } },
			},
		},
		"/auth/register": {
			post: {
				tags: ["Auth"],
				security: [],
				summary: "Create an account",
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["email", "password"],
								properties: {
									email: { type: "string", format: "email" },
									password: { type: "string", minLength: 6 },
									name: { type: "string" },
								},
							},
							example: { email: "jane@example.com", password: "secret123", name: "Jane" },
						},
					},
				},
				responses: {
					"201": {
						description: "Account created",
						content: {
							"application/json": {
								schema: {
									allOf: [
										{ $ref: "#/components/schemas/AuthResponse" },
										{ type: "object", properties: { isNewUser: { type: "boolean", example: true } } },
									],
								},
							},
						},
					},
					"400": errorResponse("Invalid body or validation failed", "Email is required"),
					"409": errorResponse("Email already registered", "An account with this email already exists"),
				},
			},
		},
		"/auth/login": {
			post: {
				tags: ["Auth"],
				security: [],
				summary: "Log in with email and password",
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["email", "password"],
								properties: {
									email: { type: "string", format: "email" },
									password: { type: "string" },
								},
							},
							example: { email: "jane@example.com", password: "secret123" },
						},
					},
				},
				responses: {
					"200": {
						description: "Logged in",
						content: {
							"application/json": { schema: { $ref: "#/components/schemas/AuthResponse" } },
						},
					},
					"400": errorResponse("Missing or invalid fields", "Email and password are required"),
					"401": errorResponse("Wrong credentials", "Invalid email or password"),
					"500": serverError,
				},
			},
		},
		"/auth/google": {
			post: {
				tags: ["Auth"],
				security: [],
				summary: "Sign in with Google",
				description:
					"Send the Google ID token from the app's Google sign-in. Creates the account on first sign-in; " +
					"if a password account already has the same verified email, Google is linked to it. " +
					"The token's audience must be one of the GOOGLE_CLIENT_IDS secret.",
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["idToken"],
								properties: {
									idToken: { type: "string", description: "Google ID token (JWT)" },
								},
							},
						},
					},
				},
				responses: {
					"200": {
						description: "Signed in",
						content: {
							"application/json": {
								schema: {
									allOf: [
										{ $ref: "#/components/schemas/AuthResponse" },
										{
											type: "object",
											properties: {
												isNewUser: {
													type: "boolean",
													description: "true when this call created the account (message is \"Account created\")",
												},
											},
										},
									],
								},
							},
						},
					},
					"400": errorResponse("idToken missing", "idToken is required"),
					"401": errorResponse("Token invalid, expired or for another app", "Google sign-in failed. Please try again."),
					"409": errorResponse(
						"The email is already linked to a different Google account",
						"This email is linked to a different Google account",
					),
					"500": errorResponse("GOOGLE_CLIENT_IDS not set, or unexpected error", "Google sign-in is not available right now"),
				},
			},
		},
		"/auth/refresh": {
			post: {
				tags: ["Auth"],
				security: [],
				summary: "Rotate access and refresh tokens",
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["refreshToken"],
								properties: { refreshToken: { type: "string" } },
							},
						},
					},
				},
				responses: {
					"200": {
						description: "New token pair",
						content: {
							"application/json": {
								schema: {
									allOf: [
										{ $ref: "#/components/schemas/Tokens" },
										{ type: "object", properties: { success: { type: "boolean", example: true } } },
									],
								},
							},
						},
					},
					"400": errorResponse("Missing refresh token", "Refresh token is required"),
					"401": errorResponse("Invalid or expired refresh token", "Invalid refresh token"),
					"500": serverError,
				},
			},
		},
		"/auth/logout": {
			post: {
				tags: ["Auth"],
				summary: "End the current session",
				security: [{ bearerAuth: [] }],
				responses: {
					"200": {
						description: "Logged out",
						content: {
							"application/json": {
								example: { success: true, message: "Logged out successfully" },
							},
						},
					},
					"401": errorResponse("Missing or invalid token", "Invalid or expired session"),
					"500": serverError,
				},
			},
		},
		"/auth/me": {
			get: {
				tags: ["Auth"],
				summary: "Get the current user",
				security: [{ bearerAuth: [] }],
				responses: {
					"200": {
						description: "Current user profile",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										success: { type: "boolean", example: true },
										user: { $ref: "#/components/schemas/User" },
									},
								},
							},
						},
					},
					"401": errorResponse("Missing, invalid or expired token", "Access token expired"),
					"500": serverError,
				},
			},
		},
		"/profile": {
			get: {
				tags: ["Profile"],
				summary: "Get the current user's profile",
				security: [{ bearerAuth: [] }],
				responses: {
					"200": {
						description: "Profile",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										success: { type: "boolean", example: true },
										user: { $ref: "#/components/schemas/ProfileUser" },
									},
								},
							},
						},
					},
					"401": errorResponse("Missing, invalid or expired token", "Invalid or expired session"),
					"404": errorResponse("User no longer exists", "User not found"),
					"500": serverError,
				},
			},
			put: {
				tags: ["Profile"],
				summary: "Update profile / onboarding fields",
				security: [{ bearerAuth: [] }],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/ProfileUpdate" },
							example: {
								goal: "build-muscle",
								gender: "male",
								age: 25,
								heightCm: 178,
								weightKg: 72,
								activityLevel: "moderate",
								workoutDays: 4,
								remindersEnabled: true,
								onboardingCompleted: true,
							},
						},
					},
				},
				responses: {
					"200": {
						description: "Updated profile",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										success: { type: "boolean", example: true },
										message: { type: "string", example: "Profile updated successfully" },
										user: { $ref: "#/components/schemas/ProfileUser" },
									},
								},
							},
						},
					},
					"400": errorResponse("Validation failed or empty body", "Workout days must be between 2 and 6"),
					"401": errorResponse("Missing, invalid or expired token", "Invalid or expired session"),
					"500": serverError,
				},
			},
		},
		"/exercises": {
			get: {
				tags: ["Exercises"],
				security: [],
				summary: "List exercises",
				description: "Active exercises sorted by name. Filters are exact matches and can be combined.",
				parameters: [
					{ name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
					{ name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
					{ name: "muscleGroup", in: "query", schema: { type: "string" }, example: "chest" },
					{ name: "category", in: "query", schema: { type: "string" }, example: "strength" },
					{ name: "difficulty", in: "query", schema: { type: "string" }, example: "beginner" },
					{ name: "equipment", in: "query", schema: { type: "string" }, example: "dumbbell" },
				],
				responses: {
					"200": {
						description: "Page of exercises",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										success: { type: "boolean", example: true },
										data: { type: "array", items: { $ref: "#/components/schemas/Exercise" } },
										pagination: { $ref: "#/components/schemas/Pagination" },
									},
								},
							},
						},
					},
					"500": serverError,
				},
			},
		},
		"/exercises/{id}": {
			get: {
				tags: ["Exercises"],
				security: [],
				summary: "Get an exercise by ID",
				parameters: [
					{ name: "id", in: "path", required: true, schema: { type: "string" }, example: "ex_chest_001" },
				],
				responses: {
					"200": {
						description: "Exercise",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										success: { type: "boolean", example: true },
										data: { $ref: "#/components/schemas/Exercise" },
									},
								},
							},
						},
					},
					"404": errorResponse("Not found or inactive", "Exercise not found"),
					"500": serverError,
				},
			},
		},
		"/workouts": {
			get: {
				tags: ["Workouts"],
				summary: "List the user's workout plans",
				description: "Newest first. Does not include days or exercises; use GET /workouts/{id} for that.",
				security: [{ bearerAuth: [] }],
				responses: {
					...ok("Workout plans", { type: "array", items: { $ref: "#/components/schemas/WorkoutPlan" } }),
					"401": unauthorized,
					"500": serverError,
				},
			},
		},
		"/workouts/generate": {
			post: {
				tags: ["Workouts"],
				summary: "Generate a workout plan from the user's profile",
				description:
					"Builds a 4-week plan from the profile's goal and workout_days (default 5). " +
					"If the user already has an active plan, that plan is returned and nothing new is created. " +
					"No request body.",
				security: [{ bearerAuth: [] }],
				responses: {
					...ok("Generated (or existing active) plan with days and exercises", {
						$ref: "#/components/schemas/WorkoutPlanDetail",
					}),
					"400": errorResponse("Onboarding not completed or goal missing", "Please complete onboarding first"),
					"401": unauthorized,
					"404": errorResponse("User no longer exists", "User not found"),
					"500": errorResponse("Generation failed", "Unable to generate workout plan"),
				},
			},
		},
		"/workouts/regenerate": {
			post: {
				tags: ["Workouts"],
				summary: "Replace the active plan with a newly generated one",
				description:
					"Marks the current active plan (if any) as completed, then generates a new plan from the " +
					"user's current profile, same as POST /workouts/generate. No request body.",
				security: [{ bearerAuth: [] }],
				responses: {
					...ok("Newly generated plan with days and exercises", {
						$ref: "#/components/schemas/WorkoutPlanDetail",
					}),
					"400": errorResponse("Onboarding not completed or goal missing", "Please complete onboarding first"),
					"401": unauthorized,
					"404": errorResponse("User no longer exists", "User not found"),
					"500": errorResponse("Generation failed", "Unable to regenerate workout plan"),
				},
			},
		},
		"/workouts/stats": {
			get: {
				tags: ["Workouts"],
				summary: "Workout totals for the dashboard",
				description: "Counts completed sessions only. \"Today\" and \"this week\" (Monday to Sunday) use UTC dates.",
				security: [{ bearerAuth: [] }],
				responses: {
					...ok("Stats", {
						type: "object",
						properties: {
							workoutsCompleted: { type: "integer", description: "All-time completed sessions", example: 12 },
							caloriesToday: { type: "number", description: "Sum of caloriesBurned for sessions completed today", example: 320 },
							weeklyWorkouts: { type: "integer", description: "Sessions completed this week", example: 3 },
							currentStreak: { type: "integer", description: "Consecutive days (UTC) with a completed workout, counting from today or yesterday", example: 4 },
						},
					}),
					"401": unauthorized,
				},
			},
		},
		"/workouts/weekly-progress": {
			get: {
				tags: ["Workouts"],
				summary: "Which days this week had a completed workout",
				description: "Always returns 7 entries, Monday to Sunday of the current week (UTC).",
				security: [{ bearerAuth: [] }],
				responses: {
					...ok("Weekly progress", {
						type: "object",
						properties: {
							days: {
								type: "array",
								minItems: 7,
								maxItems: 7,
								items: {
									type: "object",
									properties: {
										day: { type: "string", description: "First letter of the weekday", example: "M" },
										date: { type: "string", format: "date", example: "2026-09-21" },
										completed: { type: "boolean" },
										value: { type: "integer", enum: [0, 1], description: "1 if completed, for charts" },
									},
								},
							},
							daysTrained: { type: "integer", example: 3 },
							totalDays: { type: "integer", example: 7 },
						},
					}),
					"401": unauthorized,
				},
			},
		},
		"/workouts/today": {
			get: {
				tags: ["Workouts"],
				summary: "Get today's workout from the active plan",
				description:
					"Monday is day 1, Tuesday day 2, and so on. Sunday, or any weekday beyond the plan's days_per_week, " +
					"is a rest day (isRestDay: true, day: null). Weekday uses the server's clock (UTC).",
				security: [{ bearerAuth: [] }],
				responses: {
					...ok("Today's workout", {
						type: "object",
						properties: {
							plan: { $ref: "#/components/schemas/WorkoutPlan" },
							isRestDay: { type: "boolean" },
							day: {
								type: "object",
								nullable: true,
								properties: {
									id: { type: "string", format: "uuid", description: "Pass as workoutPlanDayId to start a session" },
									dayNumber: { type: "integer" },
									dayName: { type: "string" },
									title: { type: "string", nullable: true },
									description: { type: "string", nullable: true },
								},
							},
							session: {
								type: "object",
								nullable: true,
								description: "Most recent session for this plan day, or null if none",
								properties: {
									id: { type: "string", format: "uuid" },
									startedAt: { type: "string" },
									completedAt: { type: "string", nullable: true },
									status: { type: "string", enum: ["started", "completed"] },
									durationSeconds: { type: "integer", nullable: true },
									caloriesBurned: { type: "number", nullable: true },
									notes: { type: "string", nullable: true },
								},
							},
							workoutStatus: {
								type: "string",
								enum: ["not_started", "started", "completed"],
								description: "session.status, or not_started when there is no session. Not returned on rest days.",
							},
							exercises: { type: "array", items: { $ref: "#/components/schemas/PlanExercise" } },
						},
					}),
					"401": unauthorized,
					"404": errorResponse("No active plan, or today's day is missing", "No active workout plan found"),
				},
			},
		},
		"/workouts/{id}": {
			get: {
				tags: ["Workouts"],
				summary: "Get a workout plan with its days and exercises",
				security: [{ bearerAuth: [] }],
				parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
				responses: {
					...ok("Workout plan", { $ref: "#/components/schemas/WorkoutPlanDetail" }),
					"401": unauthorized,
					"404": errorResponse("Plan not found or not yours", "Workout plan not found"),
					"500": serverError,
				},
			},
		},
		"/workouts/{id}/days/{dayId}/exercises": {
			post: {
				tags: ["Workouts"],
				summary: "Add an exercise to a day of the active plan",
				description:
					"Appends an exercise from the library to the end of a plan day. The plan must be yours and active. " +
					"Defaults: sets 3, reps 10, restSeconds 45, notes \"Added from exercise library.\"",
				security: [{ bearerAuth: [] }],
				parameters: [
					{ name: "id", in: "path", required: true, description: "Workout plan ID", schema: { type: "string", format: "uuid" } },
					{ name: "dayId", in: "path", required: true, description: "Plan day ID", schema: { type: "string", format: "uuid" } },
				],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["exerciseId"],
								properties: {
									exerciseId: { type: "string", example: "ex_chest_001" },
									sets: { type: "integer", default: 3 },
									reps: { type: "integer", default: 10 },
									durationSeconds: { type: "integer" },
									restSeconds: { type: "integer", default: 45 },
									targetWeightKg: { type: "number" },
									notes: { type: "string" },
								},
							},
							example: { exerciseId: "ex_chest_001", sets: 4, reps: 8, targetWeightKg: 50 },
						},
					},
				},
				responses: {
					"201": {
						description: "Exercise added",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										success: { type: "boolean", example: true },
										message: { type: "string", example: "Exercise added to workout" },
										data: {
											type: "object",
											properties: {
												id: { type: "string", format: "uuid", description: "workout_plan_exercises row ID" },
												exerciseOrder: { type: "integer" },
												sets: { type: "integer" },
												reps: { type: "integer" },
												restSeconds: { type: "integer" },
												targetWeightKg: { type: "number", nullable: true },
												day: {
													type: "object",
													properties: {
														id: { type: "string" },
														dayNumber: { type: "integer" },
														dayName: { type: "string" },
														title: { type: "string", nullable: true },
													},
												},
												exercise: {
													type: "object",
													properties: {
														id: { type: "string" },
														name: { type: "string" },
														slug: { type: "string" },
														category: { type: "string" },
														muscle_group: { type: "string" },
														equipment: { type: "string", nullable: true },
														difficulty: { type: "string" },
													},
												},
											},
										},
									},
								},
							},
						},
					},
					"400": errorResponse("exerciseId missing", "exerciseId is required"),
					"401": unauthorized,
					"404": errorResponse("Plan (active, yours), day or exercise not found", "Workout day not found"),
					"409": errorResponse("Exercise already on this day", "Exercise already exists in this workout day"),
					"500": errorResponse("Unexpected error, including invalid JSON body", "Unable to add exercise to workout"),
				},
			},
		},
		"/workouts/sessions": {
			post: {
				tags: ["Workout Sessions"],
				summary: "Start a workout session",
				description:
					"Starts a session for a day in the active plan. If the user already has a session in progress, " +
					"that one is returned with resumed: true (status 200) instead of creating a new one.",
				security: [{ bearerAuth: [] }],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["workoutPlanDayId"],
								properties: { workoutPlanDayId: { type: "string", format: "uuid" } },
							},
						},
					},
				},
				responses: {
					...ok(
						"Session created",
						{
							type: "object",
							properties: {
								id: { type: "string", format: "uuid" },
								workoutPlanDayId: { type: "string" },
								dayNumber: { type: "integer" },
								title: { type: "string", nullable: true },
								startedAt: { type: "string" },
								status: { type: "string", example: "started" },
								resumed: { type: "boolean", example: false },
							},
						},
						"201",
					),
					...ok("Existing in-progress session resumed", {
						type: "object",
						properties: {
							id: { type: "string", format: "uuid" },
							workoutPlanDayId: { type: "string", nullable: true },
							startedAt: { type: "string" },
							status: { type: "string", example: "started" },
							resumed: { type: "boolean", example: true },
						},
					}),
					"400": errorResponse("Missing workoutPlanDayId, bad JSON, or rest day", "workoutPlanDayId is required"),
					"401": unauthorized,
					"404": errorResponse("Day not found in an active plan of yours", "Workout day not found"),
				},
			},
		},
		"/workouts/sessions/{sessionId}": {
			get: {
				tags: ["Workout Sessions"],
				summary: "Get a session with its exercises and sets",
				security: [{ bearerAuth: [] }],
				parameters: [sessionIdParam],
				responses: {
					...ok("Session detail", {
						allOf: [
							{ $ref: "#/components/schemas/SessionSummary" },
							{
								type: "object",
								properties: {
									day: {
										type: "object",
										properties: {
											dayNumber: { type: "integer", nullable: true },
											dayName: { type: "string", nullable: true },
											title: { type: "string", nullable: true },
											description: { type: "string", nullable: true },
										},
									},
									exercises: {
										type: "array",
										items: {
											type: "object",
											properties: {
												id: { type: "string", format: "uuid", description: "sessionExerciseId, used when recording sets" },
												exercise_id: { type: "string" },
												exercise_order: { type: "integer" },
												name: { type: "string" },
												slug: { type: "string" },
												description: { type: "string", nullable: true },
												category: { type: "string" },
												muscle_group: { type: "string" },
												equipment: { type: "string", nullable: true },
												difficulty: { type: "string" },
												instructions: { type: "string", nullable: true },
												image_url: { type: "string", nullable: true },
												video_url: { type: "string", nullable: true },
												sets: { type: "array", items: { $ref: "#/components/schemas/WorkoutSet" } },
											},
										},
									},
								},
							},
						],
					}),
					"401": unauthorized,
					"404": errorResponse("Session not found or not yours", "Workout session not found"),
				},
			},
		},
		"/workouts/sessions/{sessionId}/exercises": {
			post: {
				tags: ["Workout Sessions"],
				summary: "Add an exercise to an in-progress session",
				security: [{ bearerAuth: [] }],
				parameters: [sessionIdParam],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["exerciseId", "exerciseOrder"],
								properties: {
									exerciseId: { type: "string", example: "ex_chest_001" },
									exerciseOrder: { type: "integer", minimum: 1, example: 1 },
								},
							},
						},
					},
				},
				responses: {
					...ok(
						"Exercise added",
						{
							type: "object",
							properties: {
								id: { type: "string", format: "uuid", description: "sessionExerciseId" },
								workoutSessionId: { type: "string" },
								exerciseId: { type: "string" },
								exerciseOrder: { type: "integer" },
								exercise: {
									type: "object",
									properties: {
										id: { type: "string" },
										name: { type: "string" },
										slug: { type: "string" },
										muscleGroup: { type: "string" },
										equipment: { type: "string", nullable: true },
										difficulty: { type: "string" },
									},
								},
							},
						},
						"201",
					),
					"400": errorResponse("Validation failed or session not active", "exerciseOrder must be a positive integer"),
					"401": unauthorized,
					"404": errorResponse("Session or exercise not found", "Exercise not found"),
					"409": {
						description: "Exercise is already in this session; data.id is the existing sessionExerciseId",
						content: {
							"application/json": {
								example: {
									success: false,
									message: "Exercise already exists in this session",
									data: { id: "3f0c…" },
								},
							},
						},
					},
				},
			},
		},
		"/workouts/sessions/{sessionId}/sets": {
			post: {
				tags: ["Workout Sessions"],
				summary: "Record a set for an exercise in the session",
				security: [{ bearerAuth: [] }],
				parameters: [sessionIdParam],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["sessionExerciseId", "setNumber"],
								properties: {
									sessionExerciseId: { type: "string", format: "uuid" },
									setNumber: { type: "integer", minimum: 1 },
									reps: { type: "integer", nullable: true },
									weightKg: { type: "number", nullable: true },
									durationSeconds: { type: "integer", nullable: true },
									distanceMeters: { type: "number", nullable: true },
									completed: { type: "boolean", default: true },
								},
							},
							example: { sessionExerciseId: "3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90", setNumber: 1, reps: 10, weightKg: 40 },
						},
					},
				},
				responses: {
					...ok(
						"Set recorded",
						{
							type: "object",
							properties: {
								id: { type: "string", format: "uuid" },
								workoutSessionId: { type: "string" },
								sessionExerciseId: { type: "string" },
								exercise: {
									type: "object",
									properties: { id: { type: "string" }, name: { type: "string" } },
								},
								setNumber: { type: "integer" },
								reps: { type: "integer", nullable: true },
								weightKg: { type: "number", nullable: true },
								durationSeconds: { type: "integer", nullable: true },
								distanceMeters: { type: "number", nullable: true },
								completed: { type: "boolean" },
							},
						},
						"201",
					),
					"400": errorResponse("Validation failed or session not active", "setNumber must be a positive integer"),
					"401": unauthorized,
					"404": errorResponse("Session or session exercise not found", "Session exercise not found"),
					"409": errorResponse("Set number already recorded for this exercise", "This set number already exists"),
				},
			},
		},
		"/workouts/sessions/{sessionId}/complete": {
			post: {
				tags: ["Workout Sessions"],
				summary: "Complete a session",
				description:
					"Duration is calculated from startedAt. The body is optional, but must be valid JSON if sent (send {} if empty). " +
					"Awards 20 XP for the workout, plus a one-time bonus when the streak reaches 3 (50 XP), 7 (150), 30 (500) or 100 (2000) days.",
				security: [{ bearerAuth: [] }],
				parameters: [sessionIdParam],
				requestBody: {
					required: false,
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									caloriesBurned: { type: "number", minimum: 0, nullable: true },
									notes: { type: "string", nullable: true },
								},
							},
							example: { caloriesBurned: 320, notes: "Felt strong today" },
						},
					},
				},
				responses: {
					...ok("Session completed", {
						allOf: [
							{ $ref: "#/components/schemas/SessionSummary" },
							{
								type: "object",
								properties: {
									currentStreak: { type: "integer", description: "Streak after this workout", example: 7 },
									rewards: {
										type: "array",
										description: "What this workout earned; show it on the completion screen",
										items: { $ref: "#/components/schemas/RewardEarned" },
										example: [
											{ type: "workout_completed", xp: 20 },
											{ type: "streak_milestone", xp: 150, streak: 7 },
										],
									},
									totalXpEarned: { type: "integer", description: "Sum of rewards[].xp", example: 170 },
								},
							},
						],
					}),
					"400": errorResponse("Already completed, bad JSON, or invalid calories", "Workout session is already completed"),
					"401": unauthorized,
					"404": errorResponse("Session not found or not yours", "Workout session not found"),
				},
			},
		},
		"/progress": {
			get: {
				tags: ["Progress"],
				summary: "Progress dashboard for a period",
				description:
					"Periods run from the start of the current week (Monday), month or year up to now, in UTC. " +
					"Note: errors on this route use an `error` field instead of `message`.",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "period",
						in: "query",
						schema: { type: "string", enum: ["weekly", "monthly", "yearly"], default: "weekly" },
					},
				],
				responses: {
					...ok("Progress data", { $ref: "#/components/schemas/Progress" }),
					"400": {
						description: "Unknown period",
						content: { "application/json": { example: { success: false, error: "Invalid period" } } },
					},
					"401": {
						description: "Missing, invalid or expired token",
						content: { "application/json": { example: { success: false, error: "Unauthorized" } } },
					},
					"500": {
						description: "Unexpected server error",
						content: { "application/json": { example: { success: false, error: "Failed to get progress" } } },
					},
				},
			},
		},
		"/notifications": {
			get: {
				tags: ["Notifications"],
				summary: "List notifications for the in-app inbox",
				description:
					"Broadcast notifications sent to all users, newest first. Per-user test pushes are not included.",
				security: [{ bearerAuth: [] }],
				parameters: [
					{ name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
					{ name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
				],
				responses: {
					...ok("Page of notifications", {
						type: "object",
						properties: {
							notifications: {
								type: "array",
								items: {
									type: "object",
									properties: {
										id: { type: "string", example: "5f0c3a52-9d1e-4b7a-8a1f-2c6e9b7d4e10" },
										title: { type: "string", example: "New workouts are live" },
										message: { type: "string", example: "Check out this week's plan." },
										created_at: { type: "string", example: "2026-09-28 10:15:00" },
									},
								},
							},
							pagination: { $ref: "#/components/schemas/Pagination" },
						},
					}),
					"401": unauthorized,
					"500": errorResponse("Unexpected server error", "Failed to load notifications"),
				},
			},
		},
		"/notifications/test": {
			post: {
				tags: ["Notifications"],
				summary: "Send a test push notification to yourself",
				description:
					"Sends \"Your backend notification system is working!\" via OneSignal to the device(s) registered " +
					"with your user ID as external_id. No request body. data is OneSignal's raw response.",
				security: [{ bearerAuth: [] }],
				responses: {
					...ok("Sent", {
						type: "object",
						description: "OneSignal API response",
						example: { id: "b98881cc-1e94-4366-bbd9-db8f3429292b", external_id: null },
					}),
					"401": unauthorized,
					"500": errorResponse("OneSignal rejected the request", "Failed to send notification"),
				},
			},
		},
		"/app/version": {
			get: {
				tags: ["App Version"],
				security: [],
				summary: "Get the update sheet config for a platform",
				description: "Public. The app calls this on launch and compares its installed version with latestVersion and minVersion.",
				parameters: [
					{
						name: "platform",
						in: "query",
						required: true,
						schema: { type: "string", enum: ["android", "ios"] },
					},
				],
				responses: {
					...ok("Version config", { $ref: "#/components/schemas/AppVersion" }),
					"400": errorResponse("platform missing or not android/ios", "platform must be android or ios"),
					"404": errorResponse("No row for this platform", "No version configured for this platform"),
					"500": errorResponse("Unexpected server error", "Failed to load app version"),
				},
			},
		},
		"/admin/setup": {
			post: {
				tags: ["Admin"],
				security: [],
				summary: "Create the first admin account (one-time)",
				description:
					"Only works while there are no admins. After the first admin exists it always returns 403. " +
					"Public: no token required.",
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["name", "email", "password"],
								properties: {
									name: { type: "string" },
									email: { type: "string", format: "email" },
									password: { type: "string" },
								},
							},
							example: { name: "Admin", email: "admin@example.com", password: "a-strong-password" },
						},
					},
				},
				responses: {
					"200": {
						description: "Admin created",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										success: { type: "boolean", example: true },
										message: { type: "string", example: "Admin account created successfully" },
										data: { $ref: "#/components/schemas/Admin" },
									},
								},
							},
						},
					},
					"400": errorResponse("Missing fields", "Name, email and password are required"),
					"403": errorResponse("An admin already exists", "Admin setup has already been completed"),
					"500": errorResponse("Unexpected error, including invalid JSON body", "Failed to create admin account"),
				},
			},
		},
		"/admin/auth/login": {
			post: {
				tags: ["Admin"],
				security: [],
				summary: "Admin login",
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["email", "password"],
								properties: {
									email: { type: "string", format: "email" },
									password: { type: "string" },
								},
							},
						},
					},
				},
				responses: {
					...ok("Logged in. Use accessToken with the adminAuth scheme.", {
						type: "object",
						properties: {
							admin: { $ref: "#/components/schemas/Admin" },
							accessToken: { type: "string" },
							expiresAt: { type: "string", format: "date-time" },
						},
					}),
					"400": errorResponse("Missing fields or invalid JSON", "Email and password are required"),
					"401": errorResponse("Wrong credentials", "Invalid email or password"),
				},
			},
		},
		"/admin/auth/me": {
			get: {
				tags: ["Admin"],
				summary: "Get the current admin",
				security: [{ adminAuth: [] }],
				responses: {
					...ok("Current admin", { $ref: "#/components/schemas/Admin" }),
					"401": unauthorized,
				},
			},
		},
		"/admin/auth/logout": {
			post: {
				tags: ["Admin"],
				summary: "Admin logout",
				description: "Deletes the admin session for the token, if any. Always returns 200.",
				security: [{ adminAuth: [] }],
				responses: {
					"200": {
						description: "Logged out",
						content: {
							"application/json": {
								example: { success: true, message: "Admin logged out successfully" },
							},
						},
					},
				},
			},
		},
		"/admin/dashboard": {
			get: {
				tags: ["Admin Dashboard"],
				summary: "Dashboard totals",
				description: "Dates are UTC. workoutsToday and workoutsThisWeek count completed sessions.",
				security: [{ adminAuth: [] }],
				responses: {
					...ok("Totals", {
						type: "object",
						properties: {
							totalUsers: { type: "integer", example: 120 },
							newUsersToday: { type: "integer", example: 3 },
							workoutsToday: { type: "integer", example: 14 },
							workoutsThisWeek: { type: "integer", example: 61, description: "Monday to Sunday" },
							remindersEnabled: { type: "integer", example: 95 },
							onboardingCompleted: { type: "integer", example: 88 },
						},
					}),
					"401": unauthorized,
					"500": errorResponse("Unexpected server error", "Failed to load dashboard"),
				},
			},
		},
		"/admin/users": {
			get: {
				tags: ["Admin Dashboard"],
				summary: "List users",
				description: "Newest first.",
				security: [{ adminAuth: [] }],
				parameters: [...paginationParams(10), searchParam("Matches name or email")],
				responses: {
					...ok("Page of users", adminList("users", { $ref: "#/components/schemas/AdminUser" })),
					"401": unauthorized,
					"500": errorResponse("Unexpected server error", "Failed to load users"),
				},
			},
		},
		"/admin/analytics": {
			get: {
				tags: ["Admin Dashboard"],
				summary: "Workouts and sign-ups over the last 7 days",
				description:
					"One row per day from 6 days ago to today (UTC), oldest first. Days with a count of 0 are left out, so fill the gaps on the chart.",
				security: [{ adminAuth: [] }],
				responses: {
					...ok("Daily counts", {
						type: "object",
						properties: {
							workoutActivity: {
								type: "array",
								items: {
									type: "object",
									properties: {
										date: { type: "string", example: "2026-09-27" },
										workouts: { type: "integer", example: 9, description: "Completed sessions that day" },
									},
								},
							},
							userGrowth: {
								type: "array",
								items: {
									type: "object",
									properties: {
										date: { type: "string", example: "2026-09-27" },
										users: { type: "integer", example: 2, description: "Accounts created that day" },
									},
								},
							},
						},
					}),
					"401": unauthorized,
					"500": errorResponse("Unexpected server error", "Failed to load analytics"),
				},
			},
		},
		"/admin/workouts": {
			get: {
				tags: ["Admin Dashboard"],
				summary: "List workout sessions across all users",
				description: "Newest started first.",
				security: [{ adminAuth: [] }],
				parameters: [...paginationParams(10), searchParam("Matches the user's name or email")],
				responses: {
					...ok("Page of workouts", adminList("workouts", { $ref: "#/components/schemas/AdminWorkout" })),
					"401": unauthorized,
					"500": errorResponse("Unexpected server error", "Failed to load workouts"),
				},
			},
		},
		"/admin/exercises": {
			get: {
				tags: ["Admin Exercises"],
				summary: "List exercises, including deactivated ones",
				description: "Newest first.",
				security: [{ adminAuth: [] }],
				parameters: [
					...paginationParams(10),
					searchParam("Matches name, muscle_group, category, equipment or difficulty"),
				],
				responses: {
					...ok("Page of exercises", adminList("exercises", { $ref: "#/components/schemas/AdminExercise" })),
					"401": unauthorized,
					"500": errorResponse("Unexpected server error", "Failed to load exercises"),
				},
			},
			post: {
				tags: ["Admin Exercises"],
				summary: "Create an exercise",
				security: [{ adminAuth: [] }],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/ExerciseInput" },
							example: {
								name: "Push-up",
								category: "strength",
								muscle_group: "chest",
								equipment: "bodyweight",
								difficulty: "beginner",
							},
						},
					},
				},
				responses: {
					"201": {
						description: "Created",
						content: {
							"application/json": {
								example: {
									success: true,
									message: "Exercise created successfully",
									data: { id: "ex_5f0c3a52-9d1e-4b7a-8a1f-2c6e9b7d4e10", name: "Push-up", slug: "push-up" },
								},
							},
						},
					},
					"400": errorResponse("Missing fields or name too long", "Name, category, muscle group and difficulty are required"),
					"401": unauthorized,
					"409": errorResponse("Another exercise has the same name (slug)", "An exercise with this slug already exists"),
					"500": errorResponse("Unexpected error, including invalid JSON body", "Failed to create exercise"),
				},
			},
		},
		"/admin/exercises/{id}": {
			parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, example: "ex_chest_001" }],
			put: {
				tags: ["Admin Exercises"],
				summary: "Update an exercise",
				description: "Replaces every field. Set is_active to 1 to bring back a deactivated exercise.",
				security: [{ adminAuth: [] }],
				requestBody: {
					required: true,
					content: { "application/json": { schema: { $ref: "#/components/schemas/ExerciseInput" } } },
				},
				responses: {
					"200": {
						description: "Updated",
						content: { "application/json": { example: { success: true, message: "Exercise updated successfully" } } },
					},
					"400": errorResponse("Missing fields or name too long", "Name, category, muscle group and difficulty are required"),
					"401": unauthorized,
					"404": errorResponse("No exercise with this ID", "Exercise not found"),
					"409": errorResponse("Another exercise has the same name (slug)", "An exercise with this slug already exists"),
					"500": errorResponse("Unexpected error, including invalid JSON body", "Failed to update exercise"),
				},
			},
			delete: {
				tags: ["Admin Exercises"],
				summary: "Deactivate an exercise",
				description: "Soft delete: sets is_active to 0. The exercise disappears from the app but stays in plans and history.",
				security: [{ adminAuth: [] }],
				responses: {
					"200": {
						description: "Deactivated",
						content: { "application/json": { example: { success: true, message: "Exercise deleted successfully" } } },
					},
					"401": unauthorized,
					"404": errorResponse("No active exercise with this ID", "Active exercise not found"),
					"500": errorResponse("Unexpected server error", "Failed to delete exercise"),
				},
			},
		},
		"/admin/exercises/{id}/permanent": {
			delete: {
				tags: ["Admin Exercises"],
				summary: "Delete an exercise for good",
				description: "Refused with 409 while any workout plan or session uses the exercise; deactivate it instead.",
				security: [{ adminAuth: [] }],
				parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
				responses: {
					"200": {
						description: "Deleted",
						content: {
							"application/json": { example: { success: true, message: "Exercise permanently deleted successfully" } },
						},
					},
					"401": unauthorized,
					"404": errorResponse("No exercise with this ID", "Exercise not found"),
					"409": {
						description: "Still used by plans or sessions",
						content: {
							"application/json": {
								example: {
									success: false,
									message:
										"Cannot permanently delete this exercise because it is used in workout plans or sessions. Deactivate it instead.",
									references: { workoutPlans: 3, workoutSessions: 12 },
								},
							},
						},
					},
					"500": errorResponse("Unexpected server error", "Failed to permanently delete exercise"),
				},
			},
		},
		"/admin/notifications/send": {
			post: {
				tags: ["Admin Notifications"],
				summary: "Send a push notification to all users",
				description:
					"Broadcasts through OneSignal, then saves it to the history (and the app's /notifications inbox). " +
					"If saving the history fails, the send still reports success because the push already went out.",
				security: [{ adminAuth: [] }],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["title", "message"],
								properties: {
									title: { type: "string", maxLength: 100 },
									message: { type: "string", maxLength: 1000 },
								},
							},
							example: { title: "New workouts are live", message: "Check out this week's plan." },
						},
					},
				},
				responses: {
					"200": {
						description: "Sent. data is OneSignal's response.",
						content: {
							"application/json": {
								example: {
									success: true,
									message: "Broadcast notification sent",
									data: { id: "b98881cc-1e94-4366-bbd9-db8f3429292b" },
								},
							},
						},
					},
					"400": errorResponse(
						"Invalid JSON, or title/message missing or too long",
						"Title and message are required. Title must be at most 100 characters and message at most 1000 characters.",
					),
					"401": unauthorized,
					"500": errorResponse("OneSignal rejected the request", "Failed to send notification"),
				},
			},
		},
		"/admin/notifications/history": {
			get: {
				tags: ["Admin Notifications"],
				summary: "List sent notifications",
				description: "Newest first.",
				security: [{ adminAuth: [] }],
				parameters: paginationParams(10),
				responses: {
					...ok(
						"Page of notifications",
						adminList("notifications", { $ref: "#/components/schemas/NotificationHistoryItem" }),
					),
					"401": unauthorized,
					"500": errorResponse("Unexpected server error", "Failed to load notification history"),
				},
			},
		},
		"/admin/app-versions": {
			get: {
				tags: ["Admin App Versions"],
				summary: "Version config for both platforms",
				security: [{ adminAuth: [] }],
				responses: {
					...ok("android then ios", { type: "array", items: { $ref: "#/components/schemas/AppVersion" } }),
					"401": unauthorized,
					"500": errorResponse("Unexpected server error", "Failed to load app versions"),
				},
			},
		},
		"/admin/app-versions/{platform}": {
			put: {
				tags: ["Admin App Versions"],
				summary: "Update the version config for a platform",
				description: "Creates the row if it doesn't exist. updatedBy is set to the admin's email.",
				security: [{ adminAuth: [] }],
				parameters: [
					{ name: "platform", in: "path", required: true, schema: { type: "string", enum: ["android", "ios"] } },
				],
				requestBody: {
					required: true,
					content: { "application/json": { schema: { $ref: "#/components/schemas/AppVersionUpdate" } } },
				},
				responses: {
					...ok("Saved config", { $ref: "#/components/schemas/AppVersion" }),
					"400": errorResponse(
						"Invalid JSON, bad version format, min above latest, bad store URL, or platform not android/ios",
						"Minimum version can't be higher than the latest version",
					),
					"401": unauthorized,
					"500": errorResponse("Unexpected server error", "Failed to update app version"),
				},
			},
		},
	},
};

export const swaggerHtml = `<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>FitPilot API Docs</title>
	<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
	<div id="swagger-ui"></div>
	<script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
	<script>
		window.ui = SwaggerUIBundle({
			url: "/openapi.json",
			dom_id: "#swagger-ui",
			persistAuthorization: true,
		});
	</script>
</body>
</html>`;
