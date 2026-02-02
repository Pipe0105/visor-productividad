"use client";

import { useEffect, useMemo, useState } from "react";
import { Users, DollarSign, ChevronDown, Clock, Sparkles } from "lucide-react";
import { formatCOP } from "@/lib/calc";
import { formatDateLabel } from "@/lib/utils";
import type { Sede } from "@/lib/constants";
import type { HourlyAnalysisData } from "@/types";

// ============================================================================
// TIPOS
// ============================================================================

interface HourlyAnalysisProps {
  availableDates: string[];
  availableSedes: Sede[];
  defaultDate?: string;
  defaultSede?: string;
}

// ============================================================================
// UTILIDADES
// ============================================================================

const hourlyDateLabelOptions: Intl.DateTimeFormatOptions = {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
};

// ============================================================================
// SUBCOMPONENTES
// ============================================================================

const HourlyLoadingSkeleton = () => (
  <div className="space-y-3 animate-pulse">
    {Array.from({ length: 14 }).map((_, i) => (
      <div key={i} className="flex items-center gap-3">
        <div className="h-4 w-16 shrink-0 rounded-full bg-slate-200/70" />
        <div className="h-9 flex-1 rounded-full bg-slate-200/70" />
        <div className="h-4 w-24 shrink-0 rounded-full bg-slate-200/70" />
      </div>
    ))}
  </div>
);

const HourBar = ({
  label,
  totalSales,
  employeesPresent,
  maxSales,
  isExpanded,
  onToggle,
  lines,
}: {
  label: string;
  totalSales: number;
  employeesPresent: number;
  maxSales: number;
  isExpanded: boolean;
  onToggle: () => void;
  lines: HourlyAnalysisData["hours"][number]["lines"];
}) => {
  const percentage = maxSales > 0 ? (totalSales / maxSales) * 100 : 0;
  const hasActivity = totalSales > 0 || employeesPresent > 0;

  const lineTotalForPercent = totalSales || 1;

  return (
    <div className="group rounded-2xl border border-slate-200/60 bg-white/80 p-2 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)] transition-all hover:-translate-y-0.5 hover:border-amber-200/70 hover:bg-white">
      <button
        type="button"
        onClick={onToggle}
        disabled={!hasActivity}
        className="flex w-full items-center gap-3 text-left transition-opacity disabled:opacity-40"
      >
        <div className="w-26 shrink-0 text-right">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-700 ring-1 ring-slate-200/60">
            {label}
          </span>
        </div>

        <div className="relative h-9 flex-1 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/70">
          {percentage > 0 && (
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-linear-to-r from-amber-300 via-mercamio-400 to-mercamio-600 transition-all duration-500"
              style={{ width: `${Math.max(percentage, 2)}%` }}
            />
          )}
          {hasActivity && (
            <div className="absolute inset-0 flex items-center justify-between px-3">
              <span className="inline-flex items-center rounded-full bg-white/90 px-2 py-0.5 text-xs font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200/60">
                {formatCOP(totalSales)}
              </span>
            </div>
          )}
        </div>

        <div className="flex w-40 shrink-0 items-center justify-end gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-700 ring-1 ring-sky-200/70">
            <Users className="h-3.5 w-3.5" />
            {employeesPresent}
          </span>
          {hasActivity && (
            <ChevronDown
              className={`h-3.5 w-3.5 text-slate-400 transition-transform group-hover:text-mercamio-600 ${
                isExpanded ? "rotate-180" : ""
              }`}
            />
          )}
        </div>
      </button>

      {isExpanded && hasActivity && (
        <div className="mt-2 ml-26 mr-40 rounded-2xl border border-slate-200/70 bg-white/90 p-3 shadow-sm">
          <div className="grid grid-cols-12 gap-2 rounded-xl bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500 ring-1 ring-slate-200/60">
            <span className="col-span-6">Linea</span>
            <span className="col-span-3 text-right">Ventas</span>
            <span className="col-span-3 text-right">% del total</span>
          </div>
          <div className="mt-2 space-y-2">
            {lines
              .filter((l) => l.sales > 0)
              .sort((a, b) => b.sales - a.sales)
              .map((line) => {
                const percent = (line.sales / lineTotalForPercent) * 100;
                return (
                  <div
                    key={line.lineId}
                    className="grid grid-cols-12 items-center gap-2 rounded-xl border border-slate-200/60 bg-white px-3 py-2 text-sm shadow-[0_6px_20px_-16px_rgba(15,23,42,0.35)]"
                  >
                    <div className="col-span-6">
                      <p className="font-semibold text-slate-900">
                        {line.lineName}
                      </p>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-mercamio-500"
                          style={{ width: `${Math.max(percent, 3)}%` }}
                        />
                      </div>
                    </div>
                    <span className="col-span-3 text-right font-semibold text-slate-800">
                      {formatCOP(line.sales)}
                    </span>
                    <span className="col-span-3 text-right font-semibold text-mercamio-700">
                      {percent.toFixed(1)}%
                    </span>
                  </div>
                );
              })}
          </div>
          {lines.every((l) => l.sales === 0) && (
            <p className="py-2 text-center text-xs text-slate-500">
              Sin ventas registradas en esta hora
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export const HourlyAnalysis = ({
  availableDates,
  availableSedes,
  defaultDate,
  defaultSede,
}: HourlyAnalysisProps) => {
  const [selectedDate, setSelectedDate] = useState(defaultDate ?? "");
  const [selectedSede, setSelectedSede] = useState(defaultSede ?? "");
  const [hourlyData, setHourlyData] = useState<HourlyAnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedHour, setExpandedHour] = useState<number | null>(null);

  // Fetch data when date and sede change
  useEffect(() => {
    if (!selectedDate || !selectedSede) {
      setHourlyData(null);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    setExpandedHour(null);

    fetch(
      `/api/hourly-analysis?date=${selectedDate}&sede=${encodeURIComponent(selectedSede)}`,
      { signal: controller.signal },
    )
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error ?? "Error al obtener datos");
        }
        return json as HourlyAnalysisData;
      })
      .then((data) => {
        setHourlyData(data);
        setIsLoading(false);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Error desconocido");
        setHourlyData(null);
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [selectedDate, selectedSede]);

  // Filtrar solo las horas con actividad para el resumen
  const activeHours = useMemo(() => {
    if (!hourlyData) return [];
    return hourlyData.hours.filter(
      (h) => h.totalSales > 0 || h.employeesPresent > 0,
    );
  }, [hourlyData]);

  const maxSales = useMemo(() => {
    if (activeHours.length === 0) return 1;
    return Math.max(...activeHours.map((h) => h.totalSales), 1);
  }, [activeHours]);

  const chartPoints = useMemo(() => {
    if (!hourlyData || hourlyData.hours.length === 0) return "";
    const seriesMax = Math.max(...hourlyData.hours.map((h) => h.totalSales), 1);
    const total = hourlyData.hours.length;
    return hourlyData.hours
      .map((h, i) => {
        const x = total === 1 ? 0 : (i / (total - 1)) * 100;
        const y = 100 - (h.totalSales / seriesMax) * 100;
        return `${x},${y}`;
      })
      .join(" ");
  }, [hourlyData]);

  // Totales del dia
  const dayTotals = useMemo(() => {
    if (!hourlyData) return { sales: 0, peakEmployees: 0, activeHoursCount: 0 };
    const sales = hourlyData.hours.reduce((sum, h) => sum + h.totalSales, 0);
    const peakEmployees = Math.max(
      ...hourlyData.hours.map((h) => h.employeesPresent),
      0,
    );
    const activeHoursCount = hourlyData.hours.filter(
      (h) => h.totalSales > 0 || h.employeesPresent > 0,
    ).length;
    return { sales, peakEmployees, activeHoursCount };
  }, [hourlyData]);

  const handleToggleHour = (hour: number) => {
    setExpandedHour((prev) => (prev === hour ? null : hour));
  };

  return (
    <div
      data-animate="hourly-card"
      className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-linear-to-br from-white via-slate-50 to-amber-50/40 p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.2)]"
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -left-12 -bottom-16 h-44 w-44 rounded-full bg-mercamio-200/30 blur-3xl" />

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-200/70 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-amber-700 shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            Analisis por hora
          </div>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">
            Desglose horario de ventas y empleados
          </h3>
          <p className="mt-1 text-xs text-slate-600">
            Selecciona un dia y sede para ver el detalle hora a hora. Haz clic
            en una barra para ver el desglose por linea.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200/70 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm">
          <Clock className="h-4 w-4 text-mercamio-600" />
          Vista horaria
        </div>
      </div>

      {/* Controles */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-slate-700">Fecha</span>
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="mt-1 w-full rounded-full border border-slate-200/70 bg-white/90 px-3 py-2 text-sm text-slate-900 shadow-sm transition-all focus:border-mercamio-300 focus:outline-none focus:ring-2 focus:ring-mercamio-100"
          >
            <option value="">Selecciona un dia</option>
            {availableDates.map((date) => (
              <option key={date} value={date}>
                {date}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-slate-700">Sede</span>
          <select
            value={selectedSede}
            onChange={(e) => setSelectedSede(e.target.value)}
            className="mt-1 w-full rounded-full border border-slate-200/70 bg-white/90 px-3 py-2 text-sm text-slate-900 shadow-sm transition-all focus:border-mercamio-300 focus:outline-none focus:ring-2 focus:ring-mercamio-100"
          >
            <option value="">Selecciona una sede</option>
            {availableSedes.map((sede) => (
              <option key={sede.id} value={sede.name}>
                {sede.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoading && <HourlyLoadingSkeleton />}

      {/* No selection */}
      {!isLoading && (!selectedDate || !selectedSede) && (
        <p className="py-10 text-center text-sm text-slate-600">
          Selecciona una fecha y una sede para ver el analisis horario.
        </p>
      )}

      {/* Data */}
      {!isLoading && hourlyData && (
        <>
          {/* Day summary chips */}
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-white/80 px-3 py-1 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200/60">
              {formatDateLabel(hourlyData.date, hourlyDateLabelOptions)}
            </span>
            <span className="rounded-full bg-slate-100/80 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/60">
              {hourlyData.sede}
            </span>
            <span className="flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200/70">
              <DollarSign className="h-3.5 w-3.5" />
              {formatCOP(dayTotals.sales)}
            </span>
            <span className="flex items-center gap-1 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-200/70">
              <Users className="h-3.5 w-3.5" />
              Pico: {dayTotals.peakEmployees} empleados
            </span>
            <span className="rounded-full bg-slate-100/80 px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200/60">
              {dayTotals.activeHoursCount} horas con actividad
            </span>
          </div>

          {/* Hourly chart */}
          <div className="mb-6 rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Diferencias por hora
                </p>
                <p className="text-sm font-semibold text-slate-900">
                  Comportamiento de ventas durante el dia
                </p>
              </div>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200/70">
                Max: {formatCOP(maxSales)}
              </span>
            </div>
            <div className="h-28 w-full">
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="h-full w-full"
              >
                <defs>
                  <linearGradient id="hourlyFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <rect x="0" y="0" width="100" height="100" fill="#f8fafc" />
                {chartPoints && (
                  <>
                    <path
                      d={`M 0,100 L ${chartPoints} L 100,100 Z`}
                      fill="url(#hourlyFill)"
                    />
                    <polyline
                      points={chartPoints}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="2.2"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  </>
                )}
              </svg>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-slate-500">
              <span>00:00</span>
              <span>12:00</span>
              <span>23:00</span>
            </div>
          </div>

          {/* Hourly bars */}
          {activeHours.length > 0 ? (
            <div className="space-y-3">
              {activeHours.map((slot) => (
                <HourBar
                  key={slot.hour}
                  label={slot.label}
                  totalSales={slot.totalSales}
                  employeesPresent={slot.employeesPresent}
                  maxSales={maxSales}
                  isExpanded={expandedHour === slot.hour}
                  onToggle={() => handleToggleHour(slot.hour)}
                  lines={slot.lines}
                />
              ))}
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-slate-600">
              No hay actividad registrada para este dia y sede.
            </p>
          )}
        </>
      )}
    </div>
  );
};
