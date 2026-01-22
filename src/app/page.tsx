"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { animate, remove } from "animejs";
import { LineCard } from "@/components/LineCard";
import { LineComparisonTable } from "@/components/LineComparisonTable";
import { SummaryCard } from "@/components/SummaryCard";
import { TopBar } from "@/components/TopBar";
import {
  calcDailySummary,
  calcLineMargin,
  hasLaborDataForLine,
} from "@/lib/calc";
import { DailyProductivity, LineMetrics } from "@/types";
import { getLineStatus } from "@/lib/status";

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

// ============================================================================
// TIPOS
// ============================================================================

type ApiResponse = {
  dailyData: DailyProductivity[];
  sedes: Array<{ id: string; name: string }>;
};

type Sede = { id: string; name: string };

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

    const loadData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/productivity");

        if (!response.ok) {
          throw new Error("No se pudo cargar la información");
        }

        const payload = (await response.json()) as ApiResponse;

        if (!isMounted) return;

        const resolvedDailyData = payload.dailyData ?? [];
        const resolvedSedes =
          payload.sedes?.length > 0
            ? payload.sedes
            : extractSedesFromData(resolvedDailyData);

        setDailyDataSet(resolvedDailyData);
        setAvailableSedes(resolvedSedes);
      } catch (err) {
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
    };
  }, []);

  return { dailyDataSet, availableSedes, isLoading, error };
};

const useAnimations = (
  isLoading: boolean,
  filteredLinesCount: number,
  showComparison: boolean,
) => {
  useEffect(() => {
    if (
      isLoading ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    remove?.("[data-animate]");

    const runAnimations = () => {
      animate("[data-animate='top-bar']", {
        translateY: [-16, 0],
        opacity: [0, 1],
        duration: 650,
        easing: "easeOutCubic",
      });

      animate("[data-animate='line-card']", {
        translateY: [18, 0],
        opacity: [0, 1],
        delay: (_el: unknown, index: number) => index * 90,
        duration: 650,
        easing: "easeOutCubic",
      });

      animate("[data-animate='summary-card']", {
        scale: [0.97, 1],
        opacity: [0, 1],
        delay: (_el: unknown, index: number) => index * 120,
        duration: 600,
        easing: "easeOutCubic",
      });

      if (showComparison) {
        animate("[data-animate='comparison-card']", {
          translateY: [-8, 0],
          opacity: [0, 1],
          duration: 550,
          easing: "easeOutCubic",
        });

        animate("[data-animate='comparison-row']", {
          translateX: [-12, 0],
          opacity: [0, 1],
          delay: (_el: unknown, index: number) => index * 40,
          duration: 450,
          easing: "easeOutCubic",
        });
      }
    };

    const animationFrame = window.requestAnimationFrame(runAnimations);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [isLoading, filteredLinesCount, showComparison]);
};

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

const extractSedesFromData = (data: DailyProductivity[]): Sede[] => {
  return Array.from(
    new Map(data.map((item) => [item.sede, item.sede])).entries(),
  ).map(([id, name]) => ({ id, name }));
};
const DEFAULT_LINES: Array<Pick<LineMetrics, "id" | "name">> = [
  { id: "cajas", name: "Cajas" },
  { id: "fruver", name: "Fruver" },
  { id: "industria", name: "Industria" },
  { id: "carnes", name: "Carnes" },
  { id: "pollo y pescado", name: "Pollo y pescado" },
  { id: "asadero", name: "Asadero" },
];

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
  sede: string,
): LineMetrics[] => {
  if (filterType === "all") return lines;

  return lines.filter((line) => {
    const status = getLineStatus(sede, line.id, calcLineMargin(line));

    if (filterType === "critical") return status.label === "Problema";
    if (filterType === "improving") return status.label === "Atención";

    return true;
  });
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
}: {
  title: string;
  description: string;
}) => (
  <section className="rounded-3xl border border-dashed border-slate-200/70 bg-slate-50 p-10 text-center">
    <p className="text-sm uppercase tracking-[0.3em] text-slate-700">
      Sin datos
    </p>
    <h2 className="mt-3 text-2xl font-semibold text-slate-900">{title}</h2>
    <p className="mt-2 text-sm text-slate-700">{description}</p>
  </section>
);

const ViewToggle = ({
  showComparison,
  onToggle,
}: {
  showComparison: boolean;
  onToggle: () => void;
}) => (
  <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200/70 bg-white p-4 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.15)]">
    <div>
      <p className="text-xs uppercase tracking-[0.3em] text-slate-600">
        Vista de líneas
      </p>
      <p className="text-sm font-semibold text-slate-900">
        {showComparison ? "Comparativo de rentabilidad" : "Tarjetas detalladas"}
      </p>
    </div>
    <button
      type="button"
      onClick={onToggle}
      className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700 transition-all hover:border-mercamio-300/40 hover:bg-white"
    >
      {showComparison ? "Volver a tarjetas" : "Ver comparativo"}
    </button>
  </div>
);

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function Home() {
  // Estado
  const [selectedSede, setSelectedSede] = useState("floresta");
  const [dateRange, setDateRange] = useState<DateRange>({
    start: "2024-06-18",
    end: "2024-06-20",
  });
  const [lineFilter, setLineFilter] = useState("all");
  const [showComparison, setShowComparison] = useState(false);

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

  const filteredLines = useMemo(
    () => filterLinesByStatus(lines, lineFilter, selectedSede),
    [lineFilter, lines, selectedSede],
  );

  const summary = useMemo(() => calcDailySummary(lines), [lines]);

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

  const toggleComparison = useCallback(() => {
    setShowComparison((prev) => !prev);
  }, []);

  // Animaciones
  useAnimations(isLoading, filteredLines.length, showComparison);

  // Render
  return (
    <div className="min-h-screen bg-background px-4 pb-16 pt-10 text-foreground sm:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <TopBar
          title={
            <span>
              Tablero diario de{" "}
              <span className="text-mercamio-500">productividad</span> por línea
            </span>
          }
          selectedSede={selectedSede}
          sedes={availableSedes}
          startDate={dateRange.start}
          endDate={dateRange.end}
          dates={availableDates}
          lineFilter={lineFilter}
          onSedeChange={setSelectedSede}
          onStartDateChange={handleStartDateChange}
          onEndDateChange={handleEndDateChange}
          onLineFilterChange={setLineFilter}
        />

        {error && (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-sm font-semibold text-red-900">{error}</p>
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
          <div className="space-y-6">
            <ViewToggle
              showComparison={showComparison}
              onToggle={toggleComparison}
            />

            {showComparison ? (
              filteredLines.length > 0 ? (
                <LineComparisonTable
                  lines={filteredLines}
                  sede={selectedSede}
                  hasData={hasRangeData}
                />
              ) : (
                <EmptyState
                  title="No hay líneas para comparar con este filtro."
                  description="Ajusta el filtro para ver el comparativo de líneas."
                />
              )
            ) : (
              <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {filteredLines.map((line) => (
                  <LineCard
                    key={line.id}
                    line={line}
                    sede={selectedSede}
                    hasData={hasRangeData}
                  />
                ))}
              </section>
            )}
          </div>
        )}

        {!showComparison &&
          !isLoading &&
          lines.length > 0 &&
          filteredLines.length === 0 && (
            <EmptyState
              title="No hay líneas para este segmento."
              description="Prueba otro filtro o revisa un rango distinto."
            />
          )}

        {!isLoading && lines.length > 0 && (
          <>
            <SummaryCard
              summary={summary}
              title="Resumen del día"
              salesLabel="Venta total"
              sede={selectedSede}
              comparisons={dailyComparisons}
              hasData={hasRangeData}
            />
            <SummaryCard
              summary={monthlySummary}
              title={`Resumen del mes · ${formatMonthLabel(selectedMonth)}`}
              salesLabel="Ventas del mes"
              sede={selectedSede}
              hasData={hasMonthlyData}
            />
          </>
        )}
      </div>
    </div>
  );
}
