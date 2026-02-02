import { getDbPool, testDbConnection } from "@/lib/db";
import type { HourlyAnalysisData, HourlyLineSales, HourSlot } from "@/types";

// ============================================================================
// CONSTANTES DE MAPEO (replicadas de productivity/route.ts)
// ============================================================================

const LINE_TABLES = [
  { id: "cajas", name: "Cajas", table: "ventas_cajas" },
  { id: "fruver", name: "Fruver", table: "ventas_fruver" },
  { id: "industria", name: "Industria", table: "ventas_industria" },
  { id: "carnes", name: "Carnes", table: "ventas_carnes" },
  { id: "pollo y pescado", name: "Pollo y pescado", table: "ventas_pollo_pesc" },
  { id: "asadero", name: "Asadero", table: "ventas_asadero" },
] as const;

const SEDE_NAMES: Record<string, string> = {
  "001|mercamio": "Calle 5ta",
  "002|mercamio": "La 39",
  "003|mercamio": "Plaza Norte",
  "004|mercamio": "Ciudad Jardín",
  "005|mercamio": "Centro Sur",
  "006|mercamio": "Palmira",
  "001|mtodo": "Floresta",
  "002|mtodo": "Floralia",
  "003|mtodo": "Guaduales",
  "001|bogota": "Bogotá",
  "002|bogota": "Chía",
};

// Reverse: nombre de sede -> { centro, empresa }
const REVERSE_SEDE: Record<string, { centro: string; empresa: string }> = {};
for (const [key, name] of Object.entries(SEDE_NAMES)) {
  const [centro, empresa] = key.split("|");
  REVERSE_SEDE[name] = { centro, empresa };
}

const SEDE_ASISTENCIA_TO_SYSTEM: Record<string, string> = {
  "merkmios bogota": "Bogotá",
  "mio plaza norte": "Plaza Norte",
  floresta: "Floresta",
  "la 5a": "Calle 5ta",
  "palmira mercamio": "Palmira",
  guaduales: "Guaduales",
  "merkmios chia": "Chía",
  "centro sur": "Centro Sur",
  floralia: "Floralia",
  "floralia mercatodo": "Floralia",
  "mercatodo floralia": "Floralia",
  "la 39": "La 39",
  "ciudad jardin": "Ciudad Jardín",
};

// Reverse: nombre del sistema -> nombres raw en asistencia_horas
const REVERSE_SEDE_ASISTENCIA: Record<string, string[]> = {};
for (const [raw, system] of Object.entries(SEDE_ASISTENCIA_TO_SYSTEM)) {
  if (!REVERSE_SEDE_ASISTENCIA[system]) {
    REVERSE_SEDE_ASISTENCIA[system] = [];
  }
  REVERSE_SEDE_ASISTENCIA[system].push(raw);
}

const DEPARTAMENTO_TO_LINE: Record<string, string> = {
  cajas: "cajas",
  "supervision y cajas": "cajas",
  fruver: "fruver",
  "surtidor fruver": "fruver",
  industria: "industria",
  surtidores: "industria",
  carnes: "carnes",
  "carnes rojas": "carnes",
  "pollo y pescado": "pollo y pescado",
  "surtidor (a) pollo y pescado": "pollo y pescado",
  asadero: "asadero",
  "pollo asado": "asadero",
};

const normalizeDepto = (depto: string): string => {
  return (
    depto
      ?.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim() || ""
  );
};

const resolveLineId = (depto: string): string | undefined => {
  const normalized = normalizeDepto(depto);
  if (!normalized) return undefined;

  const direct = DEPARTAMENTO_TO_LINE[normalized];
  if (direct) return direct;

  if (normalized.includes("asadero") || normalized.includes("asado"))
    return "asadero";
  if (
    normalized.includes("pollo") ||
    normalized.includes("pescado") ||
    normalized.includes("mariscos")
  )
    return "pollo y pescado";
  if (
    normalized.includes("fruver") ||
    normalized.includes("fruta") ||
    normalized.includes("verdura")
  )
    return "fruver";
  if (normalized.includes("caja")) return "cajas";
  if (normalized.includes("industria") || normalized.includes("surtidor"))
    return "industria";
  if (normalized.includes("carn")) return "carnes";

  return undefined;
};

// ============================================================================
// UTILIDADES DE PARSEO
// ============================================================================

/** Extrae la hora (0-23) de un valor que puede ser entero, string de tiempo, o Date */
const parseHour = (raw: unknown): number | null => {
  if (raw === null || raw === undefined) return null;

  if (typeof raw === "number") {
    const h = Math.floor(raw);
    return h >= 0 && h <= 23 ? h : null;
  }

  if (raw instanceof Date) {
    const h = raw.getHours();
    return h >= 0 && h <= 23 ? h : null;
  }

  const str = String(raw).trim();
  if (!str) return null;

  // Entero directo: "8", "14"
  const asInt = parseInt(str, 10);
  if (!isNaN(asInt) && asInt >= 0 && asInt <= 23 && /^\d{1,2}$/.test(str)) {
    return asInt;
  }

  // Formato de tiempo: "08:30:00", "14:00", etc.
  const timeMatch = str.match(/^(\d{1,2}):/);
  if (timeMatch) {
    const hour = parseInt(timeMatch[1], 10);
    if (hour >= 0 && hour <= 23) return hour;
  }

  return null;
};

/**
 * Determina en qué horas (0-23) un empleado estuvo presente.
 * Presente desde hora_entrada hasta hora_salida, ausente en el rango
 * hora_intermedia1..hora_intermedia2 (descanso).
 */
const computePresenceHours = (
  horaEntrada: unknown,
  horaIntermedia1: unknown,
  horaIntermedia2: unknown,
  horaSalida: unknown,
): Set<number> => {
  const present = new Set<number>();

  const entry = parseHour(horaEntrada);
  const exit = parseHour(horaSalida);
  if (entry === null || exit === null) return present;

  const break1 = parseHour(horaIntermedia1);
  const break2 = parseHour(horaIntermedia2);

  for (let h = entry; h <= exit && h <= 23; h++) {
    if (break1 !== null && break2 !== null && h >= break1 && h < break2) {
      continue;
    }
    present.add(h);
  }

  return present;
};

// ============================================================================
// RATE LIMITING
// ============================================================================

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 120;
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

const getClientIp = (request: Request) => {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
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
    rateLimitStore.set(clientIp, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return null;
  }
  if (entry.count >= RATE_LIMIT_MAX) return entry.resetAt;
  entry.count += 1;
  return null;
};

// ============================================================================
// FETCH DATA
// ============================================================================

const fetchHourlyData = async (
  dateISO: string,
  sedeName: string,
): Promise<HourlyAnalysisData> => {
  const pool = await getDbPool();
  const client = await pool.connect();

  try {
    // Preparar fecha en formato YYYYMMDD para las tablas de ventas
    const dateParts = dateISO.split("-");
    const dateCompact = dateParts.join("");

    // Reverse lookup: sede -> (centro_operacion, empresa_bd)
    const sedeInfo = REVERSE_SEDE[sedeName];

    // Reverse lookup: sede -> nombre raw en asistencia_horas
    const rawAsistenciaSedeList = REVERSE_SEDE_ASISTENCIA[sedeName] ?? [];
    // Buscar todas las posibles variantes de nombre raw
    const asistenciaSedeVariants: string[] = [];
    if (rawAsistenciaSedeList.length > 0) {
      asistenciaSedeVariants.push(...rawAsistenciaSedeList);
    }
    // Agregar el nombre del sistema directamente como fallback
    asistenciaSedeVariants.push(sedeName);

    // Map<hour, Map<lineId, totalSales>>
    const salesByHourByLine = new Map<number, Map<string, number>>();

    // Consultar ventas en paralelo para todas las tablas
    if (sedeInfo) {
      const salesPromises = LINE_TABLES.map(async (line) => {
        try {
          const query = `
            SELECT
              hora_final_hora,
              COALESCE(SUM(total_bruto), 0) AS total_sales
            FROM ${line.table}
            WHERE fecha_dcto = $1
              AND centro_operacion = $2
              AND (empresa_bd = $3 OR ($3 IS NULL AND empresa_bd IS NULL))
            GROUP BY hora_final_hora
            ORDER BY hora_final_hora
          `;

          const result = await client.query(query, [
            dateCompact,
            sedeInfo.centro,
            sedeInfo.empresa || null,
          ]);

          if (!result.rows) return;

          for (const row of result.rows) {
            const typedRow = row as {
              hora_final_hora: unknown;
              total_sales: string | number;
            };
            const hour = parseHour(typedRow.hora_final_hora);
            if (hour === null) continue;

            if (!salesByHourByLine.has(hour)) {
              salesByHourByLine.set(hour, new Map());
            }
            const lineMap = salesByHourByLine.get(hour)!;
            lineMap.set(
              line.id,
              (lineMap.get(line.id) ?? 0) + (Number(typedRow.total_sales) || 0),
            );
          }
        } catch (error) {
          console.warn(
            `[hourly-analysis] Error consultando ${line.table}:`,
            error,
          );
        }
      });

      await Promise.all(salesPromises);
    }

    // Consultar asistencia para presencia por hora
    const presenceByHour = new Map<number, number>();

    try {
      // Construir la condición WHERE para las variantes de sede
      const sedePlaceholders = asistenciaSedeVariants
        .map((_, i) => `$${i + 2}`)
        .join(", ");

      const attendanceQuery = `
        SELECT
          hora_entrada,
          hora_intermedia1,
          hora_intermedia2,
          hora_salida,
          departamento
        FROM asistencia_horas
        WHERE fecha = $1
          AND LOWER(TRIM(sede)) IN (${sedePlaceholders})
          AND departamento IS NOT NULL
      `;

      const params = [
        dateISO,
        ...asistenciaSedeVariants.map((s) => s.toLowerCase().trim()),
      ];

      const attendanceResult = await client.query(attendanceQuery, params);

      if (attendanceResult.rows) {
        for (const row of attendanceResult.rows) {
          const typedRow = row as {
            hora_entrada: unknown;
            hora_intermedia1: unknown;
            hora_intermedia2: unknown;
            hora_salida: unknown;
            departamento: string;
          };

          // Solo contar empleados de departamentos conocidos
          const lineId = resolveLineId(typedRow.departamento);
          if (!lineId) continue;

          const hours = computePresenceHours(
            typedRow.hora_entrada,
            typedRow.hora_intermedia1,
            typedRow.hora_intermedia2,
            typedRow.hora_salida,
          );

          for (const h of hours) {
            presenceByHour.set(h, (presenceByHour.get(h) ?? 0) + 1);
          }
        }
      }
    } catch (error) {
      console.warn("[hourly-analysis] Error consultando asistencia_horas:", error);
    }

    // Construir slots de 24 horas
    const hours: HourSlot[] = [];
    for (let h = 0; h < 24; h++) {
      const lineSalesMap = salesByHourByLine.get(h) ?? new Map<string, number>();
      const lines: HourlyLineSales[] = LINE_TABLES.map((lt) => ({
        lineId: lt.id,
        lineName: lt.name,
        sales: lineSalesMap.get(lt.id) ?? 0,
      }));

      const totalSales = lines.reduce((sum, l) => sum + l.sales, 0);

      hours.push({
        hour: h,
        label: `${String(h).padStart(2, "0")}:00 – ${String((h + 1) % 24).padStart(2, "0")}:00`,
        totalSales,
        employeesPresent: presenceByHour.get(h) ?? 0,
        lines,
      });
    }

    return { date: dateISO, sede: sedeName, hours };
  } finally {
    client.release();
  }
};

// ============================================================================
// HANDLER
// ============================================================================

export async function GET(request: Request) {
  const limitedUntil = checkRateLimit(request);
  if (limitedUntil) {
    const retryAfterSeconds = Math.ceil((limitedUntil - Date.now()) / 1000);
    return Response.json(
      { error: "Demasiadas solicitudes. Intenta mas tarde." },
      {
        status: 429,
        headers: {
          "Retry-After": retryAfterSeconds.toString(),
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date");
  const sedeParam = url.searchParams.get("sede");

  if (!dateParam || !sedeParam) {
    return Response.json(
      { error: "Parametros 'date' y 'sede' son requeridos." },
      { status: 400 },
    );
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return Response.json(
      { error: "Formato de fecha invalido. Use YYYY-MM-DD." },
      { status: 400 },
    );
  }

  try {
    await testDbConnection();
    const data = await fetchHourlyData(dateParam, sedeParam);

    return Response.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[hourly-analysis] Error:", error);
    return Response.json(
      {
        error: `Error de conexion: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 },
    );
  }
}
