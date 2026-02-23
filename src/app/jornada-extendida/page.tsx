"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HourlyAnalysis } from "@/components/HourlyAnalysis";
import { DEFAULT_SEDES } from "@/lib/constants";
import type { DailyProductivity } from "@/types";
import type { Sede } from "@/lib/constants";

type ApiResponse = {
  dailyData?: DailyProductivity[];
  sedes?: Sede[];
  error?: string;
};

const normalizeSedeKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, " ");

export default function JornadaExtendidaPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [availableSedes, setAvailableSedes] = useState<Sede[]>([]);
  const [defaultSede, setDefaultSede] = useState<string | undefined>(undefined);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const meResponse = await fetch("/api/auth/me", {
          signal: controller.signal,
        });
        if (meResponse.status === 401) {
          router.replace("/login");
          return;
        }
        const mePayload = (await meResponse.json()) as {
          user?: { sede?: string | null };
        };
        const forcedSedeKey = mePayload.user?.sede
          ? normalizeSedeKey(mePayload.user.sede)
          : null;

        const response = await fetch("/api/productivity", {
          signal: controller.signal,
        });

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        const payload = (await response.json()) as ApiResponse;
        if (!response.ok) {
          throw new Error(payload.error ?? "No se pudo cargar la informacion");
        }

        if (!isMounted) return;

        const dates = Array.from(
          new Set((payload.dailyData ?? []).map((item) => item.date)),
        ).sort();
        const resolvedSedes =
          payload.sedes && payload.sedes.length > 0 ? payload.sedes : DEFAULT_SEDES;
        const forcedSede =
          forcedSedeKey
            ? resolvedSedes.find((sede) => {
                const idKey = normalizeSedeKey(sede.id || sede.name);
                const nameKey = normalizeSedeKey(sede.name);
                return idKey === forcedSedeKey || nameKey === forcedSedeKey;
              })
            : null;

        setAvailableDates(dates);
        if (forcedSede) {
          setAvailableSedes([forcedSede]);
          setDefaultSede(forcedSede.name);
        } else {
          setAvailableSedes(resolvedSedes);
          setDefaultSede(undefined);
        }
        setReady(true);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [router]);

  const defaultDate = useMemo(
    () => (availableDates.length > 0 ? availableDates[availableDates.length - 1] : ""),
    [availableDates],
  );

  if (!ready || isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 px-4 py-10 text-foreground">
        <div className="mx-auto w-full max-w-5xl rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.15)]">
          <p className="text-sm text-slate-600">Cargando tablero...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10 text-foreground">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-5 flex items-center justify-between gap-3 rounded-3xl border border-slate-200/70 bg-white p-5 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.15)]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">
              Tablero
            </p>
            <h1 className="mt-1 text-xl font-bold text-slate-900">Jornada extendida</h1>
          </div>
          <Link
            href="/tableros"
            className="inline-flex items-center rounded-full border border-slate-200/70 bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-200/70"
          >
            Cambiar tablero
          </Link>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        ) : (
          <HourlyAnalysis
            availableDates={availableDates}
            availableSedes={availableSedes}
            defaultDate={defaultDate}
            defaultSede={defaultSede}
            sections={["overtime"]}
            defaultSection="overtime"
            showTimeFilters={false}
            enableOvertimeDateRange
          />
        )}
      </div>
    </div>
  );
}
