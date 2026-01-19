import { getPool } from "@/lib/db";
import { mockDailyData, sedes as mockSedes } from "@/lib/mock-data";
import { DailyProductivity } from "@/types";

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

export async function GET() {
  const tableName = process.env.PRODUCTIVITY_TABLE ?? "movimientos";
  const isValidTableName = /^[a-zA-Z0-9_.]+$/.test(tableName);
  if (!isValidTableName) {
    return Response.json(
      {
        error:
          "PRODUCTIVITY_TABLE must contain only letters, numbers, underscores, or dots.",
      },
      { status: 400 },
    );
  }

  if (process.env.USE_MOCK_DATA === "true") {
    return Response.json({ dailyData: mockDailyData, sedes: mockSedes });
  }
  let pool;
  try {
    pool = getPool();
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo conectar a la base de datos.";
    if (process.env.NODE_ENV !== "production") {
      return Response.json({ dailyData: mockDailyData, sedes: mockSedes });
    }
    return Response.json({ error: message }, { status: 500 });
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
      error instanceof Error
        ? error.message
        : "No se pudo consultar la base de datos.";
    if (process.env.NODE_ENV !== "production") {
      return Response.json({ dailyData: mockDailyData, sedes: mockSedes });
    }
    return Response.json({ error: message }, { status: 500 });
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
  const sedesMap = new Map<string, string>();

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
    if (!sedesMap.has(row.sede)) {
      sedesMap.set(row.sede, row.sede);
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
  const sedes = Array.from(sedesMap.values()).map((sede) => ({
    id: sede,
    name: sede,
  }));

  return Response.json({ dailyData, sedes });
}
