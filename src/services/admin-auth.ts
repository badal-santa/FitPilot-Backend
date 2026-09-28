import {
  hashPassword,
  verifyPassword,
} from "./password";

const ADMIN_SESSION_DAYS = 7;

function hashToken(token: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hashTokenToHex(
  token: string,
): Promise<string> {
  const digest = await hashToken(token);

  return bytesToHex(new Uint8Array(digest));
}

export async function createAdmin(
  db: D1Database,
  email: string,
  password: string,
  name: string,
) {
  const normalizedEmail = email
    .trim()
    .toLowerCase();

  const existing = await db
    .prepare(
      `SELECT id FROM admin_users WHERE email = ?`,
    )
    .bind(normalizedEmail)
    .first();

  if (existing) {
    throw new Error("Admin already exists");
  }

  const id = crypto.randomUUID();

  const passwordHash = await hashPassword(password);

  await db
    .prepare(
      `
      INSERT INTO admin_users
        (id, email, password_hash, name)
      VALUES (?, ?, ?, ?)
      `,
    )
    .bind(
      id,
      normalizedEmail,
      passwordHash,
      name.trim(),
    )
    .run();

  return {
    id,
    email: normalizedEmail,
    name: name.trim(),
  };
}

export async function authenticateAdmin(
  db: D1Database,
  email: string,
  password: string,
) {
  const normalizedEmail = email
    .trim()
    .toLowerCase();

  const admin = await db
    .prepare(
      `
      SELECT
        id,
        email,
        password_hash,
        name
      FROM admin_users
      WHERE email = ?
      `,
    )
    .bind(normalizedEmail)
    .first<{
      id: string;
      email: string;
      password_hash: string;
      name: string;
    }>();

  if (!admin) {
    return null;
  }

  const valid = await verifyPassword(
    password,
    admin.password_hash,
  );

  if (!valid) {
    return null;
  }

  return {
    id: admin.id,
    email: admin.email,
    name: admin.name,
  };
}

export async function createAdminSession(
  db: D1Database,
  adminId: string,
) {
  const sessionId = crypto.randomUUID();

  const rawToken = `${crypto.randomUUID()}-${crypto.randomUUID()}`;

  const tokenHash = await hashTokenToHex(
    rawToken,
  );

  const expiresAt = new Date(
    Date.now() +
      ADMIN_SESSION_DAYS *
        24 *
        60 *
        60 *
        1000,
  ).toISOString();

  await db
    .prepare(
      `
      INSERT INTO admin_sessions
        (
          id,
          admin_id,
          token_hash,
          expires_at
        )
      VALUES (?, ?, ?, ?)
      `,
    )
    .bind(
      sessionId,
      adminId,
      tokenHash,
      expiresAt,
    )
    .run();

  return {
    token: rawToken,
    expiresAt,
  };
}

export async function getAuthenticatedAdmin(
  db: D1Database,
  request: Request,
) {
  const authorization =
    request.headers.get("Authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice(7).trim();

  if (!token) {
    return null;
  }

  const tokenHash =
    await hashTokenToHex(token);

  const admin = await db
    .prepare(
      `
      SELECT
        admin_users.id,
        admin_users.email,
        admin_users.name,
        admin_sessions.id AS session_id
      FROM admin_sessions
      INNER JOIN admin_users
        ON admin_users.id = admin_sessions.admin_id
      WHERE admin_sessions.token_hash = ?
        AND admin_sessions.expires_at > ?
      `,
    )
    .bind(
      tokenHash,
      new Date().toISOString(),
    )
    .first<{
      id: string;
      email: string;
      name: string;
      session_id: string;
    }>();

  if (!admin) {
    return null;
  }

  return {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    sessionId: admin.session_id,
  };
}

export async function deleteAdminSession(
  db: D1Database,
  request: Request,
) {
  const authorization =
    request.headers.get("Authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return;
  }

  const token = authorization.slice(7).trim();

  if (!token) {
    return;
  }

  const tokenHash =
    await hashTokenToHex(token);

  await db
    .prepare(
      `
      DELETE FROM admin_sessions
      WHERE token_hash = ?
      `,
    )
    .bind(tokenHash)
    .run();
}