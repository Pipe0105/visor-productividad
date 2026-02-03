import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Building2,
  CalendarDays,
  Download,
  MapPin,
  Moon,
  Sun,
} from "lucide-react";

interface TopBarProps {
  title: ReactNode;
  selectedSede: string;
  sedes: { id: string; name: string }[];
  selectedCompanies: string[];
  companies: { id: string; name: string }[];
  startDate: string;
  endDate: string;
  dates: string[];
  theme: "light" | "dark";
  onSedeChange: (value: string) => void;
  onCompaniesChange: (value: string[]) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onToggleTheme: () => void;
  onExportClick: () => void;
  isExportDisabled?: boolean;
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
  <label className="group relative flex flex-col gap-1 cursor-pointer sm:gap-1.5">
    <div className="flex items-center gap-1 px-1 sm:gap-1.5">
      <Icon className="h-3 w-3 text-mercamio-600 sm:h-3.5 sm:w-3.5" />
      <span className="text-[9px] font-bold uppercase tracking-widest text-slate-700 sm:text-[10px] sm:tracking-[0.15em]">
        {label}
      </span>
    </div>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full rounded-lg border border-slate-200/70 bg-white px-2.5 py-2 text-sm font-medium text-slate-900 shadow-sm transition-all hover:border-mercamio-200 hover:shadow-md focus:border-mercamio-400 focus:outline-none focus:ring-2 focus:ring-mercamio-100 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-slate-200/70 disabled:hover:shadow-sm sm:rounded-xl sm:px-3 sm:py-2.5"
    >
      {options.length === 0 ? (
        <option value="" className="bg-white text-slate-700">
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

const MultiSelectField = ({
  icon: Icon,
  label,
  values,
  options,
  onChange,
  disabled = false,
  emptyMessage = "Sin opciones disponibles",
  maxSelected = 2,
}: {
  icon: React.ElementType;
  label: string;
  values: string[];
  options: Array<{ value: string; label: string }>;
  onChange: (value: string[]) => void;
  disabled?: boolean;
  emptyMessage?: string;
  maxSelected?: number;
}) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const selectedLabels = options
    .filter((option) => values.includes(option.value))
    .map((option) => option.label);
  const displayLabel =
    selectedLabels.length > 0 ? selectedLabels.join(", ") : "Todas las empresas";
  const limitReached = values.length >= maxSelected;

  const toggleValue = (value: string) => {
    if (values.includes(value)) {
      onChange(values.filter((item) => item !== value));
      return;
    }
    if (limitReached) return;
    onChange([...values, value]);
  };

  return (
    <div className="group relative flex flex-col gap-1 sm:gap-1.5" ref={menuRef}>
      <div className="flex items-center gap-1 px-1 sm:gap-1.5">
        <Icon className="h-3 w-3 text-mercamio-600 sm:h-3.5 sm:w-3.5" />
        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-700 sm:text-[10px] sm:tracking-[0.15em]">
          {label}
        </span>
      </div>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        disabled={disabled}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200/70 bg-white px-2.5 py-2 text-left text-sm font-medium text-slate-900 shadow-sm transition-all hover:border-mercamio-200 hover:shadow-md focus:border-mercamio-400 focus:outline-none focus:ring-2 focus:ring-mercamio-100 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-slate-200/70 disabled:hover:shadow-sm sm:rounded-xl sm:px-3 sm:py-2.5"
      >
        <span className="truncate">{displayLabel}</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          {values.length > 0 ? `${values.length}/${maxSelected}` : "Todas"}
        </span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-2 w-full rounded-xl border border-slate-200/70 bg-white p-2 shadow-lg">
          {options.length === 0 ? (
            <p className="px-2 py-2 text-sm text-slate-600">{emptyMessage}</p>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onChange([])}
                className="mb-1 w-full rounded-lg px-2 py-2 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 transition-colors hover:bg-slate-50"
              >
                Todas las empresas
              </button>
              <div className="space-y-1">
                {options.map((option) => {
                  const checked = values.includes(option.value);
                  const isDisabled = !checked && limitReached;
                  return (
                    <label
                      key={option.value}
                      className={`flex items-center justify-between rounded-lg px-2 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 ${
                        isDisabled ? "opacity-50" : ""
                      }`}
                    >
                      <span>{option.label}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleValue(option.value)}
                        disabled={isDisabled}
                        className="h-4 w-4 rounded border-slate-300 text-mercamio-600 focus:ring-mercamio-200"
                      />
                    </label>
                  );
                })}
              </div>
              {limitReached && (
                <p className="mt-2 px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-600">
                  MÃ¡ximo {maxSelected} empresas
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

const DateField = ({
  icon: Icon,
  label,
  value,
  min,
  max,
  onChange,
  disabled = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  min: string;
  max: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) => (
  <label className="group relative flex flex-col gap-1 cursor-pointer sm:gap-1.5">
    <div className="flex items-center gap-1 px-1 sm:gap-1.5">
      <Icon className="h-3 w-3 text-mercamio-600 sm:h-3.5 sm:w-3.5" />
      <span className="text-[9px] font-bold uppercase tracking-widest text-slate-700 sm:text-[10px] sm:tracking-[0.15em]">
        {label}
      </span>
    </div>
    <input
      type="date"
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full rounded-lg border border-slate-200/70 bg-white px-2.5 py-2 text-sm font-medium text-slate-900 shadow-sm transition-all hover:border-mercamio-200 hover:shadow-md focus:border-mercamio-400 focus:outline-none focus:ring-2 focus:ring-mercamio-100 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-slate-200/70 disabled:hover:shadow-sm sm:rounded-xl sm:px-3 sm:py-2.5"
    />
  </label>
);

const BrandHeader = ({ title }: { title: ReactNode }) => (
  <div className="flex items-start gap-4">
    <div className="flex-1 space-y-3">
      {/* Título principal con gradiente */}
      <h1 className="bg-linear-to-br from-slate-900 via-slate-800 to-slate-700 bg-clip-text text-2xl font-bold leading-tight text-transparent sm:text-3xl md:text-4xl">
        {title}
      </h1>
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
  selectedCompanies,
  companies,
  startDate,
  endDate,
  dates,
  theme,
  onSedeChange,
  onCompaniesChange,
  onStartDateChange,
  onEndDateChange,
  onToggleTheme,
  onExportClick,
  isExportDisabled = false,
}: TopBarProps) => {
  // Transformar datos para el componente SelectField
  const sedeOptions = [
    { value: "", label: "Todas las sedes" },
    ...sedes.map((sede) => ({
      value: sede.id,
      label: sede.name,
    })),
  ];
  const companyOptions = [
    ...companies.map((company) => ({
      value: company.id,
      label: company.name,
    })),
  ];

  const sortedDates = [...dates].sort();
  const minDate = sortedDates[0] ?? "";
  const maxDate = sortedDates[sortedDates.length - 1] ?? "";

  return (
    <header
      data-animate="top-bar"
      className="flex flex-col gap-4 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.15)] backdrop-blur sm:gap-6 sm:rounded-3xl sm:p-6 md:gap-8 md:p-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
        <BrandHeader title={title} />
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={
            theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"
          }
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/70 bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-100 focus:border-mercamio-300 focus:outline-none focus:ring-2 focus:ring-mercamio-100 sm:gap-2 sm:px-4 sm:py-2 sm:text-xs sm:tracking-[0.2em]"
        >
          {theme === "dark" ? (
            <Sun className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          ) : (
            <Moon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          )}
          {theme === "dark" ? "Claro" : "Oscuro"}
        </button>
      </div>

      {/* Controles de filtrado */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:flex md:flex-wrap md:gap-6">
        {/* Selector de Empresa */}
        <div className="sm:col-span-2 md:flex-1 md:min-w-50">
          <MultiSelectField
            icon={Building2}
            label="Empresa"
            values={selectedCompanies}
            options={companyOptions}
            onChange={onCompaniesChange}
            disabled={companies.length === 0}
            emptyMessage="Sin empresas disponibles"
          />
        </div>

        {/* Selector de Sede */}
        <div className="sm:col-span-2 md:flex-1 md:min-w-50">
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
        <div className="contents sm:contents md:flex md:gap-3">
          <div className="md:w-40">
            <DateField
              icon={CalendarDays}
              label="Desde"
              value={startDate}
              min={minDate}
              max={maxDate}
              onChange={onStartDateChange}
              disabled={dates.length === 0}
            />
          </div>

          <div className="md:w-40">
            <DateField
              icon={CalendarDays}
              label="Hasta"
              value={endDate}
              min={minDate}
              max={maxDate}
              onChange={onEndDateChange}
              disabled={dates.length === 0}
            />
          </div>
        </div>

        <div className="sm:col-span-2 md:basis-full md:flex md:justify-end">
          <button
            type="button"
            onClick={onExportClick}
            disabled={isExportDisabled}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Exportar
          </button>
        </div>
      </div>
    </header>
  );
};

