"use client";

import { useEffect, useMemo, useState } from "react";
import Script from "next/script";
import { LineCard } from "@/components/LineCard";
import { LineComparisonTable } from "@/components/LineComparisonTable";
import { SummaryCard } from "@/components/SummaryCard";
import { TopBar } from "@/components/TopBar";
import { calcDailySummary, calcLineMargin } from "@/lib/calc";
import { DailyProductivity } from "@/types";
import { getLineStatus } from "@/lib/status";

const parseDateKey = (dateKey: string) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};
const toDateKey = (date: Date) => date.toISOString().slice(0, 10);
const formatDateLabel = (dateKey: string) =>
  new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parseDateKey(dateKey));

type ApiResponse = {
  dailyData: DailyProductivity[];
  sedes: Array<{ id: string; name: string }>;
};

export default function Home() {
  const [dailyDataSet, setDailyDataSet] = useState<DailyProductivity[]>([]);
  const [availableSedes, setAvailableSedes] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [selectedSede, setSelectedSede] = useState("floresta");
  const [startDate, setStartDate] = useState("2024-06-18");
  const [endDate, setEndDate] = useState("2024-06-20");
  const [lineFilter, setLineFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [animeReady, setAnimeReady] = useState(false);
  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/productivity");
        if (!response.ok) {
          throw new Error("No se pudo cargar la data.");
        }
        const payload = (await response.json()) as ApiResponse;
        if (isMounted) {
          const resolvedDailyData = payload.dailyData ?? [];
          const resolvedSedes =
            payload.sedes?.length > 0
              ? payload.sedes
              : Array.from(
                  new Map(
                    resolvedDailyData.map((item) => [item.sede, item.sede]),
                  ).entries(),
                ).map(([id, name]) => ({ id, name }));
          setDailyDataSet(resolvedDailyData);
          setAvailableSedes(resolvedSedes);
        }
      } catch {
        if (isMounted) {
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

  const availableDates = useMemo(() => {
    return Array.from(
      new Set(
        dailyDataSet
          .filter((item) => item.sede === selectedSede)
          .map((item) => item.date),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [dailyDataSet, selectedSede]);

  useEffect(() => {
    if (availableSedes.length === 0) {
      return;
    }
    if (!availableSedes.some((sede) => sede.id === selectedSede)) {
      setSelectedSede(availableSedes[0].id);
    }
  }, [availableSedes, selectedSede]);

  useEffect(() => {
    if (availableDates.length === 0) {
      return;
    }
    if (!availableDates.includes(startDate)) {
      setStartDate(availableDates[0]);
    }
    if (!availableDates.includes(endDate)) {
      setEndDate(availableDates[availableDates.length - 1]);
    }
  }, [availableDates, endDate, startDate]);

  const selectedDate = endDate;
  const selectedSedeName =
    availableSedes.find((sede) => sede.id === selectedSede)?.name ??
    selectedSede;
  const dateRangeLabel = useMemo(() => {
    if (!startDate || !endDate) {
      return "";
    }
    if (startDate === endDate) {
      return `el ${formatDateLabel(startDate)}`;
    }
    return `del ${formatDateLabel(startDate)} al ${formatDateLabel(endDate)}`;
  }, [endDate, startDate]);

  const rangeDailyData = useMemo(() => {
    if (!startDate || !endDate) {
      return [];
    }
    return dailyDataSet.filter(
      (item) =>
        item.sede === selectedSede &&
        item.date >= startDate &&
        item.date <= endDate,
    );
  }, [dailyDataSet, endDate, selectedSede, startDate]);

  const lines = useMemo(() => {
    if (rangeDailyData.length === 0) {
      return [];
    }
    const lineMap = new Map<
      string,
      { id: string; name: string; sales: number; hours: number; cost: number }
    >();
    rangeDailyData.forEach((day) => {
      day.lines.forEach((line) => {
        const cost = line.hours * line.hourlyRate;
        const existing = lineMap.get(line.id);
        if (existing) {
          existing.sales += line.sales;
          existing.hours += line.hours;
          existing.cost += cost;
        } else {
          lineMap.set(line.id, {
            id: line.id,
            name: line.name,
            sales: line.sales,
            hours: line.hours,
            cost,
          });
        }
      });
    });
    return Array.from(lineMap.values()).map((line) => ({
      id: line.id,
      name: line.name,
      sales: line.sales,
      hours: line.hours,
      hourlyRate: line.hours ? line.cost / line.hours : 0,
    }));
  }, [rangeDailyData]);
  const filteredLines = useMemo(() => {
    if (lineFilter === "all") {
      return lines;
    }
    return lines.filter((line) => {
      const status = getLineStatus(selectedSede, line.id, calcLineMargin(line));
      if (lineFilter === "critical") {
        return status.label === "Problema";
      }
      if (lineFilter === "improving") {
        return status.label === "Atención";
      }
      return true;
    });
  }, [lineFilter, lines, selectedSede]);
  const summary = calcDailySummary(lines);
  const selectedMonth = selectedDate.slice(0, 7);
  const monthlySummary = useMemo(() => {
    const monthLines = dailyDataSet
      .filter(
        (item) =>
          item.sede === selectedSede && item.date.startsWith(selectedMonth),
      )
      .flatMap((item) => item.lines);
    return calcDailySummary(monthLines);
  }, [selectedMonth, selectedSede]);

  const summariesByDate = useMemo(() => {
    const map = new Map<string, ReturnType<typeof calcDailySummary>>();
    dailyDataSet
      .filter((item) => item.sede === selectedSede)
      .forEach((item) => {
        map.set(item.date, calcDailySummary(item.lines));
      });
    return map;
  }, [selectedSede]);
  const selectedDateValue = parseDateKey(selectedDate);
  const previousDay = new Date(selectedDateValue);
  previousDay.setUTCDate(previousDay.getUTCDate() - 1);
  const previousWeek = new Date(selectedDateValue);
  previousWeek.setUTCDate(previousWeek.getUTCDate() - 7);
  const previousDaySummary = summariesByDate.get(toDateKey(previousDay));
  const previousWeekSummary = summariesByDate.get(toDateKey(previousWeek));
  const monthlyDailySummaries = dailyDataSet
    .filter(
      (item) =>
        item.sede === selectedSede && item.date.startsWith(selectedMonth),
    )
    .map((item) => calcDailySummary(item.lines));
  const monthlyAverage = monthlyDailySummaries.length
    ? monthlyDailySummaries.reduce(
        (acc, item) => ({
          sales: acc.sales + item.sales,
          hours: acc.hours + item.hours,
          cost: acc.cost + item.cost,
          margin: acc.margin + item.margin,
        }),
        { sales: 0, hours: 0, cost: 0, margin: 0 },
      )
    : null;
  const monthlyAverageSummary =
    monthlyAverage && monthlyDailySummaries.length
      ? {
          sales: monthlyAverage.sales / monthlyDailySummaries.length,
          hours: monthlyAverage.hours / monthlyDailySummaries.length,
          cost: monthlyAverage.cost / monthlyDailySummaries.length,
          margin: monthlyAverage.margin / monthlyDailySummaries.length,
        }
      : null;
  const dailyComparisons = [
    { label: "Vs. día anterior", baseline: previousDaySummary ?? null },
    { label: "Vs. semana anterior", baseline: previousWeekSummary ?? null },
    { label: "Vs. promedio mensual", baseline: monthlyAverageSummary },
  ];

  const monthLabel = new Intl.DateTimeFormat("es-CO", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${selectedMonth}-01T00:00:00`));

  useEffect(() => {
    if (!animeReady || isLoading) {
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    type AnimeInstance = ((params: Record<string, unknown>) => void) & {
      pause?: () => void;
      remove?: (targets: unknown) => void;
    };
    const animeInstance = (window as Window & { anime?: AnimeInstance }).anime;
    if (!animeInstance) {
      return;
    }

    animeInstance.remove?.("[data-animate]");

    const runAnimations = () => {
      animeInstance({
        targets: "[data-animate='top-bar']",
        translateY: [-16, 0],
        opacity: [0, 1],
        duration: 650,
        easing: "easeOutCubic",
      });
      animeInstance({
        targets: "[data-animate='line-card']",
        translateY: [18, 0],
        opacity: [0, 1],
        delay: (el: Element, index: number) => index * 90,
        duration: 650,
        easing: "easeOutCubic",
      });
      animeInstance({
        targets: "[data-animate='summary-card']",
        scale: [0.97, 1],
        opacity: [0, 1],
        delay: (el: Element, index: number) => index * 120,
        duration: 600,
        easing: "easeOutCubic",
      });
      if (showComparison) {
        animeInstance({
          targets: "[data-animate='comparison-card']",
          translateY: [-8, 0],
          opacity: [0, 1],
          duration: 550,
          easing: "easeOutCubic",
        });
        animeInstance({
          targets: "[data-animate='comparison-row']",
          translateX: [-12, 0],
          opacity: [0, 1],
          delay: (el: Element, index: number) => index * 40,
          duration: 450,
          easing: "easeOutCubic",
        });
      }
    };

    const animationFrame = window.requestAnimationFrame(runAnimations);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [
    animeReady,
    filteredLines.length,
    isLoading,
    lines.length,
    showComparison,
  ]);

  return (
    <div className="min-h-screen bg-background px-4 pb-16 pt-10 text-foreground sm:px-8">
      <Script
        src="https://cdn.jsdelivr.net/npm/animejs@3.2.2/lib/anime.min.js"
        strategy="afterInteractive"
        onLoad={() => setAnimeReady(true)}
      />
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
          startDate={startDate}
          endDate={endDate}
          dates={availableDates}
          lineFilter={lineFilter}
          onSedeChange={setSelectedSede}
          onStartDateChange={(value) => {
            setStartDate(value);
            if (value > endDate) {
              setEndDate(value);
            }
          }}
          onEndDateChange={(value) => {
            setEndDate(value);
            if (value < startDate) {
              setStartDate(value);
            }
          }}
          onLineFilterChange={setLineFilter}
        />
        {isLoading ? (
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
        ) : lines.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-slate-200/70 bg-slate-50 p-10 text-center">
            <p className="text-sm uppercase tracking-[0.3em] text-slate-700">
              {" "}
              Sin datos
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-900">
              No hay datos para {selectedSedeName} {dateRangeLabel}.
            </h2>
            <p className="mt-2 text-sm text-slate-700">
              Prueba otra fecha o sede para ver actividad.
            </p>
          </section>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200/70 bg-white p-4 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.15)]">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-600">
                  Vista de líneas
                </p>
                <p className="text-sm font-semibold text-slate-900">
                  {showComparison
                    ? "Comparativo de rentabilidad"
                    : "Tarjetas detalladas"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowComparison((prev) => !prev)}
                className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700 transition hover:border-mercamio-300/40 hover:bg-white"
              >
                {showComparison ? "Volver a tarjetas" : "Ver comparativo"}
              </button>
            </div>
            {showComparison ? (
              filteredLines.length > 0 ? (
                <LineComparisonTable
                  lines={filteredLines}
                  sede={selectedSede}
                />
              ) : (
                <section className="rounded-3xl border border-dashed border-slate-200/70 bg-slate-50 p-8 text-center">
                  <p className="text-sm uppercase tracking-[0.3em] text-slate-700">
                    {" "}
                    Sin coincidencias
                  </p>
                  <h3 className="mt-3 text-xl font-semibold text-slate-900">
                    No hay líneas para comparar con este filtro.
                  </h3>
                  <p className="mt-2 text-sm text-slate-700">
                    Ajusta el filtro para ver el comparativo de líneas.
                  </p>
                </section>
              )
            ) : (
              <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {filteredLines.map((line) => (
                  <LineCard key={line.id} line={line} sede={selectedSede} />
                ))}
              </section>
            )}
          </div>
        )}
        {!showComparison &&
        !isLoading &&
        lines.length > 0 &&
        filteredLines.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-slate-200/70 bg-slate-50 p-8 text-center">
            <p className="text-sm uppercase tracking-[0.3em] text-slate-700">
              {" "}
              Sin coincidencias
            </p>
            <h3 className="mt-3 text-xl font-semibold text-slate-900">
              No hay líneas para este segmento.
            </h3>
            <p className="mt-2 text-sm text-slate-700">
              Prueba otro filtro o revisa un rango distinto.
            </p>
          </section>
        ) : null}
        {isLoading ? (
          <div className="space-y-6">
            {Array.from({ length: 2 }).map((_, index) => (
              <div
                key={`summary-skeleton-${index}`}
                className="h-64 rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.15)]"
              >
                <div className="flex h-full flex-col gap-4 animate-pulse">
                  <div className="h-5 w-40 rounded-full bg-slate-200/70" />
                  <div className="h-8 w-32 rounded-full bg-slate-200/70" />
                  <div className="flex-1 rounded-2xl bg-slate-200/70" />
                </div>
              </div>
            ))}
          </div>
        ) : lines.length > 0 ? (
          <>
            <SummaryCard
              summary={summary}
              title="Resumen del día"
              salesLabel="Venta total"
              sede={selectedSede}
              comparisons={dailyComparisons}
            />
            <SummaryCard
              summary={monthlySummary}
              title={`Resumen del mes · ${monthLabel}`}
              salesLabel="Ventas del mes"
              sede={selectedSede}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
