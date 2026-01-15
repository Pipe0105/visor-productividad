import {
  Apple,
  BadgeDollarSign,
  Beef,
  Box,
  Clock,
  Factory,
  Fish,
  Flame,
  Gauge,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { calcLineCost, calcLineMargin, formatCOP } from "@/lib/calc";
import { getLineStatus } from "@/lib/status";
import { LineMetrics } from "@/types";
import { Sparkline } from "@/components/Sparkline";

interface LineCardProps {
  line: LineMetrics;
  sede: string;
  dailySeries: number[];
  weeklySeries: number[];
  rangeLabel: string;
}

export const LineCard = ({
  line,
  sede,
  dailySeries,
  weeklySeries,
  rangeLabel,
}: LineCardProps) => {
  const cost = calcLineCost(line);
  const margin = calcLineMargin(line);
  const status = getLineStatus(sede, line.id, margin);
  const salesPerHour = line.hours ? line.sales / line.hours : 0;
  const marginPerHour = line.hours ? margin / line.hours : 0;

  const iconMap = {
    cajas: Box,
    fruver: Apple,
    industria: Factory,
    carnes: Beef,
    "pollo y pescado": Fish,
    asadero: Flame,
  };
  const Icon = iconMap[line.id];

  return (
    <article className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-linear-to-br from-white/10 via-white/5 to-transparent p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.9)] transition hover:border-mercamio-300/40">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-white/50">
            Línea
          </p>
          <h2 className="text-xl font-semibold text-white">{line.name}</h2>
          <div className="mt-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-mercamio-200/80">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-mercamio-400/15 text-mercamio-200">
              <Icon className="h-4 w-4" />
            </span>
            Operación
          </div>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${status.className}`}
        >
          {status.label}
        </span>
      </div>
      <div className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-white/40">
          <span>Evolución diaria</span>
          <span>{rangeLabel}</span>
        </div>
        <Sparkline data={dailySeries} />
        <div className="mt-1 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-white/40">
          <span>Evolución semanal</span>
          <span>Totales</span>
        </div>
        <Sparkline data={weeklySeries} strokeClassName="stroke-sky-200" />
      </div>
      <div className="grid gap-4 text-sm text-white/70">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <BadgeDollarSign className="h-4 w-4 text-emerald-200" />
            Venta total
          </span>
          <span className="text-base font-semibold text-white">
            {formatCOP(line.sales)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-sky-200" />
            Horas trabajadas
          </span>
          <span className="text-base font-semibold text-white">
            {line.hours}h
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-sky-200" />
            Ventas por hora
          </span>
          <span className="text-base font-semibold text-white">
            {formatCOP(salesPerHour)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-white/60">Costo horas</span>
          <span className="text-base font-semibold text-white">
            {formatCOP(cost)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-white/60">
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
          <span className="text-white/60">Margen por hora</span>
          <span className={`text-base font-semibold ${status.textClass}`}>
            {formatCOP(marginPerHour)}
          </span>
        </div>
      </div>
    </article>
  );
};
