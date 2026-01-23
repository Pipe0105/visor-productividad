"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { animate, remove } from "animejs";
import { Download, LayoutGrid, Table2, Sparkles } from "lucide-react";
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
  showComparison: boolean,
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

      if (showComparison) {
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

const ViewToggle = ({
  showComparison,
  onChange,
}: {
  showComparison: boolean;
  onChange: (value: boolean) => void;
}) => (
  <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200/70 bg-white p-4 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.15)]">
    <div>
      <p className="text-xs uppercase tracking-[0.3em] text-slate-600">
        Vista de líneas
      </p>
      <p className="text-sm font-semibold text-slate-900">
        {showComparison ? "Comparativo de rentabilidad" : "Tarjetas detalladas"}
      </p>
      <p className="mt-1 text-xs text-slate-600">
        Alterna la visualización para detectar oportunidades rápidamente.
      </p>
    </div>
    <div className="flex items-center gap-2 rounded-full border border-slate-200/70 bg-slate-50 p-1">
      <button
        type="button"
        onClick={() => onChange(false)}
        aria-pressed={!showComparison}
        className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition-all ${
          !showComparison
            ? "bg-white text-mercamio-700 shadow-sm"
            : "text-slate-600 hover:text-slate-800"
        }`}
      >
        <LayoutGrid className="h-4 w-4" />
        Tarjetas
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        aria-pressed={showComparison}
        className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition-all ${
          showComparison
            ? "bg-white text-mercamio-700 shadow-sm"
            : "text-slate-600 hover:text-slate-800"
        }`}
      >
        <Table2 className="h-4 w-4" />
        Comparativo
      </button>
    </div>
  </div>
);

const SelectionSummary = ({
  selectedSedeName,
  dateRangeLabel,
  lineFilterLabel,
  filteredCount,
  totalCount,
  availableDatesCount,
  hasRangeData,
  onDownloadPdf,
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
  isDownloadDisabled: boolean;
}) => (
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
        <button
          type="button"
          onClick={onDownloadPdf}
          disabled={isDownloadDisabled}
          className="inline-flex items-center gap-2 rounded-full border border-mercamio-200/80 bg-mercamio-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-mercamio-700 transition-all hover:border-mercamio-300 hover:bg-mercamio-100 disabled:cursor-not-allowed disabled:border-slate-200/70 disabled:bg-slate-100 disabled:text-slate-400"
        >
          <Download className="h-4 w-4" />
          Descargar PDF
        </button>
      </div>
    </div>
  </section>
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

  const handleViewChange = useCallback((value: boolean) => {
    setShowComparison(value);
  }, []);

  const handleDownloadPdf = useCallback(() => {
    const columns = [
      { label: "#", width: 3 },
      { label: "Línea", width: 26 },
      { label: "Código", width: 14 },
      { label: "Ventas", width: 14 },
      { label: "Horas", width: 7 },
      { label: "Costo", width: 12 },
      { label: "Margen", width: 12 },
      { label: "Margen %", width: 9 },
    ];

    const formatRow = (cells: string[]) =>
      cells
        .map((cell, index) => {
          const width = columns[index].width;
          return cell.length >= width ? cell : cell.padEnd(width);
        })
        .join("  ");

    const headerRow = formatRow(columns.map((column) => column.label));
    const dividerRow = "-".repeat(headerRow.length);
    const rows = buildPdfRows(pdfLines).map((row) => formatRow(row));

    const contentLines = [
      { text: "Reporte de líneas", font: "F2", size: 16 },
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
    const pages: (typeof contentLines)[][] = [];

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

        <SelectionSummary
          selectedSedeName={selectedSedeName}
          dateRangeLabel={dateRangeLabel}
          lineFilterLabel={lineFilterLabel}
          filteredCount={filteredLines.length}
          totalCount={lines.length}
          availableDatesCount={availableDates.length}
          hasRangeData={hasRangeData}
          onDownloadPdf={handleDownloadPdf}
          isDownloadDisabled={filteredLines.length === 0}
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
              onChange={handleViewChange}
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
              actionLabel="Ver todas las líneas"
              onAction={() => setLineFilter("all")}
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
