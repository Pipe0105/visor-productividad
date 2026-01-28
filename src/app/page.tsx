"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { animate, remove } from "animejs";
import {
  Download,
  LayoutGrid,
  Table2,
  Sparkles,
  ChevronDown,
  Search,
  ArrowUpDown,
  BarChart3,
} from "lucide-react";
import * as ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { LineCard } from "@/components/LineCard";
import { LineComparisonTable } from "@/components/LineComparisonTable";
import { SummaryCard } from "@/components/SummaryCard";
import { TopBar } from "@/components/TopBar";
import {
  calcDailySummary,
  calcLineCost,
  calcLineMargin,
  formatCOP,
  formatPercent,
  hasLaborDataForLine,
} from "@/lib/calc";
import { DEFAULT_LINES, DEFAULT_SEDES, Sede } from "@/lib/constants";
import { DailyProductivity, LineMetrics } from "@/types";

// ============================================================================
// UTILIDADES DE FECHA
// ============================================================================

const parseDateKey = (dateKey: string): Date => {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const toDateKey = (date: Date): string => date.toISOString().slice(0, 10);

const formatDateLabel = (dateKey: string): string =>
  new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parseDateKey(dateKey));

const formatMonthLabel = (yearMonth: string): string =>
  new Intl.DateTimeFormat("es-CO", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${yearMonth}-01T00:00:00`));

const formatPdfDate = () =>
  new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());

const formatPdfNumber = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 0,
  }).format(value);

// ============================================================================
// TIPOS
// ============================================================================

type ApiResponse = {
  dailyData: DailyProductivity[];
  sedes: Array<{ id: string; name: string }>;
  error?: string;
};

type DateRange = {
  start: string;
  end: string;
};

// ============================================================================
// HOOKS PERSONALIZADOS
// ============================================================================

const useProductivityData = () => {
  const [dailyDataSet, setDailyDataSet] = useState<DailyProductivity[]>([]);
  const [availableSedes, setAvailableSedes] = useState<Sede[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/productivity", {
          signal: controller.signal,
        });

        const payload = (await response.json()) as ApiResponse;

        if (!isMounted) return;

        const resolvedDailyData = payload.dailyData ?? [];
        const resolvedSedes =
          payload.sedes && payload.sedes.length > 0
            ? payload.sedes
            : DEFAULT_SEDES;

        if (!response.ok) {
          throw new Error(payload.error ?? "No se pudo cargar la información");
        }

        setDailyDataSet(resolvedDailyData);
        setAvailableSedes(resolvedSedes);
        if (payload.error) {
          setError(payload.error);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Error desconocido");
          setDailyDataSet([]);
          setAvailableSedes([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  return { dailyDataSet, availableSedes, isLoading, error };
};

const useAnimations = (
  isLoading: boolean,
  filteredLinesCount: number,
  viewMode: "cards" | "comparison" | "chart" | "trends",
) => {
  useEffect(() => {
    if (
      isLoading ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const hasLineItems = filteredLinesCount > 0;

    remove?.("[data-animate]");

    const hasTargets = (selector: string) =>
      document.querySelectorAll(selector).length > 0;

    const runAnimations = () => {
      if (hasTargets("[data-animate='top-bar']")) {
        animate("[data-animate='top-bar']", {
          translateY: [-16, 0],
          opacity: [0, 1],
          delay: (_el: unknown, index: number) => index * 90,
          duration: 650,
          easing: "easeOutCubic",
        });
      }

      if (hasLineItems && hasTargets("[data-animate='line-card']")) {
        animate("[data-animate='line-card']", {
          translateY: [18, 0],
          opacity: [0, 1],
          duration: 550,
          easing: "easeOutCubic",
        });
      }

      if (hasTargets("[data-animate='summary-card']")) {
        animate("[data-animate='summary-card']", {
          scale: [0.97, 1],
          opacity: [0, 1],
          delay: (_el: unknown, index: number) => index * 120,
          duration: 600,
          easing: "easeOutCubic",
        });
      }

      if (viewMode === "comparison") {
        if (hasTargets("[data-animate='comparison-card']")) {
          animate("[data-animate='comparison-card']", {
            translateY: [-8, 0],
            opacity: [0, 1],
            duration: 550,
            easing: "easeOutCubic",
          });
        }

        if (hasLineItems && hasTargets("[data-animate='comparison-row']")) {
          animate("[data-animate='comparison-row']", {
            translateX: [-12, 0],
            opacity: [0, 1],
            delay: (_el: unknown, index: number) => index * 40,
            duration: 450,
            easing: "easeOutCubic",
          });
        }
      }

      if (viewMode === "chart") {
        if (hasTargets("[data-animate='chart-card']")) {
          animate("[data-animate='chart-card']", {
            translateY: [-8, 0],
            opacity: [0, 1],
            duration: 550,
            easing: "easeOutCubic",
          });
        }
      }
    };

    const animationFrame = window.requestAnimationFrame(runAnimations);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [isLoading, filteredLinesCount, viewMode]);
};

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

const extractSedesFromData = (data: DailyProductivity[]): Sede[] => {
  return Array.from(
    new Map(data.map((item) => [item.sede, item.sede])).entries(),
  ).map(([id, name]) => ({ id, name }));
};
const aggregateLines = (dailyData: DailyProductivity[]): LineMetrics[] => {
  const lineMap = new Map<
    string,
    { id: string; name: string; sales: number; hours: number; cost: number }
  >();

  dailyData.forEach((day) => {
    day.lines.forEach((line) => {
      const hasLaborData = hasLaborDataForLine(line.id);
      const hours = hasLaborData ? line.hours : 0;
      const hourlyRate = hasLaborData ? line.hourlyRate : 0;
      const cost = hours * hourlyRate;
      const existing = lineMap.get(line.id);

      if (existing) {
        existing.sales += line.sales;
        existing.hours += hours;
        existing.cost += cost;
      } else {
        lineMap.set(line.id, {
          id: line.id,
          name: line.name,
          sales: line.sales,
          hours,
          cost,
        });
      }
    });
  });

  DEFAULT_LINES.forEach((line) => {
    if (!lineMap.has(line.id)) {
      lineMap.set(line.id, {
        id: line.id,
        name: line.name,
        sales: 0,
        hours: 0,
        cost: 0,
      });
    }
  });

  return Array.from(lineMap.values()).map((line) => ({
    id: line.id,
    name: line.name,
    sales: line.sales,
    hours: line.hours,
    hourlyRate: line.hours ? line.cost / line.hours : 0,
  }));
};

const filterLinesByStatus = (
  lines: LineMetrics[],
  filterType: string,
): LineMetrics[] => {
  return lines;
};

const calculateMonthlyAverage = (
  summaries: ReturnType<typeof calcDailySummary>[],
) => {
  if (summaries.length === 0) return null;

  const total = summaries.reduce(
    (acc, item) => ({
      sales: acc.sales + item.sales,
      hours: acc.hours + item.hours,
      cost: acc.cost + item.cost,
      margin: acc.margin + item.margin,
    }),
    { sales: 0, hours: 0, cost: 0, margin: 0 },
  );

  return {
    sales: total.sales / summaries.length,
    hours: total.hours / summaries.length,
    cost: total.cost / summaries.length,
    margin: total.margin / summaries.length,
  };
};

// ============================================================================
// COMPONENTES
// ============================================================================

const LoadingSkeleton = () => (
  <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
    {Array.from({ length: 6 }).map((_, index) => (
      <div
        key={`line-skeleton-${index}`}
        className="h-80 rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.15)]"
      >
        <div className="flex h-full flex-col gap-4 animate-pulse">
          <div className="h-6 w-32 rounded-full bg-slate-200/70" />
          <div className="h-4 w-24 rounded-full bg-slate-200/70" />
          <div className="h-12 rounded-2xl bg-slate-200/70" />
          <div className="flex-1 rounded-2xl bg-slate-200/70" />
        </div>
      </div>
    ))}
  </section>
);

const EmptyState = ({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) => (
  <section className="rounded-3xl border border-dashed border-slate-200/70 bg-slate-50 p-10 text-center">
    <p className="text-sm uppercase tracking-[0.3em] text-slate-700">
      Sin datos
    </p>
    <h2 className="mt-3 text-2xl font-semibold text-slate-900">{title}</h2>
    <p className="mt-2 text-sm text-slate-700">{description}</p>
    {actionLabel && onAction && (
      <button
        type="button"
        onClick={onAction}
        className="mt-6 inline-flex items-center gap-2 rounded-full border border-mercamio-200/70 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-mercamio-700 transition-all hover:border-mercamio-300 hover:bg-mercamio-50"
      >
        <Sparkles className="h-4 w-4" />
        {actionLabel}
      </button>
    )}
  </section>
);

const SearchAndSort = ({
  searchQuery,
  onSearchChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderToggle,
}: {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  sortBy: "sales" | "margin" | "hours" | "name";
  onSortByChange: (value: "sales" | "margin" | "hours" | "name") => void;
  sortOrder: "asc" | "desc";
  onSortOrderToggle: () => void;
}) => (
  <div className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.15)]">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-3 flex-1">
        <div className="relative flex-1 min-w-50">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-700" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por nombre o código..."
            className="w-full rounded-full border border-slate-200/70 bg-slate-50 py-2 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-600 transition-all focus:border-mercamio-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-mercamio-100"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-700">
          Ordenar:
        </span>
        <select
          value={sortBy}
          onChange={(e) =>
            onSortByChange(
              e.target.value as "sales" | "margin" | "hours" | "name",
            )
          }
          className="rounded-full border border-slate-200/70 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700 transition-all hover:border-slate-300 focus:border-mercamio-300 focus:outline-none focus:ring-2 focus:ring-mercamio-100"
        >
          <option value="margin">Margen</option>
          <option value="sales">Ventas</option>
          <option value="hours">Horas</option>
          <option value="name">Nombre</option>
        </select>
        <button
          type="button"
          onClick={onSortOrderToggle}
          className="rounded-full border border-slate-200/70 bg-slate-50 p-2 text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-100"
          title={sortOrder === "asc" ? "Ascendente" : "Descendente"}
        >
          <ArrowUpDown
            className={`h-4 w-4 transition-transform ${sortOrder === "asc" ? "rotate-180" : ""}`}
          />
        </button>
      </div>
    </div>
  </div>
);

const ViewToggle = ({
  viewMode,
  onChange,
}: {
  viewMode: "cards" | "comparison" | "chart" | "trends";
  onChange: (value: "cards" | "comparison" | "chart" | "trends") => void;
}) => {
  const getModeLabel = () => {
    switch (viewMode) {
      case "cards":
        return "Tarjetas detalladas";
      case "comparison":
        return "Comparativo de rentabilidad";
      case "chart":
        return "Top 6 líneas (gráfico)";
      case "trends":
        return "Análisis de tendencias";
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200/70 bg-white p-4 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.15)]">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-700">
          Vista de líneas
        </p>
        <p className="text-sm font-semibold text-slate-900">{getModeLabel()}</p>
        <p className="mt-1 text-xs text-slate-700">
          Alterna la visualización para detectar oportunidades rápidamente.
        </p>
      </div>
      <div className="flex items-center gap-2 rounded-full border border-slate-200/70 bg-slate-50 p-1">
        <button
          type="button"
          onClick={() => onChange("cards")}
          aria-pressed={viewMode === "cards"}
          className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition-all ${
            viewMode === "cards"
              ? "bg-white text-mercamio-700 shadow-sm"
              : "text-slate-700 hover:text-slate-800"
          }`}
        >
          <LayoutGrid className="h-4 w-4" />
          Tarjetas
        </button>
        <button
          type="button"
          onClick={() => onChange("comparison")}
          aria-pressed={viewMode === "comparison"}
          className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition-all ${
            viewMode === "comparison"
              ? "bg-white text-mercamio-700 shadow-sm"
              : "text-slate-700 hover:text-slate-800"
          }`}
        >
          <Table2 className="h-4 w-4" />
          Comparativo
        </button>
        <button
          type="button"
          onClick={() => onChange("chart")}
          aria-pressed={viewMode === "chart"}
          className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition-all ${
            viewMode === "chart"
              ? "bg-white text-mercamio-700 shadow-sm"
              : "text-slate-700 hover:text-slate-800"
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          Gráfico
        </button>
        <button
          type="button"
          onClick={() => onChange("trends")}
          aria-pressed={viewMode === "trends"}
          className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition-all ${
            viewMode === "trends"
              ? "bg-white text-mercamio-700 shadow-sm"
              : "text-slate-700 hover:text-slate-800"
          }`}
        >
          <ArrowUpDown className="h-4 w-4" />
          Tendencias
        </button>
      </div>
    </div>
  );
};

const ChartVisualization = ({ lines }: { lines: LineMetrics[] }) => {
  const [chartType, setChartType] = useState<"sales" | "margin">("sales");

  const sortedLines = useMemo(() => {
    return [...lines]
      .sort((a, b) => {
        if (chartType === "sales") {
          return b.sales - a.sales;
        }
        return calcLineMargin(b) - calcLineMargin(a);
      })
      .slice(0, 6); // Top 6
  }, [lines, chartType]);

  const maxValue = useMemo(() => {
    if (sortedLines.length === 0) return 1;
    if (chartType === "sales") {
      return Math.max(...sortedLines.map((line) => line.sales));
    }
    return Math.max(...sortedLines.map((line) => calcLineMargin(line)));
  }, [sortedLines, chartType]);

  if (lines.length === 0) return null;

  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.15)]">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-700">
            Análisis visual
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">
            Top 6 líneas por {chartType === "sales" ? "ventas" : "margen"}
          </h3>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-slate-200/70 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => setChartType("sales")}
            className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition-all ${
              chartType === "sales"
                ? "bg-white text-mercamio-700 shadow-sm"
                : "text-slate-700 hover:text-slate-800"
            }`}
          >
            Ventas
          </button>
          <button
            type="button"
            onClick={() => setChartType("margin")}
            className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition-all ${
              chartType === "margin"
                ? "bg-white text-mercamio-700 shadow-sm"
                : "text-slate-700 hover:text-slate-800"
            }`}
          >
            Margen
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {sortedLines.map((line, index) => {
          const value =
            chartType === "sales" ? line.sales : calcLineMargin(line);
          const rawPercentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
          const percentage = Number.isFinite(rawPercentage)
            ? Math.min(Math.max(rawPercentage, 0), 100)
            : 0;

          return (
            <div key={line.id} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-slate-700">#{index + 1}</span>
                  <span className="font-semibold text-slate-900">
                    {line.name}
                  </span>
                  <span className="font-mono text-slate-700">{line.id}</span>
                </div>
                <span className="font-semibold text-slate-900">
                  {formatCOP(value)}
                </span>
              </div>
              <div className="relative h-8 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: "#2a8f7c",
                  }}
                />
                <div className="absolute inset-0 flex items-center px-3">
                  <span className="text-xs font-semibold text-slate-700 mix-blend-difference">
                    {percentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {sortedLines.length === 0 && (
        <p className="text-center text-sm text-slate-700 py-8">
          No hay datos suficientes para mostrar el gráfico
        </p>
      )}
    </div>
  );
};

const LineTrends = ({
  dailyDataSet,
  selectedSede,
  availableDates,
  lines,
}: {
  dailyDataSet: DailyProductivity[];
  selectedSede: string;
  availableDates: string[];
  lines: LineMetrics[];
}) => {
  const [selectedLine, setSelectedLine] = useState<string>("");
  const [metricType, setMetricType] = useState<"sales" | "margin" | "hours">(
    "sales",
  );

  // Calculate trend data for selected line
  const trendData = useMemo(() => {
    if (!selectedLine) return [];

    const dataByDate = availableDates.map((date) => {
      const dayData = dailyDataSet.find(
        (item) => item.sede === selectedSede && item.date === date,
      );
      const lineData = dayData?.lines.find((l) => l.id === selectedLine);

      if (!lineData) {
        return { date, value: 0 };
      }

      let value = 0;
      if (metricType === "sales") {
        value = lineData.sales;
      } else if (metricType === "margin") {
        const hasLaborData = hasLaborDataForLine(lineData.id);
        const hours = hasLaborData ? lineData.hours : 0;
        const cost = hours * lineData.hourlyRate;
        value = lineData.sales - cost;
      } else {
        value = hasLaborDataForLine(lineData.id) ? lineData.hours : 0;
      }

      return { date, value };
    });

    return dataByDate;
  }, [selectedLine, metricType, dailyDataSet, selectedSede, availableDates]);

  const maxValue = useMemo(() => {
    if (trendData.length === 0) return 1;
    return Math.max(...trendData.map((d) => d.value), 1);
  }, [trendData]);

  const avgValue = useMemo(() => {
    if (trendData.length === 0) return 0;
    const sum = trendData.reduce((acc, d) => acc + d.value, 0);
    return sum / trendData.length;
  }, [trendData]);

  // Calculate trend direction
  const trendDirection = useMemo(() => {
    if (trendData.length < 2) return "stable";
    const firstHalf = trendData.slice(0, Math.floor(trendData.length / 2));
    const secondHalf = trendData.slice(Math.floor(trendData.length / 2));

    const firstAvg =
      firstHalf.reduce((acc, d) => acc + d.value, 0) / firstHalf.length;
    const secondAvg =
      secondHalf.reduce((acc, d) => acc + d.value, 0) / secondHalf.length;

    const change = ((secondAvg - firstAvg) / firstAvg) * 100;

    if (Math.abs(change) < 5) return "stable";
    return change > 0 ? "up" : "down";
  }, [trendData]);

  if (lines.length === 0 || availableDates.length === 0) return null;

  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.15)]">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-700">
          Análisis de tendencias
        </p>
        <h3 className="mt-1 text-lg font-semibold text-slate-900">
          Evolución temporal por línea
        </h3>
      </div>

      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <label className="block">
          <span className="text-xs font-semibold text-slate-700">Línea</span>
          <select
            value={selectedLine}
            onChange={(e) => setSelectedLine(e.target.value)}
            className="mt-1 w-full rounded-full border border-slate-200/70 bg-slate-50 px-3 py-2 text-sm text-slate-900 transition-all focus:border-mercamio-300 focus:outline-none focus:ring-2 focus:ring-mercamio-100"
          >
            <option value="">Selecciona una línea</option>
            {lines.map((line) => (
              <option key={line.id} value={line.id}>
                {line.name} ({line.id})
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-slate-700">Métrica</span>
          <select
            value={metricType}
            onChange={(e) =>
              setMetricType(e.target.value as "sales" | "margin" | "hours")
            }
            className="mt-1 w-full rounded-full border border-slate-200/70 bg-slate-50 px-3 py-2 text-sm text-slate-900 transition-all focus:border-mercamio-300 focus:outline-none focus:ring-2 focus:ring-mercamio-100"
          >
            <option value="sales">Ventas</option>
            <option value="margin">Margen</option>
            <option value="hours">Horas trabajadas</option>
          </select>
        </label>
      </div>

      {selectedLine && trendData.length > 0 && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-700">Promedio del período</p>
              <p className="text-2xl font-semibold text-slate-900">
                {metricType === "hours"
                  ? `${avgValue.toFixed(1)}h`
                  : formatCOP(avgValue)}
              </p>
            </div>
            <div
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                trendDirection === "up"
                  ? "bg-emerald-50 text-emerald-700"
                  : trendDirection === "down"
                    ? "bg-red-50 text-red-700"
                    : "bg-slate-100 text-slate-700"
              }`}
            >
              {trendDirection === "up" && "↑ Tendencia al alza"}
              {trendDirection === "down" && "↓ Tendencia a la baja"}
              {trendDirection === "stable" && "→ Estable"}
            </div>
          </div>

          <div className="space-y-2">
            {trendData.map((point) => {
              const percentage =
                maxValue > 0 ? (point.value / maxValue) * 100 : 0;
              const isAboveAverage = point.value > avgValue;

              return (
                <div key={point.date} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-slate-700">
                      {formatDateLabel(point.date)}
                    </span>
                    <span className="font-semibold text-slate-900">
                      {metricType === "hours"
                        ? `${point.value.toFixed(1)}h`
                        : formatCOP(point.value)}
                    </span>
                  </div>
                  <div className="relative h-6 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: isAboveAverage ? "#10b981" : "#f59e0b",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {!selectedLine && (
        <p className="text-center text-sm text-slate-700 py-8">
          Selecciona una línea para ver su tendencia temporal
        </p>
      )}

      {selectedLine && trendData.length === 0 && (
        <p className="text-center text-sm text-slate-700 py-8">
          No hay datos disponibles para esta línea
        </p>
      )}
    </div>
  );
};

const PeriodComparison = ({
  dailyDataSet,
  selectedSede,
  availableDates,
}: {
  dailyDataSet: DailyProductivity[];
  selectedSede: string;
  availableDates: string[];
}) => {
  const [period1, setPeriod1] = useState<DateRange>({
    start: availableDates[0] || "",
    end: availableDates[0] || "",
  });
  const [period2, setPeriod2] = useState<DateRange>({
    start: availableDates[availableDates.length - 1] || "",
    end: availableDates[availableDates.length - 1] || "",
  });

  const period1Data = useMemo(() => {
    const filtered = dailyDataSet.filter(
      (item) =>
        item.sede === selectedSede &&
        item.date >= period1.start &&
        item.date <= period1.end,
    );
    const lines = aggregateLines(filtered);
    return calcDailySummary(lines);
  }, [dailyDataSet, selectedSede, period1]);

  const period2Data = useMemo(() => {
    const filtered = dailyDataSet.filter(
      (item) =>
        item.sede === selectedSede &&
        item.date >= period2.start &&
        item.date <= period2.end,
    );
    const lines = aggregateLines(filtered);
    return calcDailySummary(lines);
  }, [dailyDataSet, selectedSede, period2]);

  const calculateDiff = (val1: number, val2: number) => {
    if (val2 === 0) return 0;
    return ((val1 - val2) / val2) * 100;
  };

  const salesDiff = calculateDiff(period1Data.sales, period2Data.sales);
  const marginDiff = calculateDiff(period1Data.margin, period2Data.margin);
  const hoursDiff = calculateDiff(period1Data.hours, period2Data.hours);
  const costDiff = calculateDiff(period1Data.cost, period2Data.cost);

  const renderMetric = (
    label: string,
    value1: number,
    value2: number,
    diff: number,
    isPercentage?: boolean,
  ) => {
    const isPositive = diff > 0;
    const displayValue = (val: number) =>
      isPercentage ? formatPercent(val) : formatCOP(val);

    return (
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-700">
          {label}
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-slate-700">Período 1</p>
            <p className="text-lg font-semibold text-slate-900">
              {displayValue(value1)}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-700">Período 2</p>
            <p className="text-lg font-semibold text-slate-900">
              {displayValue(value2)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
              isPositive
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            <span>{isPositive ? "↑" : "↓"}</span>
            <span>{Math.abs(diff).toFixed(1)}%</span>
          </div>
          <span className="text-xs text-slate-700">
            {isPositive ? "incremento" : "disminución"}
          </span>
        </div>
      </div>
    );
  };

  if (availableDates.length === 0) return null;

  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.15)]">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-700">
          Comparación de períodos
        </p>
        <h3 className="mt-1 text-lg font-semibold text-slate-900">
          Compara dos rangos de fechas
        </h3>
      </div>

      <div className="grid gap-6 md:grid-cols-2 mb-6">
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-900">Período 1</p>
          <div className="space-y-2">
            <label className="block">
              <span className="text-xs text-slate-700">Desde</span>
              <select
                value={period1.start}
                onChange={(e) =>
                  setPeriod1((prev) => ({ ...prev, start: e.target.value }))
                }
                className="mt-1 w-full rounded-full border border-slate-200/70 bg-slate-50 px-3 py-2 text-sm text-slate-900 transition-all focus:border-mercamio-300 focus:outline-none focus:ring-2 focus:ring-mercamio-100"
              >
                {availableDates.map((date) => (
                  <option key={date} value={date}>
                    {formatDateLabel(date)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-slate-700">Hasta</span>
              <select
                value={period1.end}
                onChange={(e) =>
                  setPeriod1((prev) => ({ ...prev, end: e.target.value }))
                }
                className="mt-1 w-full rounded-full border border-slate-200/70 bg-slate-50 px-3 py-2 text-sm text-slate-900 transition-all focus:border-mercamio-300 focus:outline-none focus:ring-2 focus:ring-mercamio-100"
              >
                {availableDates.map((date) => (
                  <option key={date} value={date}>
                    {formatDateLabel(date)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-900">Período 2</p>
          <div className="space-y-2">
            <label className="block">
              <span className="text-xs text-slate-700">Desde</span>
              <select
                value={period2.start}
                onChange={(e) =>
                  setPeriod2((prev) => ({ ...prev, start: e.target.value }))
                }
                className="mt-1 w-full rounded-full border border-slate-200/70 bg-slate-50 px-3 py-2 text-sm text-slate-900 transition-all focus:border-mercamio-300 focus:outline-none focus:ring-2 focus:ring-mercamio-100"
              >
                {availableDates.map((date) => (
                  <option key={date} value={date}>
                    {formatDateLabel(date)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-slate-700">Hasta</span>
              <select
                value={period2.end}
                onChange={(e) =>
                  setPeriod2((prev) => ({ ...prev, end: e.target.value }))
                }
                className="mt-1 w-full rounded-full border border-slate-200/70 bg-slate-50 px-3 py-2 text-sm text-slate-900 transition-all focus:border-mercamio-300 focus:outline-none focus:ring-2 focus:ring-mercamio-100"
              >
                {availableDates.map((date) => (
                  <option key={date} value={date}>
                    {formatDateLabel(date)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {renderMetric(
          "Ventas",
          period1Data.sales,
          period2Data.sales,
          salesDiff,
        )}
        {renderMetric(
          "Margen",
          period1Data.margin,
          period2Data.margin,
          marginDiff,
        )}
        {renderMetric(
          "Horas trabajadas",
          period1Data.hours,
          period2Data.hours,
          hoursDiff,
        )}
        {renderMetric(
          "Costos laborales",
          period1Data.cost,
          period2Data.cost,
          costDiff,
        )}
      </div>
    </div>
  );
};

const SelectionSummary = ({
  selectedSedeName,
  dateRangeLabel,
  lineFilterLabel,
  filteredCount,
  totalCount,
  availableDatesCount,
  hasRangeData,
  onDownloadPdf,
  onDownloadCsv,
  onDownloadXlsx,
  isDownloadDisabled,
}: {
  selectedSedeName: string;
  dateRangeLabel: string;
  lineFilterLabel: string;
  filteredCount: number;
  totalCount: number;
  availableDatesCount: number;
  hasRangeData: boolean;
  onDownloadPdf: () => void;
  onDownloadCsv: () => void;
  onDownloadXlsx: () => void;
  isDownloadDisabled: boolean;
}) => {
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-dropdown="export"]')) {
        setShowDownloadMenu(false);
      }
    };

    if (showDownloadMenu) {
      document.addEventListener("click", handleClickOutside);
    }

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [showDownloadMenu]);

  return (
    <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.12)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-700">
            Resumen de filtros
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">
            {selectedSedeName} · {dateRangeLabel || "Sin rango definido"}
          </h2>
          <p className="mt-1 text-sm text-slate-700">
            {lineFilterLabel} · {filteredCount} de {totalCount} líneas visibles
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
              hasRangeData
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            {hasRangeData ? "Datos disponibles" : "Sin datos en el rango"}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700">
            {availableDatesCount} fechas disponibles
          </span>
          <div className="relative" data-dropdown="export">
            <button
              type="button"
              onClick={() => setShowDownloadMenu(!showDownloadMenu)}
              disabled={isDownloadDisabled}
              className="inline-flex items-center gap-2 rounded-full border border-mercamio-200/80 bg-mercamio-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-mercamio-700 transition-all hover:border-mercamio-300 hover:bg-mercamio-100 disabled:cursor-not-allowed disabled:border-slate-200/70 disabled:bg-slate-100 disabled:text-slate-500"
            >
              <Download className="h-4 w-4" />
              Exportar
              <ChevronDown
                className={`h-3 w-3 transition-transform ${showDownloadMenu ? "rotate-180" : ""}`}
              />
            </button>
            {showDownloadMenu && !isDownloadDisabled && (
              <div className="absolute right-0 top-full mt-2 w-48 rounded-2xl border border-slate-200/70 bg-white shadow-lg overflow-hidden z-10">
                <button
                  type="button"
                  onClick={() => {
                    onDownloadCsv();
                    setShowDownloadMenu(false);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-slate-700 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
                >
                  <Download className="h-4 w-4" />
                  <div>
                    <div className="font-semibold">Descargar CSV</div>
                    <div className="text-xs text-slate-700">
                      Excel, Google Sheets
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDownloadXlsx();
                    setShowDownloadMenu(false);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700"
                >
                  <Download className="h-4 w-4" />
                  <div>
                    <div className="font-semibold">Descargar XLSX</div>
                    <div className="text-xs text-slate-700">
                      Excel con formato
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDownloadPdf();
                    setShowDownloadMenu(false);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-slate-700 transition-colors hover:bg-mercamio-50 hover:text-mercamio-700"
                >
                  <Download className="h-4 w-4" />
                  <div>
                    <div className="font-semibold">Descargar PDF</div>
                    <div className="text-xs text-slate-700">
                      Reporte imprimible
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function Home() {
  // Estado para controlar hidratación
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Estado con persistencia - siempre inicia con valores por defecto
  const [selectedSede, setSelectedSede] = useState("Floresta");
  const [dateRange, setDateRange] = useState<DateRange>({
    start: "2025-11-01",
    end: "2025-11-30",
  });
  const [lineFilter, setLineFilter] = useState("all");
  const [viewMode, setViewMode] = useState<
    "cards" | "comparison" | "chart" | "trends"
  >("cards");
  const [activeTab, setActiveTab] = useState<"lines" | "summaries">("lines");

  // Cargar preferencias desde localStorage después de montar
  useEffect(() => {
    setMounted(true);

    const savedSede = localStorage.getItem("selectedSede");
    if (savedSede) setSelectedSede(savedSede);

    const savedDateRange = localStorage.getItem("dateRange");
    if (savedDateRange) {
      try {
        setDateRange(JSON.parse(savedDateRange));
      } catch {
        // Mantener valores por defecto si hay error
      }
    }

    const savedLineFilter = localStorage.getItem("lineFilter");
    if (savedLineFilter) setLineFilter(savedLineFilter);

    const savedViewMode = localStorage.getItem("viewMode");
    if (savedViewMode) {
      setViewMode(savedViewMode as "cards" | "comparison" | "chart" | "trends");
    }

    const savedActiveTab = localStorage.getItem("activeTab");
    if (savedActiveTab) setActiveTab(savedActiveTab as "lines" | "summaries");

    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
      document.documentElement.classList.toggle("dark", savedTheme === "dark");
    } else if (window.matchMedia) {
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      setTheme(prefersDark ? "dark" : "light");
      document.documentElement.classList.toggle("dark", prefersDark);
    }
  }, []);

  // Guardar preferencias en localStorage (solo después de montar)
  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem("selectedSede", selectedSede);
  }, [selectedSede, mounted]);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem("dateRange", JSON.stringify(dateRange));
  }, [dateRange, mounted]);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem("lineFilter", lineFilter);
  }, [lineFilter, mounted]);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem("viewMode", viewMode);
  }, [viewMode, mounted]);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem("activeTab", activeTab);
  }, [activeTab, mounted]);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme, mounted]);

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  // Estados adicionales para búsqueda y ordenamiento
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"sales" | "margin" | "hours" | "name">(
    "margin",
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Cargar datos
  const { dailyDataSet, availableSedes, isLoading, error } =
    useProductivityData();

  // Fechas disponibles
  const availableDates = useMemo(() => {
    return Array.from(
      new Set(
        dailyDataSet
          .filter((item) => item.sede === selectedSede)
          .map((item) => item.date),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [dailyDataSet, selectedSede]);

  // Sincronizar sede seleccionada
  useEffect(() => {
    if (availableSedes.length === 0) return;

    if (!availableSedes.some((sede) => sede.id === selectedSede)) {
      setSelectedSede(availableSedes[0].id);
    }
  }, [availableSedes, selectedSede]);

  // Sincronizar fechas
  useEffect(() => {
    if (availableDates.length === 0) return;

    setDateRange((prev) => ({
      start: availableDates.includes(prev.start)
        ? prev.start
        : availableDates[0],
      end: availableDates.includes(prev.end)
        ? prev.end
        : availableDates[availableDates.length - 1],
    }));
  }, [availableDates]);

  // Datos derivados
  const selectedSedeName =
    availableSedes.find((sede) => sede.id === selectedSede)?.name ??
    selectedSede;

  const dateRangeLabel = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return "";

    if (dateRange.start === dateRange.end) {
      return `el ${formatDateLabel(dateRange.start)}`;
    }

    return `del ${formatDateLabel(dateRange.start)} al ${formatDateLabel(dateRange.end)}`;
  }, [dateRange]);

  const rangeDailyData = useMemo(() => {
    return dailyDataSet.filter(
      (item) =>
        item.sede === selectedSede &&
        item.date >= dateRange.start &&
        item.date <= dateRange.end,
    );
  }, [dailyDataSet, dateRange, selectedSede]);

  const lines = useMemo(() => aggregateLines(rangeDailyData), [rangeDailyData]);
  const hasRangeData = rangeDailyData.length > 0;

  const filteredLines = useMemo(() => {
    let result = filterLinesByStatus(lines, lineFilter);

    // Aplicar búsqueda
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (line) =>
          line.name.toLowerCase().includes(query) ||
          line.id.toLowerCase().includes(query),
      );
    }

    // Aplicar ordenamiento
    result.sort((a, b) => {
      let compareValue = 0;

      switch (sortBy) {
        case "sales":
          compareValue = a.sales - b.sales;
          break;
        case "margin":
          compareValue = calcLineMargin(a) - calcLineMargin(b);
          break;
        case "hours":
          compareValue = a.hours - b.hours;
          break;
        case "name":
          compareValue = a.name.localeCompare(b.name);
          break;
      }

      return sortOrder === "asc" ? compareValue : -compareValue;
    });

    return result;
  }, [lineFilter, lines, selectedSede, searchQuery, sortBy, sortOrder]);
  const pdfLines = useMemo(
    () =>
      [...filteredLines].sort((a, b) => calcLineMargin(b) - calcLineMargin(a)),
    [filteredLines],
  );

  const summary = useMemo(() => calcDailySummary(lines), [lines]);

  const lineFilterLabels: Record<string, string> = {
    all: "Todas las líneas",
    critical: "Líneas críticas (alerta)",
    improving: "Líneas en mejora (atención)",
  };

  const lineFilterLabel = lineFilterLabels[lineFilter] ?? "Todas las líneas";

  // Resumen mensual
  const selectedMonth = dateRange.end.slice(0, 7);

  const monthlySummary = useMemo(() => {
    const monthLines = dailyDataSet
      .filter(
        (item) =>
          item.sede === selectedSede && item.date.startsWith(selectedMonth),
      )
      .flatMap((item) => item.lines);

    return calcDailySummary(monthLines);
  }, [dailyDataSet, selectedMonth, selectedSede]);
  const hasMonthlyData = useMemo(() => {
    return dailyDataSet.some(
      (item) =>
        item.sede === selectedSede && item.date.startsWith(selectedMonth),
    );
  }, [dailyDataSet, selectedMonth, selectedSede]);

  // Comparaciones
  const summariesByDate = useMemo(() => {
    const map = new Map<string, ReturnType<typeof calcDailySummary>>();

    dailyDataSet
      .filter((item) => item.sede === selectedSede)
      .forEach((item) => {
        map.set(item.date, calcDailySummary(item.lines));
      });

    return map;
  }, [dailyDataSet, selectedSede]);

  const dailyComparisons = useMemo(() => {
    const selectedDateValue = parseDateKey(dateRange.end);

    const previousDay = new Date(selectedDateValue);
    previousDay.setUTCDate(previousDay.getUTCDate() - 1);

    const previousWeek = new Date(selectedDateValue);
    previousWeek.setUTCDate(previousWeek.getUTCDate() - 7);

    const monthlyDailySummaries = dailyDataSet
      .filter(
        (item) =>
          item.sede === selectedSede && item.date.startsWith(selectedMonth),
      )
      .map((item) => calcDailySummary(item.lines));

    return [
      {
        label: "Vs. día anterior",
        baseline: summariesByDate.get(toDateKey(previousDay)) ?? null,
      },
      {
        label: "Vs. semana anterior",
        baseline: summariesByDate.get(toDateKey(previousWeek)) ?? null,
      },
      {
        label: "Vs. promedio mensual",
        baseline: calculateMonthlyAverage(monthlyDailySummaries),
      },
    ];
  }, [
    dailyDataSet,
    dateRange.end,
    selectedMonth,
    selectedSede,
    summariesByDate,
  ]);

  // Handlers
  const handleStartDateChange = useCallback((value: string) => {
    setDateRange((prev) => ({
      start: value,
      end: value > prev.end ? value : prev.end,
    }));
  }, []);

  const handleEndDateChange = useCallback((value: string) => {
    setDateRange((prev) => ({
      start: value < prev.start ? value : prev.start,
      end: value,
    }));
  }, []);

  const handleViewChange = useCallback(
    (value: "cards" | "comparison" | "chart" | "trends") => {
      setViewMode(value);
    },
    [],
  );

  const handleSortOrderToggle = useCallback(() => {
    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
  }, []);

  const handleDownloadCsv = useCallback(() => {
    const escapeCsv = (value: string | number) => {
      const str = String(value);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const formatNumber = (value: number) => {
      return new Intl.NumberFormat("es-CO", {
        maximumFractionDigits: 0,
      }).format(value);
    };

    // Calcular totales
    const totalSales = pdfLines.reduce((acc, line) => acc + line.sales, 0);
    const totalHours = pdfLines.reduce((acc, line) => {
      const hasLaborData = hasLaborDataForLine(line.id);
      return acc + (hasLaborData ? line.hours : 0);
    }, 0);
    const totalCost = pdfLines.reduce((acc, line) => {
      const hasLaborData = hasLaborDataForLine(line.id);
      return acc + (hasLaborData ? calcLineCost(line) : 0);
    }, 0);
    const totalMargin = pdfLines.reduce((acc, line) => {
      const hasLaborData = hasLaborDataForLine(line.id);
      return acc + (hasLaborData ? calcLineMargin(line) : 0);
    }, 0);
    const totalMarginRatio = totalSales ? totalMargin / totalSales : 0;

    // Separador visual
    const separator = "═".repeat(80);
    const thinSeparator = "─".repeat(80);

    const csvLines = [
      separator,
      "REPORTE DE PRODUCTIVIDAD POR LÍNEA",
      separator,
      "",
      "┌─────────────────────────────────────────────────────────────────────────────┐",
      "│  INFORMACIÓN DEL REPORTE                                                    │",
      "├─────────────────────────────────────────────────────────────────────────────┤",
      `│  Sede:      ${escapeCsv(selectedSedeName).padEnd(62)}│`,
      `│  Rango:     ${escapeCsv(dateRangeLabel || "Sin rango definido").padEnd(62)}│`,
      `│  Filtro:    ${escapeCsv(lineFilterLabel).padEnd(62)}│`,
      `│  Generado:  ${escapeCsv(formatPdfDate()).padEnd(62)}│`,
      "└─────────────────────────────────────────────────────────────────────────────┘",
      "",
      "",
      thinSeparator,
      "DETALLE POR LÍNEA",
      thinSeparator,
      "",
      "#,Línea,Código,Ventas ($),Horas,Costo ($),Margen ($),Margen %",
      ...pdfLines.map((line, index) => {
        const hasLaborData = hasLaborDataForLine(line.id);
        const hours = hasLaborData ? line.hours : 0;
        const cost = hasLaborData ? calcLineCost(line) : 0;
        const margin = hasLaborData ? calcLineMargin(line) : 0;
        const marginRatio = line.sales ? margin / line.sales : 0;
        return [
          index + 1,
          escapeCsv(line.name),
          escapeCsv(line.id),
          formatNumber(Math.round(line.sales)),
          hours.toFixed(2),
          formatNumber(Math.round(cost)),
          formatNumber(Math.round(margin)),
          `${(marginRatio * 100).toFixed(2)}%`,
        ].join(",");
      }),
      "",
      thinSeparator,
      "TOTALES",
      thinSeparator,
      `,TOTAL,,${formatNumber(Math.round(totalSales))},${totalHours.toFixed(2)},${formatNumber(Math.round(totalCost))},${formatNumber(Math.round(totalMargin))},${(totalMarginRatio * 100).toFixed(2)}%`,
      "",
      "",
      separator,
      "Generado automáticamente por Visor de Productividad",
      separator,
    ];

    const csvContent = csvLines.join("\n");
    const blob = new Blob(["\ufeff" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeSede = selectedSede.replace(/\s+/g, "-");
    const fileName = `reporte-productividad-${safeSede}-${dateRange.start || "sin-fecha"}-${
      dateRange.end || "sin-fecha"
    }.csv`;
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }, [
    dateRange.end,
    dateRange.start,
    dateRangeLabel,
    lineFilterLabel,
    pdfLines,
    selectedSede,
    selectedSedeName,
  ]);

  const handleDownloadXlsx = useCallback(async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Visor de Productividad";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Productividad", {
      views: [{ showGridLines: false }],
    });

    // Colores corporativos
    const primaryColor = "1F4E79";
    const accentColor = "2E75B6";
    const lightBg = "D6DCE4";
    const totalBg = "BDD7EE";

    // Configurar anchos de columna
    worksheet.columns = [
      { key: "num", width: 6 },
      { key: "linea", width: 22 },
      { key: "codigo", width: 18 },
      { key: "ventas", width: 18 },
      { key: "horas", width: 12 },
      { key: "costo", width: 18 },
      { key: "margen", width: 18 },
      { key: "margenPct", width: 14 },
    ];

    // === TÍTULO ===
    worksheet.mergeCells("A1:H1");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = "REPORTE DE PRODUCTIVIDAD POR LÍNEA";
    titleCell.font = { name: "Calibri", size: 18, bold: true, color: { argb: primaryColor } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(1).height = 30;

    // === INFORMACIÓN DEL REPORTE ===
    const infoStartRow = 3;
    const infoData = [
      ["Sede:", selectedSedeName],
      ["Rango:", dateRangeLabel || "Sin rango definido"],
      ["Filtro:", lineFilterLabel],
      ["Generado:", formatPdfDate()],
    ];

    worksheet.mergeCells(`A${infoStartRow}:H${infoStartRow}`);
    const infoHeaderCell = worksheet.getCell(`A${infoStartRow}`);
    infoHeaderCell.value = "Información del Reporte";
    infoHeaderCell.font = { name: "Calibri", size: 12, bold: true, color: { argb: primaryColor } };
    infoHeaderCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: lightBg } };
    worksheet.getRow(infoStartRow).height = 22;

    infoData.forEach((item, index) => {
      const rowNum = infoStartRow + 1 + index;
      worksheet.getCell(`A${rowNum}`).value = item[0];
      worksheet.getCell(`A${rowNum}`).font = { name: "Calibri", size: 11, bold: true };
      worksheet.getCell(`B${rowNum}`).value = item[1];
      worksheet.getCell(`B${rowNum}`).font = { name: "Calibri", size: 11 };
    });

    // === ENCABEZADOS DE TABLA ===
    const headerRow = infoStartRow + infoData.length + 2;
    const headers = ["#", "Línea", "Código", "Ventas ($)", "Horas", "Costo ($)", "Margen ($)", "Margen %"];

    const headerRowObj = worksheet.getRow(headerRow);
    headers.forEach((header, index) => {
      const cell = headerRowObj.getCell(index + 1);
      cell.value = header;
      cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: primaryColor } };
      cell.alignment = { horizontal: index <= 2 ? "left" : "right", vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: primaryColor } },
        bottom: { style: "thin", color: { argb: primaryColor } },
        left: { style: "thin", color: { argb: primaryColor } },
        right: { style: "thin", color: { argb: primaryColor } },
      };
    });
    headerRowObj.height = 24;

    // === FILAS DE DATOS ===
    const dataStartRow = headerRow + 1;
    let totalSales = 0;
    let totalHours = 0;
    let totalCost = 0;
    let totalMargin = 0;

    pdfLines.forEach((line, index) => {
      const hasLaborData = hasLaborDataForLine(line.id);
      const hours = hasLaborData ? line.hours : 0;
      const cost = hasLaborData ? calcLineCost(line) : 0;
      const margin = hasLaborData ? calcLineMargin(line) : 0;
      const marginRatio = line.sales ? margin / line.sales : 0;

      totalSales += line.sales;
      totalHours += hours;
      totalCost += cost;
      totalMargin += margin;

      const rowNum = dataStartRow + index;
      const row = worksheet.getRow(rowNum);
      const isEven = index % 2 === 0;
      const rowBg = isEven ? "F2F2F2" : "FFFFFF";

      const rowData = [
        index + 1,
        line.name,
        line.id,
        Math.round(line.sales),
        hours,
        Math.round(cost),
        Math.round(margin),
        marginRatio,
      ];

      rowData.forEach((value, colIndex) => {
        const cell = row.getCell(colIndex + 1);
        cell.value = value;
        cell.font = { name: "Calibri", size: 11 };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowBg } };
        cell.alignment = { horizontal: colIndex <= 2 ? "left" : "right", vertical: "middle" };
        cell.border = {
          top: { style: "thin", color: { argb: "D9D9D9" } },
          bottom: { style: "thin", color: { argb: "D9D9D9" } },
          left: { style: "thin", color: { argb: "D9D9D9" } },
          right: { style: "thin", color: { argb: "D9D9D9" } },
        };

        // Formato numérico
        if (colIndex >= 3 && colIndex <= 6) {
          cell.numFmt = "#,##0";
        }
        if (colIndex === 7) {
          cell.numFmt = "0.00%";
        }
      });
      row.height = 20;
    });

    // === FILA DE TOTALES ===
    const totalRowNum = dataStartRow + pdfLines.length + 1;
    const totalRow = worksheet.getRow(totalRowNum);
    const totalMarginRatio = totalSales ? totalMargin / totalSales : 0;

    const totalsData = [
      "",
      "TOTAL",
      "",
      Math.round(totalSales),
      totalHours,
      Math.round(totalCost),
      Math.round(totalMargin),
      totalMarginRatio,
    ];

    totalsData.forEach((value, colIndex) => {
      const cell = totalRow.getCell(colIndex + 1);
      cell.value = value;
      cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: primaryColor } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: totalBg } };
      cell.alignment = { horizontal: colIndex <= 2 ? "left" : "right", vertical: "middle" };
      cell.border = {
        top: { style: "medium", color: { argb: accentColor } },
        bottom: { style: "medium", color: { argb: accentColor } },
        left: { style: "thin", color: { argb: accentColor } },
        right: { style: "thin", color: { argb: accentColor } },
      };

      if (colIndex >= 3 && colIndex <= 6) {
        cell.numFmt = "#,##0";
      }
      if (colIndex === 7) {
        cell.numFmt = "0.00%";
      }
    });
    totalRow.height = 24;

    // === PIE DE PÁGINA ===
    const footerRow = totalRowNum + 2;
    worksheet.mergeCells(`A${footerRow}:H${footerRow}`);
    const footerCell = worksheet.getCell(`A${footerRow}`);
    footerCell.value = "Generado automáticamente por Visor de Productividad";
    footerCell.font = { name: "Calibri", size: 9, italic: true, color: { argb: "808080" } };
    footerCell.alignment = { horizontal: "center" };

    // Generar y descargar archivo
    const safeSede = selectedSede.replace(/\s+/g, "-");
    const fileName = `reporte-productividad-${safeSede}-${dateRange.start || "sin-fecha"}-${
      dateRange.end || "sin-fecha"
    }.xlsx`;

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }, [
    dateRange.end,
    dateRange.start,
    dateRangeLabel,
    lineFilterLabel,
    pdfLines,
    selectedSede,
    selectedSedeName,
  ]);

  const handleDownloadPdf = useCallback(() => {
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const primaryColor: [number, number, number] = [31, 78, 121];
    const accentColor: [number, number, number] = [46, 117, 182];

    const formatNumber = (value: number) =>
      new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(value);

    // === TÍTULO ===
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 20, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("REPORTE DE PRODUCTIVIDAD POR LÍNEA", pageWidth / 2, 13, { align: "center" });

    // === INFORMACIÓN DEL REPORTE ===
    doc.setTextColor(0, 0, 0);
    doc.setFillColor(214, 220, 228);
    doc.rect(15, 25, pageWidth - 30, 8, "F");
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...primaryColor);
    doc.text("Información del Reporte", 20, 30.5);

    doc.setTextColor(60, 60, 60);
    doc.setFontSize(10);
    const infoY = 40;
    const infoData = [
      ["Sede:", selectedSedeName],
      ["Rango:", dateRangeLabel || "Sin rango definido"],
      ["Filtro:", lineFilterLabel],
      ["Generado:", formatPdfDate()],
    ];

    infoData.forEach((item, index) => {
      const y = infoY + index * 6;
      doc.setFont("helvetica", "bold");
      doc.text(item[0], 20, y);
      doc.setFont("helvetica", "normal");
      doc.text(item[1], 45, y);
    });

    // === TABLA DE DATOS ===
    const tableStartY = infoY + infoData.length * 6 + 8;

    // Calcular totales
    const totalSales = pdfLines.reduce((acc, line) => acc + line.sales, 0);
    const totalHours = pdfLines.reduce((acc, line) => {
      const hasLaborData = hasLaborDataForLine(line.id);
      return acc + (hasLaborData ? line.hours : 0);
    }, 0);
    const totalCost = pdfLines.reduce((acc, line) => {
      const hasLaborData = hasLaborDataForLine(line.id);
      return acc + (hasLaborData ? calcLineCost(line) : 0);
    }, 0);
    const totalMargin = pdfLines.reduce((acc, line) => {
      const hasLaborData = hasLaborDataForLine(line.id);
      return acc + (hasLaborData ? calcLineMargin(line) : 0);
    }, 0);
    const totalMarginRatio = totalSales ? totalMargin / totalSales : 0;

    // Preparar filas de datos
    const tableBody = pdfLines.map((line, index) => {
      const hasLaborData = hasLaborDataForLine(line.id);
      const hours = hasLaborData ? line.hours : 0;
      const cost = hasLaborData ? calcLineCost(line) : 0;
      const margin = hasLaborData ? calcLineMargin(line) : 0;
      const marginRatio = line.sales ? margin / line.sales : 0;

      return [
        (index + 1).toString(),
        line.name,
        line.id,
        `$ ${formatNumber(Math.round(line.sales))}`,
        hours.toFixed(2),
        `$ ${formatNumber(Math.round(cost))}`,
        `$ ${formatNumber(Math.round(margin))}`,
        `${(marginRatio * 100).toFixed(2)}%`,
      ];
    });

    // Fila de totales
    const totalsRow = [
      "",
      "TOTAL",
      "",
      `$ ${formatNumber(Math.round(totalSales))}`,
      totalHours.toFixed(2),
      `$ ${formatNumber(Math.round(totalCost))}`,
      `$ ${formatNumber(Math.round(totalMargin))}`,
      `${(totalMarginRatio * 100).toFixed(2)}%`,
    ];

    autoTable(doc, {
      startY: tableStartY,
      head: [["#", "Línea", "Código", "Ventas", "Horas", "Costo", "Margen", "Margen %"]],
      body: tableBody,
      foot: [totalsRow],
      theme: "grid",
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        halign: "center",
        fontSize: 10,
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [50, 50, 50],
      },
      footStyles: {
        fillColor: [189, 215, 238],
        textColor: primaryColor,
        fontStyle: "bold",
        fontSize: 10,
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 12 },
        1: { halign: "left", cellWidth: 50 },
        2: { halign: "left", cellWidth: 35 },
        3: { halign: "right", cellWidth: 35 },
        4: { halign: "right", cellWidth: 22 },
        5: { halign: "right", cellWidth: 35 },
        6: { halign: "right", cellWidth: 35 },
        7: { halign: "right", cellWidth: 25 },
      },
      margin: { left: 15, right: 15 },
      styles: {
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
      },
    });

    // === PIE DE PÁGINA ===
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFillColor(...accentColor);
    doc.rect(0, pageHeight - 10, pageWidth, 10, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text("Generado automáticamente por Visor de Productividad", pageWidth / 2, pageHeight - 4, {
      align: "center",
    });

    // Descargar
    const safeSede = selectedSede.replace(/\s+/g, "-");
    const fileName = `reporte-productividad-${safeSede}-${dateRange.start || "sin-fecha"}-${
      dateRange.end || "sin-fecha"
    }.pdf`;
    doc.save(fileName);
  }, [
    dateRange.end,
    dateRange.start,
    dateRangeLabel,
    lineFilterLabel,
    pdfLines,
    selectedSede,
    selectedSedeName,
  ]);

  // Atajos de teclado
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Ignorar si está escribiendo en un input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        // Solo permitir Escape para limpiar búsqueda
        if (
          event.key === "Escape" &&
          event.target instanceof HTMLInputElement
        ) {
          setSearchQuery("");
          event.target.blur();
        }
        return;
      }

      // Ctrl/Cmd + E: Abrir menú de exportación
      if ((event.ctrlKey || event.metaKey) && event.key === "e") {
        event.preventDefault();
        // Trigger del botón de exportar (se implementará con ref si es necesario)
      }

      // Ctrl/Cmd + F: Enfocar búsqueda
      if ((event.ctrlKey || event.metaKey) && event.key === "f") {
        event.preventDefault();
        const searchInput = document.querySelector(
          'input[placeholder*="Buscar"]',
        ) as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      }

      // 1: Ir a pestaña Líneas
      if (event.key === "1" && !event.ctrlKey && !event.metaKey) {
        setActiveTab("lines");
      }

      // 2: Ir a pestaña Resúmenes
      if (event.key === "2" && !event.ctrlKey && !event.metaKey) {
        setActiveTab("summaries");
      }

      // T: Toggle vista (tarjetas/comparativo/gráfico/tendencias)
      if (event.key === "t" && activeTab === "lines") {
        setViewMode((prev) => {
          if (prev === "cards") return "comparison";
          if (prev === "comparison") return "chart";
          if (prev === "chart") return "trends";
          return "cards";
        });
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, [activeTab]);

  // Animaciones
  useAnimations(isLoading, filteredLines.length, viewMode);

  // Render
  return (
    <div className="min-h-screen bg-background px-3 pb-8 pt-4 text-foreground sm:px-4 sm:pb-12 sm:pt-6 md:px-8 md:pb-16 md:pt-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:gap-6 md:gap-10">
        <TopBar
          title="Tablero de Productividad por Línea"
          selectedSede={selectedSede}
          sedes={availableSedes}
          startDate={dateRange.start}
          endDate={dateRange.end}
          dates={availableDates}
          theme={theme}
          onSedeChange={setSelectedSede}
          onStartDateChange={handleStartDateChange}
          onEndDateChange={handleEndDateChange}
          onToggleTheme={handleToggleTheme}
        />

        <SelectionSummary
          selectedSedeName={selectedSedeName}
          dateRangeLabel={dateRangeLabel}
          lineFilterLabel={lineFilterLabel}
          filteredCount={filteredLines.length}
          totalCount={lines.length}
          availableDatesCount={availableDates.length}
          hasRangeData={hasRangeData}
          onDownloadPdf={handleDownloadPdf}
          onDownloadCsv={handleDownloadCsv}
          onDownloadXlsx={handleDownloadXlsx}
          isDownloadDisabled={filteredLines.length === 0}
        />

        {error && (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-sm font-semibold text-red-900">{error}</p>
          </div>
        )}

        {/* Tabs Navigation */}
        {!isLoading && lines.length > 0 && (
          <div className="flex items-center gap-1 rounded-2xl border border-slate-200/70 bg-white p-1.5 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.15)] sm:gap-2 sm:rounded-3xl sm:p-2">
            <button
              type="button"
              onClick={() => setActiveTab("lines")}
              className={`flex-1 rounded-xl px-2 py-2 text-xs font-semibold uppercase tracking-widest transition-all sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm sm:tracking-[0.2em] ${
                activeTab === "lines"
                  ? "bg-mercamio-50 text-mercamio-700 shadow-sm"
                  : "text-slate-700 hover:text-slate-800"
              }`}
            >
              <span className="hidden sm:inline">Líneas de producción</span>
              <span className="sm:hidden">Líneas</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("summaries")}
              className={`flex-1 rounded-xl px-2 py-2 text-xs font-semibold uppercase tracking-widest transition-all sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm sm:tracking-[0.2em] ${
                activeTab === "summaries"
                  ? "bg-mercamio-50 text-mercamio-700 shadow-sm"
                  : "text-slate-700 hover:text-slate-800"
              }`}
            >
              Resúmenes
            </button>
          </div>
        )}

        {isLoading ? (
          <LoadingSkeleton />
        ) : lines.length === 0 ? (
          <EmptyState
            title={`No hay datos para ${selectedSedeName} ${dateRangeLabel}.`}
            description="Prueba otra fecha o sede para ver actividad."
          />
        ) : (
          <>
            {/* Tab: Lines */}
            {activeTab === "lines" && (
              <div className="space-y-6">
                <SearchAndSort
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  sortBy={sortBy}
                  onSortByChange={setSortBy}
                  sortOrder={sortOrder}
                  onSortOrderToggle={handleSortOrderToggle}
                />
                <ViewToggle viewMode={viewMode} onChange={handleViewChange} />

                {viewMode === "comparison" ? (
                  filteredLines.length > 0 ? (
                    <LineComparisonTable
                      lines={filteredLines}
                      hasData={hasRangeData}
                    />
                  ) : (
                    <EmptyState
                      title="No hay líneas para comparar con este filtro."
                      description="Ajusta el filtro para ver el comparativo de líneas."
                    />
                  )
                ) : viewMode === "chart" ? (
                  <div data-animate="chart-card">
                    <ChartVisualization lines={filteredLines} />
                  </div>
                ) : viewMode === "trends" ? (
                  <LineTrends
                    dailyDataSet={dailyDataSet}
                    selectedSede={selectedSede}
                    availableDates={availableDates}
                    lines={lines}
                  />
                ) : (
                  <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {filteredLines.map((line) => (
                      <LineCard
                        key={line.id}
                        line={line}
                        hasData={hasRangeData}
                      />
                    ))}
                  </section>
                )}

                {viewMode === "cards" && filteredLines.length === 0 && (
                  <EmptyState
                    title="No hay líneas para este segmento."
                    description="Prueba otro filtro o revisa un rango distinto."
                    actionLabel="Ver todas las líneas"
                    onAction={() => setLineFilter("all")}
                  />
                )}
              </div>
            )}

            {/* Tab: Summaries */}
            {activeTab === "summaries" && (
              <div className="space-y-6">
                <SummaryCard
                  summary={summary}
                  title="Resumen del día"
                  salesLabel="Venta total"
                  comparisons={dailyComparisons}
                  hasData={hasRangeData}
                />
                <SummaryCard
                  summary={monthlySummary}
                  title={`Resumen del mes · ${formatMonthLabel(selectedMonth)}`}
                  salesLabel="Ventas del mes"
                  hasData={hasMonthlyData}
                />
                <PeriodComparison
                  dailyDataSet={dailyDataSet}
                  selectedSede={selectedSede}
                  availableDates={availableDates}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

