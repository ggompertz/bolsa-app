import { authHeaders } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function apiFetch(url: string, options: RequestInit = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers ?? {}) },
  });
  if (res.status === 401) {
    // Token expirado — redirigir a login
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("No autenticado");
  }
  return res;
}

export async function fetchChart(
  symbol: string,
  market: string = "US",
  interval: string = "1d",
  period: string = "1y",
  indicators: string = "SMA_20,SMA_50,Volume,RSI,MACD",
): Promise<{ chart: string }> {
  const params = new URLSearchParams({ market, interval, period, indicators });
  const res = await apiFetch(`${API_BASE}/api/stock/${symbol}/chart?${params}`);
  if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function fetchAnalysis(symbol: string, market: string = "US", period: string = "6mo") {
  const params = new URLSearchParams({ market, period });
  const res = await apiFetch(`${API_BASE}/api/stock/${symbol}/analysis?${params}`);
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

export async function fetchInfo(symbol: string, market: string = "US") {
  const res = await apiFetch(`${API_BASE}/api/stock/${symbol}/info?market=${market}`);
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

export async function searchTickers(q: string, market: string = "US") {
  const res = await apiFetch(`${API_BASE}/api/search?q=${encodeURIComponent(q)}&market=${market}`);
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}
