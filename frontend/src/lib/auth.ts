const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const TOKEN_KEY = "bolsa_token";

export interface AuthUser {
  username: string;
  is_admin: boolean;
}

export async function login(username: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Error al iniciar sesión");
  }
  const data = await res.json();
  // Guardar token en cookie (accesible por middleware y JS)
  document.cookie = `${TOKEN_KEY}=${data.access_token}; path=/; max-age=${60 * 60 * 24}; SameSite=Lax`;
  return { username: data.username, is_admin: data.is_admin };
}

export function logout() {
  document.cookie = `${TOKEN_KEY}=; path=/; max-age=0`;
  window.location.href = "/login";
}

export function getToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${TOKEN_KEY}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
