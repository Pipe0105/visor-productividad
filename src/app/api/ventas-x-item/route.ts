import { NextResponse } from "next/server";
import { getSessionCookieOptions, requireAuthSession } from "@/lib/auth";
import { getDbPool } from "@/lib/db";

type VentasXItemDbRow = {
  empresa: string | null;
  fecha_dcto: string | null;
  id_co: string | null;
  id_item: string | null;
  descripcion: string | null;
  linea: string | null;
  und_dia: string | number | null;
  venta_sin_impuesto_dia: string | number | null;
  und_acum: string | number | null;
  venta_sin_impuesto_acum: string | number | null;
};

const toNumber = (value: string | number | null | undefined) =>
  Number(value ?? 0) || 0;

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 90;
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

const getClientIp = (request: Request) => {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("cf-connecting-ip") ??
    "unknown"
  );
};

const checkRateLimit = (request: Request) => {
  const now = Date.now();
  const clientIp = getClientIp(request);
  const entry = rateLimitStore.get(clientIp);
  if (!entry || entry.resetAt <= now) {
    rateLimitStore.set(clientIp, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return null;
  }
  if (entry.count >= RATE_LIMIT_MAX) return entry.resetAt;
  entry.count += 1;
  return null;
};

const isDateKey = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

export async function GET(request: Request) {
  const session = await requireAuthSession();
  if (!session) {
    return NextResponse.json(
      { error: "No autorizado." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const withSession = (response: NextResponse) => {
    response.cookies.set(
      "vp_session",
      session.token,
      getSessionCookieOptions(session.expiresAt),
    );
    return response;
  };

  const allowedDashboards = session.user.allowedDashboards;
  if (
    session.user.role !== "admin" &&
    Array.isArray(allowedDashboards) &&
    !allowedDashboards.includes("ventas-x-item")
  ) {
    return withSession(
      NextResponse.json(
        { error: "No tienes permisos para este tablero." },
        { status: 403 },
      ),
    );
  }

  const limitedUntil = checkRateLimit(request);
  if (limitedUntil) {
    const retryAfterSeconds = Math.ceil((limitedUntil - Date.now()) / 1000);
    return withSession(
      NextResponse.json(
        { error: "Demasiadas solicitudes. Intenta mas tarde." },
        {
          status: 429,
          headers: {
            "Retry-After": retryAfterSeconds.toString(),
            "Cache-Control": "no-store",
          },
        },
      ),
    );
  }

  const url = new URL(request.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  const maxRowsParam = Number(url.searchParams.get("maxRows") ?? 150000);
  const maxRows = Number.isFinite(maxRowsParam)
    ? Math.max(1000, Math.min(500000, Math.floor(maxRowsParam)))
    : 150000;

  if (start && !isDateKey(start)) {
    return withSession(
      NextResponse.json(
        { error: "Formato de start invalido. Use YYYY-MM-DD." },
        { status: 400 },
      ),
    );
  }
  if (end && !isDateKey(end)) {
    return withSession(
      NextResponse.json(
        { error: "Formato de end invalido. Use YYYY-MM-DD." },
        { status: 400 },
      ),
    );
  }
  if (start && end && start > end) {
    return withSession(
      NextResponse.json(
        { error: "start no puede ser mayor que end." },
        { status: 400 },
      ),
    );
  }

  const pool = await getDbPool();
  const client = await pool.connect();
  try {
    const tableCheck = await client.query(
      `
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'ventas_item_diario'
      LIMIT 1
      `,
    );
    if (!tableCheck.rows || tableCheck.rows.length === 0) {
      return withSession(
        NextResponse.json(
          {
            rows: [],
            total: 0,
            error:
              "Falta aplicar migracion de Ventas X item (db/migrations/20260303_ventas_x_item.sql).",
          },
          { status: 503, headers: { "Cache-Control": "no-store" } },
        ),
      );
    }

    const params: unknown[] = [];
    const where: string[] = ["parsed.fecha_norm IS NOT NULL"];

    if (start) {
      params.push(start);
      where.push(`parsed.fecha_norm >= $${params.length}::date`);
    }
    if (end) {
      params.push(end);
      where.push(`parsed.fecha_norm <= $${params.length}::date`);
    }
    params.push(maxRows);

    const result = await client.query(
      `
      WITH base AS (
        SELECT
          empresa,
          fecha_dcto::text AS fecha_dcto,
          id_co::text AS id_co,
          id_item::text AS id_item,
          descripcion,
          linea,
          und_dia,
          venta_sin_impuesto_dia,
          und_acum,
          venta_sin_impuesto_acum
        FROM ventas_item_diario
      ),
      parsed AS (
        SELECT
          base.*,
          CASE
            WHEN base.fecha_dcto ~ '^[0-9]{8}$' THEN TO_DATE(base.fecha_dcto, 'YYYYMMDD')
            WHEN base.fecha_dcto ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN base.fecha_dcto::date
            ELSE NULL::date
          END AS fecha_norm
        FROM base
      )
      SELECT
        parsed.empresa,
        parsed.fecha_dcto,
        parsed.id_co,
        parsed.id_item,
        parsed.descripcion,
        parsed.linea,
        parsed.und_dia,
        parsed.venta_sin_impuesto_dia,
        parsed.und_acum,
        parsed.venta_sin_impuesto_acum
      FROM parsed
      WHERE ${where.join(" AND ")}
      ORDER BY parsed.fecha_norm, parsed.empresa, parsed.id_co, parsed.id_item
      LIMIT $${params.length}
      `,
      params,
    );

    const rows = ((result.rows ?? []) as VentasXItemDbRow[]).map((row) => ({
      empresa: row.empresa ?? "",
      fecha_dcto: row.fecha_dcto ?? "",
      id_co: row.id_co ?? "",
      id_item: row.id_item ?? "",
      descripcion: row.descripcion ?? "",
      linea: row.linea ?? "",
      und_dia: toNumber(row.und_dia),
      venta_sin_impuesto_dia: toNumber(row.venta_sin_impuesto_dia),
      und_acum: toNumber(row.und_acum),
      venta_sin_impuesto_acum: toNumber(row.venta_sin_impuesto_acum),
    }));

    return withSession(
      NextResponse.json(
        {
          rows,
          total: rows.length,
          source: "database",
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        },
      ),
    );
  } catch (error) {
    return withSession(
      NextResponse.json(
        {
          rows: [],
          total: 0,
          error:
            "No se pudieron cargar los datos de ventas x item: " +
            (error instanceof Error ? error.message : String(error)),
        },
        { status: 500, headers: { "Cache-Control": "no-store" } },
      ),
    );
  } finally {
    client.release();
  }
}
