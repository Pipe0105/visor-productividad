import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import {
  getSessionCookieOptions,
  hashPassword,
  requireAdminSession,
} from "@/lib/auth";

type Params = { params: { id: string } };

export async function PATCH(req: Request, { params }: Params) {
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
    role?: "admin" | "user";
    is_active?: boolean;
    password?: string;
  };

  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  const addUpdate = (field: string, value: unknown) => {
    updates.push(`${field} = $${idx++}`);
    values.push(value);
  };

  if (typeof body.username === "string") {
    addUpdate("username", body.username.trim());
  }
  if (body.role === "admin" || body.role === "user") {
    addUpdate("role", body.role);
  }
  if (typeof body.is_active === "boolean") {
    addUpdate("is_active", body.is_active);
  }
  if (typeof body.password === "string" && body.password.length > 0) {
    if (body.password.length < 8) {
      return NextResponse.json(
        { error: "La contraseña debe tener mínimo 8 caracteres." },
        { status: 400 },
      );
    }
    const passwordHash = await hashPassword(body.password);
    addUpdate("password_hash", passwordHash);
  }

  if (updates.length === 0) {
    return NextResponse.json(
      { error: "No hay cambios para actualizar." },
      { status: 400 },
    );
  }

  updates.push("updated_at = now()");
  values.push(params.id);

  const client = await (await getDbPool()).connect();
  try {
    const result = await client.query(
      `
      UPDATE app_users
      SET ${updates.join(", ")}
      WHERE id = $${idx}
      RETURNING id, username, role, is_active, created_at, updated_at, last_login_at, last_login_ip
      `,
      values,
    );
    return withSession(NextResponse.json({ user: result.rows?.[0] ?? null }));
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo actualizar el usuario." },
      { status: 400 },
    );
  } finally {
    client.release();
  }
}

export async function DELETE(_req: Request, { params }: Params) {
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

  if (session.user.id === params.id) {
    return NextResponse.json(
      { error: "No puedes eliminar tu propio usuario." },
      { status: 400 },
    );
  }

  const client = await (await getDbPool()).connect();
  try {
    await client.query(`DELETE FROM app_users WHERE id = $1`, [params.id]);
    return withSession(NextResponse.json({ ok: true }));
  } finally {
    client.release();
  }
}
