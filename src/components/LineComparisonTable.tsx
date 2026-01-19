import {
  calcLineCost,
  calcLineMargin,
  formatCOP,
  formatPercent,
} from "@/lib/calc";
import { getLineStatus } from "@/lib/status";
import { LineMetrics } from "@/types";

interface LineComparisonTableProps {
  lines: LineMetrics[];
  sede: string;
}

export const LineComparisonTable = ({
  lines,
  sede,
}: LineComparisonTableProps) => {
  const sortedLines = [...lines].sort((a, b) => {
    const marginA = calcLineMargin(a);
    const marginB = calcLineMargin(b);
    return marginB - marginA;
  });

  return (
    <section
      data-animate="comparison-card"
      className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.15)]"
    >
      {" "}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-800">
            Comparativo de líneas
          </p>
          <h3 className="text-2xl font-semibold text-slate-900">
            Rentabilidad en comparación
          </h3>
          <p className="mt-2 text-sm text-slate-600">
            Ordenado por margen total para identificar rápido las líneas más
            rentables.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700">
          {sortedLines.length} líneas
        </span>
      </div>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-720px border-separate border-spacing-y-2 text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-[0.2em] text-slate-500">
              <th className="px-4">Ranking</th>
              <th className="px-4">Línea</th>
              <th className="px-4">Ventas</th>
              <th className="px-4">Horas</th>
              <th className="px-4">Costo</th>
              <th className="px-4">Margen</th>
              <th className="px-4">Margen %</th>
              <th className="px-4">Margen/h</th>
              <th className="px-4">Estado</th>
            </tr>
          </thead>
          <tbody>
            {sortedLines.map((line, index) => {
              const cost = calcLineCost(line);
              const margin = calcLineMargin(line);
              const marginRatio = line.sales ? margin / line.sales : 0;
              const marginPerHour = line.hours ? margin / line.hours : 0;
              const status = getLineStatus(sede, line.id, margin);

              return (
                <tr
                  key={line.id}
                  data-animate="comparison-row"
                  className="rounded-2xl bg-slate-50 text-slate-800"
                >
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    #{index + 1}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{line.name}</p>
                    <p className="text-xs text-slate-500">{line.id}</p>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {formatCOP(line.sales)}
                  </td>
                  <td className="px-4 py-3">{line.hours}h</td>
                  <td className="px-4 py-3">{formatCOP(cost)}</td>
                  <td className={`px-4 py-3 font-semibold ${status.textClass}`}>
                    {formatCOP(margin)}
                  </td>
                  <td className={`px-4 py-3 font-semibold ${status.textClass}`}>
                    {formatPercent(marginRatio)}
                  </td>
                  <td className={`px-4 py-3 font-semibold ${status.textClass}`}>
                    {formatCOP(marginPerHour)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};
