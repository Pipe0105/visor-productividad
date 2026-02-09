"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCOP } from "@/lib/calc";
import {
  DEFAULT_LINES,
  DEFAULT_SEDES,
  SEDE_GROUPS,
  SEDE_ORDER,
  Sede,
} from "@/lib/constants";
import { DailyProductivity, LineMetrics } from "@/types";

type ApiResponse = {
  dailyData: DailyProductivity[];
  sedes: Array<{ id: string; name: string }>;
  error?: string;
};

type DateRange = {
  start: string;
  end: string;
};

const parseDateKey = (dateKey: string): Date => {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const toDateKey = (date: Date): string => date.toISOString().slice(0, 10);

const formatDateLabel = (dateKey: string) =>
  new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parseDateKey(dateKey));

const normalizeSedeKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "");

const sortSedesByOrder = (sedes: Sede[]) => {
  return [...sedes].sort((a, b) => {
    const indexA = SEDE_ORDER.indexOf(a.name);
    const indexB = SEDE_ORDER.indexOf(b.name);
    if (indexA === -1 && indexB === -1) {
      return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
    }
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });
};

const buildCompanyOptions = (): Sede[] =>
  SEDE_GROUPS.filter((group) => group.id !== "all").map((group) => ({
    id: group.id,
    name: group.name,
  }));

const resolveSelectedSedeIds = (
  selectedSede: string,
  selectedCompanies: string[],
  availableSedes: Sede[],
): string[] => {
  const availableByKey = new Map(
    availableSedes.map((sede) => [normalizeSedeKey(sede.id), sede.id]),
  );

  if (selectedCompanies.length > 0) {
    const resolved = new Set<string>();
    selectedCompanies.forEach((companyId) => {
      const group = SEDE_GROUPS.find((candidate) => candidate.id === companyId);
      if (!group) return;
      group.sedes.forEach((sedeId) => {
        const resolvedId = availableByKey.get(normalizeSedeKey(sedeId));
        if (resolvedId) resolved.add(resolvedId);
      });
    });
    return Array.from(resolved);
  }

  if (selectedSede) {
    const resolved = availableByKey.get(normalizeSedeKey(selectedSede));
    return resolved ? [resolved] : [];
  }

  return availableSedes.map((sede) => sede.id);
};

const GROSS_MARGIN_PCT = 0.2;

const calcGrossMargin = (line: LineMetrics) => line.sales * GROSS_MARGIN_PCT;

const sumMargins = (lines: LineMetrics[]) =>
  lines.reduce((acc, line) => acc + calcGrossMargin(line), 0);

export default function MargenesPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [prefsReady, setPrefsReady] = useState(false);
  const [pendingSedeKey, setPendingSedeKey] = useState<string | null>(null);
  const [appliedUserDefault, setAppliedUserDefault] = useState(false);
  const [dailyDataSet, setDailyDataSet] = useState<DailyProductivity[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSede, setSelectedSede] = useState("");
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>({ start: "", end: "" });
  const prefsKey = useMemo(
    () => `vp_margenes_prefs_${username ?? "default"}`,
    [username],
  );

  const resolveUsernameSedeKey = (value?: string | null) => {
    if (!value) return null;
    const normalized = value.trim().toLowerCase();
    if (!normalized.startsWith("sede_")) return null;
    const raw = normalized.replace(/^sede_/, "").replace(/_/g, " ");
    return normalizeSedeKey(raw);
  };

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadUser = async () => {
      try {
        const response = await fetch("/api/auth/me", {
          signal: controller.signal,
        });
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        if (!response.ok) return;
        const payload = (await response.json()) as {
          user?: { role?: string; username?: string };
        };
        if (!isMounted) return;
        setReady(true);
        setUsername(payload.user?.username ?? null);
        setPendingSedeKey(resolveUsernameSedeKey(payload.user?.username));
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
      } finally {
        if (isMounted) setAuthLoaded(true);
      }
    };

    void loadUser();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [router]);

  useEffect(() => {
    if (!ready) return;

    let isMounted = true;
    const controller = new AbortController();

    const loadData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/productivity", {
          signal: controller.signal,
        });
        const payload = (await response.json()) as ApiResponse;

        if (!isMounted) return;

        if (response.status === 401) {
          setError("No autorizado.");
          setDailyDataSet([]);
          setSedes([]);
          return;
        }

        const resolvedDailyData = payload.dailyData ?? [];
        const resolvedSedes =
          payload.sedes && payload.sedes.length > 0
            ? payload.sedes
            : DEFAULT_SEDES;

        if (!response.ok) {
          setError(payload.error ?? "No se pudieron cargar los datos.");
          setDailyDataSet(resolvedDailyData);
          setSedes(resolvedSedes);
          return;
        }

        setDailyDataSet(resolvedDailyData);
        setSedes(resolvedSedes);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        setError("No se pudieron cargar los datos.");
        setDailyDataSet([]);
        setSedes([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void loadData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [ready]);

  const orderedSedes = useMemo(() => sortSedesByOrder(sedes), [sedes]);
  const companyOptions = useMemo(() => buildCompanyOptions(), []);
  const selectedSedeIds = useMemo(
    () => resolveSelectedSedeIds(selectedSede, selectedCompanies, orderedSedes),
    [selectedCompanies, selectedSede, orderedSedes],
  );
  const selectedSedeIdSet = useMemo(
    () => new Set(selectedSedeIds),
    [selectedSedeIds],
  );
  const filteredSedes = useMemo(() => {
    if (selectedSedeIds.length === 0) return orderedSedes;
    return orderedSedes.filter((sede) => selectedSedeIdSet.has(sede.id));
  }, [orderedSedes, selectedSedeIdSet, selectedSedeIds.length]);
  const availableDates = useMemo(
    () =>
      Array.from(new Set(dailyDataSet.map((item) => item.date))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [dailyDataSet],
  );

  useEffect(() => {
    if (availableDates.length === 0) return;
    setDateRange((prev) => ({
      start: prev.start || availableDates[0],
      end: prev.end || (availableDates.at(-1) ?? availableDates[0]),
    }));
  }, [availableDates]);

  useEffect(() => {
    if (!authLoaded) return;

    const rawPrefs = localStorage.getItem(prefsKey);
    if (rawPrefs) {
      try {
        const parsed = JSON.parse(rawPrefs) as {
          selectedSede?: string;
          selectedCompanies?: string[];
          dateRange?: DateRange;
        };
        if (Array.isArray(parsed.selectedCompanies)) {
          setSelectedCompanies(parsed.selectedCompanies.slice(0, 2));
        }
        if (typeof parsed.selectedSede === "string") {
          setSelectedSede(parsed.selectedSede);
        }
        if (parsed.dateRange?.start && parsed.dateRange?.end) {
          setDateRange(parsed.dateRange);
        }
        setPrefsReady(true);
        return;
      } catch {
        // ignore
      }
    }
    setPrefsReady(true);
  }, [authLoaded, prefsKey]);

  useEffect(() => {
    if (!prefsReady) return;
    const payload = {
      selectedSede,
      selectedCompanies,
      dateRange,
    };
    localStorage.setItem(prefsKey, JSON.stringify(payload));
  }, [dateRange, prefsKey, prefsReady, selectedCompanies, selectedSede]);

  useEffect(() => {
    if (!prefsReady || appliedUserDefault) return;
    if (!pendingSedeKey) {
      setAppliedUserDefault(true);
      return;
    }
    const match = orderedSedes.find((sede) => {
      const idKey = normalizeSedeKey(sede.id);
      const nameKey = normalizeSedeKey(sede.name);
      return idKey === pendingSedeKey || nameKey === pendingSedeKey;
    });
    if (match) {
      setSelectedCompanies([]);
      setSelectedSede(match.id);
      setAppliedUserDefault(true);
    }
  }, [appliedUserDefault, orderedSedes, pendingSedeKey, prefsReady]);

  const selectedDay = dateRange.end || dateRange.start;

  const marginsBySede = useMemo(() => {
    const dayMap = new Map<string, number>();
    const rangeMap = new Map<string, number>();
    const monthMap = new Map<string, number>();
    let totalDay = 0;
    let totalRange = 0;
    let totalMonth = 0;

    if (!selectedDay) {
      return { dayMap, rangeMap, monthMap, totalDay, totalRange, totalMonth };
    }

    const base = parseDateKey(selectedDay);
    const monthStart = toDateKey(
      new Date(base.getFullYear(), base.getMonth(), 1),
    );
    const monthEnd = toDateKey(
      new Date(base.getFullYear(), base.getMonth() + 1, 0),
    );

    dailyDataSet.forEach((item) => {
      if (selectedSedeIdSet.size > 0 && !selectedSedeIdSet.has(item.sede)) {
        return;
      }
      const margin = sumMargins(item.lines);
      if (item.date === selectedDay) {
        dayMap.set(item.sede, (dayMap.get(item.sede) ?? 0) + margin);
        totalDay += margin;
      }
      if (item.date >= dateRange.start && item.date <= dateRange.end) {
        rangeMap.set(item.sede, (rangeMap.get(item.sede) ?? 0) + margin);
        totalRange += margin;
      }
      if (item.date >= monthStart && item.date <= monthEnd) {
        monthMap.set(item.sede, (monthMap.get(item.sede) ?? 0) + margin);
        totalMonth += margin;
      }
    });

    return { dayMap, rangeMap, monthMap, totalDay, totalRange, totalMonth };
  }, [
    dailyDataSet,
    dateRange.end,
    dateRange.start,
    selectedDay,
    selectedSedeIdSet,
  ]);

  const lineOptions = useMemo(() => {
    const nameMap = new Map<string, string>();
    DEFAULT_LINES.forEach((line) => nameMap.set(line.id, line.name));
    dailyDataSet.forEach((item) => {
      item.lines.forEach((line) => {
        if (!nameMap.has(line.id)) {
          nameMap.set(line.id, line.name ?? line.id);
        }
      });
    });
    return Array.from(nameMap.entries()).map(([id, name]) => ({ id, name }));
  }, [dailyDataSet]);

  const marginsByLine = useMemo(() => {
    const dayMap = new Map<string, number>();
    const rangeMap = new Map<string, number>();
    const monthMap = new Map<string, number>();

    if (!selectedDay) {
      return { dayMap, rangeMap, monthMap };
    }

    const base = parseDateKey(selectedDay);
    const monthStart = toDateKey(
      new Date(base.getFullYear(), base.getMonth(), 1),
    );
    const monthEnd = toDateKey(
      new Date(base.getFullYear(), base.getMonth() + 1, 0),
    );

    dailyDataSet.forEach((item) => {
      if (selectedSedeIdSet.size > 0 && !selectedSedeIdSet.has(item.sede)) {
        return;
      }
      item.lines.forEach((line) => {
        const margin = calcGrossMargin(line);
        if (item.date === selectedDay) {
          dayMap.set(line.id, (dayMap.get(line.id) ?? 0) + margin);
        }
        if (item.date >= dateRange.start && item.date <= dateRange.end) {
          rangeMap.set(line.id, (rangeMap.get(line.id) ?? 0) + margin);
        }
        if (item.date >= monthStart && item.date <= monthEnd) {
          monthMap.set(line.id, (monthMap.get(line.id) ?? 0) + margin);
        }
      });
    });

    return { dayMap, rangeMap, monthMap };
  }, [
    dailyDataSet,
    dateRange.end,
    dateRange.start,
    selectedDay,
    selectedSedeIdSet,
  ]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-background px-4 py-10 text-foreground">
        <div className="mx-auto w-full max-w-md rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.15)]">
          <p className="text-sm text-slate-600">Cargando tablero...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(148,163,184,0.18),transparent_55%),linear-gradient(180deg,#f8fafc,#eef2f7)] px-4 py-10 text-foreground">
      <div className="mx-auto w-full max-w-6xl rounded-[30px] border border-slate-200/70 bg-white p-8 shadow-[0_30px_80px_-55px_rgba(15,23,42,0.45)]">
        <div className="rounded-3xl border border-slate-200/70 bg-slate-50/70 p-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-500">
                Tablero margenes
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-900">
                Margenes por sede y linea
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Margen bruto estimado ({Math.round(GROSS_MARGIN_PCT * 100)}%)
                para el dia, acumulado del rango y acumulado del mes.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-white px-4 py-3 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">
                Rango de fechas
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <label className="text-xs font-semibold text-slate-600">
                  Desde
                  <input
                    type="date"
                    value={dateRange.start}
                    min={availableDates[0]}
                    max={availableDates.at(-1)}
                    onChange={(e) =>
                      setDateRange((prev) => ({
                        start: e.target.value,
                        end:
                          e.target.value > prev.end ? e.target.value : prev.end,
                      }))
                    }
                    className="ml-2 rounded-full border border-slate-200/70 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  Hasta
                  <input
                    type="date"
                    value={dateRange.end}
                    min={availableDates[0]}
                    max={availableDates.at(-1)}
                    onChange={(e) =>
                      setDateRange((prev) => ({
                        start:
                          e.target.value < prev.start
                            ? e.target.value
                            : prev.start,
                        end: e.target.value,
                      }))
                    }
                    className="ml-2 rounded-full border border-slate-200/70 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </label>
              </div>
            </div>
            <button
              type="button"
              onClick={() => router.push("/tableros")}
              className="inline-flex h-fit items-center justify-center rounded-full border border-slate-200/70 bg-white px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-100"
            >
              Cambiar tablero
            </button>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/70 bg-white px-4 py-3 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.25)]">
            <label className="text-xs font-semibold text-slate-600">
              Empresa (max 2)
              <select
                value=""
                onChange={(e) => {
                  const value = e.target.value;
                  if (!value) return;
                  setSelectedCompanies((prev) => {
                    const next = prev.includes(value) ? prev : [...prev, value];
                    return next.slice(0, 2);
                  });
                  setSelectedSede("");
                }}
                className="ml-2 rounded-full border border-slate-200/70 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              >
                <option value="">Seleccionar empresa</option>
                {companyOptions.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              {selectedCompanies.map((companyId) => {
                const label =
                  companyOptions.find((c) => c.id === companyId)?.name ??
                  companyId;
                return (
                  <button
                    key={companyId}
                    type="button"
                    onClick={() =>
                      setSelectedCompanies((prev) =>
                        prev.filter((id) => id !== companyId),
                      )
                    }
                    className="rounded-full border border-slate-200/70 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 transition-all hover:border-slate-300"
                  >
                    {label} x
                  </button>
                );
              })}
            </div>
            <label className="text-xs font-semibold text-slate-600">
              Sede
              <select
                value={selectedSede}
                onChange={(e) => {
                  setSelectedSede(e.target.value);
                  if (e.target.value) setSelectedCompanies([]);
                }}
                className="ml-2 rounded-full border border-slate-200/70 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              >
                <option value="">Todas las sedes</option>
                {orderedSedes.map((sede) => (
                  <option key={sede.id} value={sede.id}>
                    {sede.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-amber-200/70 bg-amber-50 px-4 py-2 text-sm text-amber-700">
            {error}
          </div>
        )}

        {isLoading && (
          <p className="mt-6 text-sm text-slate-600">Cargando datos...</p>
        )}

        {!isLoading && selectedDay && (
          <>
            <div className="mt-8 overflow-x-auto rounded-2xl border border-slate-200/70 bg-white shadow-[0_18px_40px_-34px_rgba(15,23,42,0.25)]">
              <table className="min-w-full text-sm text-slate-700">
                <thead className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Sede</th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Margen {formatDateLabel(selectedDay)}
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Acumulado rango
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Acumulado mes
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSedes.map((sede, index) => (
                    <tr
                      key={sede.id}
                      className={
                        index % 2 === 0 ? "bg-white" : "bg-slate-50/60"
                      }
                    >
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {sede.name}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatCOP(marginsBySede.dayMap.get(sede.id) ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatCOP(marginsBySede.rangeMap.get(sede.id) ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatCOP(marginsBySede.monthMap.get(sede.id) ?? 0)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-slate-200 bg-slate-100/80">
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      Total seleccionadas
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {formatCOP(marginsBySede.totalDay)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {formatCOP(marginsBySede.totalRange)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {formatCOP(marginsBySede.totalMonth)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-8 overflow-x-auto rounded-2xl border border-slate-200/70 bg-white shadow-[0_18px_40px_-34px_rgba(15,23,42,0.25)]">
              <table className="min-w-full text-sm text-slate-700">
                <thead className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Linea</th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Margen {formatDateLabel(selectedDay)}
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Acumulado rango
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Acumulado mes
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lineOptions.map((line, index) => (
                    <tr
                      key={line.id}
                      className={
                        index % 2 === 0 ? "bg-white" : "bg-slate-50/60"
                      }
                    >
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {line.name}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatCOP(marginsByLine.dayMap.get(line.id) ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatCOP(marginsByLine.rangeMap.get(line.id) ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatCOP(marginsByLine.monthMap.get(line.id) ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!isLoading && !selectedDay && (
          <p className="mt-6 text-sm text-slate-600">
            No hay datos disponibles.
          </p>
        )}

        <div className="mt-8">
          <button
            type="button"
            onClick={() => router.push("/tableros")}
            className="w-full rounded-full border border-slate-200/70 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700 transition-all hover:border-slate-300 hover:text-slate-900"
          >
            Volver a tableros
          </button>
        </div>
      </div>
    </div>
  );
}
