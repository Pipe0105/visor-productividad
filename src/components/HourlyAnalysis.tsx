"use client";

import { useEffect, useMemo, useState } from "react";
import { Users, DollarSign, ChevronDown } from "lucide-react";
import { formatCOP } from "@/lib/calc";
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

const formatDateLabel = (dateKey: string): string =>
  new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(dateKey + "T12:00:00"));

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
    <div>
      <button
        type="button"
        onClick={onToggle}
        disabled={!hasActivity}
        className="group flex w-full items-center gap-3 text-left transition-opacity disabled:opacity-40"
      >
        <span className="w-26 shrink-0 text-right font-mono text-xs text-slate-600">
          {label}
        </span>

        <div className="relative h-9 flex-1 overflow-hidden rounded-full bg-slate-100">
          {percentage > 0 && (
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-linear-to-r from-mercamio-400 to-mercamio-600 transition-all duration-500"
              style={{ width: `${Math.max(percentage, 2)}%` }}
            />
          )}
          {hasActivity && (
            <div className="absolute inset-0 flex items-center justify-between px-3">
              <span className="text-xs font-semibold text-slate-900 drop-shadow-[0_0_2px_rgba(255,255,255,0.8)]">
                {formatCOP(totalSales)}
              </span>
            </div>
          )}
        </div>

        <div className="flex w-36 shrink-0 items-center justify-end gap-3">
          <span className="flex items-center gap-1 text-xs text-slate-700">
            <Users className="h-3.5 w-3.5" />
            {employeesPresent}
          </span>
          {hasActivity && (
            <ChevronDown
              className={`h-3.5 w-3.5 text-slate-400 transition-transform group-hover:text-slate-600 ${
                isExpanded ? "rotate-180" : ""
              }`}
            />
          )}
        </div>
      </button>

      {isExpanded && hasActivity && (
        <div className="mt-2 ml-26 mr-36 rounded-2xl border border-slate-200/70 bg-slate-50 p-3">
          <div className="grid grid-cols-3 gap-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500 pb-2 border-b border-slate-200/50">
            <span>Linea</span>
            <span className="text-right">Ventas</span>
            <span className="text-right">% del total</span>
          </div>
          <div className="divide-y divide-slate-100">
            {lines
              .filter((l) => l.sales > 0)
              .sort((a, b) => b.sales - a.sales)
              .map((line) => (
                <div
                  key={line.lineId}
                  className="grid grid-cols-3 gap-1 py-1.5 text-sm"
                >
                  <span className="font-medium text-slate-800">
                    {line.lineName}
                  </span>
                  <span className="text-right text-slate-700">
                    {formatCOP(line.sales)}
                  </span>
                  <span className="text-right font-semibold text-mercamio-700">
                    {((line.sales / lineTotalForPercent) * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
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
      className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.15)]"
    >
      {/* Header */}
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-700">
          Analisis por hora
        </p>
        <h3 className="mt-1 text-lg font-semibold text-slate-900">
          Desglose horario de ventas y empleados
        </h3>
        <p className="mt-1 text-xs text-slate-600">
          Selecciona un dia y sede para ver el detalle hora a hora. Haz clic en
          una barra para ver el desglose por linea.
        </p>
      </div>

      {/* Controles */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-slate-700">Fecha</span>
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="mt-1 w-full rounded-full border border-slate-200/70 bg-slate-50 px-3 py-2 text-sm text-slate-900 transition-all focus:border-mercamio-300 focus:outline-none focus:ring-2 focus:ring-mercamio-100"
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
            className="mt-1 w-full rounded-full border border-slate-200/70 bg-slate-50 px-3 py-2 text-sm text-slate-900 transition-all focus:border-mercamio-300 focus:outline-none focus:ring-2 focus:ring-mercamio-100"
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
            <span className="text-sm font-semibold text-slate-900">
              {formatDateLabel(hourlyData.date)}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {hourlyData.sede}
            </span>
            <span className="flex items-center gap-1 rounded-full bg-mercamio-50 px-3 py-1 text-xs font-semibold text-mercamio-700">
              <DollarSign className="h-3.5 w-3.5" />
              {formatCOP(dayTotals.sales)}
            </span>
            <span className="flex items-center gap-1 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
              <Users className="h-3.5 w-3.5" />
              Pico: {dayTotals.peakEmployees} empleados
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {dayTotals.activeHoursCount} horas con actividad
            </span>
          </div>

          {/* Hourly bars */}
          {activeHours.length > 0 ? (
            <div className="space-y-2">
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
