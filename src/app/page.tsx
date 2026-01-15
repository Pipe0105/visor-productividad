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
        <SummaryCard summary={summary} />
      </div>
    </div>
  );
}
