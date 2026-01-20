import { Clock, TrendingDown, TrendingUp } from "lucide-react";
import {
  calcLineCost,
  calcLineMargin,
  formatCOP,
  formatPercent,
} from "@/lib/calc";
import { getLineStatus } from "@/lib/status";
import { LineMetrics } from "@/types";

interface LineCardProps {
  line: LineMetrics;
  sede: string;
}

// Componente extraído para mejor legibilidad
const MetricRow = ({
  label,
  value,
  icon,
  valueClassName = "text-slate-900",
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  valueClassName?: string;
}) => (
  <div className="flex items-center justify-between">
    <span className="flex items-center gap-2 text-slate-700">
      {icon}
      {label}
    </span>
    <span className={`text-base font-semibold ${valueClassName}`}>{value}</span>
  </div>
);

export const LineCard = ({ line, sede }: LineCardProps) => {
  const cost = calcLineCost(line);
  const margin = calcLineMargin(line);
  const marginRatio = line.sales ? margin / line.sales : 0;
  const status = getLineStatus(sede, line.id, margin);
  const isPositiveMargin = margin >= 0;

  return (
    <article
      data-animate="line-card"
      className="flex flex-col gap-4 rounded-3xl border border-slate-200/70 bg-linear-to-br from-white via-slate-50 to-transparent p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.15)] transition-all duration-200 hover:border-mercamio-300/40 hover:shadow-[0_20px_70px_-35px_rgba(15,23,42,0.2)]"
    >
      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-800">
            Línea
          </p>
          <h2 className="text-xl font-semibold text-slate-900">{line.name}</h2>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${status.className}`}
        >
          {status.label}
        </span>
      </header>

      {/* Metrics */}
      <div className="grid gap-4 text-sm">
        <MetricRow
          label="Horas trabajadas"
          value={`${line.hours}h`}
          icon={<Clock className="h-4 w-4 text-sky-500" />}
        />

        <MetricRow label="Costo de mano de obra" value={formatCOP(cost)} />

        <MetricRow label="Ventas" value={formatCOP(line.sales)} />

        <MetricRow
          label="Margen"
          value={formatCOP(margin)}
          icon={
            isPositiveMargin ? (
              <TrendingUp className={`h-4 w-4 ${status.textClass}`} />
            ) : (
              <TrendingDown className={`h-4 w-4 ${status.textClass}`} />
            )
          }
          valueClassName={status.textClass}
        />

        <MetricRow
          label="Margen sobre ventas"
          value={formatPercent(marginRatio)}
          valueClassName={status.textClass}
        />
      </div>
    </article>
  );
};
