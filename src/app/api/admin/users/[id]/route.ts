import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import {
  getSessionCookieOptions,
  hashPassword,
  requireAdminSession,
} from "@/lib/auth";
import { BRANCH_LOCATIONS } from "@/lib/constants";

type Params = { params: Promise<{ id: string }> };
const ALLOWED_SEDE_SET = new Set(BRANCH_LOCATIONS);

const resolveValidSede = (value?: string | null) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return ALLOWED_SEDE_SET.has(trimmed) ? trimmed : null;
};

const hasSedeColumn = async (client: {
  query: (queryText: string) => Promise<{ rows?: unknown[] }>;
}) => {
  const result = await client.query(
    `
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'app_users'
      AND column_name = 'sede'
    LIMIT 1
    `,
  );
  return (result.rows?.length ?? 0) > 0;
};

export async function PATCH(req: Request, { params }: Params) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const { id } = await params;
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
    sede?: string | null;
    is_active?: boolean;
    password?: string;
  };

  const client = await (await getDbPool()).connect();
  try {
    const sedeEnabled = await hasSedeColumn(client);
    const currentResult = await client.query(
      `
      SELECT
        u.role,
        to_jsonb(u)->>'sede' AS sede
      FROM app_users u
      WHERE id = $1
      LIMIT 1
      `,
      [id],
    );
    if (!currentResult.rows || currentResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Usuario no encontrado." },
        { status: 404 },
      );
    }

    const currentUser = currentResult.rows[0] as {
      role: "admin" | "user";
      sede: string | null;
    };

    if (typeof body.sede === "string" && !resolveValidSede(body.sede)) {
      return NextResponse.json(
        { error: "La sede no es valida." },
        { status: 400 },
      );
    }

    const nextRole =
      body.role === "admin" || body.role === "user" ? body.role : currentUser.role;
    const nextSede =
      body.sede === null
        ? null
        : typeof body.sede === "string"
          ? resolveValidSede(body.sede)
          : currentUser.sede;

    if (nextRole === "user" && !nextSede) {
      return NextResponse.json(
        { error: "Los usuarios de rol user deben tener sede asignada." },
        { status: 400 },
      );
    }
    if (!sedeEnabled && (body.sede !== undefined || nextRole === "user")) {
      return NextResponse.json(
        {
          error:
            "Falta aplicar migracion de sede en app_users (db/migrations/20260220_user_sede.sql).",
        },
        { status: 400 },
      );
    }

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
      if (body.role === "admin" && body.sede === undefined) {
        addUpdate("sede", null);
      }
    }
    if (sedeEnabled && body.sede !== undefined) {
      addUpdate("sede", nextSede);
    }
    if (typeof body.is_active === "boolean") {
      addUpdate("is_active", body.is_active);
    }
    if (typeof body.password === "string" && body.password.length > 0) {
      if (body.password.length < 8) {
        return NextResponse.json(
          { error: "La contrasena debe tener minimo 8 caracteres." },
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
    values.push(id);

    const result = await client.query(
      `
      UPDATE app_users
      SET ${updates.join(", ")}
      WHERE id = $${idx}
      RETURNING id, username, role, sede, is_active, created_at, updated_at, last_login_at, last_login_ip
      `,
      values,
    );
    return withSession(NextResponse.json({ user: result.rows?.[0] ?? null }));
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "No se pudo actualizar el usuario.";
    return NextResponse.json(
      { error: detail },
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
  const { id } = await params;
  const withSession = (response: NextResponse) => {
    response.cookies.set(
      "vp_session",
      session.token,
      getSessionCookieOptions(session.expiresAt),
    );
    return response;
  };

  if (session.user.id === id) {
    return NextResponse.json(
      { error: "No puedes eliminar tu propio usuario." },
      { status: 400 },
    );
  }

  const client = await (await getDbPool()).connect();
  try {
    await client.query(`DELETE FROM app_users WHERE id = $1`, [id]);
    return withSession(NextResponse.json({ ok: true }));
  } finally {
    client.release();
  }
}
