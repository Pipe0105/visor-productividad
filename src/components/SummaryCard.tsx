import {
  Gauge,
  PiggyBank,
  Timer,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { DailySummary } from "@/types";
import { formatCOP, formatPercent } from "@/lib/calc";
import { getSummaryStatus } from "@/lib/status";

interface SummaryCardProps {
  summary: DailySummary;
  title: string;
  salesLabel: string;
  sede: string;
  comparisons?: {
    label: string;
    baseline?: DailySummary | null;
  }[];
}

export const SummaryCard = ({
  summary,
  title,
  salesLabel,
  sede,
  comparisons = [],
}: SummaryCardProps) => {
  const status = getSummaryStatus(sede, summary.margin);
  const marginRatio = summary.sales ? summary.margin / summary.sales : 0;
  const marginPercentClass =
    marginRatio > 0
      ? "text-emerald-600 dark:text-emerald-200"
      : marginRatio < 0
      ? "text-rose-600 dark:text-rose-200"
      : "text-slate-700 dark:text-slate-300";
  const salesPerHour = summary.hours ? summary.sales / summary.hours : 0;
  const marginPerHour = summary.hours ? summary.margin / summary.hours : 0;

  return (
    <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.15)] dark:border-white/10 dark:bg-white/5 dark:shadow-[0_20px_60px_-40px_rgba(15,23,42,0.9)]">
      {" "}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-800 dark:text-white/70">
            {" "}
            {title}
          </p>
          <h3 className="text-2xl font-semibold text-slate-900 dark:text-white">
            {formatCOP(summary.sales)}
          </h3>
          <p className="text-sm text-slate-700 dark:text-white/70">
            {salesLabel}
          </p>
        </div>
        <span
          className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] ${status.className}`}
        >
          {status.label}
        </span>
      </div>
      <div className="mt-6 grid gap-4 text-sm text-slate-800 dark:text-white/80 sm:grid-cols-2 lg:grid-cols-5">
        {" "}
        <div className="rounded-2xl border border-slate-200/70 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/60">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-700 dark:text-white/60">
            {" "}
            Horas registradas
          </p>
          <p className="mt-2 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
            <Timer className="h-4 w-4 text-sky-500 dark:text-sky-200" />
            {summary.hours}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/60">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-700 dark:text-white/60">
            {" "}
            Costo de nómina
          </p>
          <p className="mt-2 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
            <PiggyBank className="h-4 w-4 text-amber-500 dark:text-amber-200" />
            {formatCOP(summary.cost)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/60">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-700 dark:text-white/60">
            {" "}
            Venta por hora
          </p>
          <p className="mt-2 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
            <Gauge className="h-4 w-4 text-sky-500 dark:text-sky-200" />
            {formatCOP(salesPerHour)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/60">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-700 dark:text-white/60">
            {" "}
            Margen acumulado
          </p>
          <div className="mt-2 space-y-1">
            <p className={`text-lg font-semibold ${status.textClass}`}>
              {formatCOP(summary.margin)}
            </p>
            <p className={`text-xs font-semibold ${marginPercentClass}`}>
              {formatPercent(marginRatio)} margen
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/60">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-700 dark:text-white/60">
            {" "}
            Margen por hora trabajada
          </p>
          <p className={`mt-2 text-lg font-semibold ${status.textClass}`}>
            {formatCOP(marginPerHour)}
          </p>
        </div>
      </div>
      {comparisons.length ? (
        <div className="mt-6 grid gap-3 text-xs text-slate-800 dark:text-white/80 sm:grid-cols-3">
          {" "}
          {comparisons.map((comparison) => {
            if (!comparison.baseline) {
              return (
                <div
                  key={comparison.label}
                  className="rounded-2xl border border-slate-200/70 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-slate-950/40"
                >
                  <p className="uppercase tracking-[0.2em] text-slate-500 dark:text-white/40">
                    {" "}
                    {comparison.label}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-white/70">
                    {" "}
                    Sin datos
                  </p>
                </div>
              );
            }
            const delta = summary.margin - comparison.baseline.margin;
            const deltaRatio = comparison.baseline.margin
              ? delta / Math.abs(comparison.baseline.margin)
              : 0;
            const deltaClass =
              delta > 0
                ? "text-emerald-600 dark:text-emerald-200"
                : delta < 0
                ? "text-rose-600 dark:text-rose-200"
                : "text-slate-600 dark:text-slate-200";
            return (
              <div
                key={comparison.label}
                className="rounded-2xl border border-slate-200/70 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-slate-950/40"
              >
                <p className="uppercase tracking-[0.2em] text-slate-700 dark:text-white/60">
                  {" "}
                  {comparison.label}
                </p>
                <p
                  className={`mt-2 flex items-center gap-2 text-sm font-semibold ${deltaClass}`}
                >
                  {delta > 0 ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : delta < 0 ? (
                    <TrendingDown className="h-4 w-4" />
                  ) : null}
                  {formatCOP(delta)}
                </p>
                <p className={`text-xs font-semibold ${deltaClass}`}>
                  {formatPercent(deltaRatio)} vs margen
                </p>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
};
