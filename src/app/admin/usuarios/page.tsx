"use client";

import { useEffect, useMemo, useState } from "react";
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

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.username.localeCompare(b.username, "es")),
    [users],
  );

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
    if (!confirm("Â¿Seguro que deseas eliminar este usuario?")) return;
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

  return (
    <div className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              AdministraciÃ³n
            </p>
            <h1 className="text-2xl font-semibold text-slate-900">
              Usuarios de la aplicaciÃ³n
            </h1>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={openCreate}
              className="rounded-full border border-mercamio-200/70 bg-mercamio-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition-all hover:bg-mercamio-700"
            >
              Nuevo usuario
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full border border-slate-200/70 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 transition-all hover:bg-slate-50"
            >
              Cerrar sesiÃ³n
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-amber-200/70 bg-amber-50 px-4 py-2 text-sm text-amber-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-3xl border border-slate-200/70 bg-white p-6">
            Cargando usuarios...
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.15)]">
              <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
                Usuarios
              </h2>
              <div className="mt-4 overflow-auto">
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
                      <tr key={user.id} className="border-t border-slate-100">
                        <td className="py-2 font-semibold text-slate-900">
                          {user.username}
                        </td>
                        <td className="py-2">{user.role}</td>
                        <td className="py-2">
                          {user.is_active ? "Activo" : "Inactivo"}
                        </td>
                        <td className="py-2">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => openEdit(user)}
                              className="text-xs font-semibold text-mercamio-700 hover:text-mercamio-800"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(user.id)}
                              className="text-xs font-semibold text-red-600 hover:text-red-700"
                            >
                              Borrar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.15)]">
              <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
                Accesos recientes
              </h2>
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2"
                  >
                    <div className="font-semibold text-slate-900">
                      {log.username}
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(log.logged_at).toLocaleString("es-CO")} â€¢{" "}
                      {log.ip ?? "IP desconocida"}
                    </div>
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
                ContraseÃ±a {formState.id ? "(opcional)" : "(mÃ­n 8)"}
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
                className="rounded-full border border-slate-200/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 transition-colors hover:bg-slate-50"
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
