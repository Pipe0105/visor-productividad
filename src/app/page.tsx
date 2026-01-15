"use client";

import { useMemo, useState } from "react";
import { LineCard } from "@/components/LineCard";
import { SummaryCard } from "@/components/SummaryCard";
import { TopBar } from "@/components/TopBar";
import { calcDailySummary } from "@/lib/calc";
import { mockDailyData, sedes } from "@/lib/mock-data";

export default function Home() {
  const availableDates = useMemo(
    () => Array.from(new Set(mockDailyData.map((item) => item.date))),
    []
  );
  const [selectedSede, setSelectedSede] = useState(sedes[0]?.id ?? "floresta");
  const [selectedDate, setSelectedDate] = useState(
    availableDates[0] ?? "2024-06-18"
  );

  const dailyData = useMemo(() => {
    return (
      mockDailyData.find(
        (item) => item.date === selectedDate && item.sede === selectedSede
      ) ?? null
    );
  }, [selectedDate, selectedSede]);

  const lines = dailyData?.lines ?? [];
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
  const parseDate = (dateKey: string) => {
    const [year, month, day] = dateKey.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  };
  const toDateKey = (date: Date) => date.toISOString().slice(0, 10);
  const selectedDateValue = parseDate(selectedDate);
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

  const monthLabel = new Intl.DateTimeFormat("es-CO", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${selectedMonth}-01T00:00:00`));
  return (
    <div className="min-h-screen bg-slate-950 px-4 pb-16 pt-10 text-white sm:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <TopBar
          title={
            <span>
              Visualizador de{" "}
              <span className="text-mercamio-200/90">Productividad</span> por
              Día
            </span>
          }
          selectedSede={selectedSede}
          sedes={sedes}
          selectedDate={selectedDate}
          dates={availableDates}
          onSedeChange={setSelectedSede}
          onDateChange={setSelectedDate}
        />
        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {lines.map((line) => (
            <LineCard key={line.id} line={line} sede={selectedSede} />
          ))}
        </section>
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
      </div>
    </div>
  );
}
