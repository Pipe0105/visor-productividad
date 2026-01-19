import { getPool } from "@/lib/db";
import { mockDailyData, sedes as mockSedes } from "@/lib/mock-data";
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

type LineGroup = {
  id: string;
  name: string;
};

const toDateKey = (value: Date | string) => {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return value.slice(0, 10);
};

const normalizeLineId = (value: string) => value.trim().padStart(2, "0");

const resolveLineGroup = (row: ProductivityRow): LineGroup => {
  const lineName = row.line_name?.toLowerCase().trim() ?? "";
  if (lineName === "cajas" || lineName === "caja") {
    return { id: "cajas", name: "Cajas" };
  }
  if (lineName === "asadero" || lineName === "asaderp") {
    return { id: "asadero", name: "Asadero" };
  }

  const lineId = normalizeLineId(String(row.line_id ?? ""));
  if (lineId === "01") {
    return { id: "fruver", name: "Fruver" };
  }
  if (lineId === "02") {
    return { id: "carnes", name: "Carnes" };
  }
  if (lineId === "03" || lineId === "04") {
    return { id: "pollo y pescado", name: "Pollo y pescado" };
  }
  return { id: "industria", name: "Industria" };
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
  const tableName = process.env.PRODUCTIVITY_TABLE ?? "movimientos";
  const isValidTableName = /^[a-zA-Z0-9_.]+$/.test(tableName);
  if (!isValidTableName) {
    return Response.json(
      {
        error:
          "PRODUCTIVITY_TABLE must contain only letters, numbers, underscores, or dots.",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (process.env.USE_MOCK_DATA === "true") {
    return Response.json(
      { dailyData: mockDailyData, sedes: mockSedes },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  let pool;
  try {
    pool = getPool();
  } catch (error) {
    const message = "No se pudo conectar a la base de datos.";
    if (process.env.NODE_ENV !== "production") {
      return Response.json(
        { dailyData: mockDailyData, sedes: mockSedes },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    return Response.json(
      { error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  let result;
  try {
    result = await pool.query<ProductivityRow>(
      `
        SELECT
          fecha_dcto AS date,
          empresa AS sede,
          id_linea1 AS line_id,
          nombre_linea1 AS line_name,
          cantidad AS quantity,
          ven_totales AS sales
        FROM ${tableName}
        ORDER BY date ASC, sede ASC, line_name ASC
      `,
    );
  } catch (error) {
    const message =
      process.env.NODE_ENV !== "production" && error instanceof Error
        ? error.message
        : "No se pudo consultar la base de datos.";
    if (process.env.NODE_ENV !== "production") {
      return Response.json(
        { dailyData: mockDailyData, sedes: mockSedes },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    return Response.json(
      { error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  const cached = await readCache();
  if (cached) {
    return Response.json(
      { dailyData: cached, sedes: buildSedes(cached) },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

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

  result.rows.forEach((row) => {
    const dateKey = toDateKey(row.date);
    const dailyKey = `${dateKey}|${row.sede}`;
    const lineGroup = resolveLineGroup(row);
    const lineKey = `${dailyKey}|${lineGroup.id}`;
    const existing = lineTotals.get(lineKey) ?? {
      id: lineGroup.id,
      name: lineGroup.name,
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
  const cachedDailyData = (await readCache()) ?? [];
  const mergedDailyData = mergeDailyData(cachedDailyData, dailyData);
  await writeCache(mergedDailyData);
  const sedes = buildSedes(mergedDailyData);

  return Response.json(
    { dailyData: mergedDailyData, sedes },
    { headers: { "Cache-Control": "no-store" } },
  );
}
