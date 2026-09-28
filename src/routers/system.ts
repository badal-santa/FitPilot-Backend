import { openApiSpec, swaggerHtml } from "../docs/openapi";
import { json, type Router } from "../http";

// GET /openapi.json
// GET /docs
// GET /
// GET /health
// GET /test-db

export const systemRouter: Router = async (request, env, url) => {
	if (request.method !== "GET") {
		return null;
	}

	switch (url.pathname) {
		case "/openapi.json":
			return json(openApiSpec);

		// Swagger UI
		case "/docs":
			return new Response(swaggerHtml, {
				headers: {
					"Content-Type": "text/html; charset=utf-8",
				},
			});

		case "/":
			return json({
				success: true,
				message: "FitPilot API is running 🚀",
				version: "1.0.0",
			});

		case "/health":
			return json({
				success: true,
				service: "fitpilot-backend",
				status: "healthy",
			});

		case "/test-db": {
			const result =
				await env.fitpilot_db
					.prepare(
						`
						SELECT name
						FROM sqlite_master
						WHERE type = 'table'
						ORDER BY name
						`,
					)
					.all();

			return json({
				success: true,
				tables: result.results,
			});
		}
	}

	return null;
};
