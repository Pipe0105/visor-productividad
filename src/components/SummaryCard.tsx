import { PiggyBank, Timer } from "lucide-react";
import { DailySummary } from "@/types";
import { formatCOP, formatPercent } from "@/lib/calc";

interface SummaryCardProps {
  summary: DailySummary;
  title: string;
  salesLabel: string;
}

export const SummaryCard = ({
  summary,
  title,
  salesLabel,
}: SummaryCardProps) => {
  const status =
    summary.margin >= 1200000
      ? {
          label: "Día sólido",
          className: "bg-emerald-500/20 text-emerald-200",
          textClass: "text-emerald-200",
        }
      : summary.margin >= 0
      ? {
          label: "Día estable",
          className: "bg-slate-400/15 text-slate-200",
          textClass: "text-slate-200",
        }
      : summary.margin >= -400000
      ? {
          label: "Revisar",
          className: "bg-amber-500/20 text-amber-200",
          textClass: "text-amber-200",
        }
      : {
          label: "Crítico",
          className: "bg-rose-500/20 text-rose-200",
          textClass: "text-rose-200",
        };
  const marginRatio = summary.sales ? summary.margin / summary.sales : 0;
  const marginPercentClass =
    marginRatio > 0
      ? "text-emerald-200"
      : marginRatio < 0
      ? "text-rose-200"
      : "text-slate-200";

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.9)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-white/50">
            {title}
          </p>
          <h3 className="text-2xl font-semibold text-white">
            {formatCOP(summary.sales)}
          </h3>
          <p className="text-sm text-white/60">{salesLabel}</p>
        </div>
        <span
          className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] ${status.className}`}
        >
          {status.label}
        </span>
      </div>
      <div className="mt-6 grid gap-4 text-sm text-white/70 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">
            Horas totales
          </p>
          <p className="mt-2 flex items-center gap-2 text-lg font-semibold text-white">
            <Timer className="h-4 w-4 text-sky-200" />
            {summary.hours}h
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">
            Costo horas
          </p>
          <p className="mt-2 flex items-center gap-2 text-lg font-semibold text-white">
            <PiggyBank className="h-4 w-4 text-amber-200" />
            {formatCOP(summary.cost)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">
            Margen total
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
      </div>
    </section>
  );
};
