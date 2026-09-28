import { verifyGoogleIdToken } from "../services/google-auth";
import { hashPassword, verifyPassword } from "../services/password";

export interface Env {
    fitpilot_db: D1Database;
    // Comma-separated OAuth client IDs Google ID tokens may be issued to
    // (the web client ID the app passes as webClientId).
    GOOGLE_CLIENT_IDS?: string;
}

function json(
    data: unknown,
    status = 200,
): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers":
                "Content-Type, Authorization",
            "Access-Control-Allow-Methods":
                "GET, POST, PUT, DELETE, OPTIONS",
        },
    });
}

function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generateId(): string {
    return crypto.randomUUID();
}

function generateSessionToken(): string {
    const bytes = crypto.getRandomValues(
        new Uint8Array(32),
    );

    let binary = "";

    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }

    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
}

const ACCESS_TOKEN_EXPIRES_IN_MS =
    7 * 24 * 60 * 60 * 1000; // 7 days

const REFRESH_TOKEN_EXPIRES_IN_MS =
    30 * 24 * 60 * 60 * 1000; // 30 days

async function hashToken(
    token: string,
): Promise<string> {
    const data = new TextEncoder().encode(token);

    const digest = await crypto.subtle.digest(
        "SHA-256",
        data,
    );

    const bytes = new Uint8Array(digest);

    let binary = "";

    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }

    return btoa(binary);
}

type RegisterBody = {
    email?: string;
    password?: string;
    name?: string;
};

// register
export async function register(
    request: Request,
    env: Env,
): Promise<Response> {
    // -----------------------------
    // Parse request body
    // -----------------------------

    let body: RegisterBody;

    try {
        body = await request.json();
    } catch {
        return json(
            {
                success: false,
                message: "Invalid request body",
            },
            400,
        );
    }

    // -----------------------------
    // Validate fields
    // -----------------------------

    const email = body.email
        ? normalizeEmail(body.email)
        : "";

    const password = body.password ?? "";

    const name = body.name?.trim() || null;

    if (!email) {
        return json(
            {
                success: false,
                message: "Email is required",
            },
            400,
        );
    }

    if (!isValidEmail(email)) {
        return json(
            {
                success: false,
                message: "Please enter a valid email address",
            },
            400,
        );
    }

    if (!password) {
        return json(
            {
                success: false,
                message: "Password is required",
            },
            400,
        );
    }

    if (password.length < 6) {
        return json(
            {
                success: false,
                message:
                    "Password must be at least 6 characters",
            },
            400,
        );
    }

    // -----------------------------
    // Check existing user
    // -----------------------------

    const existingUser =
        await env.fitpilot_db
            .prepare(
                `
        SELECT id
        FROM users
        WHERE email = ?
        LIMIT 1
        `,
            )
            .bind(email)
            .first<{ id: string }>();

    if (existingUser) {
        return json(
            {
                success: false,
                message:
                    "An account with this email already exists",
            },
            409,
        );
    }

    // -----------------------------
    // Hash password
    // -----------------------------

    const passwordHash =
        await hashPassword(password);

    // -----------------------------
    // Create user
    // -----------------------------

    const userId = generateId();

    await env.fitpilot_db
        .prepare(
            `
      INSERT INTO users (
        id,
        email,
        password_hash,
        name
      )
      VALUES (?, ?, ?, ?)
      `,
        )
        .bind(
            userId,
            email,
            passwordHash,
            name,
        )
        .run();

    // -----------------------------
    // Create session
    // -----------------------------

    const accessToken = generateSessionToken();
    const refreshToken = generateSessionToken();

    const accessTokenHash =
        await hashToken(accessToken);

    const refreshTokenHash =
        await hashToken(refreshToken);

    const sessionId = generateId();

    const accessExpiresAt = new Date(
        Date.now() + ACCESS_TOKEN_EXPIRES_IN_MS,
    ).toISOString();

    const refreshExpiresAt = new Date(
        Date.now() + REFRESH_TOKEN_EXPIRES_IN_MS,
    ).toISOString();

    await env.fitpilot_db
        .prepare(
            `
    INSERT INTO sessions (
      id,
      user_id,
      token_hash,
      expires_at,
      refresh_token_hash,
      refresh_expires_at
    )
    VALUES (?, ?, ?, ?, ?, ?)
    `,
        )
        .bind(
            sessionId,
            userId,
            accessTokenHash,
            accessExpiresAt,
            refreshTokenHash,
            refreshExpiresAt,
        )
        .run();

    // -----------------------------
    // Response
    // -----------------------------

    return json(
        {
            success: true,
            message: "Account created successfully",
            isNewUser: true,

            accessToken,
            refreshToken,
            expiresIn: ACCESS_TOKEN_EXPIRES_IN_MS / 1000,
            user: {
                id: userId,
                email,
                name,
            },
        },
        201,
    );
}

// login
// login
export async function login(
    request: Request,
    env: Env,
): Promise<Response> {
    try {
        const body = (await request.json()) as {
            email?: string;
            password?: string;
        };

        const email = body.email
            ? normalizeEmail(body.email)
            : "";

        const password = body.password ?? "";

        if (!email || !password) {
            return json(
                {
                    success: false,
                    message: "Email and password are required",
                },
                400,
            );
        }

        if (!isValidEmail(email)) {
            return json(
                {
                    success: false,
                    message: "Please enter a valid email address",
                },
                400,
            );
        }

        const user =
            await env.fitpilot_db
                .prepare(
                    `
          SELECT
            id,
            email,
            name,
            password_hash
          FROM users
          WHERE email = ?
          LIMIT 1
          `,
                )
                .bind(email)
                .first<{
                    id: string;
                    email: string;
                    name: string | null;
                    password_hash: string;
                }>();

        if (!user) {
            return json(
                {
                    success: false,
                    message: "Invalid email or password",
                },
                401,
            );
        }

        const passwordValid =
            await verifyPassword(
                password,
                user.password_hash,
            );

        if (!passwordValid) {
            return json(
                {
                    success: false,
                    message: "Invalid email or password",
                },
                401,
            );
        }

        // -----------------------------
        // Generate access token
        // -----------------------------

        const accessToken =
            generateSessionToken();

        const accessTokenHash =
            await hashToken(accessToken);

        // -----------------------------
        // Generate refresh token
        // -----------------------------

        const refreshToken =
            generateSessionToken();

        const refreshTokenHash =
            await hashToken(refreshToken);

        // -----------------------------
        // Session
        // -----------------------------

        const sessionId = generateId();

        const accessExpiresAt = new Date(
            Date.now() +
            ACCESS_TOKEN_EXPIRES_IN_MS,
        ).toISOString();

        const refreshExpiresAt = new Date(
            Date.now() +
            REFRESH_TOKEN_EXPIRES_IN_MS,
        ).toISOString();

        await env.fitpilot_db
            .prepare(
                `
        INSERT INTO sessions (
          id,
          user_id,
          token_hash,
          expires_at,
          refresh_token_hash,
          refresh_expires_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
        `,
            )
            .bind(
                sessionId,
                user.id,
                accessTokenHash,
                accessExpiresAt,
                refreshTokenHash,
                refreshExpiresAt,
            )
            .run();

        // -----------------------------
        // Response
        // -----------------------------

        return json({
            success: true,
            message: "Login successful",

            accessToken,
            refreshToken,

            // seconds
            expiresIn:
                ACCESS_TOKEN_EXPIRES_IN_MS / 1000,

            user: {
                id: user.id,
                email: user.email,
                name: user.name,
            },
        });
    } catch (error) {
        console.error(
            "Login error:",
            error,
        );

        return json(
            {
                success: false,
                message: "Something went wrong",
            },
            500,
        );
    }
}

// me
export async function me(
    request: Request,
    env: Env,
): Promise<Response> {
    try {
        const authHeader = request.headers.get("Authorization");

        if (!authHeader?.startsWith("Bearer ")) {
            return json(
                {
                    success: false,
                    message: "Authorization token is required",
                },
                401,
            );
        }

        const token = authHeader.slice(7).trim();

        if (!token) {
            return json(
                {
                    success: false,
                    message: "Authorization token is required",
                },
                401,
            );
        }

        const tokenHash = await hashToken(token);

        const session = await env.fitpilot_db
            .prepare(
                `SELECT
          sessions.id,
          sessions.user_id,
          sessions.expires_at,
          users.email,
          users.name,
          users.avatar_url,
          users.date_of_birth,
          users.gender,
          users.height_cm,
          users.weight_kg,
          users.goal,
          users.activity_level
        FROM sessions
        INNER JOIN users
          ON users.id = sessions.user_id
        WHERE sessions.token_hash = ?
        LIMIT 1`,
            )
            .bind(tokenHash)
            .first<{
                id: string;
                user_id: string;
                expires_at: string;
                email: string;
                name: string | null;
                avatar_url: string | null;
                date_of_birth: string | null;
                gender: string | null;
                height_cm: number | null;
                weight_kg: number | null;
                goal: string | null;
                activity_level: string | null;
            }>();

        if (!session) {
            return json(
                {
                    success: false,
                    message: "Invalid or expired session",
                },
                401,
            );
        }

        if (
            new Date(session.expires_at).getTime() <=
            Date.now()
        ) {
            return json(
                {
                    success: false,
                    message: "Access token expired",
                },
                401,
            );
        }

        return json({
            success: true,
            user: {
                id: session.user_id,
                email: session.email,
                name: session.name,
                avatarUrl: session.avatar_url,
                dateOfBirth: session.date_of_birth,
                gender: session.gender,
                heightCm: session.height_cm,
                weightKg: session.weight_kg,
                goal: session.goal,
                activityLevel: session.activity_level,
            },
        });
    } catch (error) {
        console.error("Get current user error:", error);

        return json(
            {
                success: false,
                message: "Something went wrong",
            },
            500,
        );
    }
}

// refresh access token
export async function refresh(
    request: Request,
    env: Env,
): Promise<Response> {
    try {
        const body = (await request.json()) as {
            refreshToken?: string;
        };

        const refreshToken =
            body.refreshToken?.trim();

        if (!refreshToken) {
            return json(
                {
                    success: false,
                    message: "Refresh token is required",
                },
                400,
            );
        }

        const refreshTokenHash =
            await hashToken(refreshToken);

        const session =
            await env.fitpilot_db
                .prepare(
                    `
          SELECT
            id,
            user_id,
            refresh_expires_at
          FROM sessions
          WHERE refresh_token_hash = ?
          LIMIT 1
          `,
                )
                .bind(refreshTokenHash)
                .first<{
                    id: string;
                    user_id: string;
                    refresh_expires_at: string;
                }>();

        if (!session) {
            return json(
                {
                    success: false,
                    message: "Invalid refresh token",
                },
                401,
            );
        }

        // Check refresh token expiry
        if (
            new Date(
                session.refresh_expires_at,
            ).getTime() <= Date.now()
        ) {
            await env.fitpilot_db
                .prepare(
                    `DELETE FROM sessions WHERE id = ?`,
                )
                .bind(session.id)
                .run();

            return json(
                {
                    success: false,
                    message: "Refresh token expired",
                },
                401,
            );
        }

        // -----------------------------
        // Rotate access token
        // -----------------------------

        const newAccessToken =
            generateSessionToken();

        const newAccessTokenHash =
            await hashToken(newAccessToken);

        // -----------------------------
        // Rotate refresh token
        // -----------------------------

        const newRefreshToken =
            generateSessionToken();

        const newRefreshTokenHash =
            await hashToken(newRefreshToken);

        const accessExpiresAt = new Date(
            Date.now() +
            ACCESS_TOKEN_EXPIRES_IN_MS,
        ).toISOString();

        const refreshExpiresAt = new Date(
            Date.now() +
            REFRESH_TOKEN_EXPIRES_IN_MS,
        ).toISOString();

        await env.fitpilot_db
            .prepare(
                `
        UPDATE sessions
        SET
          token_hash = ?,
          expires_at = ?,
          refresh_token_hash = ?,
          refresh_expires_at = ?
        WHERE id = ?
        `,
            )
            .bind(
                newAccessTokenHash,
                accessExpiresAt,
                newRefreshTokenHash,
                refreshExpiresAt,
                session.id,
            )
            .run();

        return json({
            success: true,

            accessToken: newAccessToken,
            refreshToken: newRefreshToken,

            expiresIn:
                ACCESS_TOKEN_EXPIRES_IN_MS / 1000,
        });
    } catch (error) {
        console.error(
            "Refresh token error:",
            error,
        );

        return json(
            {
                success: false,
                message: "Something went wrong",
            },
            500,
        );
    }
}

// Logout
// logout
export async function logout(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const authHeader =
      request.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return json(
        {
          success: false,
          message: "Authorization token is required",
        },
        401,
      );
    }

    const accessToken =
      authHeader.slice(7).trim();

    if (!accessToken) {
      return json(
        {
          success: false,
          message: "Authorization token is required",
        },
        401,
      );
    }

    const accessTokenHash =
      await hashToken(accessToken);

    // Find the session
    const session =
      await env.fitpilot_db
        .prepare(
          `
          SELECT id
          FROM sessions
          WHERE token_hash = ?
          LIMIT 1
          `,
        )
        .bind(accessTokenHash)
        .first<{
          id: string;
        }>();

    if (!session) {
      return json(
        {
          success: false,
          message: "Invalid or expired session",
        },
        401,
      );
    }

    // Delete the complete session.
    // This invalidates both access and refresh tokens.
    await env.fitpilot_db
      .prepare(
        `
        DELETE FROM sessions
        WHERE id = ?
        `,
      )
      .bind(session.id)
      .run();

    return json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error(
      "Logout error:",
      error,
    );

    return json(
      {
        success: false,
        message: "Something went wrong",
      },
      500,
    );
  }
}

// ========================================
// POST /auth/google
// ========================================

// Never a valid "pbkdf2$..." hash, so verifyPassword() always rejects it:
// Google-only accounts can't be signed into with a password.
export const GOOGLE_ONLY_PASSWORD_HASH = "!google";

type GoogleUserRow = {
    id: string;
    email: string;
    name: string | null;
    avatar_url: string | null;
    google_id: string | null;
};

export async function googleLogin(
    request: Request,
    env: Env,
): Promise<Response> {
    try {
        const body = (await request.json().catch(() => ({}))) as {
            idToken?: string;
        };

        if (!body.idToken) {
            return json(
                {
                    success: false,
                    message: "idToken is required",
                },
                400,
            );
        }

        const clientIds = (env.GOOGLE_CLIENT_IDS ?? "")
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean);

        if (clientIds.length === 0) {
            console.error("GOOGLE_CLIENT_IDS is not configured");

            return json(
                {
                    success: false,
                    message: "Google sign-in is not available right now",
                },
                500,
            );
        }

        const identity = await verifyGoogleIdToken(
            body.idToken,
            clientIds,
        );

        if (!identity) {
            return json(
                {
                    success: false,
                    message: "Google sign-in failed. Please try again.",
                },
                401,
            );
        }

        // -----------------------------
        // Find or create the user
        // -----------------------------

        const selectUser = `
          SELECT id, email, name, avatar_url, google_id
          FROM users
          WHERE %COLUMN% = ?
          LIMIT 1
        `;

        let user =
            await env.fitpilot_db
                .prepare(selectUser.replace("%COLUMN%", "google_id"))
                .bind(identity.sub)
                .first<GoogleUserRow>();

        let isNewUser = false;

        if (!user) {
            const existing =
                await env.fitpilot_db
                    .prepare(selectUser.replace("%COLUMN%", "email"))
                    .bind(identity.email)
                    .first<GoogleUserRow>();

            if (existing) {
                // Same verified email already has an account (e.g. signed
                // up with a password) — link Google to it.
                if (existing.google_id && existing.google_id !== identity.sub) {
                    return json(
                        {
                            success: false,
                            message: "This email is linked to a different Google account",
                        },
                        409,
                    );
                }

                await env.fitpilot_db
                    .prepare(
                        `
            UPDATE users
            SET
              google_id = ?,
              name = COALESCE(name, ?),
              avatar_url = COALESCE(avatar_url, ?),
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            `,
                    )
                    .bind(
                        identity.sub,
                        identity.name,
                        identity.picture,
                        existing.id,
                    )
                    .run();

                user = {
                    ...existing,
                    google_id: identity.sub,
                    name: existing.name ?? identity.name,
                };
            } else {
                const userId = generateId();

                await env.fitpilot_db
                    .prepare(
                        `
            INSERT INTO users (
              id,
              email,
              password_hash,
              name,
              avatar_url,
              google_id
            )
            VALUES (?, ?, ?, ?, ?, ?)
            `,
                    )
                    .bind(
                        userId,
                        identity.email,
                        GOOGLE_ONLY_PASSWORD_HASH,
                        identity.name,
                        identity.picture,
                        identity.sub,
                    )
                    .run();

                user = {
                    id: userId,
                    email: identity.email,
                    name: identity.name,
                    avatar_url: identity.picture,
                    google_id: identity.sub,
                };
                isNewUser = true;
            }
        }

        // -----------------------------
        // Session (same shape as /auth/login)
        // -----------------------------

        const accessToken = generateSessionToken();
        const accessTokenHash = await hashToken(accessToken);

        const refreshToken = generateSessionToken();
        const refreshTokenHash = await hashToken(refreshToken);

        const accessExpiresAt = new Date(
            Date.now() + ACCESS_TOKEN_EXPIRES_IN_MS,
        ).toISOString();

        const refreshExpiresAt = new Date(
            Date.now() + REFRESH_TOKEN_EXPIRES_IN_MS,
        ).toISOString();

        await env.fitpilot_db
            .prepare(
                `
        INSERT INTO sessions (
          id,
          user_id,
          token_hash,
          expires_at,
          refresh_token_hash,
          refresh_expires_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
        `,
            )
            .bind(
                generateId(),
                user.id,
                accessTokenHash,
                accessExpiresAt,
                refreshTokenHash,
                refreshExpiresAt,
            )
            .run();

        return json({
            success: true,
            message: isNewUser ? "Account created" : "Login successful",
            isNewUser,

            accessToken,
            refreshToken,

            // seconds
            expiresIn: ACCESS_TOKEN_EXPIRES_IN_MS / 1000,

            user: {
                id: user.id,
                email: user.email,
                name: user.name,
            },
        });
    } catch (error) {
        console.error("Google login error:", error);

        return json(
            {
                success: false,
                message: "Something went wrong",
            },
            500,
        );
    }
}
