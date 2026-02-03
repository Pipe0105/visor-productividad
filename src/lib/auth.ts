import crypto from "crypto";
import { cookies } from "next/headers";
import { getDbPool } from "@/lib/db";
import bcrypt from "bcryptjs";

export type AuthUser = {
  id: string;
  username: string;
  role: "admin" | "user";
  is_active: boolean;
  last_login_at: string | null;
  last_login_ip: string | null;
};

const SESSION_COOKIE = "vp_session";
const SESSION_TTL_DAYS = 7;

const hashToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

export const hashPassword = async (password: string) =>
  bcrypt.hash(password, 12);

export const verifyPassword = async (password: string, hash: string) =>
  bcrypt.compare(password, hash);

export const getClientIp = (req: Request) => {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || null;
  }
  return req.headers.get("x-real-ip") || null;
};

export const createSession = async (
  userId: string,
  ip: string | null,
  userAgent: string | null,
) => {
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(
    Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  const client = await (await getDbPool()).connect();
  try {
    await client.query(
      `
      INSERT INTO app_user_sessions (user_id, token_hash, expires_at, ip, user_agent)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [userId, tokenHash, expiresAt.toISOString(), ip, userAgent],
    );
  } finally {
    client.release();
  }

  return { token, expiresAt };
};

export const revokeSessionByToken = async (token: string) => {
  const tokenHash = hashToken(token);
  const client = await (await getDbPool()).connect();
  try {
    await client.query(
      `
      UPDATE app_user_sessions
      SET revoked_at = now()
      WHERE token_hash = $1 AND revoked_at IS NULL
      `,
      [tokenHash],
    );
  } finally {
    client.release();
  }
};

export const getSessionCookieOptions = (expiresAt?: Date) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  ...(expiresAt ? { expires: expiresAt } : {}),
});

export const getExpiredSessionCookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  expires: new Date(0),
});

export const getSessionToken = async () => {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value ?? null;
};

export const getUserFromSession = async (): Promise<AuthUser | null> => {
  const token = await getSessionToken();
  if (!token) return null;
  const tokenHash = hashToken(token);

  const client = await (await getDbPool()).connect();
  try {
    const result = await client.query(
      `
      SELECT u.id, u.username, u.role, u.is_active, u.last_login_at, u.last_login_ip
      FROM app_user_sessions s
      JOIN app_users u ON u.id = s.user_id
      WHERE s.token_hash = $1
        AND s.revoked_at IS NULL
        AND s.expires_at > now()
        AND u.is_active = true
      `,
      [tokenHash],
    );

    if (!result.rows || result.rows.length === 0) return null;
    return result.rows[0] as AuthUser;
  } finally {
    client.release();
  }
};

export const requireAdminUser = async () => {
  const user = await getUserFromSession();
  if (!user || user.role !== "admin") {
    return null;
  }
  return user;
};
