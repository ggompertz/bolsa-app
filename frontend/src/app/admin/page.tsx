"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface User {
  id: number;
  username: string;
  is_admin: boolean;
  is_active: boolean;
}

function authHeaders(): HeadersInit {
  if (typeof document === "undefined") return {};
  const match = document.cookie.match(/(?:^|; )bolsa_token=([^;]*)/);
  const token = match ? decodeURIComponent(match[1]) : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [creating, setCreating] = useState(false);

  async function loadUsers() {
    const res = await fetch(`${API_BASE}/api/auth/users`, { headers: authHeaders() });
    if (res.status === 401 || res.status === 403) { router.replace("/"); return; }
    if (!res.ok) { setError("Error al cargar usuarios"); return; }
    setUsers(await res.json());
  }

  useEffect(() => { loadUsers(); }, []);

  async function toggleActive(id: number) {
    const res = await fetch(`${API_BASE}/api/auth/users/${id}/active`, {
      method: "PATCH",
      headers: authHeaders(),
    });
    if (!res.ok) { setError("Error al cambiar estado"); return; }
    setUsers(prev => prev.map(u => u.id === id ? { ...u, is_active: !u.is_active } : u));
  }

  async function deleteUser(id: number, username: string) {
    if (!confirm(`¿Eliminar usuario "${username}"?`)) return;
    const res = await fetch(`${API_BASE}/api/auth/users/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!res.ok) { setError("Error al eliminar usuario"); return; }
    setUsers(prev => prev.filter(u => u.id !== id));
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");
    const res = await fetch(`${API_BASE}/api/auth/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ username: newUsername, password: newPassword, is_admin: newIsAdmin }),
    });
    setCreating(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setError(err.detail ?? "Error al crear usuario");
      return;
    }
    setNewUsername("");
    setNewPassword("");
    setNewIsAdmin(false);
    loadUsers();
  }

  return (
    <main className="min-h-screen bg-[#131722] text-white p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/")}
            className="text-gray-400 hover:text-white text-sm">← Volver</button>
          <h1 className="text-xl font-bold text-[#2196f3]">Administración de Usuarios</h1>
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">{error}</p>
        )}

        {/* Tabla de usuarios */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
                <th className="text-left px-4 py-3">Usuario</th>
                <th className="px-4 py-3">Admin</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-4 py-3 font-medium">{u.username}</td>
                  <td className="px-4 py-3 text-center">
                    {u.is_admin ? <span className="text-yellow-400 text-xs">Admin</span>
                      : <span className="text-gray-600 text-xs">Usuario</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${u.is_active
                      ? "bg-green-900/40 text-green-400 border border-green-800"
                      : "bg-red-900/40 text-red-400 border border-red-800"}`}>
                      {u.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex gap-2 justify-center">
                      <button onClick={() => toggleActive(u.id)}
                        className="text-xs px-2 py-1 rounded border border-gray-700 hover:border-gray-500 transition">
                        {u.is_active ? "Desactivar" : "Activar"}
                      </button>
                      <button onClick={() => deleteUser(u.id, u.username)}
                        className="text-xs px-2 py-1 rounded border border-red-900 text-red-400 hover:border-red-700 transition">
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Crear nuevo usuario */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Crear nuevo usuario</h2>
          <form onSubmit={createUser} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Usuario</label>
                <input type="text" required value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm
                             focus:outline-none focus:border-[#2196f3]" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Contraseña</label>
                <input type="password" required value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm
                             focus:outline-none focus:border-[#2196f3]" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
              <input type="checkbox" checked={newIsAdmin} onChange={e => setNewIsAdmin(e.target.checked)}
                className="accent-[#2196f3]" />
              Administrador
            </label>
            <button type="submit" disabled={creating}
              className="px-4 py-1.5 bg-[#2196f3] hover:bg-blue-500 text-white text-sm rounded transition disabled:opacity-50">
              {creating ? "Creando…" : "Crear usuario"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
