import type { ReactNode } from "react";
import { CalendarDays, MapPin, SlidersHorizontal, TrendingUp, BarChart3 } from "lucide-react";

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
  <label className="group relative flex flex-col gap-1.5 cursor-pointer">
    <div className="flex items-center gap-1.5 px-1">
      <Icon className="h-3.5 w-3.5 text-mercamio-600" />
      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-600">
        {label}
      </span>
    </div>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="rounded-xl border border-slate-200/70 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm transition-all hover:border-mercamio-200 hover:shadow-md focus:border-mercamio-400 focus:outline-none focus:ring-2 focus:ring-mercamio-100 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-slate-200/70 disabled:hover:shadow-sm"
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
    {/* Barra decorativa con gradiente */}
    <div className="relative flex shrink-0 flex-col gap-2">
      <div className="h-16 w-1.5 rounded-full bg-linear-to-b from-mercamio-400 via-mercamio-500 to-mercamio-600 shadow-[0_0_20px_rgba(60,173,152,0.4)]" />
      <div className="flex items-center justify-center rounded-full bg-linear-to-br from-mercamio-50 to-mercamio-100 p-2 shadow-sm">
        <BarChart3 className="h-4 w-4 text-mercamio-600" />
      </div>
    </div>

    <div className="flex-1 space-y-3">
      {/* Badge de marca */}
      <div className="inline-flex items-center gap-2 rounded-full bg-linear-to-r from-mercamio-50 to-emerald-50 px-4 py-1.5 shadow-sm ring-1 ring-mercamio-200/50">
        <div className="h-1.5 w-1.5 rounded-full bg-mercamio-500 shadow-[0_0_6px_rgba(60,173,152,0.6)]" />
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-mercamio-700">
          Mercamio Analytics
        </p>
        <TrendingUp className="h-3.5 w-3.5 text-mercamio-600" />
      </div>

      {/* Título principal con gradiente */}
      <h1 className="bg-linear-to-br from-slate-900 via-slate-800 to-slate-700 bg-clip-text text-3xl font-bold leading-tight text-transparent sm:text-4xl">
        {title}
      </h1>

      {/* Descripción mejorada */}
      <p className="max-w-md text-sm leading-relaxed text-slate-600">
        <span className="font-medium text-slate-700">Análisis en tiempo real:</span>{" "}
        Visualiza ventas, horas trabajadas y márgenes por línea de producción
        con métricas precisas.
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
      className="flex flex-col gap-8 rounded-3xl border border-slate-200/70 bg-white p-8 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.15)] backdrop-blur"
    >
      <BrandHeader title={title} />

      {/* Controles de filtrado */}
      <div className="flex flex-wrap gap-6">
        {/* Selector de Sede */}
        <div className="flex-1 min-w-50">
          <SelectField
            icon={MapPin}
            label="Sede"
            value={selectedSede}
            options={sedeOptions}
            onChange={onSedeChange}
            disabled={sedes.length === 0}
            emptyMessage="Sin sedes disponibles"
          />
        </div>

        {/* Selectores de Fecha */}
        <div className="flex gap-3">
          <div className="w-40">
            <SelectField
              icon={CalendarDays}
              label="Desde"
              value={startDate}
              options={dateOptions}
              onChange={onStartDateChange}
              disabled={dates.length === 0}
              emptyMessage="Sin fechas disponibles"
            />
          </div>

          <div className="w-40">
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
        </div>

        {/* Selector de Filtro */}
        <div className="flex-1 min-w-50">
          <SelectField
            icon={SlidersHorizontal}
            label="Estado de línea"
            value={lineFilter}
            options={filterOptions}
            onChange={onLineFilterChange}
          />
        </div>
      </div>
    </header>
  );
};
