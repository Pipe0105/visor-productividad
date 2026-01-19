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
    <header
      data-animate="top-bar"
      className="flex flex-col gap-6 rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.15)] backdrop-blur sm:flex-row sm:items-center sm:justify-between"
    >
      {" "}
      <div className="flex items-start gap-4">
        |
        <div className="h-12 w-1.5 rounded-full bg-mercamio-400/70 shadow-[0_0_18px_rgba(60,173,152,0.35)]" />
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-mercamio-700">
            {" "}
            Mercamio
          </p>
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
            {title}
          </h1>
          <p className="text-sm text-slate-700">
            Elige sede y fechas para ver ventas, horas y margen por línea en un
            vistazo.
          </p>
        </div>
      </div>
      <div className="grid w-full gap-4 sm:w-auto sm:min-w-[320px]">
        <label className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white px-4 py-3 text-sm text-slate-800 transition focus-within:border-mercamio-300/70 focus-within:ring-1 focus-within:ring-mercamio-300/40">
          <MapPin className="h-4 w-4 text-slate-600" />
          <span className="text-xs uppercase tracking-[0.2em]">Sede</span>
          <select
            value={selectedSede}
            onChange={(event) => onSedeChange(event.target.value)}
            disabled={sedes.length === 0}
            className="ml-auto w-full bg-transparent text-sm font-medium text-slate-900 outline-none"
          >
            {sedes.length === 0 ? (
              <option value="" className="bg-white text-slate-500">
                Sin sedes disponibles
              </option>
            ) : null}
            {sedes.map((sede) => (
              <option
                key={sede.id}
                value={sede.id}
                className="bg-white text-slate-900"
              >
                {sede.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white px-4 py-3 text-sm text-slate-800 transition focus-within:border-mercamio-300/70 focus-within:ring-1 focus-within:ring-mercamio-300/40">
            <CalendarDays className="h-4 w-4 text-slate-600" />
            <span className="text-xs uppercase tracking-[0.2em]">Desde</span>
            <select
              value={startDate}
              onChange={(event) => onStartDateChange(event.target.value)}
              disabled={dates.length === 0}
              className="ml-auto w-full bg-transparent text-sm font-medium text-slate-900 outline-none"
            >
              {dates.length === 0 ? (
                <option value="" className="bg-white text-slate-500">
                  Sin fechas disponibles
                </option>
              ) : null}
              {dates.map((date) => (
                <option
                  key={date}
                  value={date}
                  className="bg-white text-slate-900"
                >
                  {date}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white px-4 py-3 text-sm text-slate-800 transition focus-within:border-mercamio-300/70 focus-within:ring-1 focus-within:ring-mercamio-300/40">
            <CalendarDays className="h-4 w-4 text-slate-600" />
            <span className="text-xs uppercase tracking-[0.2em]">Hasta</span>
            <select
              value={endDate}
              onChange={(event) => onEndDateChange(event.target.value)}
              disabled={dates.length === 0}
              className="ml-auto w-full bg-transparent text-sm font-medium text-slate-900 outline-none"
            >
              {dates.length === 0 ? (
                <option value="" className="bg-white text-slate-500">
                  Sin fechas disponibles
                </option>
              ) : null}
              {dates.map((date) => (
                <option
                  key={date}
                  value={date}
                  className="bg-white text-slate-900"
                >
                  {date}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white px-4 py-3 text-sm text-slate-800 transition focus-within:border-mercamio-300/70 focus-within:ring-1 focus-within:ring-mercamio-300/40">
          <SlidersHorizontal className="h-4 w-4 text-slate-600" />
          <span className="text-xs uppercase tracking-[0.2em]">
            Estado de línea
          </span>
          <select
            value={lineFilter}
            onChange={(event) => onLineFilterChange(event.target.value)}
            className="ml-auto w-full bg-transparent text-sm font-medium text-slate-900 outline-none"
          >
            <option value="all" className="bg-white text-slate-900">
              Todas las líneas
            </option>
            <option value="critical" className="bg-white text-slate-900">
              Líneas críticas (alerta)
            </option>
            <option value="improving" className="bg-white text-slate-900">
              Líneas en mejora (atención)
            </option>
          </select>
        </label>
      </div>
    </header>
  );
};
