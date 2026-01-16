import { pool } from "@/lib/db";
import { DailyProductivity } from "@/types";

type ProductivityRow = {
  date: Date | string;
  sede: string;
  line_id: string;
  line_name: string;
  sales: number;
  hours: number;
  hourly_rate: number;
};

const toDateKey = (value: Date | string) => {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return value.slice(0, 10);
};

export async function GET() {
  const result = await pool.query<ProductivityRow>(
    `
      SELECT
        date,
        sede,
        line_id,
        line_name,
        sales,
        hours,
        hourly_rate
      FROM productivity_lines
      ORDER BY date ASC, sede ASC, line_name ASC
    `,
  );

  const grouped = new Map<string, DailyProductivity>();
  const sedesMap = new Map<string, string>();

  result.rows.forEach((row) => {
    const dateKey = toDateKey(row.date);
    const key = `${dateKey}-${row.sede}`;
    const existing =
      grouped.get(key) ??
      ({
        date: dateKey,
        sede: row.sede,
        lines: [],
      } satisfies DailyProductivity);

    existing.lines.push({
      id: row.line_id,
      name: row.line_name,
      sales: Number(row.sales),
      hours: Number(row.hours),
      hourlyRate: Number(row.hourly_rate),
    });

    grouped.set(key, existing);
    if (!sedesMap.has(row.sede)) {
      sedesMap.set(row.sede, row.sede);
    }
  });

  const dailyData = Array.from(grouped.values());
  const sedes = Array.from(sedesMap.values()).map((sede) => ({
    id: sede,
    name: sede,
  }));

  return Response.json({ dailyData, sedes });
}
