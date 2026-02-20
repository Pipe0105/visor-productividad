"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function TablerosPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSwitchingUser, setIsSwitchingUser] = useState(false);

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
        setIsAdmin(payload.user?.role === "admin");
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

  const handleSwitchUser = async () => {
    if (isSwitchingUser) return;
    setIsSwitchingUser(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
    }
  };

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
    <div className="min-h-screen bg-slate-100 px-4 py-12 text-foreground">
      <div className="mx-auto w-full max-w-2xl rounded-[28px] border border-slate-200/70 bg-white p-7 shadow-[0_28px_70px_-45px_rgba(15,23,42,0.4)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-500">
          Acceso rapido
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="bg-linear-to-r from-blue-700 via-indigo-700 to-amber-700 bg-clip-text text-2xl font-bold text-transparent">
            Elige un tablero
          </h1>
          {isAdmin && (
            <button
              type="button"
              onClick={() => router.push("/admin/usuarios")}
            className="inline-flex items-center rounded-full border border-slate-900/90 bg-linear-to-r from-slate-900 to-slate-700 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white transition-all hover:brightness-110"
            >
              Usuarios
            </button>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Selecciona a donde quieres ingresar.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="group w-full rounded-2xl border border-blue-300/80 bg-linear-to-br from-blue-100 via-white to-cyan-100 px-5 py-5 text-left text-slate-900 shadow-[0_18px_35px_-30px_rgba(37,99,235,0.45)] transition-all hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-[0_22px_44px_-26px_rgba(37,99,235,0.55)]"
          >
            <span className="inline-flex rounded-full border border-blue-300/80 bg-blue-200/75 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-800">
              Productividad
            </span>
            <span className="mt-3 block text-sm font-semibold tracking-wide">
              Tablero productividad
            </span>
            <span className="mt-1 block text-xs text-slate-600">
              Ventas, horas, margen y comparativos por sede.
            </span>
          </button>
          <button
            type="button"
            onClick={() => router.push("/margenes")}
            className="group w-full rounded-2xl border border-amber-300/80 bg-linear-to-br from-amber-100 via-white to-orange-100 px-5 py-5 text-left text-slate-900 shadow-[0_18px_35px_-30px_rgba(245,158,11,0.45)] transition-all hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-[0_22px_44px_-26px_rgba(245,158,11,0.55)]"
          >
            <span className="inline-flex rounded-full border border-amber-300/80 bg-amber-200/75 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-800">
              Margenes
            </span>
            <span className="mt-3 block text-sm font-semibold tracking-wide">
              Tablero margenes
            </span>
            <span className="mt-1 block text-xs text-slate-600">
              Proximamente: indicadores de rentabilidad.
            </span>
          </button>
          <button
            type="button"
            onClick={() => router.push("/jornada-extendida")}
            className="group w-full rounded-2xl border border-rose-300/80 bg-linear-to-br from-rose-100 via-white to-pink-100 px-5 py-5 text-left text-slate-900 shadow-[0_18px_35px_-30px_rgba(244,63,94,0.4)] transition-all hover:-translate-y-0.5 hover:border-rose-400 hover:shadow-[0_22px_44px_-26px_rgba(244,63,94,0.5)]"
          >
            <span className="inline-flex rounded-full border border-rose-300/80 bg-rose-200/75 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-rose-800">
              Jornada
            </span>
            <span className="mt-3 block text-sm font-semibold tracking-wide">
              Jornada extendida
            </span>
            <span className="mt-1 block text-xs text-slate-600">
              Empleados con horas extra por sede y fecha.
            </span>
          </button>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-slate-200/70 pt-4">
          <button
            type="button"
            onClick={handleSwitchUser}
            disabled={isSwitchingUser}
            className="inline-flex items-center rounded-full border border-slate-200/70 bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-200/70 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSwitchingUser ? "Saliendo..." : "Cambiar usuario"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/cuenta/contrasena")}
            className="inline-flex items-center rounded-full border border-blue-200/70 bg-blue-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700 transition-all hover:border-blue-300 hover:bg-blue-100"
          >
            Cambiar contraseña
          </button>
        </div>
      </div>
    </div>
  );
}
