import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { getSessionCookieOptions, requireAuthSession } from "@/lib/auth";
import type { Sede } from "@/lib/constants";

const normalizeSedeKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, " ");

const BASE_SEDES: Sede[] = [
  { id: "Calle 5ta", name: "Calle 5ta" },
  { id: "La 39", name: "La 39" },
  { id: "Plaza Norte", name: "Plaza Norte" },
  { id: "Ciudad Jardin", name: "Ciudad Jardin" },
  { id: "Centro Sur", name: "Centro Sur" },
  { id: "Palmira", name: "Palmira" },
  { id: "Floresta", name: "Floresta" },
  { id: "Floralia", name: "Floralia" },
  { id: "Guaduales", name: "Guaduales" },
  { id: "Bogota", name: "Bogota" },
  { id: "Chia", name: "Chia" },
  { id: "Panificadora", name: "Panificadora" },
  { id: "Planta Desposte Mixto", name: "Planta Desposte Mixto" },
  { id: "Planta Desprese Pollo", name: "Planta Desprese Pollo" },
];

export async function GET() {
  const session = await requireAuthSession();
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

  const isAdmin = session.user.role === "admin";
  const allowedDashboards = session.user.allowedDashboards;
  if (
    !isAdmin &&
    Array.isArray(allowedDashboards) &&
    !allowedDashboards.includes("jornada-extendida")
  ) {
    return withSession(
      NextResponse.json(
        { error: "No tienes permisos para este tablero." },
        { status: 403 },
      ),
    );
  }

  const forcedSedeKey = session.user.sede ? normalizeSedeKey(session.user.sede) : null;
  const forcedSede = forcedSedeKey
    ? BASE_SEDES.find((sede) => normalizeSedeKey(sede.name) === forcedSedeKey)
    : null;

  const pool = await getDbPool();
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT DISTINCT fecha::text AS fecha
      FROM asistencia_horas
      WHERE fecha IS NOT NULL
      ORDER BY fecha
    `);

    const dates = (result.rows ?? [])
      .map((row) => (row as { fecha?: string }).fecha?.slice(0, 10))
      .filter((value): value is string => Boolean(value));

    return withSession(
      NextResponse.json({
        dates,
        sedes: forcedSede ? [forcedSede] : BASE_SEDES,
        defaultSede: forcedSede?.name ?? null,
      }),
    );
  } catch (error) {
    return withSession(
      NextResponse.json(
        {
          error:
            "No se pudieron cargar los metadatos de jornada extendida: " +
            (error instanceof Error ? error.message : String(error)),
        },
        { status: 500 },
      ),
    );
  } finally {
    client.release();
  }
}
