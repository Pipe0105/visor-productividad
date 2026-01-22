import {
  Gauge,
  PiggyBank,
  Timer,
  TrendingDown,
  TrendingUp,
  LucideIcon,
} from "lucide-react";
import { DailySummary } from "@/types";
import { formatCOP, formatPercent } from "@/lib/calc";
import { getSummaryStatus } from "@/lib/status";

interface SummaryCardProps {
  summary: DailySummary;
  title: string;
  salesLabel: string;
  sede: string;
  hasData?: boolean;
  comparisons?: {
    label: string;
    baseline?: DailySummary | null;
  }[];
}

// ============================================================================
// COMPONENTES AUXILIARES
// ============================================================================

const MetricCard = ({
  label,
  value,
  icon: Icon,
  iconColor,
  valueClassName = "text-slate-900",
  subtitle,
  subtitleClassName,
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  iconColor?: string;
  valueClassName?: string;
  subtitle?: string;
  subtitleClassName?: string;
}) => (
  <div className="rounded-2xl border border-slate-200/70 bg-slate-50 p-4 transition-all hover:bg-slate-100/50">
    <p className="text-xs uppercase tracking-[0.2em] text-slate-700">{label}</p>
    {subtitle ? (
      <div className="mt-2 space-y-1">
        <p className={`text-lg font-semibold ${valueClassName}`}>{value}</p>
        <p className={`text-xs font-semibold ${subtitleClassName}`}>
          {subtitle}
        </p>
      </div>
    ) : (
      <p
        className={`mt-2 flex items-center gap-2 text-lg font-semibold ${valueClassName}`}
      >
        {Icon && <Icon className={`h-4 w-4 ${iconColor}`} />}
        {value}
      </p>
    )}
  </div>
);

const ComparisonCard = ({
  label,
  currentMargin,
  baselineMargin,
  hasData,
}: {
  label: string;
  currentMargin: number;
  baselineMargin?: number | null;
  hasData: boolean;
}) => {
  if (!hasData) {
    return (
      <div className="rounded-2xl border border-slate-200/70 bg-slate-50 px-4 py-3 transition-all hover:bg-slate-100/50">
        <p className="uppercase tracking-[0.2em] text-slate-600">{label}</p>
        <p className="mt-2 text-sm font-semibold text-slate-700">Sin datos</p>
      </div>
    );
  }
  if (baselineMargin === null || baselineMargin === undefined) {
    return (
      <div className="rounded-2xl border border-slate-200/70 bg-slate-50 px-4 py-3 transition-all hover:bg-slate-100/50">
        <p className="uppercase tracking-[0.2em] text-slate-600">{label}</p>
        <p className="mt-2 text-sm font-semibold text-slate-700">Sin datos</p>
      </div>
    );
  }

  const delta = currentMargin - baselineMargin;
  const deltaRatio = baselineMargin ? delta / Math.abs(baselineMargin) : 0;

  const deltaClass =
    delta > 0
      ? "text-emerald-600"
      : delta < 0
        ? "text-rose-600"
        : "text-slate-700";

  const TrendIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : null;

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-slate-50 px-4 py-3 transition-all hover:bg-slate-100/50">
      <p className="uppercase tracking-[0.2em] text-slate-700">{label}</p>
      <p
        className={`mt-2 flex items-center gap-2 text-sm font-semibold ${deltaClass}`}
      >
        {TrendIcon && <TrendIcon className="h-4 w-4" />}
        {formatCOP(delta)}
      </p>
      <p className={`text-xs font-semibold ${deltaClass}`}>
        {formatPercent(deltaRatio)} vs margen
      </p>
    </div>
  );
};

// ============================================================================
// UTILIDADES
// ============================================================================

const calculateMetrics = (summary: DailySummary) => {
  const marginRatio = summary.sales ? summary.margin / summary.sales : 0;
  const salesPerHour = summary.hours ? summary.sales / summary.hours : 0;
  const marginPerHour = summary.hours ? summary.margin / summary.hours : 0;

  const marginPercentClass =
    marginRatio > 0
      ? "text-emerald-600"
      : marginRatio < 0
        ? "text-rose-600"
        : "text-slate-700";

  return {
    marginRatio,
    salesPerHour,
    marginPerHour,
    marginPercentClass,
  };
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export const SummaryCard = ({
  summary,
  title,
  salesLabel,
  sede,
  hasData = true,
  comparisons = [],
}: SummaryCardProps) => {
  const status = hasData
    ? getSummaryStatus(sede, summary.margin)
    : {
        label: "Sin datos",
        className: "bg-slate-100 text-slate-600",
        textClass: "text-slate-400",
      };
  const emptyValueClass = hasData ? "text-slate-900" : "text-slate-400";

  return (
    <section
      data-animate="summary-card"
      className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.15)] transition-all hover:shadow-[0_20px_70px_-35px_rgba(15,23,42,0.2)]"
    >
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-800">
            {title}
          </p>
          <h3 className="text-2xl font-semibold text-slate-900"></h3>
          <p className="text-sm text-slate-700">{salesLabel}</p>
        </div>
        <span
          className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] ${status.className}`}
        >
          {status.label}
        </span>
      </header>

      {/* Metrics Grid */}
      <div className="mt-6 grid gap-4 text-sm text-slate-800 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          label="Horas registradas"
          value={hasData ? summary.hours : "—"}
          icon={Timer}
          iconColor="text-sky-500"
        />

        <MetricCard
          label="Costo de nómina"
          value={hasData ? formatCOP(summary.cost) : "—"}
          icon={PiggyBank}
          iconColor="text-amber-500"
          valueClassName={emptyValueClass}
        />

        <MetricCard
          label="Venta por hora"
          value={formatCOP(salesPerHour)}
          icon={Gauge}
          iconColor="text-sky-500"
        />

        <MetricCard
          label="Margen acumulado"
          value={hasData ? formatCOP(summary.margin) : "—"}
          valueClassName={hasData ? status.textClass : emptyValueClass}
          subtitle={
            hasData ? `${formatPercent(marginRatio)} margen` : undefined
          }
          subtitleClassName={marginPercentClass}
        />

        <MetricCard
          label="Margen por hora trabajada"
          value={hasData ? formatCOP(marginPerHour) : "—"}
          valueClassName={hasData ? status.textClass : emptyValueClass}
        />
      </div>

      {/* Comparisons */}
      {comparisons.length > 0 && (
        <div className="mt-6 grid gap-3 text-xs text-slate-800 sm:grid-cols-3">
          {comparisons.map((comparison) => (
            <ComparisonCard
              key={comparison.label}
              label={comparison.label}
              currentMargin={summary.margin}
              baselineMargin={comparison.baseline?.margin}
            />
          ))}
        </div>
      )}
    </section>
  );
};
