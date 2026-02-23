import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import {
  getSessionCookieOptions,
  hashPassword,
  requireAdminSession,
} from "@/lib/auth";
import { BRANCH_LOCATIONS } from "@/lib/constants";

const ALLOWED_SEDE_SET = new Set(BRANCH_LOCATIONS);

const resolveValidSede = (value?: string | null) => {
  const trimmed = value?.trim();
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
      SELECT
        u.id,
        u.username,
        u.role,
        to_jsonb(u)->>'sede' AS sede,
        u.is_active,
        u.created_at,
        u.updated_at,
        u.last_login_at,
        u.last_login_ip
      FROM app_users u
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
    sede?: string | null;
  };

  const username = body.username?.trim();
  const password = body.password ?? "";
  const role = body.role ?? "user";
  const sede = resolveValidSede(body.sede);

  if (!username || password.length < 8) {
    return NextResponse.json(
      { error: "Usuario y contraseña (mín 8) son obligatorios." },
      { status: 400 },
    );
  }
  if (role === "user" && !sede) {
    return NextResponse.json(
      { error: "Los usuarios de rol user deben tener sede asignada." },
      { status: 400 },
    );
  }
  if (body.sede && !sede) {
    return NextResponse.json(
      { error: "La sede no es válida." },
      { status: 400 },
    );
  }

  const passwordHash = await hashPassword(password);
  const client = await (await getDbPool()).connect();
  try {
    const sedeEnabled = await hasSedeColumn(client);
    if (!sedeEnabled && role === "user") {
      return NextResponse.json(
        {
          error:
            "Falta aplicar migracion de sede en app_users (db/migrations/20260220_user_sede.sql).",
        },
        { status: 400 },
      );
    }

    const result = sedeEnabled
      ? await client.query(
          `
          INSERT INTO app_users (username, password_hash, role, sede)
          VALUES ($1, $2, $3, $4)
          RETURNING id, username, role, sede, is_active, created_at, updated_at
          `,
          [username, passwordHash, role, role === "admin" ? null : sede],
        )
      : await client.query(
          `
          INSERT INTO app_users (username, password_hash, role)
          VALUES ($1, $2, $3)
          RETURNING id, username, role, NULL::text AS sede, is_active, created_at, updated_at
          `,
          [username, passwordHash, role],
        );
    return withSession(NextResponse.json({ user: result.rows?.[0] }));
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "No se pudo crear el usuario.";
    return NextResponse.json(
      { error: detail },
      { status: 400 },
    );
  } finally {
    client.release();
  }
}

