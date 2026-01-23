import { DailyProductivity } from "@/types";
import { getDbPool, testDbConnection } from "@/lib/db";
import { promises as fs } from "fs";
import path from "path";

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

const buildSedes = (dailyData: DailyProductivity[]) =>
  Array.from(new Set(dailyData.map((item) => item.sede))).map((sede) => ({
    id: sede,
    name: sede,
  }));

const LINE_TABLES: Array<{
  id: DailyProductivity["lines"][number]["id"];
  name: string;
  table: string;
}> = [
  { id: "cajas", name: "Cajas", table: "ventas_cajas" },
  { id: "fruver", name: "Fruver", table: "ventas_fruver" },
  { id: "industria", name: "Industria", table: "ventas_industria" },
  { id: "carnes", name: "Carnes", table: "ventas_carnes" },
  {
    id: "pollo y pescado",
    name: "Pollo y pescado",
    table: "ventas_pollo_pesc",
  },
  { id: "asadero", name: "Asadero", table: "ventas_asadero" },
];

const fetchLineSalesTotals = async () => {
  const pool = await getDbPool();
  const client = await pool.connect();
  try {
    const results = await Promise.all(
      LINE_TABLES.map(async (line) => {
        let total = 0;
        try {
          const result = await client.query(
            `SELECT COALESCE(SUM(total_bruto), 0) AS total FROM ${line.table}`,
          );
          total = Number(result.rows?.[0]?.total ?? 0);
        } catch (error) {
          console.warn(
            `No se pudo consultar la tabla ${line.table}. Se usa total 0.`,
            error,
          );
        }
        return {
          id: line.id,
          name: line.name,
          sales: Number.isFinite(total) ? total : 0,
          hours: 0,
          hourlyRate: 0,
        };
      }),
    );
    return results;
  } finally {
    client.release();
  }
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
  const cached = await readCache();
  if (cached && cached.length > 0) {
    return buildCacheResponse(cached);
  }
  try {
    await testDbConnection();
    const lines = await fetchLineSalesTotals();
    if (lines.length > 0) {
      const today = new Date().toISOString().slice(0, 10);
      const dailyData: DailyProductivity[] = [
        {
          date: today,
          sede: "Total",
          lines,
        },
      ];
      return Response.json(
        {
          dailyData,
          sedes: buildSedes(dailyData),
        },
        {
          headers: {
            "Cache-Control": "no-store",
            "X-Data-Source": "database",
          },
        },
      );
    }
    return Response.json(
      {
        dailyData: [],
        sedes: [],
        message: "Conexión a base de datos establecida. Sin datos aún.",
      },
      {
        headers: {
          "Cache-Control": "no-store",
          "X-Data-Source": "database",
        },
      },
    );
  } catch (error) {
    return buildFallbackResponse("No hay datos de productividad disponibles.");
  }
}
