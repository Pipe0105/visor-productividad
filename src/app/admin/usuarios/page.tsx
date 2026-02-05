"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type UserRow = {
  id: string;
  username: string;
  role: "admin" | "user";
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  last_login_ip: string | null;
};

type LogRow = {
  id: number;
  logged_at: string;
  ip: string | null;
  user_agent: string | null;
  user_id: string;
  username: string;
};

type UserFormState = {
  id?: string;
  username: string;
  role: "admin" | "user";
  password: string;
  is_active: boolean;
};

const emptyForm: UserFormState = {
  username: "",
  role: "user",
  password: "",
  is_active: true,
};

export default function AdminUsuariosPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formState, setFormState] = useState<UserFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.username.localeCompare(b.username, "es")),
    [users],
  );
  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((user) => user.is_active).length;
    const admins = users.filter((user) => user.role === "admin").length;
    return { total, active, admins };
  }, [users]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) {
        router.replace("/login");
        return;
      }
      const mePayload = (await meRes.json()) as { user?: { role?: string } };
      if (mePayload.user?.role !== "admin") {
        router.replace("/login");
        return;
      }
      setIsAdmin(true);

      const [usersRes, logsRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/login-logs?limit=25"),
      ]);

      if (!usersRes.ok) throw new Error("No se pudieron cargar los usuarios.");
      if (!logsRes.ok) throw new Error("No se pudieron cargar los accesos.");

      const usersPayload = (await usersRes.json()) as { users: UserRow[] };
      const logsPayload = (await logsRes.json()) as { logs: LogRow[] };
      setUsers(usersPayload.users ?? []);
      setLogs(logsPayload.logs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const openCreate = () => {
    setFormState(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (user: UserRow) => {
    setFormState({
      id: user.id,
      username: user.username,
      role: user.role,
      password: "",
      is_active: user.is_active,
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setFormState(emptyForm);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        username: formState.username,
        role: formState.role,
        password: formState.password,
        is_active: formState.is_active,
      };

      const response = await fetch(
        formState.id ? `/api/admin/users/${formState.id}` : "/api/admin/users",
        {
          method: formState.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "No se pudo guardar el usuario.");
      }

      closeForm();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("¿Seguro que deseas eliminar este usuario?")) return;
    setError(null);
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "No se pudo eliminar el usuario.");
      return;
    }
    await loadData();
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  };

  const handleClearLogs = async () => {
    if (!confirm("¿Deseas borrar todos los accesos recientes?")) return;
    setError(null);
    const response = await fetch("/api/admin/login-logs", { method: "DELETE" });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "No se pudieron borrar los accesos.");
      return;
    }
    await loadData();
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 px-4 py-10 text-slate-900">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 right-[-6rem] h-72 w-72 rounded-full bg-mercamio-200/40 blur-3xl" />
        <div className="absolute bottom-[-8rem] left-[-4rem] h-80 w-80 rounded-full bg-sky-200/40 blur-3xl" />
        <div className="absolute top-1/3 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-slate-200/50 blur-3xl" />
      </div>

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/60 bg-white/80 p-6 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.35)] backdrop-blur">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
              Administración
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900 md:text-3xl">
              Usuarios de la aplicación
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-500">
              Gestiona roles, accesos y actividad reciente con una vista clara y
              accionable.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/"
              className="rounded-full border border-slate-200/70 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-700 transition-all hover:-translate-y-0.5 hover:bg-slate-50"
            >
              Volver al tablero
            </Link>
            <button
              type="button"
              onClick={openCreate}
              className="rounded-full border border-slate-900/90 bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white shadow-[0_14px_30px_-16px_rgba(15,23,42,0.6)] transition-all hover:-translate-y-0.5 hover:bg-slate-800"
            >
              Nuevo usuario
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full border border-slate-200/70 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-700 transition-all hover:-translate-y-0.5 hover:bg-slate-50"
            >
              Cerrar sesión
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-amber-200/70 bg-amber-50 px-4 py-2 text-sm text-amber-700 shadow-[0_16px_40px_-28px_rgba(217,119,6,0.45)]">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.15)]">
            Cargando usuarios...
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-[0_18px_60px_-40px_rgba(15,23,42,0.3)] backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                  Total usuarios
                </p>
                <p className="mt-3 text-3xl font-semibold text-slate-900">
                  {stats.total}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Cuentas registradas
                </p>
              </div>
              <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-[0_18px_60px_-40px_rgba(15,23,42,0.3)] backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                  Usuarios activos
                </p>
                <p className="mt-3 text-3xl font-semibold text-slate-900">
                  {stats.active}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Con acceso habilitado
                </p>
              </div>
              <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-[0_18px_60px_-40px_rgba(15,23,42,0.3)] backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                  Administradores
                </p>
                <p className="mt-3 text-3xl font-semibold text-slate-900">
                  {stats.admins}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Roles con permisos totales
                </p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
              <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.15)]">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
                    Usuarios
                  </h2>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                    {sortedUsers.length} registrados
                  </span>
                </div>
                <div className="mt-5 overflow-auto">
                  <table className="w-full text-sm text-slate-700">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-[0.2em] text-slate-500">
                        <th className="py-2">Usuario</th>
                        <th className="py-2">Rol</th>
                        <th className="py-2">Estado</th>
                        <th className="py-2">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedUsers.map((user) => (
                        <tr
                          key={user.id}
                          className="border-t border-slate-100 transition-colors hover:bg-slate-50/80"
                        >
                          <td className="py-3 font-semibold text-slate-900">
                            {user.username}
                          </td>
                          <td className="py-3">
                            <span className="inline-flex rounded-full border border-slate-200 px-2 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                              {user.role}
                            </span>
                          </td>
                          <td className="py-3">
                            <span
                              className={`inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs font-semibold ${
                                user.is_active
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-rose-50 text-rose-700"
                              }`}
                            >
                              <span
                                className={`h-2 w-2 rounded-full ${
                                  user.is_active
                                    ? "bg-emerald-500"
                                    : "bg-rose-500"
                                }`}
                              />
                              {user.is_active ? "Activo" : "Inactivo"}
                            </span>
                          </td>
                          <td className="py-3">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => openEdit(user)}
                                className="rounded-full border border-mercamio-200/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-mercamio-700 transition-colors hover:bg-mercamio-50"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(user.id)}
                                className="rounded-full border border-rose-200/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-rose-700 transition-colors hover:bg-rose-50"
                              >
                                Borrar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {sortedUsers.length === 0 && (
                    <div className="py-10 text-center text-sm text-slate-500">
                      No hay usuarios registrados todavía.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.15)]">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
                    Accesos recientes
                  </h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                      Últimos {logs.length}
                    </span>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={handleClearLogs}
                        className="rounded-full border border-rose-200/70 bg-rose-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-rose-700 transition-colors hover:bg-rose-100"
                      >
                        Borrar accesos
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-5 space-y-3 text-sm text-slate-700">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-xs font-semibold uppercase text-slate-600 shadow-sm">
                          {log.username.slice(0, 2)}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">
                            {log.username}
                          </div>
                          <div className="text-xs text-slate-500">
                            {new Date(log.logged_at).toLocaleString("es-CO")} •{" "}
                            {log.ip ?? "IP desconocida"}
                          </div>
                        </div>
                      </div>
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">
                        Login
                      </span>
                    </div>
                  ))}
                  {logs.length === 0 && (
                    <p className="text-sm text-slate-500">
                      Sin accesos registrados.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200/70 bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-slate-900">
              {formState.id ? "Editar usuario" : "Nuevo usuario"}
            </h2>

            <div className="mt-4 space-y-3">
              <label className="block text-sm text-slate-700">
                Usuario
                <input
                  value={formState.username}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, username: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200/70 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-mercamio-400 focus:outline-none focus:ring-2 focus:ring-mercamio-100"
                />
              </label>
              <label className="block text-sm text-slate-700">
                Rol
                <select
                  value={formState.role}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      role: e.target.value as "admin" | "user",
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200/70 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-mercamio-400 focus:outline-none focus:ring-2 focus:ring-mercamio-100"
                >
                  <option value="user">Usuario</option>
                  <option value="admin">Administrador</option>
                </select>
              </label>
              <label className="block text-sm text-slate-700">
                Contraseña {formState.id ? "(opcional)" : "(mín 8)"}
                <input
                  type="password"
                  value={formState.password}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      password: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200/70 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-mercamio-400 focus:outline-none focus:ring-2 focus:ring-mercamio-100"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={formState.is_active}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      is_active: e.target.checked,
                    }))
                  }
                />
                Cuenta activa
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeForm}
                className="rounded-full border border-slate-200/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700 transition-colors hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-full border border-mercamio-200/70 bg-mercamio-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition-all hover:bg-mercamio-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

