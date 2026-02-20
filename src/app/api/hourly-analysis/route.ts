import { NextResponse } from "next/server";
import { getDbPool, testDbConnection } from "@/lib/db";
import { getSessionCookieOptions, requireAuthSession } from "@/lib/auth";
import type {
  HourlyAnalysisData,
  HourlyLineSales,
  HourSlot,
  OvertimeEmployee,
} from "@/types";

// ============================================================================
// CONSTANTES
// ============================================================================

const LINE_TABLES = [
  { id: "cajas", name: "Cajas", table: "ventas_cajas" },
  { id: "fruver", name: "Fruver", table: "ventas_fruver" },
  { id: "industria", name: "Industria", table: "ventas_industria" },
  { id: "carnes", name: "Carnes", table: "ventas_carnes" },
  { id: "pollo y pescado", name: "Pollo y pescado", table: "ventas_pollo_pesc" },
  { id: "asadero", name: "Asadero", table: "ventas_asadero" },
] as const;

const LINE_IDS = new Set<string>(LINE_TABLES.map((line) => line.id));

const SEDE_CONFIGS = [
  { name: "Calle 5ta", centro: "001", empresa: "mercamio", attendanceNames: ["la 5a", "calle 5ta"], aliases: ["calle 5ta", "la 5a", "la 5"] },
  { name: "La 39", centro: "002", empresa: "mercamio", attendanceNames: ["la 39"], aliases: ["la 39", "39"] },
  { name: "Plaza Norte", centro: "003", empresa: "mercamio", attendanceNames: ["plaza norte", "mio plaza norte"], aliases: ["plaza norte", "mio plaza norte"] },
  { name: "Ciudad Jardin", centro: "004", empresa: "mercamio", attendanceNames: ["ciudad jardin"], aliases: ["ciudad jardin", "ciudad jard", "jardin"] },
  { name: "Centro Sur", centro: "005", empresa: "mercamio", attendanceNames: ["centro sur"], aliases: ["centro sur"] },
  { name: "Palmira", centro: "006", empresa: "mercamio", attendanceNames: ["palmira", "palmira mercamio"], aliases: ["palmira", "palmira mercamio"] },
  { name: "Floresta", centro: "001", empresa: "mtodo", attendanceNames: ["floresta"], aliases: ["floresta"] },
  { name: "Floralia", centro: "002", empresa: "mtodo", attendanceNames: ["floralia", "floralia mercatodo", "mercatodo floralia"], aliases: ["floralia", "mercatodo floralia"] },
  { name: "Guaduales", centro: "003", empresa: "mtodo", attendanceNames: ["guaduales"], aliases: ["guaduales"] },
  { name: "Bogota", centro: "001", empresa: "bogota", attendanceNames: ["bogota", "merkmios bogota"], aliases: ["bogota", "bogot", "merkmios bogota", "merkmios bogot"] },
  { name: "Chia", centro: "002", empresa: "bogota", attendanceNames: ["chia", "merkmios chia"], aliases: ["chia", "chi", "ch a", "merkmios chia"] },
] as const;

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
  "surtidor a pollo y pescado": "pollo y pescado",
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

const normalizeSedeName = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const matchSelectedSedeConfigs = (selectedSedes: string[]) => {
  if (selectedSedes.length === 0) return SEDE_CONFIGS;

  const normalizedSelected = selectedSedes.map(normalizeSedeName);
  const matched = SEDE_CONFIGS.filter((cfg) => {
    const aliasPool = [cfg.name, ...cfg.aliases].map(normalizeSedeName);
    return normalizedSelected.some((selected) =>
      aliasPool.some(
        (alias) =>
          selected === alias ||
          selected.includes(alias) ||
          alias.includes(selected),
      ),
    );
  });

  return matched.length > 0 ? matched : SEDE_CONFIGS;
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

const parseMinuteOfDay = (raw: unknown): number | null => {
  if (raw === null || raw === undefined) return null;

  if (typeof raw === "number") {
    const h = Math.floor(raw);
    return h >= 0 && h <= 23 ? h * 60 : null;
  }

  if (raw instanceof Date) {
    const h = raw.getHours();
    const m = raw.getMinutes();
    return h >= 0 && h <= 23 ? h * 60 + m : null;
  }

  const str = String(raw).trim();
  if (!str) return null;

  const asInt = parseInt(str, 10);
  if (!isNaN(asInt) && asInt >= 0 && asInt <= 23 && /^\d{1,2}$/.test(str)) {
    return asInt * 60;
  }

  const timeMatch = str.match(/^(\d{1,2}):(\d{1,2})/);
  if (timeMatch) {
    const hour = parseInt(timeMatch[1], 10);
    const minute = parseInt(timeMatch[2], 10);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return hour * 60 + minute;
    }
  }

  return null;
};

const buildSlotLabel = (slotStartMinute: number, bucketMinutes: number) => {
  const startHour = Math.floor(slotStartMinute / 60);
  const startMinute = slotStartMinute % 60;
  const slotEndMinute = (slotStartMinute + bucketMinutes) % 1440;
  const endHour = Math.floor(slotEndMinute / 60);
  const endMinute = slotEndMinute % 60;
  return `${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")} - ${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
};

const compactDateToISO = (value: string | null | undefined): string | null => {
  if (!value || !/^\d{8}$/.test(value)) return null;
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
};

const EMPLOYEE_ID_COLUMN_CANDIDATES = [
  "identificacion",
  "cedula",
  "cedula_empleado",
  "cedula_colaborador",
  "documento",
  "documento_empleado",
  "documento_colaborador",
  "id_empleado",
  "codigo_empleado",
  "codigo",
  "nit",
  "dni",
  "num_documento",
  "numero_documento",
  "nro_documento",
  "documento_numero",
] as const;

const EMPLOYEE_NAME_COLUMN_CANDIDATES = [
  "nombre_empleado",
  "nombre_trabajador",
  "empleado",
  "trabajador",
  "nombre_completo",
  "nombre_y_apellido",
  "nombre_colaborador",
  "colaborador",
  "nombres_apellidos",
  "nombre",
  "funcionario",
] as const;

const pickAttendanceColumn = (
  columns: Set<string>,
  candidates: readonly string[],
  fuzzyTokens: readonly string[],
): string | null => {
  const exact = candidates.find((col) => columns.has(col));
  if (exact) return exact;

  const fuzzy = Array.from(columns).find((col) => {
    if (col.includes("tipo")) return false;
    return fuzzyTokens.some((token) => col.includes(token));
  });
  return fuzzy ?? null;
};

const isSafeSqlIdentifier = (value: string): boolean =>
  /^[a-z_][a-z0-9_]*$/.test(value);

const toSafeIdentifier = (value: string): string | null =>
  isSafeSqlIdentifier(value) ? `"${value}"` : null;

const parseHoursValue = (value: string | number): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = value.replace(",", ".").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildNormalizeSedeSql = (columnName: string) => `
  REGEXP_REPLACE(
    LOWER(
      TRANSLATE(
        TRIM(${columnName}),
        CHR(225)||CHR(233)||CHR(237)||CHR(243)||CHR(250)||CHR(252)||CHR(241)||CHR(193)||CHR(201)||CHR(205)||CHR(211)||CHR(218)||CHR(220)||CHR(209),
        'aeiouunaeiouun'
      )
    ),
    '[^a-z0-9]+',
    ' ',
    'g'
  )
`;

const computePresenceSlots = (
  horaEntrada: unknown,
  horaIntermedia1: unknown,
  horaIntermedia2: unknown,
  horaSalida: unknown,
  bucketMinutes: number,
): Set<number> => {
  const presentSlots = new Set<number>();

  const entry = parseMinuteOfDay(horaEntrada);
  const exit = parseMinuteOfDay(horaSalida);
  if (entry === null || exit === null) return presentSlots;

  const break1 = parseMinuteOfDay(horaIntermedia1);
  const break2 = parseMinuteOfDay(horaIntermedia2);

  const isInBreak = (minuteOfDay: number) => {
    if (break1 === null || break2 === null) return false;
    if (break1 <= break2) {
      return minuteOfDay >= break1 && minuteOfDay < break2;
    }
    return minuteOfDay >= break1 || minuteOfDay < break2;
  };

  const isInShift = (minuteOfDay: number) => {
    if (entry <= exit) {
      return minuteOfDay >= entry && minuteOfDay <= exit;
    }
    return minuteOfDay >= entry || minuteOfDay <= exit;
  };

  for (let slotStart = 0; slotStart < 1440; slotStart += bucketMinutes) {
    if (isInShift(slotStart) && !isInBreak(slotStart)) {
      presentSlots.add(slotStart);
    }
  }

  return presentSlots;
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
  lineFilter: string | null,
  bucketMinutes: number,
  selectedSedes: string[],
): Promise<HourlyAnalysisData> => {
  const pool = await getDbPool();
  const client = await pool.connect();

  try {
    const dateCompact = dateISO.split("-").join("");
    const selectedLineTables = lineFilter
      ? LINE_TABLES.filter((line) => line.id === lineFilter)
      : LINE_TABLES;
    const selectedSedeConfigs = matchSelectedSedeConfigs(selectedSedes);
    const selectedScopeLabel =
      selectedSedeConfigs.length === 0 || selectedSedeConfigs.length === SEDE_CONFIGS.length
        ? "Todas las sedes"
        : selectedSedeConfigs.map((cfg) => cfg.name).join(", ");
    const salesBranchClauses = selectedSedeConfigs
      .map(
        (_cfg, index) =>
          `(centro_operacion = $${index * 2 + 2} AND (empresa_bd = $${index * 2 + 3} OR ($${index * 2 + 3} IS NULL AND empresa_bd IS NULL)))`,
      )
      .join(" OR ");
    const salesBranchFilter =
      selectedSedeConfigs.length > 0 ? `AND (${salesBranchClauses})` : "AND 1=0";
    const salesBranchParams: Array<string | null> = [];
    selectedSedeConfigs.forEach((cfg) => {
      salesBranchParams.push(cfg.centro, cfg.empresa);
    });

    let salesDateCompact = dateCompact;
    try {
      const latestSalesDateSubqueries = selectedLineTables
        .map(
          (line) => `
            SELECT MAX(fecha_dcto) AS max_fecha
            FROM ${line.table}
            WHERE fecha_dcto <= $1
              ${salesBranchFilter}
          `,
        )
        .join(" UNION ALL ");
      const latestSalesDateResult = await client.query(
        `
          SELECT MAX(max_fecha) AS sales_date
          FROM (
            ${latestSalesDateSubqueries}
          ) AS latest_dates
        `,
        [dateCompact, ...salesBranchParams],
      );
      const candidate = (latestSalesDateResult.rows?.[0] as { sales_date?: string })
        ?.sales_date;
      if (candidate && /^\d{8}$/.test(candidate)) {
        salesDateCompact = candidate;
      }
    } catch (error) {
      console.warn("[hourly-analysis] Error resolviendo fecha de ventas:", error);
    }

    const salesByHourByLine = new Map<number, Map<string, number>>();

    const salesPromises = selectedLineTables.map(async (line) => {
      try {
        const query = `
          SELECT
            hora_final_hora,
            COALESCE(SUM(total_bruto), 0) AS total_sales
          FROM ${line.table}
          WHERE fecha_dcto = $1
            ${salesBranchFilter}
          GROUP BY hora_final_hora
          ORDER BY hora_final_hora
        `;

        const queryParams: Array<string | null> = [salesDateCompact, ...salesBranchParams];
        const result = await client.query(query, queryParams);

        if (!result.rows) return;

        for (const row of result.rows) {
          const typedRow = row as {
            hora_final_hora: unknown;
            total_sales: string | number;
          };
            const minuteOfDay = parseMinuteOfDay(typedRow.hora_final_hora);
            if (minuteOfDay === null) continue;
            const bucketStartMinute =
              Math.floor(minuteOfDay / bucketMinutes) * bucketMinutes;

            if (!salesByHourByLine.has(bucketStartMinute)) {
              salesByHourByLine.set(bucketStartMinute, new Map());
            }
            const lineMap = salesByHourByLine.get(bucketStartMinute)!;
            lineMap.set(
              line.id,
              (lineMap.get(line.id) ?? 0) + (Number(typedRow.total_sales) || 0),
          );
        }
      } catch (error) {
        console.warn(`[hourly-analysis] Error consultando ${line.table}:`, error);
      }
    });

    await Promise.all(salesPromises);

    const presenceByHour = new Map<number, number>();
    const presenceByHourByLine = new Map<number, Map<string, number>>();

    let attendanceDateUsed: string | null = null;
    let overtimeEmployees: OvertimeEmployee[] = [];

    try {
      const selectedAttendanceNames = Array.from(
        new Set(
          selectedSedeConfigs.flatMap((cfg) =>
            [cfg.name, ...cfg.attendanceNames].map((name) =>
              normalizeSedeName(name),
            ),
          ),
        ),
      );
      const attendanceDateResult = await client.query(
        `
        SELECT MAX(fecha::date)::text AS attendance_date
        FROM asistencia_horas
        WHERE fecha::date <= $1::date
          ${
            selectedSedeConfigs.length > 0
              ? `AND ${buildNormalizeSedeSql("sede")} = ANY($2::text[])`
              : "AND 1=0"
          }
        `,
        selectedSedeConfigs.length > 0
          ? [dateISO, selectedAttendanceNames]
          : [dateISO],
      );
      attendanceDateUsed =
        (attendanceDateResult.rows?.[0] as { attendance_date?: string })
          ?.attendance_date ?? null;

      if (!attendanceDateUsed) {
        return {
          date: dateISO,
          scopeLabel: lineFilter
            ? `${selectedScopeLabel} - ${
                selectedLineTables.find((line) => line.id === lineFilter)?.name ??
                lineFilter
              }`
            : selectedScopeLabel,
          attendanceDateUsed: null,
          salesDateUsed: compactDateToISO(salesDateCompact),
          bucketMinutes,
          overtimeEmployees: [],
          hours: Array.from({ length: 1440 / bucketMinutes }, (_, index) => {
            const slotStartMinute = index * bucketMinutes;
            return {
              hour: Math.floor(slotStartMinute / 60),
              slotStartMinute,
              slotEndMinute: (slotStartMinute + bucketMinutes) % 1440,
              label: buildSlotLabel(slotStartMinute, bucketMinutes),
              totalSales: 0,
              employeesPresent: 0,
              employeesByLine: {},
              lines: selectedLineTables.map((lt) => ({
                lineId: lt.id,
                lineName: lt.name,
                sales: 0,
              })),
            };
          }),
        };
      }

      const attendanceQuery = `
        SELECT
          hora_entrada,
          hora_intermedia1,
          hora_intermedia2,
          hora_salida,
          departamento
        FROM asistencia_horas
        WHERE fecha::date = $1::date
          AND departamento IS NOT NULL
          ${
            selectedSedeConfigs.length > 0
              ? `AND ${buildNormalizeSedeSql("sede")} = ANY($2::text[])`
              : "AND 1=0"
          }
      `;
      const attendanceColumnsResult = await client.query(
        `
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'asistencia_horas'
        `,
      );
      const attendanceColumns = new Set(
        (attendanceColumnsResult.rows ?? [])
          .map((row) => (row as { column_name?: string }).column_name?.toLowerCase())
          .filter((value): value is string => Boolean(value)),
      );
      const attendanceParams: unknown[] = [attendanceDateUsed];
      if (selectedSedeConfigs.length > 0) {
        attendanceParams.push(selectedAttendanceNames);
      }
      const attendanceResult = await client.query(attendanceQuery, attendanceParams);

      if (attendanceResult.rows) {
        for (const row of attendanceResult.rows) {
          const typedRow = row as {
            hora_entrada: unknown;
            hora_intermedia1: unknown;
            hora_intermedia2: unknown;
            hora_salida: unknown;
            departamento: string;
          };

          const lineId = resolveLineId(typedRow.departamento);
          if (!lineId) continue;

          const slots = computePresenceSlots(
            typedRow.hora_entrada,
            typedRow.hora_intermedia1,
            typedRow.hora_intermedia2,
            typedRow.hora_salida,
            bucketMinutes,
          );

          for (const slotStartMinute of slots) {
            presenceByHour.set(
              slotStartMinute,
              (presenceByHour.get(slotStartMinute) ?? 0) + 1,
            );

            if (!presenceByHourByLine.has(slotStartMinute)) {
              presenceByHourByLine.set(slotStartMinute, new Map());
            }
            const linePresenceMap = presenceByHourByLine.get(slotStartMinute)!;
            linePresenceMap.set(lineId, (linePresenceMap.get(lineId) ?? 0) + 1);
          }
        }
      }

      if (attendanceColumns.has("total_laborado_horas")) {
        const employeeNameColumn = pickAttendanceColumn(
          attendanceColumns,
          EMPLOYEE_NAME_COLUMN_CANDIDATES,
          ["nombre", "emplead", "trabajador", "colaborador", "funcionario"],
        );
        const firstNameColumn = attendanceColumns.has("nombres")
          ? "nombres"
          : null;
        const lastNameColumn = attendanceColumns.has("apellidos")
          ? "apellidos"
          : null;
        const employeeIdColumns = Array.from(
          new Set([
            ...EMPLOYEE_ID_COLUMN_CANDIDATES.filter((col) =>
              attendanceColumns.has(col),
            ),
            ...Array.from(attendanceColumns).filter((col) => {
              if (col.includes("tipo")) return false;
              return ["cedula", "ident", "document", "doc", "dni", "nit"].some(
                (token) => col.includes(token),
              );
            }),
          ]),
        );
        const employeeIdIdentifiers = employeeIdColumns
          .map((col) => toSafeIdentifier(col))
          .filter((value): value is string => Boolean(value));
        const employeeNameIdentifier = employeeNameColumn
          ? toSafeIdentifier(employeeNameColumn)
          : null;
        const firstNameIdentifier = firstNameColumn
          ? toSafeIdentifier(firstNameColumn)
          : null;
        const lastNameIdentifier = lastNameColumn
          ? toSafeIdentifier(lastNameColumn)
          : null;

        if (
          employeeIdIdentifiers.length > 0 ||
          employeeNameIdentifier ||
          firstNameIdentifier ||
          lastNameIdentifier
        ) {
          const employeeIdExpr =
            employeeIdIdentifiers.length > 0
              ? `COALESCE(${employeeIdIdentifiers
                  .map(
                    (identifier) =>
                      `NULLIF(TRIM(BOTH '"' FROM CAST(${identifier} AS text)), '')`,
                  )
                  .join(", ")})`
              : "NULL::text";
          const employeeNameExpr = employeeNameIdentifier
            ? `NULLIF(TRIM(CAST(${employeeNameIdentifier} AS text)), '')`
            : firstNameIdentifier || lastNameIdentifier
              ? `NULLIF(
                   TRIM(
                     CONCAT_WS(
                       ' ',
                       ${
                         firstNameIdentifier
                           ? `NULLIF(TRIM(CAST(${firstNameIdentifier} AS text)), '')`
                           : "NULL"
                       },
                       ${
                         lastNameIdentifier
                           ? `NULLIF(TRIM(CAST(${lastNameIdentifier} AS text)), '')`
                           : "NULL"
                       }
                     )
                   ),
                   ''
                 )`
              : "NULL::text";
          const overtimeQuery = `
            SELECT
              ${employeeIdExpr} AS employee_id,
              ${employeeNameExpr} AS employee_name,
              NULLIF(TRIM(CAST(sede AS text)), '') AS sede,
              departamento,
              COALESCE(SUM(total_laborado_horas), 0) AS total_hours
            FROM asistencia_horas
            WHERE fecha::date = $1::date
              AND departamento IS NOT NULL
              ${
                selectedSedeConfigs.length > 0
                  ? `AND ${buildNormalizeSedeSql("sede")} = ANY($2::text[])`
                  : "AND 1=0"
              }
            GROUP BY 1, 2, 3, 4
            ORDER BY total_hours DESC
          `;
          const overtimeParams: unknown[] = [attendanceDateUsed];
          if (selectedSedeConfigs.length > 0) {
            overtimeParams.push(selectedAttendanceNames);
          }

          const overtimeResult = await client.query(overtimeQuery, overtimeParams);
          const lineNameById = new Map<string, string>(
            LINE_TABLES.map((line) => [line.id, line.name]),
          );
          for (const row of overtimeResult.rows ?? []) {
            const typedRow = row as {
              employee_id: string | null;
              employee_name: string | null;
              sede: string | null;
              departamento: string;
              total_hours: string | number;
            };
            const lineId = resolveLineId(typedRow.departamento);
            if (lineFilter && lineId !== lineFilter) continue;

            const employeeId = typedRow.employee_id?.trim() || null;
            const employeeNameRaw = typedRow.employee_name?.trim() || "";
            const employeeName =
              employeeNameRaw || employeeId || "Empleado sin nombre";
            const workedHours = parseHoursValue(typedRow.total_hours);
            if (workedHours <= 0) {
              continue;
            }

            overtimeEmployees.push({
              employeeId,
              employeeName,
              workedHours,
              lineName: lineId ? lineNameById.get(lineId) ?? lineId : undefined,
              sede: typedRow.sede?.trim() || undefined,
              department: typedRow.departamento?.trim() || undefined,
              workedDate: attendanceDateUsed,
            });
          }

          overtimeEmployees.sort((a, b) => b.workedHours - a.workedHours);
        }
      }
    } catch (error) {
      console.warn("[hourly-analysis] Error consultando asistencia_horas:", error);
    }

    const hours: HourSlot[] = [];
    for (
      let slotStartMinute = 0;
      slotStartMinute < 1440;
      slotStartMinute += bucketMinutes
    ) {
      const lineSalesMap =
        salesByHourByLine.get(slotStartMinute) ?? new Map<string, number>();
      const linePresenceMap =
        presenceByHourByLine.get(slotStartMinute) ?? new Map<string, number>();

      const lines: HourlyLineSales[] = selectedLineTables.map((lt) => ({
        lineId: lt.id,
        lineName: lt.name,
        sales: lineSalesMap.get(lt.id) ?? 0,
      }));

      const totalSales = lines.reduce((sum, l) => sum + l.sales, 0);
      const employeesByLine = Object.fromEntries(
        selectedLineTables.map((line) => [line.id, linePresenceMap.get(line.id) ?? 0]),
      );

      hours.push({
        hour: Math.floor(slotStartMinute / 60),
        slotStartMinute,
        slotEndMinute: (slotStartMinute + bucketMinutes) % 1440,
        label: buildSlotLabel(slotStartMinute, bucketMinutes),
        totalSales,
        employeesPresent: lineFilter
          ? linePresenceMap.get(lineFilter) ?? 0
          : presenceByHour.get(slotStartMinute) ?? 0,
        employeesByLine,
        lines,
      });
    }

    const lineName = lineFilter
      ? selectedLineTables.find((line) => line.id === lineFilter)?.name || lineFilter
      : null;

    return {
      date: dateISO,
      scopeLabel: lineName
        ? `${selectedScopeLabel} - ${lineName}`
        : selectedScopeLabel,
      attendanceDateUsed,
      salesDateUsed: compactDateToISO(salesDateCompact),
      bucketMinutes,
      overtimeEmployees,
      hours,
    };
  } finally {
    client.release();
  }
};

// ============================================================================
// HANDLER
// ============================================================================

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
  const dateParam = url.searchParams.get("date");
  const lineParam = url.searchParams.get("line")?.trim() || null;
  const sedeParams = url.searchParams.getAll("sede").filter(Boolean);
  const bucketParamRaw = url.searchParams.get("bucketMinutes");
  const bucketMinutes = bucketParamRaw ? Number(bucketParamRaw) : 60;

  if (!dateParam) {
    return withSession(
      NextResponse.json(
        { error: 'Parametro "date" es requerido.' },
        { status: 400 },
      ),
    );
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return withSession(
      NextResponse.json(
        { error: "Formato de fecha invalido. Use YYYY-MM-DD." },
        { status: 400 },
      ),
    );
  }

  if (lineParam && !LINE_IDS.has(lineParam)) {
    return withSession(
      NextResponse.json(
        { error: "Linea invalida para el analisis por hora." },
        { status: 400 },
      ),
    );
  }

  const allowedBuckets = new Set([60, 30, 20, 15, 10]);
  if (!allowedBuckets.has(bucketMinutes)) {
    return withSession(
      NextResponse.json(
        { error: "bucketMinutes invalido. Valores permitidos: 60, 30, 20, 15, 10." },
        { status: 400 },
      ),
    );
  }

  try {
    await testDbConnection();
    const data = await fetchHourlyData(
      dateParam,
      lineParam,
      bucketMinutes,
      sedeParams,
    );

    return withSession(
      NextResponse.json(data, {
        headers: { "Cache-Control": "no-store" },
      }),
    );
  } catch (error) {
    console.error("[hourly-analysis] Error:", error);
    return withSession(
      NextResponse.json(
        {
          error:
            "Error de conexion: " +
            (error instanceof Error ? error.message : String(error)),
        },
        { status: 500 },
      ),
    );
  }
}

