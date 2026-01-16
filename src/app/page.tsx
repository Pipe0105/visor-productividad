"use client";

import { useMemo, useState } from "react";
import { LineCard } from "@/components/LineCard";
import { SummaryCard } from "@/components/SummaryCard";
import { TopBar } from "@/components/TopBar";
import { calcDailySummary, calcLineMargin } from "@/lib/calc";
import { mockDailyData, sedes } from "@/lib/mock-data";
import { getLineStatus } from "@/lib/status";

const parseDateKey = (dateKey: string) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};
const toDateKey = (date: Date) => date.toISOString().slice(0, 10);
const getWeekKey = (dateKey: string) => {
  const date = parseDateKey(dateKey);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - (day - 1));
  return toDateKey(date);
};

export default function Home() {
  const availableDates = useMemo(
    () =>
      Array.from(new Set(mockDailyData.map((item) => item.date))).sort((a, b) =>
        a.localeCompare(b)
      ),
    []
  );
  const [selectedSede, setSelectedSede] = useState(sedes[0]?.id ?? "floresta");
  const [startDate, setStartDate] = useState(availableDates[0] ?? "2024-06-18");
  const [endDate, setEndDate] = useState(
    availableDates[availableDates.length - 1] ?? "2024-06-20"
  );
  const [lineFilter, setLineFilter] = useState("all");
  const [isLoading] = useState(false);

  const selectedDate = endDate;
  const rangeDates = useMemo(
    () => availableDates.filter((date) => date >= startDate && date <= endDate),
    [availableDates, endDate, startDate]
  );
  const rangeLabel = rangeDates.length
    ? `Rango seleccionado: ${rangeDates.length} días`
    : "Rango sin datos";

  const dailyData = useMemo(() => {
    return (
      mockDailyData.find(
        (item) => item.date === selectedDate && item.sede === selectedSede
      ) ?? null
    );
  }, [selectedDate, selectedSede]);

  const lines = dailyData?.lines ?? [];
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
    const monthLines = mockDailyData
      .filter(
        (item) =>
          item.sede === selectedSede && item.date.startsWith(selectedMonth)
      )
      .flatMap((item) => item.lines);
    return calcDailySummary(monthLines);
  }, [selectedMonth, selectedSede]);

  const summariesByDate = useMemo(() => {
    const map = new Map<string, ReturnType<typeof calcDailySummary>>();
    mockDailyData
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
  const monthlyDailySummaries = mockDailyData
    .filter(
      (item) =>
        item.sede === selectedSede && item.date.startsWith(selectedMonth)
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
        { sales: 0, hours: 0, cost: 0, margin: 0 }
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
  const rangeData = useMemo(() => {
    return mockDailyData
      .filter(
        (item) =>
          item.sede === selectedSede &&
          item.date >= startDate &&
          item.date <= endDate
      )
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [endDate, selectedSede, startDate]);
  const rangeDataByDate = useMemo(() => {
    const map = new Map(rangeData.map((item) => [item.date, item]));
    return map;
  }, [rangeData]);
  const lineSeriesById = useMemo(() => {
    const dailySeries = new Map<string, number[]>();
    const weeklySeries = new Map<string, number[]>();
    const weekKeys = Array.from(
      new Set(rangeData.map((item) => getWeekKey(item.date)))
    ).sort((a, b) => a.localeCompare(b));
    lines.forEach((line) => {
      const dailyValues = rangeDates.map((date) => {
        const item = rangeDataByDate.get(date);
        const match = item?.lines.find((entry) => entry.id === line.id);
        return match?.sales ?? 0;
      });
      dailySeries.set(line.id, dailyValues);
      const weeklyValues = weekKeys.map((weekKey) => {
        return rangeData
          .filter((item) => getWeekKey(item.date) === weekKey)
          .reduce((acc, item) => {
            const match = item.lines.find((entry) => entry.id === line.id);
            return acc + (match?.sales ?? 0);
          }, 0);
      });
      weeklySeries.set(line.id, weeklyValues);
    });
    return { dailySeries, weeklySeries };
  }, [lines, rangeData, rangeDataByDate, rangeDates]);

  const monthLabel = new Intl.DateTimeFormat("es-CO", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${selectedMonth}-01T00:00:00`));
  return (
    <div className="min-h-screen bg-background px-4 pb-16 pt-10 text-foreground sm:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <TopBar
          title={
            <span>
              Tablero diario de{" "}
              <span className="text-mercamio-500 dark:text-mercamio-200/90">
                productividad
              </span>{" "}
              por línea
            </span>
          }
          selectedSede={selectedSede}
          sedes={sedes}
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
                className="h-80 rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.15)] dark:border-white/10 dark:bg-white/5 dark:shadow-[0_20px_60px_-40px_rgba(15,23,42,0.9)]"
              >
                <div className="flex h-full flex-col gap-4 animate-pulse">
                  <div className="h-6 w-32 rounded-full bg-slate-200/70 dark:bg-white/10" />
                  <div className="h-4 w-24 rounded-full bg-slate-200/70 dark:bg-white/10" />
                  <div className="h-12 rounded-2xl bg-slate-200/70 dark:bg-white/10" />
                  <div className="flex-1 rounded-2xl bg-slate-200/70 dark:bg-white/10" />
                </div>
              </div>
            ))}
          </section>
        ) : lines.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-slate-200/70 bg-slate-50 p-10 text-center dark:border-white/15 dark:bg-slate-950/40">
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400 dark:text-white/40">
              Sin datos
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-900 dark:text-white">
              No hay datos en este rango para la sede seleccionada.
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-white/60">
              Prueba otro rango o sede para ver actividad.
            </p>
          </section>
        ) : (
          <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredLines.map((line) => (
              <LineCard
                key={line.id}
                line={line}
                sede={selectedSede}
                dailySeries={lineSeriesById.dailySeries.get(line.id) ?? []}
                weeklySeries={lineSeriesById.weeklySeries.get(line.id) ?? []}
                rangeLabel={rangeLabel}
              />
            ))}
          </section>
        )}
        {!isLoading && lines.length > 0 && filteredLines.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-slate-200/70 bg-slate-50 p-8 text-center dark:border-white/15 dark:bg-slate-950/40">
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400 dark:text-white/40">
              Sin coincidencias
            </p>
            <h3 className="mt-3 text-xl font-semibold text-slate-900 dark:text-white">
              No hay líneas para este segmento.
            </h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-white/60">
              Prueba otro filtro o revisa un rango distinto.
            </p>
          </section>
        ) : null}
        {isLoading ? (
          <div className="space-y-6">
            {Array.from({ length: 2 }).map((_, index) => (
              <div
                key={`summary-skeleton-${index}`}
                className="h-64 rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.15)] dark:border-white/10 dark:bg-white/5 dark:shadow-[0_20px_60px_-40px_rgba(15,23,42,0.9)]"
              >
                <div className="flex h-full flex-col gap-4 animate-pulse">
                  <div className="h-5 w-40 rounded-full bg-slate-200/70 dark:bg-white/10" />
                  <div className="h-8 w-32 rounded-full bg-slate-200/70 dark:bg-white/10" />
                  <div className="flex-1 rounded-2xl bg-slate-200/70 dark:bg-white/10" />
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
