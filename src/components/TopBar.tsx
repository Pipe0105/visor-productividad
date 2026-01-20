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

// ============================================================================
// COMPONENTES AUXILIARES
// ============================================================================

const SelectField = ({
  icon: Icon,
  label,
  value,
  options,
  onChange,
  disabled = false,
  emptyMessage = "Sin opciones disponibles",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
  emptyMessage?: string;
}) => (
  <label className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white px-4 py-3 text-sm text-slate-800 transition-all focus-within:border-mercamio-300/70 focus-within:ring-1 focus-within:ring-mercamio-300/40 hover:border-slate-300/70">
    <Icon className="h-4 w-4 shrink-0 text-slate-600" />
    <span className="text-xs uppercase tracking-[0.2em] whitespace-nowrap">
      {label}
    </span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="ml-auto w-full bg-transparent text-sm font-medium text-slate-900 outline-none disabled:cursor-not-allowed disabled:opacity-60"
    >
      {options.length === 0 ? (
        <option value="" className="bg-white text-slate-500">
          {emptyMessage}
        </option>
      ) : (
        options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            className="bg-white text-slate-900"
          >
            {option.label}
          </option>
        ))
      )}
    </select>
  </label>
);

const BrandHeader = ({ title }: { title: ReactNode }) => (
  <div className="flex items-start gap-4">
    <div className="h-12 w-1.5 shrink-0 rounded-full bg-mercamio-400/70 shadow-[0_0_18px_rgba(60,173,152,0.35)]" />
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-mercamio-700">
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
);

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

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
  // Transformar datos para el componente SelectField
  const sedeOptions = sedes.map((sede) => ({
    value: sede.id,
    label: sede.name,
  }));

  const dateOptions = dates.map((date) => ({
    value: date,
    label: date,
  }));

  const filterOptions = [
    { value: "all", label: "Todas las líneas" },
    { value: "critical", label: "Líneas críticas (alerta)" },
    { value: "improving", label: "Líneas en mejora (atención)" },
  ];

  return (
    <header
      data-animate="top-bar"
      className="flex flex-col gap-6 rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.15)] backdrop-blur sm:flex-row sm:items-center sm:justify-between"
    >
      <BrandHeader title={title} />

      <div className="grid w-full gap-4 sm:w-auto sm:min-w-[320px]">
        {/* Selector de Sede */}
        <SelectField
          icon={MapPin}
          label="Sede"
          value={selectedSede}
          options={sedeOptions}
          onChange={onSedeChange}
          disabled={sedes.length === 0}
          emptyMessage="Sin sedes disponibles"
        />

        {/* Selectores de Fecha */}
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField
            icon={CalendarDays}
            label="Desde"
            value={startDate}
            options={dateOptions}
            onChange={onStartDateChange}
            disabled={dates.length === 0}
            emptyMessage="Sin fechas disponibles"
          />

          <SelectField
            icon={CalendarDays}
            label="Hasta"
            value={endDate}
            options={dateOptions}
            onChange={onEndDateChange}
            disabled={dates.length === 0}
            emptyMessage="Sin fechas disponibles"
          />
        </div>

        {/* Selector de Filtro */}
        <SelectField
          icon={SlidersHorizontal}
          label="Estado de línea"
          value={lineFilter}
          options={filterOptions}
          onChange={onLineFilterChange}
        />
      </div>
    </header>
  );
};
