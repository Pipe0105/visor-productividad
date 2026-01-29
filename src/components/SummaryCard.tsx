import {
  Gauge,
  Timer,
  LucideIcon,
} from "lucide-react";
import { DailySummary } from "@/types";
import { formatCOP, formatHours } from "@/lib/calc";

interface SummaryCardProps {
  summary: DailySummary;
  title: string;
  salesLabel: string;
  hasData?: boolean;
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

// ============================================================================
// UTILIDADES
// ============================================================================

const calculateMetrics = (summary: DailySummary) => {
  const salesPerHour = summary.hours ? summary.sales / summary.hours : 0;

  return {
    salesPerHour,
  };
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export const SummaryCard = ({
  summary,
  title,
  salesLabel,
  hasData = true,
}: SummaryCardProps) => {
  const { salesPerHour } = calculateMetrics(summary);

  return (
    <section
      data-animate="summary-card"
      className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.15)] transition-all hover:shadow-[0_20px_70px_-35px_rgba(15,23,42,0.2)]"
    >
      {/* Header */}
      <header>
        <p className="text-sm uppercase tracking-[0.2em] text-slate-800">
          {title}
        </p>
        <p className="text-sm text-slate-700">{salesLabel}</p>
      </header>

      {/* Metrics Grid */}
      <div className="mt-6 grid gap-4 text-sm text-slate-800 sm:grid-cols-2">
        <MetricCard
          label="Horas registradas"
          value={hasData ? `${formatHours(summary.hours)}h` : "0h"}
          icon={Timer}
          iconColor="text-sky-500"
        />

        <MetricCard
          label="Venta por hora"
          value={formatCOP(salesPerHour)}
          icon={Gauge}
          iconColor="text-sky-500"
        />
      </div>
    </section>
  );
};

