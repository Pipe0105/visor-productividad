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
  hasData?: boolean;
}

// ============================================================================
// TIPOS
// ============================================================================

type LineWithMetrics = LineMetrics & {
  cost: number;
  margin: number;
  marginRatio: number;
  marginPerHour: number;
  status: ReturnType<typeof getLineStatus>;
};

// ============================================================================
// COMPONENTES AUXILIARES
// ============================================================================

const TableHeader = () => (
  <thead>
    <tr className="text-xs uppercase tracking-[0.2em] text-slate-500">
      <th className="px-4 py-2 text-left font-semibold">Ranking</th>
      <th className="px-4 py-2 text-left font-semibold">Línea</th>
      <th className="px-4 py-2 text-left font-semibold">Ventas</th>
      <th className="px-4 py-2 text-left font-semibold">Horas</th>
      <th className="px-4 py-2 text-left font-semibold">Costo</th>
      <th className="px-4 py-2 text-left font-semibold">Margen</th>
      <th className="px-4 py-2 text-left font-semibold">Margen %</th>
      <th className="px-4 py-2 text-left font-semibold">Margen/h</th>
      <th className="px-4 py-2 text-left font-semibold">Estado</th>
    </tr>
  </thead>
);

const TableRow = ({
  line,
  index,
  hasData: boolean;
}: {
  line: LineWithMetrics;
  index: number;
}) => (
  <tr
    data-animate="comparison-row"
    className="rounded-2xl bg-slate-50 transition-all hover:bg-slate-100"
  >
    <td className="rounded-l-2xl px-4 py-3 font-semibold text-slate-900">
      #{index + 1}
    </td>
    <td className="px-4 py-3">
      <p className="font-semibold text-slate-900">{line.name}</p>
      <p className="text-xs text-slate-500">{line.id}</p>
    </td>
    <td className="px-4 py-3 font-semibold text-slate-900">
      {hasData ? formatCOP(line.sales) : "—"}
    </td>
    <td className="px-4 py-3 text-slate-700">
      {hasData ? `${line.hours}h` : "—"}
    </td>
    <td className="px-4 py-3 text-slate-700">
      {hasData ? formatCOP(line.cost) : "—"}
    <td
      className={`px-4 py-3 font-semibold ${
        hasData ? line.status.textClass : "text-slate-400"
      }`}
    >
      {hasData ? formatCOP(line.margin) : "—"}
    </td>
    <td
      className={`px-4 py-3 font-semibold ${
        hasData ? line.status.textClass : "text-slate-400"
      }`}
    >
      {hasData ? formatPercent(line.marginRatio) : "—"}
    </td>
    <td
      className={`px-4 py-3 font-semibold ${
        hasData ? line.status.textClass : "text-slate-400"
      }`}
    >
      {hasData ? formatCOP(line.marginPerHour) : "—"}
    </td>
    <td className="rounded-r-2xl px-4 py-3">
      <span
        className={`inline-block rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
          hasData ? line.status.className : "bg-slate-100 text-slate-600"
        }`}      >
        {hasData ? line.status.label : "Sin datos"}
      </span>
    </td>
  </tr>
);

const TableSummary = ({ count }: { count: number }) => (
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
      {count} {count === 1 ? "línea" : "líneas"}
    </span>
  </div>
);

const EmptyState = () => (
  <div className="py-12 text-center">
    <p className="text-sm uppercase tracking-[0.2em] text-slate-500">
      Sin datos
    </p>
    <p className="mt-2 text-slate-700">No hay líneas para comparar</p>
  </div>
);

// ============================================================================
// UTILIDADES
// ============================================================================

const enrichLineWithMetrics = (
  line: LineMetrics,
  sede: string,
): LineWithMetrics => {
  const cost = calcLineCost(line);
  const margin = calcLineMargin(line);
  const marginRatio = line.sales ? margin / line.sales : 0;
  const marginPerHour = line.hours ? margin / line.hours : 0;
  const status = getLineStatus(sede, line.id, margin);

  return {
    ...line,
    cost,
    margin,
    marginRatio,
    marginPerHour,
    status,
  };
};

const sortLinesByMargin = (lines: LineWithMetrics[]): LineWithMetrics[] => {
  return [...lines].sort((a, b) => b.margin - a.margin);
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export const LineComparisonTable = ({
  lines,
  sede,
  hasData = true,
}: LineComparisonTableProps) => {
  // Enriquecer líneas con métricas calculadas
  const enrichedLines = lines.map((line) => enrichLineWithMetrics(line, sede));

  // Ordenar por margen
  const sortedLines = sortLinesByMargin(enrichedLines);

  return (
    <section
      data-animate="comparison-card"
      className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.15)] transition-all hover:shadow-[0_20px_70px_-35px_rgba(15,23,42,0.2)]"
    >
      <TableSummary count={sortedLines.length} />

      {sortedLines.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-180 border-separate border-spacing-y-2 text-left text-sm">
            <TableHeader />
            <tbody>
              {sortedLines.map((line, index) => (
                <TableRow
                  key={line.id}
                  line={line}
                  index={index}
                  hasData={hasData}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
