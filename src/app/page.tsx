"use client";

import { useMemo, useState } from "react";
import { LineCard } from "@/components/LineCard";
import { SummaryCard } from "@/components/SummaryCard";
import { TopBar } from "@/components/TopBar";
import { calcDailySummary } from "@/lib/calc";
import { mockDailyData, sedes } from "@/lib/mock-data";
import { Item } from "@radix-ui/react-select";

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

  const monthLabel = new Intl.DateTimeFormat("es-CO", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${selectedMonth}-01T00:00:00`));
  const selectedMonth = selectedDate.slice(0, 7);
  const monthlySummary = useMemo(() => {
    const monthLines = mockDailyData.filter(
      (Item) => Item.sede === selectedSede && item.date.startsWith
    );
  });
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
            <LineCard key={line.id} line={line} />
          ))}
        </section>
        <SummaryCard
          summary={summary}
          title="Resumen del día"
          salesLabel="Venta total"
        />
        <SummaryCard
          summary={monthlySummary}
          title={`Resumen del mes · ${monthLabel}`}
          salesLabel="Ventas del mes"
        />
      </div>
    </div>
  );
}
