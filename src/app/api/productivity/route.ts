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

// Mapeo de centro_operacion + empresa_bd a nombre de sede
// Clave: "numero|empresa" -> Nombre de sede
const SEDE_NAMES: Record<string, string> = {
  // Mercamio
  "001|mercamio": "Calle 5ta",
  "002|mercamio": "La 39",
  "003|mercamio": "Plaza Norte",
  "004|mercamio": "Ciudad Jardín",
  "005|mercamio": "Centro Sur",
  "006|mercamio": "Palmira",
  // Mercatodo (en BD aparece como "mtodo")
  "001|mtodo": "Floresta",
  "002|mtodo": "Floralia",
  "003|mtodo": "Guaduales",
  // Merkmios (en BD aparece como "bogota")
  "001|bogota": "Bogotá",
  "002|bogota": "Chía",
};

// Función para obtener el nombre de sede a partir de centro_operacion y empresa
const getSedeKey = (centroOp: string, empresa: string): string => {
  const normalizedEmpresa = empresa?.toLowerCase().trim() || "";
  return `${centroOp}|${normalizedEmpresa}`;
};

// Convierte fecha de formato YYYYMMDD a YYYY-MM-DD
const formatDate = (dateStr: string): string => {
  if (dateStr.length !== 8) return dateStr;
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  return `${year}-${month}-${day}`;
};

// Mapeo de departamento en asistencia_horas a ID de línea
// Los nombres se normalizan a minúsculas antes de buscar
const DEPARTAMENTO_TO_LINE: Record<string, string> = {
  // Cajas
  cajas: "cajas",
  "supervision y cajas": "cajas",
  // Fruver
  fruver: "fruver",
  // Industria
  industria: "industria",
  // Carnes
  carnes: "carnes",
  // Pollo y pescado
  "pollo y pescado": "pollo y pescado",
  // Asadero
  asadero: "asadero",
};

// Normaliza el nombre del departamento para mapear a línea
const normalizeDepto = (depto: string): string => {
  return depto?.toLowerCase().trim() || "";
};

// Mapeo de nombres de sede en asistencia_horas a nombres del sistema
const SEDE_ASISTENCIA_TO_SYSTEM: Record<string, string> = {
  "merkmios bogota": "Bogotá",
  "mio plaza norte": "Plaza Norte",
  "floresta": "Floresta",
  "la 5a": "Calle 5ta",
  "palmira mercamio": "Palmira",
  "guaduales": "Guaduales",
  "merkmios chia": "Chía",
  "centro sur": "Centro Sur",
  "floralia": "Floralia",
  "la 39": "La 39",
  "ciudad jardin": "Ciudad Jardín",
};

// Normaliza el nombre de sede de asistencia_horas al nombre del sistema
const normalizeSedeAsistencia = (sede: string): string => {
  const normalized = sede?.toLowerCase().trim() || "";
  return SEDE_ASISTENCIA_TO_SYSTEM[normalized] || sede?.trim() || "";
};

const fetchAllProductivityData = async (): Promise<DailyProductivity[]> => {
  const pool = await getDbPool();
  const client = await pool.connect();
  try {
    const dailyDataMap = new Map<string, DailyProductivity>();

    for (const line of LINE_TABLES) {
      try {
        // Consulta que agrupa por fecha, centro_operacion y empresa_bd
        const query = `
          SELECT
            fecha_dcto,
            centro_operacion,
            empresa_bd,
            COALESCE(SUM(total_bruto), 0) AS total_sales
          FROM ${line.table}
          WHERE fecha_dcto IS NOT NULL
            AND centro_operacion IS NOT NULL
          GROUP BY fecha_dcto, centro_operacion, empresa_bd
          ORDER BY fecha_dcto, centro_operacion
        `;

        const result = await client.query(query);

        if (!result.rows) continue;

        for (const row of result.rows) {
          const typedRow = row as {
            fecha_dcto: string;
            centro_operacion: string;
            empresa_bd: string | null;
            total_sales: string | number;
          };
          const fecha = formatDate(typedRow.fecha_dcto);
          const centroOp = typedRow.centro_operacion;
          const empresa = typedRow.empresa_bd || "";
          const sedeKey = getSedeKey(centroOp, empresa);
          const sedeName = SEDE_NAMES[sedeKey] || `Sede ${centroOp} ${empresa}`.trim();
          const key = `${fecha}_${sedeName}`;

          // Obtener o crear el registro de DailyProductivity
          let dailyData = dailyDataMap.get(key);
          if (!dailyData) {
            dailyData = {
              date: fecha,
              sede: sedeName,
              lines: [],
            };
            dailyDataMap.set(key, dailyData);
          }

          // Buscar la línea existente o crearla
          let lineMetric = dailyData.lines.find((l) => l.id === line.id);
          if (!lineMetric) {
            lineMetric = {
              id: line.id,
              name: line.name,
              sales: 0,
              hours: 0,
              hourlyRate: 0,
            };
            dailyData.lines.push(lineMetric);
          }

          // Sumar las ventas
          lineMetric.sales += Number(typedRow.total_sales) || 0;
        }
      } catch (error) {
        console.warn(
          `No se pudo consultar la tabla ${line.table}. Se omite.`,
          error,
        );
      }
    }

    // Consultar horas de asistencia_horas
    try {
      const hoursQuery = `
        SELECT
          fecha,
          sede,
          departamento,
          COALESCE(SUM(total_laborado_horas), 0) AS total_hours
        FROM asistencia_horas
        WHERE fecha IS NOT NULL
          AND sede IS NOT NULL
          AND departamento IS NOT NULL
        GROUP BY fecha, sede, departamento
        ORDER BY fecha, sede
      `;

      const hoursResult = await client.query(hoursQuery);

      // DEBUG: Resumen inicial
      console.log("=== DEBUG HORAS ===");
      console.log("Claves ventas:", dailyDataMap.size);
      console.log("Primeras 5 claves ventas:", Array.from(dailyDataMap.keys()).slice(0, 5));
      console.log("Filas horas:", hoursResult.rows?.length ?? 0);

      let horasAsignadas = 0;
      let filasSkipped = 0;
      let primerFila = true;

      if (hoursResult.rows) {
        for (const row of hoursResult.rows) {
          const typedRow = row as {
            fecha: string;
            sede: string;
            departamento: string;
            total_hours: string | number;
          };

          // Formatear fecha (viene como Date de PostgreSQL o string YYYY-MM-DD)
          let fecha: string;
          if (typeof typedRow.fecha === "string") {
            // Si ya viene como string, usar directamente (puede ser "YYYY-MM-DD")
            fecha = typedRow.fecha.slice(0, 10);
          } else {
            // Si es objeto Date, extraer fecha en zona local para evitar desfase UTC
            const fechaObj = new Date(typedRow.fecha);
            const year = fechaObj.getFullYear();
            const month = String(fechaObj.getMonth() + 1).padStart(2, "0");
            const day = String(fechaObj.getDate()).padStart(2, "0");
            fecha = `${year}-${month}-${day}`;
          }
          const sedeName = normalizeSedeAsistencia(typedRow.sede);
          const depto = normalizeDepto(typedRow.departamento);
          const lineId = DEPARTAMENTO_TO_LINE[depto];

          // DEBUG: Mostrar solo las primeras 3 filas
          if (primerFila) {
            const hoursKey = `${fecha}_${sedeName}`;
            const existsInVentas = dailyDataMap.has(hoursKey);
            console.log("Primera fila horas:", {
              fechaRaw: typedRow.fecha,
              fechaFormateada: fecha,
              sedeRaw: typedRow.sede,
              sedeNorm: sedeName,
              hoursKey,
              existsInVentas,
              deptoRaw: typedRow.departamento,
              lineId,
            });
            primerFila = false;
          }

          if (!lineId || !sedeName) {
            filasSkipped++;
            continue;
          }

          const key = `${fecha}_${sedeName}`;
          let dailyData = dailyDataMap.get(key);

          // Si no existe el registro, crearlo (puede haber horas sin ventas)
          if (!dailyData) {
            dailyData = {
              date: fecha,
              sede: sedeName,
              lines: [],
            };
            dailyDataMap.set(key, dailyData);
          }

          // Buscar o crear la línea
          let lineMetric = dailyData.lines.find((l) => l.id === lineId);
          if (!lineMetric) {
            const lineInfo = LINE_TABLES.find((l) => l.id === lineId);
            lineMetric = {
              id: lineId,
              name: lineInfo?.name || lineId,
              sales: 0,
              hours: 0,
              hourlyRate: 0,
            };
            dailyData.lines.push(lineMetric);
          }

          const horasValue = Number(typedRow.total_hours) || 0;
          lineMetric.hours += horasValue;
          horasAsignadas += horasValue;
        }
      }

      // Obtener sedes únicas de horas
      const sedesHoras = new Set<string>();
      if (hoursResult.rows) {
        for (const row of hoursResult.rows) {
          const typedRow = row as { sede: string };
          const sedeNorm = normalizeSedeAsistencia(typedRow.sede);
          if (sedeNorm) sedesHoras.add(sedeNorm);
        }
      }
      console.log("Sedes únicas en horas:", Array.from(sedesHoras));
      console.log("Sedes únicas en ventas:", Array.from(new Set(Array.from(dailyDataMap.values()).map(d => d.sede))));
      console.log("Resumen:", { horasAsignadas, filasSkipped });
    } catch (error) {
      console.warn("No se pudo consultar la tabla asistencia_horas:", error);
    }

    // Convertir el mapa a array y asegurarse de que cada fecha tenga todas las líneas
    const result: DailyProductivity[] = [];
    for (const dailyData of dailyDataMap.values()) {
      // Asegurar que todas las líneas estén presentes (incluso con ventas 0)
      for (const line of LINE_TABLES) {
        if (!dailyData.lines.find((l) => l.id === line.id)) {
          dailyData.lines.push({
            id: line.id,
            name: line.name,
            sales: 0,
            hours: 0,
            hourlyRate: 0,
          });
        }
      }
      result.push(dailyData);
    }

    const sortedResult = result.sort((a, b) => a.date.localeCompare(b.date));

    // DEBUG: Verificar que los datos finales tienen horas
    const sampleWithHours = sortedResult.find((d) =>
      d.lines.some((l) => l.hours > 0)
    );
    if (sampleWithHours) {
      const lineWithHours = sampleWithHours.lines.find((l) => l.hours > 0);
      console.log("Ejemplo con horas:", {
        fecha: sampleWithHours.date,
        sede: sampleWithHours.sede,
        linea: lineWithHours?.id,
        horas: lineWithHours?.hours,
      });
    } else {
      console.log("ADVERTENCIA: Ningún registro tiene horas > 0");
    }

    return sortedResult;
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
    const dailyData = await fetchAllProductivityData();
    if (dailyData.length > 0) {
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
    console.error("Error en endpoint de productividad:", error);
    return buildFallbackResponse(
      `Error de conexión: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
