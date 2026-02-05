import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import {
  getSessionCookieOptions,
  hashPassword,
  requireAdminSession,
} from "@/lib/auth";

export async function GET() {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const withSession = (response: NextResponse) => {
    response.cookies.set(
      "vp_session",
      session.token,
      getSessionCookieOptions(session.expiresAt),
    );
    return response;
  };

  const client = await (await getDbPool()).connect();
  try {
    const result = await client.query(
      `
      SELECT id, username, role, is_active, created_at, updated_at, last_login_at, last_login_ip
      FROM app_users
      ORDER BY created_at DESC
      `,
    );
    return withSession(NextResponse.json({ users: result.rows ?? [] }));
  } finally {
    client.release();
  }
}

export async function POST(req: Request) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const withSession = (response: NextResponse) => {
    response.cookies.set(
      "vp_session",
      session.token,
      getSessionCookieOptions(session.expiresAt),
    );
    return response;
  };

  const body = (await req.json()) as {
    username?: string;
    password?: string;
    role?: "admin" | "user";
  };

  const username = body.username?.trim();
  const password = body.password ?? "";
  const role = body.role ?? "user";

  if (!username || password.length < 8) {
    return NextResponse.json(
      { error: "Usuario y contraseña (mín 8) son obligatorios." },
      { status: 400 },
    );
  }

  const passwordHash = await hashPassword(password);
  const client = await (await getDbPool()).connect();
  try {
    const result = await client.query(
      `
      INSERT INTO app_users (username, password_hash, role)
      VALUES ($1, $2, $3)
      RETURNING id, username, role, is_active, created_at, updated_at
      `,
      [username, passwordHash, role],
    );
    return withSession(NextResponse.json({ user: result.rows?.[0] }));
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo crear el usuario (usuario duplicado?)." },
      { status: 400 },
    );
  } finally {
    client.release();
  }
}

