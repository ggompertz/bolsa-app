import { authHeaders } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Direction = "long" | "short";

export interface TradingLevels {
  direction: Direction;
  leverage: number;
  entry: number;
  stopLoss: number;
  liquidation: number;
  tp1: number;
  tp2: number;
  tp3: number;
  capital: number;
  positionSize: number;
  maxLoss: number;
  maxLossPct: number;
}

export interface Trade {
  id: number;
  symbol: string;
  market: string;
  direction: Direction;
  leverage: number;
  entry_price: number;
  stop_loss: number;
  liquidation_price: number;
  tp1: number;
  tp2: number;
  tp3: number;
  capital: number;
  position_size: number;
  status: "open" | "closed" | "stopped";
  exit_price: number | null;
  pnl: number | null;
  pnl_pct: number | null;
  notes: string | null;
  opened_at: string;
  closed_at: string | null;
}

export function calcLevels(
  direction: Direction,
  leverage: number,
  entry: number,
  stopLoss: number,
  capital: number,
): TradingLevels | null {
  if (!entry || !stopLoss || !capital || entry <= 0) return null;

  const risk = Math.abs(entry - stopLoss);
  if (risk === 0) return null;

  // Liquidación (con ~0.5% de margen de mantenimiento aproximado)
  const maintenance = 0.005;
  const liq =
    direction === "long"
      ? entry * (1 - (1 / leverage - maintenance))
      : entry * (1 + (1 / leverage - maintenance));

  // Take profits (ratio riesgo/beneficio 1:1, 1:2, 1:3)
  const tp1 = direction === "long" ? entry + risk : entry - risk;
  const tp2 = direction === "long" ? entry + risk * 2 : entry - risk * 2;
  const tp3 = direction === "long" ? entry + risk * 3 : entry - risk * 3;

  // Tamaño de posición
  const positionSize = (capital * leverage) / entry;

  // Pérdida máxima
  const stopPct = (risk / entry) * 100;
  const maxLossPct = stopPct * leverage;
  const maxLoss = capital * (maxLossPct / 100);

  return {
    direction,
    leverage,
    entry,
    stopLoss,
    liquidation: parseFloat(liq.toFixed(6)),
    tp1: parseFloat(tp1.toFixed(6)),
    tp2: parseFloat(tp2.toFixed(6)),
    tp3: parseFloat(tp3.toFixed(6)),
    capital,
    positionSize: parseFloat(positionSize.toFixed(4)),
    maxLoss: parseFloat(maxLoss.toFixed(2)),
    maxLossPct: parseFloat(maxLossPct.toFixed(2)),
  };
}

async function apiFetch(url: string, options: RequestInit = {}) {
  return fetch(url, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers ?? {}) },
  });
}

export async function saveTrade(
  symbol: string,
  market: string,
  levels: TradingLevels,
  notes?: string,
): Promise<Trade> {
  const res = await apiFetch(`${API_BASE}/api/trades`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      symbol,
      market,
      direction: levels.direction,
      leverage: levels.leverage,
      entry_price: levels.entry,
      stop_loss: levels.stopLoss,
      liquidation_price: levels.liquidation,
      tp1: levels.tp1,
      tp2: levels.tp2,
      tp3: levels.tp3,
      capital: levels.capital,
      position_size: levels.positionSize,
      notes: notes ?? null,
    }),
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

export async function listTrades(status?: string): Promise<Trade[]> {
  const params = status ? `?status=${status}` : "";
  const res = await apiFetch(`${API_BASE}/api/trades${params}`);
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

export async function closeTrade(
  id: number,
  exitPrice: number,
  status: "closed" | "stopped",
): Promise<Trade> {
  const res = await apiFetch(`${API_BASE}/api/trades/${id}/close`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ exit_price: exitPrice, status }),
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

export async function deleteTrade(id: number): Promise<void> {
  const res = await apiFetch(`${API_BASE}/api/trades/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Error ${res.status}`);
}
