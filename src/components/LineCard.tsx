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

export const LineCard = ({ line, sede }: LineCardProps) => {
  const cost = calcLineCost(line);
  const margin = calcLineMargin(line);
  const marginRatio = line.sales ? margin / line.sales : 0;
  const status = getLineStatus(sede, line.id, margin);

  return (
    <article className="flex flex-col gap-4 rounded-3xl border border-slate-200/70 bg-linear-to-br from-white via-slate-50 to-transparent p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.15)] transition hover:border-mercamio-300/40 dark:border-white/10 dark:from-white/10 dark:via-white/5 dark:shadow-[0_20px_60px_-40px_rgba(15,23,42,0.9)]">
      {" "}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500 dark:text-white/50">
            Línea
          </p>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {line.name}
          </h2>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${status.className}`}
        >
          {status.label}
        </span>
      </div>
      <div className="grid gap-4 text-sm text-slate-600 dark:text-white/70">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-sky-500 dark:text-sky-200" />
            Horas trabajadas
          </span>
          <span className="text-base font-semibold text-slate-900 dark:text-white">
            {line.hours}h
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500 dark:text-white/60">
            Costo de mano de obra
          </span>
          <span className="text-base font-semibold text-slate-900 dark:text-white">
            {formatCOP(cost)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-slate-500 dark:text-white/60">
            {margin >= 0 ? (
              <TrendingUp className={`h-4 w-4 ${status.textClass}`} />
            ) : (
              <TrendingDown className={`h-4 w-4 ${status.textClass}`} />
            )}
            Margen
          </span>
          <span className={`text-base font-semibold ${status.textClass}`}>
            {formatCOP(margin)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500 dark:text-white/60">
            Margen sobre ventas
          </span>
          <span className={`text-base font-semibold ${status.textClass}`}>
            {formatPercent(marginRatio)}
          </span>
        </div>
      </div>
    </article>
  );
};
