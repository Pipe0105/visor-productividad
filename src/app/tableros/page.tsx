"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function TablerosPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

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
          user?: { role?: string };
        };
        if (!isMounted) return;
        setReady(true);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
      }
    };

    void loadUser();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-background px-4 py-10 text-foreground">
        <div className="mx-auto w-full max-w-md rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.15)]">
          <p className="text-sm text-slate-600">Cargando tableros...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.18),_transparent_55%),linear-gradient(180deg,_#f8fafc,_#eef2f7)] px-4 py-12 text-foreground">
      <div className="mx-auto w-full max-w-lg rounded-[28px] border border-slate-200/70 bg-white p-7 shadow-[0_28px_70px_-45px_rgba(15,23,42,0.4)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-500">
          Acceso rapido
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          Elige un tablero
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Selecciona a donde quieres ingresar.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="group w-full rounded-2xl border border-slate-200/80 bg-white px-5 py-4 text-left text-slate-900 shadow-[0_18px_35px_-30px_rgba(15,23,42,0.25)] transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_20px_40px_-30px_rgba(15,23,42,0.35)]"
          >
            <span className="block text-sm font-semibold tracking-wide">
              Tablero productividad
            </span>
            <span className="mt-1 block text-xs text-slate-600">
              Ventas, horas, margen y comparativos por sede.
            </span>
          </button>
          <button
            type="button"
            onClick={() => router.push("/margenes")}
            className="group w-full rounded-2xl border border-slate-200/80 bg-white px-5 py-4 text-left text-slate-900 shadow-[0_18px_35px_-30px_rgba(15,23,42,0.25)] transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_20px_40px_-30px_rgba(15,23,42,0.35)]"
          >
            <span className="block text-sm font-semibold tracking-wide">
              Tablero margenes
            </span>
            <span className="mt-1 block text-xs text-slate-600">
              Proximamente: indicadores de rentabilidad.
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
