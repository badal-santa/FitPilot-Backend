// Verifies Google Sign-In ID tokens (RS256 JWTs) with WebCrypto against
// Google's published signing keys — no SDK needed on Workers.
// https://developers.google.com/identity/sign-in/android/backend-auth

const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = ["accounts.google.com", "https://accounts.google.com"];

// Allow a little clock drift between Google and the Worker.
const CLOCK_SKEW_SECONDS = 60;

export type GoogleIdentity = {
    sub: string;
    email: string;
    name: string | null;
    picture: string | null;
};

type Jwk = JsonWebKey & { kid: string };

type GoogleClaims = {
    iss?: string;
    aud?: string;
    exp?: number;
    iat?: number;
    sub?: string;
    email?: string;
    email_verified?: boolean | string;
    name?: string;
    picture?: string;
};

// Google rotates keys roughly daily and sends Cache-Control: max-age, so
// keep them per isolate until then instead of fetching on every sign-in.
let cachedKeys: { keys: Jwk[]; expiresAt: number } | null = null;

async function getGoogleKeys(forceRefresh = false): Promise<Jwk[]> {
    if (!forceRefresh && cachedKeys && cachedKeys.expiresAt > Date.now()) {
        return cachedKeys.keys;
    }

    const response = await fetch(GOOGLE_JWKS_URL);
    if (!response.ok) {
        throw new Error(`Failed to fetch Google signing keys (${response.status})`);
    }

    const { keys } = (await response.json()) as { keys: Jwk[] };
    const maxAge = Number(
        response.headers.get("Cache-Control")?.match(/max-age=(\d+)/)?.[1] ?? 3600,
    );
    cachedKeys = { keys, expiresAt: Date.now() + maxAge * 1000 };
    return keys;
}

function base64UrlToBytes(value: string): Uint8Array {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

function decodeJson<T>(segment: string): T {
    return JSON.parse(new TextDecoder().decode(base64UrlToBytes(segment))) as T;
}

/**
 * Returns the verified Google identity, or null if the token is invalid,
 * expired, issued for a different app, or the email isn't verified.
 * `allowedClientIds` are the OAuth client IDs the token may be issued to —
 * on Android/iOS with a webClientId configured, that's the *web* client ID.
 */
export async function verifyGoogleIdToken(
    idToken: string,
    allowedClientIds: string[],
): Promise<GoogleIdentity | null> {
    const parts = idToken.split(".");
    if (parts.length !== 3) return null;
    const [headerSegment, payloadSegment, signatureSegment] = parts;

    let header: { alg?: string; kid?: string };
    let claims: GoogleClaims;
    try {
        header = decodeJson(headerSegment);
        claims = decodeJson(payloadSegment);
    } catch {
        return null;
    }

    if (header.alg !== "RS256" || !header.kid) return null;

    // Unknown kid can mean Google just rotated keys — refetch once.
    let jwk = (await getGoogleKeys()).find((key) => key.kid === header.kid);
    if (!jwk) {
        jwk = (await getGoogleKeys(true)).find((key) => key.kid === header.kid);
    }
    if (!jwk) return null;

    const key = await crypto.subtle.importKey(
        "jwk",
        jwk,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["verify"],
    );

    const signatureValid = await crypto.subtle.verify(
        "RSASSA-PKCS1-v1_5",
        key,
        base64UrlToBytes(signatureSegment),
        new TextEncoder().encode(`${headerSegment}.${payloadSegment}`),
    );
    if (!signatureValid) return null;

    const now = Math.floor(Date.now() / 1000);

    if (!claims.iss || !GOOGLE_ISSUERS.includes(claims.iss)) return null;
    if (!claims.aud || !allowedClientIds.includes(claims.aud)) return null;
    if (!claims.exp || claims.exp + CLOCK_SKEW_SECONDS < now) return null;
    if (claims.iat && claims.iat - CLOCK_SKEW_SECONDS > now) return null;
    if (!claims.sub || !claims.email) return null;

    // Only trust the email for account lookup/linking when Google has
    // verified the user owns it.
    if (claims.email_verified !== true && claims.email_verified !== "true") return null;

    return {
        sub: claims.sub,
        email: claims.email.trim().toLowerCase(),
        name: claims.name ?? null,
        picture: claims.picture ?? null,
    };
}
