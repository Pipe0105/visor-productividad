import { getPool } from "@/lib/db";
import { DailyProductivity } from "@/types";
import { promises as fs } from "fs";
import path from "path";

type ProductivityRow = {
  date: Date | string;
  sede: string;
  line_id: string;
  line_name: string;
  quantity: number;
  sales: number;
};

const toDateKey = (value: Date | string) => {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return value.slice(0, 10);
};

const resolveCachePath = () => {
  const defaultPath = "data/productivity-cache.json";
  const envPath = process.env.PRODUCTIVITY_CACHE_PATH?.trim();
  if (!envPath) {
    return path.resolve(process.cwd(), defaultPath);
  }
  const isSafeRelative =
    !path.isAbsolute(envPath) &&
    !envPath.split(path.sep).includes("..") &&
    /^[\w./-]+$/.test(envPath);
  if (!isSafeRelative) {
    return path.resolve(process.cwd(), defaultPath);
  }
  return path.resolve(process.cwd(), envPath);
};

const cacheFilePath = resolveCachePath();

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 120;
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

const getClientIp = (request: Request) => {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
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
  if (entry.count >= RATE_LIMIT_MAX) {
    return entry.resetAt;
  }
  entry.count += 1;
  return null;
};

const readCache = async (): Promise<DailyProductivity[] | null> => {
  try {
    const raw = await fs.readFile(cacheFilePath, "utf-8");
    const parsed = JSON.parse(raw) as { dailyData?: DailyProductivity[] };
    if (!Array.isArray(parsed.dailyData)) {
      return null;
    }
    return parsed.dailyData;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    return null;
  }
};

const writeCache = async (dailyData: DailyProductivity[]) => {
  await fs.mkdir(path.dirname(cacheFilePath), { recursive: true });
  const payload = {
    updatedAt: new Date().toISOString(),
    dailyData,
  };
  await fs.writeFile(cacheFilePath, JSON.stringify(payload, null, 2));
};

const buildCacheResponse = (dailyData: DailyProductivity[]) =>
  Response.json(
    { dailyData, sedes: buildSedes(dailyData) },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-Data-Source": "cache",
      },
    },
  );

const buildFallbackResponse = (message: string) =>
  Response.json(
    {
      dailyData: [],
      sedes: [],
      error: message,
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-Data-Source": "fallback",
      },
    },
  );

const mergeDailyData = (
  cached: DailyProductivity[],
  fresh: DailyProductivity[],
) => {
  const merged = new Map<string, DailyProductivity>();
  cached.forEach((entry) => {
    merged.set(`${entry.date}|${entry.sede}`, entry);
  });
  fresh.forEach((entry) => {
    merged.set(`${entry.date}|${entry.sede}`, entry);
  });
  return Array.from(merged.values()).sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) {
      return dateCompare;
    }
    return a.sede.localeCompare(b.sede);
  });
};

const buildSedes = (dailyData: DailyProductivity[]) =>
  Array.from(new Set(dailyData.map((item) => item.sede))).map((sede) => ({
    id: sede,
    name: sede,
  }));

const isValidTableName = (tableName: string) =>
  /^[a-zA-Z0-9_.]+$/.test(tableName);

const fetchLineRows = async (
  pool: ReturnType<typeof getPool>,
  {
    tableName,
    lineId,
    lineName,
    salesColumn,
  }: {
    tableName: string;
    lineId: string;
    lineName: string;
    salesColumn: string;
  },
) => {
  return pool.query<ProductivityRow>(
    `
      SELECT
        fecha_dcto AS date,
        empresa_bd AS sede,
        '${lineId}' AS line_id,
        '${lineName}' AS line_name,
        0 AS quantity,
        SUM(${salesColumn}) AS sales
      FROM ${tableName}
      GROUP BY fecha_dcto, empresa_bd
      ORDER BY date ASC, sede ASC
    `,
  );
};

export async function GET(request: Request) {
  const limitedUntil = checkRateLimit(request);
  if (limitedUntil) {
    const retryAfterSeconds = Math.ceil((limitedUntil - Date.now()) / 1000);
    return Response.json(
      { error: "Demasiadas solicitudes. Intenta más tarde." },
      {
        status: 429,
        headers: {
          "Retry-After": retryAfterSeconds.toString(),
          "Cache-Control": "no-store",
        },
      },
    );
  }
  const cajasTable = process.env.PRODUCTIVITY_TABLE_CAJAS ?? "ventas_cajas";
  const fruverTable = process.env.PRODUCTIVITY_TABLE_FRUVER ?? cajasTable;
  const carnesTable = process.env.PRODUCTIVITY_TABLE_CARNES ?? "ventas_cajas";
  const industriaTable =
    process.env.PRODUCTIVITY_TABLE_INDUSTRIA ?? "ventas_industria";
  const polloPescTable =
    process.env.PRODUCTIVITY_TABLE_POLLO_PESC ?? "ventas_pollo_pesc";
  const tableNames = [
    cajasTable,
    fruverTable,
    carnesTable,
    industriaTable,
    polloPescTable,
  ];
  if (!tableNames.every(isValidTableName)) {
    return Response.json(
      {
        error:
          "Productivity tables must contain only letters, numbers, underscores, or dots.",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  let pool;
  try {
    pool = getPool();
  } catch (error) {
    const cached = await readCache();
    if (cached && cached.length > 0) {
      return buildCacheResponse(cached);
    }
    const message =
      process.env.NODE_ENV !== "production" && error instanceof Error
        ? error.message
        : "No se pudo conectar a la base de datos.";
    return buildFallbackResponse(message);
  }

  try {
    const [
      cajasResult,
      fruverResult,
      carnesResult,
      industriaResult,
      polloPescResult,
    ] = await Promise.all([
      fetchLineRows(pool, {
        tableName: cajasTable,
        lineId: "cajas",
        lineName: "Cajas",
        salesColumn: "total_bruto",
      }),
      fetchLineRows(pool, {
        tableName: fruverTable,
        lineId: "fruver",
        lineName: "Fruver",
        salesColumn: "total_bruto",
      }),
      fetchLineRows(pool, {
        tableName: carnesTable,
        lineId: "carnes",
        lineName: "Carnes",
        salesColumn: "total_bruto",
      }),
      fetchLineRows(pool, {
        tableName: industriaTable,
        lineId: "industria",
        lineName: "Industria",
        salesColumn: "total_bruto",
      }),
      fetchLineRows(pool, {
        tableName: polloPescTable,
        lineId: "pollo y pescado",
        lineName: "Pollo y pescado",
        salesColumn: "total_bruto",
      }),
    ]);

    const rows = [
      ...cajasResult.rows,
      ...fruverResult.rows,
      ...carnesResult.rows,
      ...industriaResult.rows,
      ...polloPescResult.rows,
    ];
    const cached = await readCache();

    const grouped = new Map<string, DailyProductivity>();
    const lineTotals = new Map<
      string,
      {
        id: string;
        name: string;
        sales: number;
        hours: number;
        laborCost: number;
      }
    >();

    rows.forEach((row) => {
      const dateKey = toDateKey(row.date);
      const dailyKey = `${dateKey}|${row.sede}`;
      const lineKey = `${dailyKey}|${row.line_id}`;
      const existing = lineTotals.get(lineKey) ?? {
        id: row.line_id,
        name: row.line_name,
        sales: 0,
        hours: 0,
        laborCost: 0,
      };

      const sales = Number(row.sales ?? 0);
      const hours = Number(row.quantity ?? 0);
      const hourlyRate = 0;

      existing.sales += Number.isNaN(sales) ? 0 : sales;
      existing.hours += Number.isNaN(hours) ? 0 : hours;
      existing.laborCost +=
        (Number.isNaN(hours) ? 0 : hours) *
        (Number.isNaN(hourlyRate) ? 0 : hourlyRate);
      lineTotals.set(lineKey, existing);

      if (!grouped.has(dailyKey)) {
        grouped.set(dailyKey, {
          date: dateKey,
          sede: row.sede,
          lines: [],
        });
      }
    });

    lineTotals.forEach((line, key) => {
      const [dateKey, sede] = key.split("|");
      const dailyKey = `${dateKey}|${sede}`;
      const dailyEntry = grouped.get(dailyKey);
      if (!dailyEntry) {
        return;
      }
      const hourlyRate = line.hours ? line.laborCost / line.hours : 0;
      dailyEntry.lines.push({
        id: line.id,
        name: line.name,
        sales: line.sales,
        hours: line.hours,
        hourlyRate,
      });
    });

    const dailyData = Array.from(grouped.values());
    const cachedDailyData = cached ?? [];
    const mergedDailyData = mergeDailyData(cachedDailyData, dailyData);
    await writeCache(mergedDailyData);
    const sedes = buildSedes(mergedDailyData);

    return Response.json(
      { dailyData: mergedDailyData, sedes },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const cached = await readCache();
    if (cached && cached.length > 0) {
      return buildCacheResponse(cached);
    }
    const message =
      process.env.NODE_ENV !== "production" && error instanceof Error
        ? error.message
        : "No se pudo consultar la base de datos.";
    return buildFallbackResponse(message);
  }
}
