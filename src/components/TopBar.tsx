import type { ReactNode } from "react";
import { CalendarDays, MapPin, SlidersHorizontal } from "lucide-react";

interface TopBarProps {
  title: ReactNode;
  selectedSede: string;
  sedes: { id: string; name: string }[];
  startDate: string;
  endDate: string;
  dates: string[];
  lineFilter: string;
  onSedeChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onLineFilterChange: (value: string) => void;
}

export const TopBar = ({
  title,
  selectedSede,
  sedes,
  startDate,
  endDate,
  dates,
  lineFilter,
  onSedeChange,
  onStartDateChange,
  onEndDateChange,
  onLineFilterChange,
}: TopBarProps) => {
  return (
    <header className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.9)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-4">
        <div className="h-12 w-1.5 rounded-full bg-mercamio-400/70 shadow-[0_0_18px_rgba(60,173,152,0.35)]" />
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-mercamio-200/80">
            Mercamio
          </p>
          <h1 className="text-2xl font-semibold text-white sm:text-3xl">
            {title}
          </h1>
          <p className="text-sm text-white/60">
            Monitorea ventas, horas y margen en tiempo real por línea.
          </p>
        </div>
      </div>
      <div className="grid w-full gap-4 sm:w-auto sm:min-w-[320px]">
        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white/70 transition focus-within:border-mercamio-300/70 focus-within:ring-1 focus-within:ring-mercamio-300/40">
          <MapPin className="h-4 w-4 text-white/60" />
          <span className="text-xs uppercase tracking-[0.2em]">Sede</span>
          <select
            value={selectedSede}
            onChange={(event) => onSedeChange(event.target.value)}
            className="ml-auto w-full bg-transparent text-sm font-medium text-white outline-none"
          >
            {sedes.map((sede) => (
              <option key={sede.id} value={sede.id} className="bg-slate-950">
                {sede.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white/70 transition focus-within:border-mercamio-300/70 focus-within:ring-1 focus-within:ring-mercamio-300/40">
            <CalendarDays className="h-4 w-4 text-white/60" />
            <span className="text-xs uppercase tracking-[0.2em]">Desde</span>
            <select
              value={startDate}
              onChange={(event) => onStartDateChange(event.target.value)}
              className="ml-auto w-full bg-transparent text-sm font-medium text-white outline-none"
            >
              {dates.map((date) => (
                <option key={date} value={date} className="bg-slate-950">
                  {date}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white/70 transition focus-within:border-mercamio-300/70 focus-within:ring-1 focus-within:ring-mercamio-300/40">
            <CalendarDays className="h-4 w-4 text-white/60" />
            <span className="text-xs uppercase tracking-[0.2em]">Hasta</span>
            <select
              value={endDate}
              onChange={(event) => onEndDateChange(event.target.value)}
              className="ml-auto w-full bg-transparent text-sm font-medium text-white outline-none"
            >
              {dates.map((date) => (
                <option key={date} value={date} className="bg-slate-950">
                  {date}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white/70 transition focus-within:border-mercamio-300/70 focus-within:ring-1 focus-within:ring-mercamio-300/40">
          <SlidersHorizontal className="h-4 w-4 text-white/60" />
          <span className="text-xs uppercase tracking-[0.2em]">Segmento</span>
          <select
            value={lineFilter}
            onChange={(event) => onLineFilterChange(event.target.value)}
            className="ml-auto w-full bg-transparent text-sm font-medium text-white outline-none"
          >
            <option value="all" className="bg-slate-950">
              Todas las líneas
            </option>
            <option value="critical" className="bg-slate-950">
              Línea crítica
            </option>
            <option value="improving" className="bg-slate-950">
              Líneas en mejora
            </option>
          </select>
        </label>
      </div>
    </header>
  );
};
