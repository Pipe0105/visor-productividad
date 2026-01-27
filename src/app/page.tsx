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
import * as XLSX from "xlsx";
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

const buildPdfRows = (lines: LineMetrics[]) => {
  return lines.map((line, index) => {
    const hasLaborData = hasLaborDataForLine(line.id);
    const hours = hasLaborData ? line.hours : 0;
    const cost = hasLaborData ? calcLineCost(line) : 0;
    const margin = hasLaborData ? calcLineMargin(line) : 0;
    const marginRatio = line.sales ? margin / line.sales : 0;

    return [
      `${index + 1}`,
      line.name,
      line.id,
      formatPdfNumber(line.sales),
      `${hours}h`,
      formatPdfNumber(cost),
      formatPdfNumber(margin),
      formatPercent(marginRatio),
    ];
  });
};

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
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por nombre o código..."
            className="w-full rounded-full border border-slate-200/70 bg-slate-50 py-2 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-500 transition-all focus:border-mercamio-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-mercamio-100"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
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
        <p className="text-xs uppercase tracking-[0.3em] text-slate-600">
          Vista de líneas
        </p>
        <p className="text-sm font-semibold text-slate-900">{getModeLabel()}</p>
        <p className="mt-1 text-xs text-slate-600">
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
              : "text-slate-600 hover:text-slate-800"
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
              : "text-slate-600 hover:text-slate-800"
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
              : "text-slate-600 hover:text-slate-800"
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
              : "text-slate-600 hover:text-slate-800"
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
          <p className="text-xs uppercase tracking-[0.3em] text-slate-600">
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
                : "text-slate-600 hover:text-slate-800"
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
                : "text-slate-600 hover:text-slate-800"
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
          const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;

          return (
            <div key={line.id} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-slate-500">#{index + 1}</span>
                  <span className="font-semibold text-slate-900">
                    {line.name}
                  </span>
                  <span className="font-mono text-slate-500">{line.id}</span>
                </div>
                <span className="font-semibold text-slate-900">
                  {formatCOP(value)}
                </span>
              </div>
              <div className="relative h-8 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-mercamio-500 transition-all duration-500"
                  style={{ width: `${percentage}%` }}
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
        <p className="text-center text-sm text-slate-500 py-8">
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
        <p className="text-xs uppercase tracking-[0.3em] text-slate-600">
          Análisis de tendencias
        </p>
        <h3 className="mt-1 text-lg font-semibold text-slate-900">
          Evolución temporal por línea
        </h3>
      </div>

      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <label className="block">
          <span className="text-xs font-semibold text-slate-600">Línea</span>
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
          <span className="text-xs font-semibold text-slate-600">Métrica</span>
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
              <p className="text-sm text-slate-600">Promedio del período</p>
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
                    <span className="font-mono text-slate-600">
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
        <p className="text-center text-sm text-slate-500 py-8">
          Selecciona una línea para ver su tendencia temporal
        </p>
      )}

      {selectedLine && trendData.length === 0 && (
        <p className="text-center text-sm text-slate-500 py-8">
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
        <p className="text-xs uppercase tracking-[0.2em] text-slate-600">
          {label}
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-slate-500">Período 1</p>
            <p className="text-lg font-semibold text-slate-900">
              {displayValue(value1)}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Período 2</p>
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
          <span className="text-xs text-slate-500">
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
        <p className="text-xs uppercase tracking-[0.3em] text-slate-600">
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
              <span className="text-xs text-slate-600">Desde</span>
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
              <span className="text-xs text-slate-600">Hasta</span>
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
              <span className="text-xs text-slate-600">Desde</span>
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
              <span className="text-xs text-slate-600">Hasta</span>
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
          <p className="text-xs uppercase tracking-[0.3em] text-slate-600">
            Resumen de filtros
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">
            {selectedSedeName} · {dateRangeLabel || "Sin rango definido"}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
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
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
            {availableDatesCount} fechas disponibles
          </span>
          <div className="relative" data-dropdown="export">
            <button
              type="button"
              onClick={() => setShowDownloadMenu(!showDownloadMenu)}
              disabled={isDownloadDisabled}
              className="inline-flex items-center gap-2 rounded-full border border-mercamio-200/80 bg-mercamio-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-mercamio-700 transition-all hover:border-mercamio-300 hover:bg-mercamio-100 disabled:cursor-not-allowed disabled:border-slate-200/70 disabled:bg-slate-100 disabled:text-slate-400"
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
                    <div className="text-xs text-slate-500">
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
                    <div className="text-xs text-slate-500">
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
                    <div className="text-xs text-slate-500">
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

    const headers = [
      "#",
      "Línea",
      "Código",
      "Ventas",
      "Horas",
      "Costo",
      "Margen",
      "Margen %",
    ];

    const rows = pdfLines.map((line, index) => {
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
        hours,
        formatNumber(Math.round(cost)),
        formatNumber(Math.round(margin)),
        `${(marginRatio * 100).toFixed(2)}%`,
      ];
    });

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

    const csvLines = [
      "REPORTE DE PRODUCTIVIDAD POR LÍNEA",
      "",
      "",
      "Información del Reporte",
      `Sede:,${escapeCsv(selectedSedeName)}`,
      `Rango:,${escapeCsv(dateRangeLabel || "Sin rango definido")}`,
      `Filtro:,${escapeCsv(lineFilterLabel)}`,
      `Generado:,${escapeCsv(formatPdfDate())}`,
      "",
      "",
      "",
      "DETALLE POR LÍNEA",
      "",
      headers.join(","),
      ...rows.map((row) => row.join(",")),
      "",
      "",
      "TOTALES",
      "",
      `Total,,,${formatNumber(Math.round(totalSales))},${totalHours},${formatNumber(Math.round(totalCost))},${formatNumber(Math.round(totalMargin))},${(totalMarginRatio * 100).toFixed(2)}%`,
    ];

    const csvContent = csvLines.join("\n");
    const blob = new Blob(["\ufeff" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeSede = selectedSede.replace(/\s+/g, "-");
    const fileName = `lineas-${safeSede}-${dateRange.start || "sin-fecha"}-${
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

  const handleDownloadXlsx = useCallback(() => {
    // Crear libro de trabajo
    const workbook = XLSX.utils.book_new();

    // Preparar datos
    const formatNumber = (value: number) => Math.round(value);

    // Fila de título y metadatos
    const metaData = [
      ["REPORTE DE PRODUCTIVIDAD POR LÍNEA"],
      [],
      ["Información del Reporte"],
      ["Sede:", selectedSedeName],
      ["Rango:", dateRangeLabel || "Sin rango definido"],
      ["Filtro:", lineFilterLabel],
      ["Generado:", formatPdfDate()],
      [],
      [],
    ];

    // Headers
    const headers = [
      "#",
      "Línea",
      "Código",
      "Ventas",
      "Horas",
      "Costo",
      "Margen",
      "Margen %",
    ];

    // Filas de datos
    const dataRows = pdfLines.map((line, index) => {
      const hasLaborData = hasLaborDataForLine(line.id);
      const hours = hasLaborData ? line.hours : 0;
      const cost = hasLaborData ? calcLineCost(line) : 0;
      const margin = hasLaborData ? calcLineMargin(line) : 0;
      const marginRatio = line.sales ? margin / line.sales : 0;

      return [
        index + 1,
        line.name,
        line.id,
        formatNumber(line.sales),
        hours,
        formatNumber(cost),
        formatNumber(margin),
        marginRatio, // Excel formateará como porcentaje
      ];
    });

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

    // Fila de totales
    const totalsRow = [
      "",
      "TOTAL",
      "",
      formatNumber(totalSales),
      totalHours,
      formatNumber(totalCost),
      formatNumber(totalMargin),
      totalMarginRatio,
    ];

    // Combinar todos los datos
    const sheetData = [...metaData, [headers], ...dataRows, [], [totalsRow]];

    // Crear hoja
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

    // Configurar anchos de columna
    worksheet["!cols"] = [
      { wch: 5 }, // #
      { wch: 30 }, // Línea
      { wch: 15 }, // Código
      { wch: 15 }, // Ventas
      { wch: 10 }, // Horas
      { wch: 15 }, // Costo
      { wch: 15 }, // Margen
      { wch: 12 }, // Margen %
    ];

    // Aplicar formato de porcentaje a la columna de Margen %
    const headerRowIndex = metaData.length;
    dataRows.forEach((_, index) => {
      const rowIndex = headerRowIndex + index + 1;
      const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: 7 });
      if (worksheet[cellAddress]) {
        worksheet[cellAddress].z = "0.00%";
      }
    });

    // Formato para la fila de totales
    const totalRowIndex = headerRowIndex + dataRows.length + 2;
    const totalPercentCell = XLSX.utils.encode_cell({ r: totalRowIndex, c: 7 });
    if (worksheet[totalPercentCell]) {
      worksheet[totalPercentCell].z = "0.00%";
    }

    // Agregar hoja al libro
    XLSX.utils.book_append_sheet(workbook, worksheet, "Productividad");

    // Generar nombre de archivo
    const safeSede = selectedSede.replace(/\s+/g, "-");
    const fileName = `lineas-${safeSede}-${dateRange.start || "sin-fecha"}-${
      dateRange.end || "sin-fecha"
    }.xlsx`;

    // Descargar archivo
    XLSX.writeFile(workbook, fileName);
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
    type PdfLine = { text: string; font: string; size: number };
    const columns = [
      { label: "#", width: 3, align: "right" as const },
      { label: "Linea", width: 26, align: "left" as const },
      { label: "Codigo", width: 14, align: "left" as const },
      { label: "Ventas", width: 14, align: "right" as const },
      { label: "Horas", width: 7, align: "right" as const },
      { label: "Costo", width: 12, align: "right" as const },
      { label: "Margen", width: 12, align: "right" as const },
      { label: "Margen %", width: 9, align: "right" as const },
    ];
    const fitCell = (cell: string, width: number, align: "left" | "right") => {
      const safeCell = cell.length > width ? cell.slice(0, width) : cell;
      return align === "right"
        ? safeCell.padStart(width)
        : safeCell.padEnd(width);
    };

    const formatRow = (cells: string[]) =>
      cells
        .map((cell, index) => {
          const { width, align } = columns[index];
          return fitCell(cell, width, align);
        })
        .join("  ");

    const headerRow = formatRow(columns.map((column) => column.label));
    const dividerRow = "-".repeat(headerRow.length);
    const rows = buildPdfRows(pdfLines).map((row) => formatRow(row));

    const contentLines: PdfLine[] = [
      { text: "Reporte de lineas", font: "F2", size: 16 },
      { text: selectedSedeName, font: "F1", size: 12 },
      { text: "", font: "F1", size: 11 },
      {
        text: `Rango: ${dateRangeLabel || "Sin rango definido"}`,
        font: "F1",
        size: 11,
      },
      { text: `Filtro: ${lineFilterLabel}`, font: "F1", size: 11 },
      { text: `Generado: ${formatPdfDate()}`, font: "F1", size: 11 },
      { text: "", font: "F1", size: 11 },
      { text: headerRow, font: "F3", size: 11 },
      { text: dividerRow, font: "F3", size: 11 },
      ...rows.map((row) => ({ text: row, font: "F3", size: 11 })),
    ];

    const pageWidth = 842;
    const pageHeight = 595;
    const marginLeft = 50;
    const marginTop = 50;
    const marginBottom = 50;
    const lineHeight = 16;
    const linesPerPage = Math.floor(
      (pageHeight - marginTop - marginBottom) / lineHeight,
    );
    const pages: PdfLine[][] = [];

    for (let i = 0; i < contentLines.length; i += linesPerPage) {
      pages.push(contentLines.slice(i, i + linesPerPage));
    }

    const escapePdfText = (text: string) =>
      text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

    const encoder = new TextEncoder();
    const objectOffsets: number[] = [];
    const parts: string[] = [];
    const header = "%PDF-1.4\n";
    let currentOffset = encoder.encode(header).length;

    const addObject = (id: number, body: string) => {
      const objectBody = `${id} 0 obj\n${body}\nendobj\n`;
      objectOffsets[id] = currentOffset;
      parts.push(objectBody);
      currentOffset += encoder.encode(objectBody).length;
    };

    const catalogId = 1;
    const pagesId = 2;
    let nextId = 3;
    const pageIds: number[] = [];
    const contentIds: number[] = [];

    pages.forEach(() => {
      pageIds.push(nextId++);
      contentIds.push(nextId++);
    });

    const fontRegularId = nextId++;
    const fontBoldId = nextId++;
    const fontMonoId = nextId++;

    const kids = pageIds.map((id) => `${id} 0 R`).join(" ");
    addObject(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
    addObject(
      pagesId,
      `<< /Type /Pages /Kids [${kids}] /Count ${pageIds.length} >>`,
    );

    pageIds.forEach((pageId, index) => {
      const contentId = contentIds[index];
      addObject(
        pageId,
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R /F3 ${fontMonoId} 0 R >> >> >>`,
      );
    });

    contentIds.forEach((contentId, index) => {
      const lines = pages[index];
      const startY = pageHeight - marginTop;
      let stream = `BT\n${marginLeft} ${startY} Td\n${lineHeight} TL\n`;
      lines.forEach((line) => {
        stream += `/${line.font} ${line.size} Tf\n(${escapePdfText(
          line.text,
        )}) Tj\nT*\n`;
      });
      stream += "ET";
      addObject(
        contentId,
        `<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}\nendstream`,
      );
    });

    addObject(
      fontRegularId,
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    );
    addObject(
      fontBoldId,
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    );
    addObject(
      fontMonoId,
      "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>",
    );

    const maxId = fontMonoId;
    const xrefOffset = currentOffset;
    const xrefLines = [`xref`, `0 ${maxId + 1}`, "0000000000 65535 f "];

    for (let id = 1; id <= maxId; id += 1) {
      const offset = objectOffsets[id] ?? 0;
      xrefLines.push(`${String(offset).padStart(10, "0")} 00000 n `);
    }

    const xref = `${xrefLines.join("\n")}\n`;
    const trailer = `trailer\n<< /Size ${maxId + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    const pdfContent = `${header}${parts.join("")}${xref}${trailer}`;

    const blob = new Blob([pdfContent], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeSede = selectedSede.replace(/\s+/g, "-");
    const fileName = `lineas-${safeSede}-${dateRange.start || "sin-fecha"}-${
      dateRange.end || "sin-fecha"
    }.pdf`;
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
    <div className="min-h-screen bg-background px-4 pb-16 pt-10 text-foreground sm:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <TopBar
          title="Tablero de Productividad por Línea"
          selectedSede={selectedSede}
          sedes={availableSedes}
          startDate={dateRange.start}
          endDate={dateRange.end}
          dates={availableDates}
          onSedeChange={setSelectedSede}
          onStartDateChange={handleStartDateChange}
          onEndDateChange={handleEndDateChange}
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
          <div className="flex items-center gap-2 rounded-3xl border border-slate-200/70 bg-white p-2 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.15)]">
            <button
              type="button"
              onClick={() => setActiveTab("lines")}
              className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] transition-all ${
                activeTab === "lines"
                  ? "bg-mercamio-50 text-mercamio-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-800"
              }`}
            >
              Líneas de producción
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("summaries")}
              className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] transition-all ${
                activeTab === "summaries"
                  ? "bg-mercamio-50 text-mercamio-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-800"
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
