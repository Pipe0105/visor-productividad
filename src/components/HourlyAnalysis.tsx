"use client";

import { useEffect, useMemo, useState } from "react";
import { Users, DollarSign, ChevronDown, Clock, Sparkles } from "lucide-react";
import { formatDateLabel } from "@/lib/utils";
import { DEFAULT_LINES } from "@/lib/constants";
import type { Sede } from "@/lib/constants";
import type { HourlyAnalysisData } from "@/types";

interface HourlyAnalysisProps {
  availableDates: string[];
  availableSedes: Sede[];
  defaultDate?: string;
  defaultSede?: string;
}

const hourlyDateLabelOptions: Intl.DateTimeFormatOptions = {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
};

const getHeatColor = (ratioPercent: number) => {
  if (ratioPercent >= 110) return "#16a34a";
  if (ratioPercent >= 100) return "#facc15";
  if (ratioPercent >= 90) return "#f97316";
  return "#dc2626";
};

const formatProductivity = (value: number) =>
  value.toFixed(3);

const calcVtaHr = (sales: number, laborHours: number) =>
  laborHours > 0 ? sales / 1_000_000 / laborHours : 0;

const parseTimeToMinute = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return 0;
  }
  return hours * 60 + minutes;
};

const minuteToTime = (value: number) => {
  const safe = Math.max(0, Math.min(1439, value));
  const hour = Math.floor(safe / 60);
  const minute = safe % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

const HourlyLoadingSkeleton = () => (
  <div className="space-y-3 animate-pulse">
    {Array.from({ length: 14 }).map((_, i) => (
      <div key={i} className="flex items-center gap-3">
        <div className="h-4 w-16 shrink-0 rounded-full bg-slate-200/70" />
        <div className="h-9 flex-1 rounded-full bg-slate-200/70" />
        <div className="h-4 w-24 shrink-0 rounded-full bg-slate-200/70" />
      </div>
    ))}
  </div>
);

const HourBar = ({
  label,
  productivity,
  totalSales,
  employeesPresent,
  maxProductivity,
  isExpanded,
  onToggle,
  lines,
  employeesByLine,
  heatColor,
  bucketMinutes,
}: {
  label: string;
  productivity: number;
  totalSales: number;
  employeesPresent: number;
  maxProductivity: number;
  isExpanded: boolean;
  onToggle: () => void;
  lines: HourlyAnalysisData["hours"][number]["lines"];
  employeesByLine?: Record<string, number>;
  heatColor: string;
  bucketMinutes: number;
}) => {
  const percentage = maxProductivity > 0 ? (productivity / maxProductivity) * 100 : 0;
  const hasActivity = totalSales > 0 || employeesPresent > 0;

  return (
    <div className="group rounded-2xl border border-slate-200/60 bg-white/80 p-2 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)] transition-all hover:-translate-y-0.5 hover:border-amber-200/70 hover:bg-white">
      <button
        type="button"
        onClick={onToggle}
        disabled={!hasActivity}
        className="flex w-full items-center gap-3 text-left transition-opacity disabled:opacity-40"
      >
        <div className="w-26 shrink-0 text-right">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-700 ring-1 ring-slate-200/60">
            {label}
          </span>
        </div>

        <div className="relative h-9 flex-1 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/70">
          {percentage > 0 && (
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
              style={{
                width: `${Math.max(percentage, 2)}%`,
                backgroundColor: heatColor,
              }}
            />
          )}
          {hasActivity && (
            <div className="absolute inset-0 flex items-center justify-between px-3">
              <span className="inline-flex items-center rounded-full bg-white/90 px-2 py-0.5 text-xs font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200/60">
                Vta/Hr: {formatProductivity(productivity)}
              </span>
            </div>
          )}
        </div>

        <div className="flex w-40 shrink-0 items-center justify-end gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-700 ring-1 ring-sky-200/70">
            <Users className="h-3.5 w-3.5" />
            {employeesPresent}
          </span>
          {hasActivity && (
            <ChevronDown
              className={`h-3.5 w-3.5 text-slate-400 transition-transform group-hover:text-mercamio-600 ${
                isExpanded ? "rotate-180" : ""
              }`}
            />
          )}
        </div>
      </button>

      {isExpanded && hasActivity && (
        <div className="mt-2 ml-26 mr-40 rounded-2xl border border-slate-200/70 bg-white/90 p-3 shadow-sm">
          <div className="grid grid-cols-12 gap-2 rounded-xl bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500 ring-1 ring-slate-200/60">
            <span className="col-span-8">Linea</span>
            <span className="col-span-4 text-right">Vta/Hr</span>
          </div>
          <div className="mt-2 space-y-2">
            {lines
              .filter((l) => l.sales > 0)
              .sort((a, b) => b.sales - a.sales)
              .map((line) => {
                const lineEmployees = employeesByLine?.[line.lineId] ?? 0;
                const lineLaborHours = lineEmployees * (bucketMinutes / 60);
                const lineProductivity = calcVtaHr(line.sales, lineLaborHours);
                return (
                  <div
                    key={line.lineId}
                    className="grid grid-cols-12 items-center gap-2 rounded-xl border border-slate-200/60 bg-white px-3 py-2 text-sm shadow-[0_6px_20px_-16px_rgba(15,23,42,0.35)]"
                  >
                    <div className="col-span-8">
                      <p className="font-semibold text-slate-900">{line.lineName}</p>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: "100%",
                            backgroundColor: heatColor,
                          }}
                        />
                      </div>
                    </div>
                    <span className="col-span-4 text-right font-semibold text-slate-800">
                      {formatProductivity(lineProductivity)}
                    </span>
                  </div>
                );
              })}
          </div>
          {lines.every((l) => l.sales === 0) && (
            <p className="py-2 text-center text-xs text-slate-500">
              Sin ventas registradas en esta hora
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export const HourlyAnalysis = ({
  availableDates,
  availableSedes,
  defaultDate,
  defaultSede,
}: HourlyAnalysisProps) => {
  const [selectedDate, setSelectedDate] = useState(defaultDate ?? "");
  const [selectedLine, setSelectedLine] = useState("");
  const [selectedSedes, setSelectedSedes] = useState<string[]>(
    defaultSede ? [defaultSede] : [],
  );
  const [bucketMinutes, setBucketMinutes] = useState(60);
  const [minuteRangeStart, setMinuteRangeStart] = useState(6 * 60);
  const [minuteRangeEnd, setMinuteRangeEnd] = useState(21 * 60 + 50);
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [compareDate, setCompareDate] = useState("");
  const [hourlyData, setHourlyData] = useState<HourlyAnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [compareData, setCompareData] = useState<HourlyAnalysisData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [expandedSlotStart, setExpandedSlotStart] = useState<number | null>(null);
  const [hourlySection, setHourlySection] = useState<"map" | "overtime">("map");
  const [overtimeFilterMode, setOvertimeFilterMode] = useState<
    "gte" | "lte" | "gt" | "lt" | "eq" | "range"
  >("gte");
  const [overtimeFilterValue, setOvertimeFilterValue] = useState("8");
  const [overtimeRangeMin, setOvertimeRangeMin] = useState("8");
  const [overtimeRangeMax, setOvertimeRangeMax] = useState("10");

  const minuteRangeStepSeconds = useMemo(() => bucketMinutes * 60, [bucketMinutes]);
  const bucketOptions = useMemo(
    () => [60, 30, 20, 15, 10],
    [],
  );

  const availableDateRange = useMemo(() => {
    if (availableDates.length === 0) return { min: "", max: "" };
    const sorted = [...availableDates].sort();
    return { min: sorted[0], max: sorted[sorted.length - 1] };
  }, [availableDates]);

  const lineOptions = useMemo(() => {
    const fallback = DEFAULT_LINES.map((line) => ({ id: line.id, name: line.name }));
    if (!hourlyData) return fallback;

    const map = new Map<string, string>();
    fallback.forEach((line) => map.set(line.id, line.name));
    hourlyData.hours.forEach((slot) => {
      slot.lines.forEach((line) => {
        if (!map.has(line.lineId)) {
          map.set(line.lineId, line.lineName);
        }
      });
    });

    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [hourlyData]);

  useEffect(() => {
    const available = new Set(availableSedes.map((s) => s.name));
    setSelectedSedes((prev) => prev.filter((name) => available.has(name)));
  }, [availableSedes]);

  const toggleSede = (sedeName: string) => {
    setSelectedSedes((prev) =>
      prev.includes(sedeName)
        ? prev.filter((name) => name !== sedeName)
        : [...prev, sedeName],
    );
  };

  const toggleAllSedes = () => {
    setSelectedSedes((prev) =>
      prev.length === availableSedes.length
        ? []
        : availableSedes.map((sede) => sede.name),
    );
  };

  const fetchHourly = async (
    date: string,
    lineId: string,
    currentBucketMinutes: number,
    sedeNames: string[],
    signal?: AbortSignal,
  ) => {
    const params = new URLSearchParams({ date });
    if (lineId) params.set("line", lineId);
    params.set("bucketMinutes", String(currentBucketMinutes));
    sedeNames.forEach((sede) => params.append("sede", sede));

    const res = await fetch(`/api/hourly-analysis?${params.toString()}`, { signal });
    const json = (await res.json()) as HourlyAnalysisData | { error?: string };

    if (!res.ok) {
      throw new Error((json as { error?: string }).error ?? "Error al obtener datos");
    }

    return json as HourlyAnalysisData;
  };

  useEffect(() => {
    if (!selectedDate) {
      setHourlyData(null);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    setExpandedSlotStart(null);

    fetchHourly(
      selectedDate,
      selectedLine,
      bucketMinutes,
      selectedSedes,
      controller.signal,
    )
      .then((data) => {
        setHourlyData(data);
        setIsLoading(false);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Error desconocido");
        setHourlyData(null);
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [selectedDate, selectedLine, bucketMinutes, selectedSedes]);

  useEffect(() => {
    if (!compareEnabled || !compareDate) {
      setCompareData(null);
      setCompareError(null);
      return;
    }

    const controller = new AbortController();
    setCompareError(null);

    fetchHourly(
      compareDate,
      selectedLine,
      bucketMinutes,
      selectedSedes,
      controller.signal,
    )
      .then((data) => {
        setCompareData(data);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setCompareError(err instanceof Error ? err.message : "Error desconocido");
        setCompareData(null);
      });

    return () => controller.abort();
  }, [compareEnabled, compareDate, selectedLine, bucketMinutes, selectedSedes]);

  const rangedHours = useMemo(() => {
    if (!hourlyData) return [];
    return hourlyData.hours.filter(
      (h) =>
        h.slotStartMinute >= minuteRangeStart &&
        h.slotStartMinute <= minuteRangeEnd,
    );
  }, [hourlyData, minuteRangeEnd, minuteRangeStart]);

  const activeHours = useMemo(() => {
    if (!hourlyData) return [];
    return rangedHours.filter((h) => h.totalSales > 0 || h.employeesPresent > 0);
  }, [hourlyData, rangedHours]);

  const mainBaselineSalesPerEmployee = useMemo(() => {
    if (!hourlyData) return 0;
    const totals = rangedHours.reduce(
      (acc, h) => {
        acc.sales += h.totalSales;
        acc.hours += h.employeesPresent * (bucketMinutes / 60);
        return acc;
      },
      { sales: 0, hours: 0 },
    );
    return calcVtaHr(totals.sales, totals.hours);
  }, [rangedHours, hourlyData, bucketMinutes]);

  const compareBaselineSalesPerEmployee = useMemo(() => {
    if (!compareData) return 0;
    const compareRangeHours = compareData.hours.filter(
      (h) =>
        h.slotStartMinute >= minuteRangeStart &&
        h.slotStartMinute <= minuteRangeEnd,
    );
    const totals = compareRangeHours.reduce(
      (acc, h) => {
        acc.sales += h.totalSales;
        acc.hours += h.employeesPresent * (bucketMinutes / 60);
        return acc;
      },
      { sales: 0, hours: 0 },
    );
    return calcVtaHr(totals.sales, totals.hours);
  }, [compareData, minuteRangeEnd, minuteRangeStart, bucketMinutes]);

  const computeHeatRatio = (
    sales: number,
    employees: number,
    baselineSalesPerEmployee: number,
  ) => {
    const laborHours = employees * (bucketMinutes / 60);
    const vtaHr = calcVtaHr(sales, laborHours);
    if (baselineSalesPerEmployee > 0) {
      return (vtaHr / baselineSalesPerEmployee) * 100;
    }
    return 0;
  };

  const maxProductivity = useMemo(() => {
    if (activeHours.length === 0) return 1;
    return Math.max(
      ...activeHours.map((h) => {
        const laborHours = h.employeesPresent * (bucketMinutes / 60);
        return calcVtaHr(h.totalSales, laborHours);
      }),
      1,
    );
  }, [activeHours, bucketMinutes]);

  const chartHours = useMemo(() => {
    if (!hourlyData) return [];

    const compareByHour = new Map(
      compareData?.hours
        .filter(
          (h) =>
            h.slotStartMinute >= minuteRangeStart &&
            h.slotStartMinute <= minuteRangeEnd,
        )
        .map((h) => [h.slotStartMinute, h]) ?? [],
    );

    return rangedHours
      .map((h) => {
        const compareSlot = compareByHour.get(h.slotStartMinute);

        const mainHeatRatio = computeHeatRatio(
          h.totalSales,
          h.employeesPresent,
          mainBaselineSalesPerEmployee,
        );

        const compareSales = compareSlot?.totalSales ?? 0;
        const compareEmployees = compareSlot?.employeesPresent ?? 0;
        const compareHeatRatio = computeHeatRatio(
          compareSales,
          compareEmployees,
          compareBaselineSalesPerEmployee,
        );
        const mainProductivity = calcVtaHr(
          h.totalSales,
          h.employeesPresent * (bucketMinutes / 60),
        );
        const compareProductivity = calcVtaHr(
          compareSales,
          compareEmployees * (bucketMinutes / 60),
        );

        return {
          slotStartMinute: h.slotStartMinute,
          label: h.label.slice(0, 5),
          mainSales: h.totalSales,
          mainProductivity,
          mainHeatRatio,
          mainHeatColor: getHeatColor(mainHeatRatio),
          compareSales,
          compareProductivity,
          compareHeatRatio,
          compareHeatColor: getHeatColor(compareHeatRatio),
        };
      })
      .filter((h) => {
        if (compareEnabled && compareData) {
          return h.mainSales > 0 || h.compareSales > 0;
        }
        return h.mainSales > 0;
      });
  }, [
    compareBaselineSalesPerEmployee,
    compareData,
    compareEnabled,
    bucketMinutes,
    minuteRangeEnd,
    minuteRangeStart,
    hourlyData,
    mainBaselineSalesPerEmployee,
    rangedHours,
  ]);

  const chartTickEvery = useMemo(() => {
    const count = chartHours.length;
    if (count <= 6) return 1;
    return Math.ceil(count / 6);
  }, [chartHours]);

  const chartColumnWidth = useMemo(() => {
    if (chartHours.length <= 8) return 56;
    if (chartHours.length <= 16) return 42;
    return 26;
  }, [chartHours.length]);

  const chartMaxProductivity = useMemo(() => {
    if (chartHours.length === 0) return 1;
    return Math.max(
      ...chartHours.map((h) =>
        Math.max(h.mainProductivity, h.compareProductivity),
      ),
      1,
    );
  }, [chartHours]);

  const dayTotals = useMemo(() => {
    if (!hourlyData)
      return { sales: 0, avgProductivity: 0, peakEmployees: 0, activeHoursCount: 0 };
    const sales = rangedHours.reduce((sum, h) => sum + h.totalSales, 0);
    const productivityValues = rangedHours
      .reduce(
        (acc, h) => {
          acc.sales += h.totalSales;
          acc.hours += h.employeesPresent * (bucketMinutes / 60);
          return acc;
        },
        { sales: 0, hours: 0 },
      );
    const avgProductivity = calcVtaHr(productivityValues.sales, productivityValues.hours);
    const peakEmployees = Math.max(...rangedHours.map((h) => h.employeesPresent), 0);
    const activeHoursCount = rangedHours.filter(
      (h) => h.totalSales > 0 || h.employeesPresent > 0,
    ).length;
    return { sales, avgProductivity, peakEmployees, activeHoursCount };
  }, [hourlyData, rangedHours, bucketMinutes]);

  const handleToggleHour = (hour: number) => {
    setExpandedSlotStart((prev) => (prev === hour ? null : hour));
  };

  const selectedLineLabel =
    selectedLine && lineOptions.find((line) => line.id === selectedLine)?.name;
  const overtimeEmployees = hourlyData?.overtimeEmployees ?? [];
  const filteredOvertimeEmployees = useMemo(() => {
    const value = overtimeFilterValue.trim() === "" ? null : Number(overtimeFilterValue);
    const min = overtimeRangeMin.trim() === "" ? null : Number(overtimeRangeMin);
    const max = overtimeRangeMax.trim() === "" ? null : Number(overtimeRangeMax);
    const validValue = value !== null && Number.isFinite(value) ? value : null;
    const validMin = min !== null && Number.isFinite(min) ? min : null;
    const validMax = max !== null && Number.isFinite(max) ? max : null;

    return overtimeEmployees.filter((employee) => {
      if (overtimeFilterMode === "range") {
        if (validMin !== null && employee.workedHours < validMin) return false;
        if (validMax !== null && employee.workedHours > validMax) return false;
        return true;
      }
      if (validValue === null) return true;
      if (overtimeFilterMode === "gt") return employee.workedHours > validValue;
      if (overtimeFilterMode === "gte") return employee.workedHours >= validValue;
      if (overtimeFilterMode === "lt") return employee.workedHours < validValue;
      if (overtimeFilterMode === "lte") return employee.workedHours <= validValue;
      if (overtimeFilterMode === "eq")
        return Math.abs(employee.workedHours - validValue) < 0.005;
      return true;
    });
  }, [
    overtimeEmployees,
    overtimeFilterMode,
    overtimeFilterValue,
    overtimeRangeMin,
    overtimeRangeMax,
  ]);

  return (
    <div
      data-animate="hourly-card"
      className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-linear-to-br from-white via-slate-50 to-amber-50/40 p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.2)]"
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -left-12 -bottom-16 h-44 w-44 rounded-full bg-mercamio-200/30 blur-3xl" />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-200/70 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-amber-700 shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            Analisis por hora
          </div>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">
            Desglose horario con color de mapa de calor
          </h3>
          <p className="mt-1 text-xs text-slate-600">
            Filtra por linea para enfocar el comportamiento horario en todas las sedes.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200/70 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm">
          <Clock className="h-4 w-4 text-mercamio-600" />
          Vista horaria
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="block">
          <span className="text-xs font-semibold text-slate-700">Fecha</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            min={availableDateRange.min}
            max={availableDateRange.max}
            className="mt-1 w-full rounded-full border border-slate-200/70 bg-white/90 px-3 py-2 text-sm text-slate-900 shadow-sm transition-all focus:border-mercamio-300 focus:outline-none focus:ring-2 focus:ring-mercamio-100"
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-slate-700">Linea</span>
          <select
            value={selectedLine}
            onChange={(e) => setSelectedLine(e.target.value)}
            className="mt-1 w-full rounded-full border border-slate-200/70 bg-white/90 px-3 py-2 text-sm text-slate-900 shadow-sm transition-all focus:border-mercamio-300 focus:outline-none focus:ring-2 focus:ring-mercamio-100"
          >
            <option value="">Todas las lineas</option>
            {lineOptions.map((line) => (
              <option key={line.id} value={line.id}>
                {line.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-slate-700">Intervalo</span>
          <select
            value={bucketMinutes}
            onChange={(e) => setBucketMinutes(Number(e.target.value))}
            className="mt-1 w-full rounded-full border border-slate-200/70 bg-white/90 px-3 py-2 text-sm text-slate-900 shadow-sm transition-all focus:border-mercamio-300 focus:outline-none focus:ring-2 focus:ring-mercamio-100"
          >
            {bucketOptions.map((minutes) => (
              <option key={`bucket-${minutes}`} value={minutes}>
                {minutes} minutos
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-slate-700">Desde (HH:mm)</span>
          <input
            type="time"
            step={minuteRangeStepSeconds}
            value={minuteToTime(minuteRangeStart)}
            onChange={(e) => {
              const nextStart = parseTimeToMinute(e.target.value);
              setMinuteRangeStart(nextStart);
              setMinuteRangeEnd((prev) => (prev < nextStart ? nextStart : prev));
            }}
            className="mt-1 w-full rounded-full border border-slate-200/70 bg-white/90 px-3 py-2 text-sm text-slate-900 shadow-sm transition-all focus:border-mercamio-300 focus:outline-none focus:ring-2 focus:ring-mercamio-100"
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-slate-700">Hasta (HH:mm)</span>
          <input
            type="time"
            step={minuteRangeStepSeconds}
            value={minuteToTime(minuteRangeEnd)}
            onChange={(e) => {
              const nextEnd = parseTimeToMinute(e.target.value);
              setMinuteRangeEnd(nextEnd);
              setMinuteRangeStart((prev) => (prev > nextEnd ? nextEnd : prev));
            }}
            className="mt-1 w-full rounded-full border border-slate-200/70 bg-white/90 px-3 py-2 text-sm text-slate-900 shadow-sm transition-all focus:border-mercamio-300 focus:outline-none focus:ring-2 focus:ring-mercamio-100"
          />
        </label>
      </div>

      <div className="mb-6 rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Sedes
          </span>
          <button
            type="button"
            onClick={toggleAllSedes}
            className="rounded-full border border-slate-200/70 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-700 transition-all hover:border-slate-300"
          >
            {selectedSedes.length === availableSedes.length
              ? "Quitar todas"
              : "Seleccionar todas"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {availableSedes.map((sede) => {
            const selected = selectedSedes.includes(sede.name);
            return (
              <button
                key={sede.id}
                type="button"
                onClick={() => toggleSede(sede.name)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                  selected
                    ? "border-sky-300 bg-sky-50 text-sky-700 ring-2 ring-sky-300 shadow-sm"
                    : "border-slate-200/70 bg-slate-50 text-slate-600 hover:border-slate-300"
                }`}
              >
                {sede.name}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          {selectedSedes.length === 0
            ? "Sin selección manual: se usan todas las sedes."
            : `${selectedSedes.length} sede(s) seleccionada(s).`}
        </p>
      </div>

      <div className="mb-6 rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Comparar
            </p>
            <p className="text-sm font-semibold text-slate-900">Compara dos dias</p>
          </div>
          <button
            type="button"
            onClick={() => setCompareEnabled((prev) => !prev)}
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] transition-all ${
              compareEnabled
                ? "bg-mercamio-50 text-mercamio-700 ring-1 ring-mercamio-200/70"
                : "bg-slate-100 text-slate-600 ring-1 ring-slate-200/70"
            }`}
          >
            {compareEnabled ? "Comparando" : "Comparar"}
          </button>
        </div>

        {compareEnabled && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-slate-700">Fecha a comparar</span>
              <input
                type="date"
                value={compareDate}
                onChange={(e) => setCompareDate(e.target.value)}
                min={availableDateRange.min}
                max={availableDateRange.max}
                className="mt-1 w-full rounded-full border border-slate-200/70 bg-white/90 px-3 py-2 text-sm text-slate-900 shadow-sm transition-all focus:border-mercamio-300 focus:outline-none focus:ring-2 focus:ring-mercamio-100"
              />
            </label>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-800">
          {error}
        </div>
      )}
      {compareError && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-800">
          {compareError}
        </div>
      )}

      {isLoading && <HourlyLoadingSkeleton />}

      {!isLoading && !selectedDate && (
        <p className="py-10 text-center text-sm text-slate-600">
          Selecciona una fecha para ver el analisis horario.
        </p>
      )}

      {!isLoading && hourlyData && (
        <>
          <div className="mb-6 rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border border-slate-200/70 bg-slate-50/80 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Fecha</p>
                <p className="text-sm font-semibold text-slate-900">
                  {formatDateLabel(hourlyData.date, hourlyDateLabelOptions)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200/70 bg-slate-50/80 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Alcance</p>
                <p className="text-sm font-semibold text-slate-900">{hourlyData.scopeLabel}</p>
              </div>
              <div className="rounded-xl border border-slate-200/70 bg-slate-50/80 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Rango</p>
                <p className="text-sm font-semibold text-slate-900">
                  {minuteToTime(minuteRangeStart)} - {minuteToTime(minuteRangeEnd)}
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200/70">
                Intervalo: {bucketMinutes} min
              </span>
              {selectedLineLabel && (
                <span className="rounded-full bg-mercamio-50 px-3 py-1 text-xs font-semibold text-mercamio-700 ring-1 ring-mercamio-200/70">
                  Linea: {selectedLineLabel}
                </span>
              )}
              {hourlyData.attendanceDateUsed &&
                hourlyData.attendanceDateUsed !== hourlyData.date && (
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200/70">
                    Asistencia usada: {hourlyData.attendanceDateUsed}
                  </span>
                )}
              {hourlyData.salesDateUsed &&
                hourlyData.salesDateUsed !== hourlyData.date && (
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200/70">
                    Ventas usadas: {hourlyData.salesDateUsed}
                  </span>
                )}
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <div className="flex items-center gap-2 rounded-xl border border-amber-200/70 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                <DollarSign className="h-3.5 w-3.5" />
                Vta/Hr prom: {formatProductivity(dayTotals.avgProductivity)}
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-sky-200/70 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-800">
                <Users className="h-3.5 w-3.5" />
                Pico: {dayTotals.peakEmployees} empleados
              </div>
              <div className="rounded-xl border border-slate-200/70 bg-slate-100/80 px-3 py-2 text-xs font-semibold text-slate-700">
                {dayTotals.activeHoursCount} horas con actividad
              </div>
            </div>
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setHourlySection("map")}
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] transition-all ${
                hourlySection === "map"
                  ? "bg-mercamio-50 text-mercamio-700 ring-1 ring-mercamio-200/70"
                  : "bg-slate-100 text-slate-600 ring-1 ring-slate-200/70"
              }`}
            >
              Mapa por hora
            </button>
            <button
              type="button"
              onClick={() => setHourlySection("overtime")}
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] transition-all ${
                hourlySection === "overtime"
                  ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200/70"
                  : "bg-slate-100 text-slate-600 ring-1 ring-slate-200/70"
              }`}
            >
              Jornada extendida
            </button>
          </div>

          {hourlySection === "overtime" && (
            <div className="mb-6 rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Jornada extendida
                </p>
                <p className="text-sm font-semibold text-slate-900">
                  Filtra por total de horas trabajadas
                </p>
              </div>
              <div className="mt-3">
                <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200/70">
                  {filteredOvertimeEmployees.length} empleado(s)
                </span>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-700">Tipo de filtro</span>
                  <select
                    value={overtimeFilterMode}
                    onChange={(e) =>
                      setOvertimeFilterMode(
                        e.target.value as "gte" | "lte" | "gt" | "lt" | "eq" | "range",
                      )
                    }
                    className="mt-1 w-full rounded-full border border-slate-200/70 bg-white/90 px-3 py-2 text-sm text-slate-900 shadow-sm transition-all focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100"
                  >
                    <option value="gte">Mayor o igual que</option>
                    <option value="gt">Mayor que</option>
                    <option value="lte">Menor o igual que</option>
                    <option value="lt">Menor que</option>
                    <option value="eq">Igual a</option>
                    <option value="range">Rango</option>
                  </select>
                </label>
                {overtimeFilterMode === "range" ? (
                  <>
                    <label className="block">
                      <span className="text-xs font-semibold text-slate-700">Horas min</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={overtimeRangeMin}
                        onChange={(e) => setOvertimeRangeMin(e.target.value)}
                        className="mt-1 w-full rounded-full border border-slate-200/70 bg-white/90 px-3 py-2 text-sm text-slate-900 shadow-sm transition-all focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-slate-700">Horas max</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={overtimeRangeMax}
                        onChange={(e) => setOvertimeRangeMax(e.target.value)}
                        className="mt-1 w-full rounded-full border border-slate-200/70 bg-white/90 px-3 py-2 text-sm text-slate-900 shadow-sm transition-all focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100"
                      />
                    </label>
                  </>
                ) : (
                  <label className="block sm:col-span-2">
                    <span className="text-xs font-semibold text-slate-700">Horas</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={overtimeFilterValue}
                      onChange={(e) => setOvertimeFilterValue(e.target.value)}
                      className="mt-1 w-full rounded-full border border-slate-200/70 bg-white/90 px-3 py-2 text-sm text-slate-900 shadow-sm transition-all focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100"
                    />
                  </label>
                )}
              </div>

              {filteredOvertimeEmployees.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No hay empleados para ese filtro de horas.
                </p>
              ) : (
                <div className="mt-3 overflow-hidden rounded-xl border border-slate-200/70 bg-white">
                  <div className="grid grid-cols-12 gap-2 border-b border-slate-200/70 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    <span className="col-span-1">#</span>
                    <span className="col-span-6">Empleado</span>
                    <span className="col-span-2 text-right">Horas</span>
                    <span className="col-span-3 text-right">Linea</span>
                  </div>
                  {filteredOvertimeEmployees.map((employee, index) => (
                    <div
                      key={`${employee.employeeId ?? "sin-id"}-${employee.employeeName}`}
                      className="grid grid-cols-12 items-center gap-2 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0"
                    >
                      <span className="col-span-1 text-xs font-semibold text-slate-500">
                        {index + 1}
                      </span>
                      <span className="col-span-6 font-semibold text-slate-900">
                        {employee.employeeName}
                      </span>
                      <span className="col-span-2 text-right text-xs font-semibold text-amber-700">
                        {employee.workedHours.toFixed(2)}h
                      </span>
                      <span className="col-span-3 text-right text-xs font-semibold text-sky-700">
                        {employee.lineName ?? "-"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {hourlySection === "map" && (
            <div className="mb-6 rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Diferencias por hora
                </p>
                <p className="text-sm font-semibold text-slate-900">
                  Colores por rendimiento (formula de mapa de calor)
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {compareEnabled && compareDate && (
                  <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-200/70">
                    Comparado: {compareDate}
                  </span>
                )}
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200/70">
                  Max Vta/Hr: {formatProductivity(maxProductivity)}
                </span>
              </div>
            </div>

            <div className="w-full rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3">
              {chartHours.length === 0 ? (
                <p className="py-10 text-center text-xs text-slate-500">Sin horas con ventas para graficar.</p>
              ) : (
                <div className="overflow-x-auto pb-2">
                  <div
                    className="relative h-52"
                    style={{
                      width: `${Math.max(chartHours.length * chartColumnWidth, 920)}px`,
                    }}
                  >
                    <div className="pointer-events-none absolute inset-x-0 top-[20%] border-t border-dashed border-slate-300/70" />
                    <div className="pointer-events-none absolute inset-x-0 top-[40%] border-t border-dashed border-slate-300/70" />
                    <div className="pointer-events-none absolute inset-x-0 top-[60%] border-t border-dashed border-slate-300/70" />
                    <div className="pointer-events-none absolute inset-x-0 top-[80%] border-t border-dashed border-slate-300/70" />
                    <div className="absolute inset-x-0 bottom-5 border-t border-slate-300/80" />

                    <div className="relative flex h-full items-end gap-1">
                      {chartHours.map((slot, index) => {
                        const mainHeight =
                          (slot.mainProductivity / chartMaxProductivity) * 100;
                        const compareHeight =
                          (slot.compareProductivity / chartMaxProductivity) * 100;
                        const showTick =
                          index % chartTickEvery === 0 || index === chartHours.length - 1;

                        return (
                          <div
                            key={slot.slotStartMinute}
                            className="group flex shrink-0 flex-col items-center justify-end gap-1"
                            style={{ width: `${chartColumnWidth}px` }}
                          >
                            <div className="flex h-44 w-full items-end justify-center gap-[3px]">
                              <div
                                className="w-[46%] min-h-[3px] rounded-t-md shadow-[0_8px_18px_-14px_rgba(15,23,42,0.6)] transition-all duration-200 group-hover:brightness-110"
                                style={{
                                  height: `${Math.max(mainHeight, slot.mainProductivity > 0 ? 2.5 : 0)}%`,
                                  backgroundColor: slot.mainHeatColor,
                                }}
                                title={`${slot.label} | Vta/Hr ${formatProductivity(slot.mainProductivity)} | ${slot.mainHeatRatio.toFixed(0)}%`}
                              />
                              {compareEnabled && compareData && (
                                <div
                                  className="w-[34%] min-h-[3px] rounded-t-md bg-sky-400/85 shadow-[0_8px_18px_-14px_rgba(14,165,233,0.8)]"
                                  style={{
                                    height: `${Math.max(compareHeight, slot.compareProductivity > 0 ? 2.5 : 0)}%`,
                                  }}
                                  title={`${slot.label} comparado | Vta/Hr ${formatProductivity(slot.compareProductivity)} | ${slot.compareHeatRatio.toFixed(0)}%`}
                                />
                              )}
                            </div>
                            <span className="text-[10px] font-semibold text-slate-500">
                              {showTick ? slot.label : ""}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {compareEnabled && compareData && (
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold">
                <span className="rounded-full bg-sky-50 px-2 py-1 text-sky-700 ring-1 ring-sky-200">
                  Barra azul: dia comparado
                </span>
              </div>
            )}
            </div>
          )}

          {hourlySection === "map" && (activeHours.length > 0 ? (
            <div className="space-y-3">
              {activeHours.map((slot) => {
                const heatRatio = computeHeatRatio(
                  slot.totalSales,
                  slot.employeesPresent,
                  mainBaselineSalesPerEmployee,
                );
                const heatColor = getHeatColor(heatRatio);

                return (
                  <HourBar
                    key={slot.slotStartMinute}
                    label={slot.label}
                    productivity={
                      calcVtaHr(
                        slot.totalSales,
                        slot.employeesPresent * (bucketMinutes / 60),
                      )
                    }
                    totalSales={slot.totalSales}
                    employeesPresent={slot.employeesPresent}
                    maxProductivity={maxProductivity}
                    isExpanded={expandedSlotStart === slot.slotStartMinute}
                    onToggle={() => handleToggleHour(slot.slotStartMinute)}
                    lines={slot.lines}
                    employeesByLine={slot.employeesByLine}
                    heatColor={heatColor}
                    bucketMinutes={bucketMinutes}
                  />
                );
              })}
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-slate-600">
              No hay actividad registrada para este filtro.
            </p>
          ))}
        </>
      )}
    </div>
  );
};
