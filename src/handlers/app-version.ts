import { Env } from "../index";

function json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        },
    });
}

const PLATFORMS = ["android", "ios"] as const;
type Platform = (typeof PLATFORMS)[number];

const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

type AppVersionRow = {
    platform: Platform;
    latest_version: string;
    min_version: string;
    store_url: string | null;
    release_notes: string | null;
    updated_by: string | null;
    updated_at: string;
};

interface AppVersionInput {
    latestVersion?: string;
    minVersion?: string;
    storeUrl?: string | null;
    releaseNotes?: string | null;
}

export function isPlatform(value: string | null | undefined): value is Platform {
    return PLATFORMS.includes(value as Platform);
}

function toAppVersion(row: AppVersionRow) {
    return {
        platform: row.platform,
        latestVersion: row.latest_version,
        minVersion: row.min_version,
        storeUrl: row.store_url,
        releaseNotes: row.release_notes,
        updatedAt: row.updated_at,
        updatedBy: row.updated_by,
    };
}

// Numeric x.y.z compare: negative if a < b, 0 if equal, positive if a > b.
function compareVersions(a: string, b: string): number {
    const pa = a.split(".").map(Number);
    const pb = b.split(".").map(Number);
    for (let i = 0; i < 3; i++) {
        if (pa[i] !== pb[i]) return pa[i] - pb[i];
    }
    return 0;
}

function validateAppVersion(body: AppVersionInput): string | null {
    const latest = body.latestVersion?.trim();
    const min = body.minVersion?.trim();

    if (!latest || !VERSION_PATTERN.test(latest)) {
        return "Latest version must look like 1.2.3";
    }
    if (!min || !VERSION_PATTERN.test(min)) {
        return "Minimum version must look like 1.2.3";
    }
    if (compareVersions(min, latest) > 0) {
        return "Minimum version can't be higher than the latest version";
    }

    const storeUrl = body.storeUrl?.trim();
    if (storeUrl && !/^https?:\/\/\S+$/.test(storeUrl)) {
        return "Store URL must start with http:// or https://";
    }

    return null;
}

const SELECT_COLUMNS = `
    platform,
    latest_version,
    min_version,
    store_url,
    release_notes,
    updated_by,
    updated_at
`;

// ========================================
// GET /app/version?platform=android|ios  (public)
// ========================================

export async function getAppVersion(request: Request, env: Env): Promise<Response> {
    const platform = new URL(request.url).searchParams.get("platform");

    if (!isPlatform(platform)) {
        return json({ success: false, message: "platform must be android or ios" }, 400);
    }

    try {
        const row = await env.fitpilot_db
            .prepare(`SELECT ${SELECT_COLUMNS} FROM app_versions WHERE platform = ?`)
            .bind(platform)
            .first<AppVersionRow>();

        if (!row) {
            return json({ success: false, message: "No version configured for this platform" }, 404);
        }

        return json({ success: true, data: toAppVersion(row) });
    } catch (error) {
        console.error("Get app version error:", error);
        return json({ success: false, message: "Failed to load app version" }, 500);
    }
}

// ========================================
// GET /admin/app-versions
// ========================================

export async function getAdminAppVersions(_request: Request, env: Env): Promise<Response> {
    try {
        const result = await env.fitpilot_db
            .prepare(`SELECT ${SELECT_COLUMNS} FROM app_versions ORDER BY platform ASC`)
            .all<AppVersionRow>();

        return json({ success: true, data: result.results.map(toAppVersion) });
    } catch (error) {
        console.error("Get admin app versions error:", error);
        return json({ success: false, message: "Failed to load app versions" }, 500);
    }
}

// ========================================
// PUT /admin/app-versions/:platform
// ========================================

export async function updateAdminAppVersion(
    request: Request,
    env: Env,
    platform: Platform,
    adminEmail: string,
): Promise<Response> {
    let body: AppVersionInput;
    try {
        body = await request.json();
    } catch {
        return json({ success: false, message: "Invalid JSON body" }, 400);
    }

    const validationError = validateAppVersion(body);
    if (validationError) {
        return json({ success: false, message: validationError }, 400);
    }

    try {
        const row = await env.fitpilot_db
            .prepare(
                `
                INSERT INTO app_versions (
                    platform, latest_version, min_version, store_url,
                    release_notes, updated_by, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(platform) DO UPDATE SET
                    latest_version = excluded.latest_version,
                    min_version = excluded.min_version,
                    store_url = excluded.store_url,
                    release_notes = excluded.release_notes,
                    updated_by = excluded.updated_by,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING ${SELECT_COLUMNS}
                `,
            )
            .bind(
                platform,
                body.latestVersion!.trim(),
                body.minVersion!.trim(),
                body.storeUrl?.trim() || null,
                body.releaseNotes?.trim() || null,
                adminEmail,
            )
            .first<AppVersionRow>();

        return json({ success: true, data: row ? toAppVersion(row) : null });
    } catch (error) {
        console.error("Update app version error:", error);
        return json({ success: false, message: "Failed to update app version" }, 500);
    }
}
