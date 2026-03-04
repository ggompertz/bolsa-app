import { authHeaders } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function apiFetch(url: string, options: RequestInit = {}) {
  return fetch(url, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers ?? {}) },
  });
}

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type ConditionType =
  | "rsi_overbought"
  | "rsi_oversold"
  | "candle_pattern"
  | "volume_anomaly"
  | "breakout"
  | "confluence";

export interface AlertCreate {
  symbol: string;
  market: string;
  condition_type: ConditionType;
  condition_params: Record<string, unknown>;
  telegram_chat_id?: string;
  cooldown_hours?: number;
}

export interface Alert {
  id: number;
  symbol: string;
  market: string;
  condition_type: ConditionType;
  condition_params: Record<string, unknown>;
  telegram_chat_id: string | null;
  active: boolean;
  created_at: string;
  cooldown_hours: number;
  last_triggered_at: string | null;
}

export interface TriggeredAlert {
  id: number;
  alert_id: number;
  triggered_at: string;
  message: string;
  seen: boolean;
  symbol: string;
  condition_type: ConditionType;
}

// ─── CRUD ───────────────────────────────────────────────────────────────────

export async function createAlert(data: AlertCreate): Promise<Alert> {
  const res = await apiFetch(`${API_BASE}/api/alerts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function listAlerts(): Promise<Alert[]> {
  const res = await apiFetch(`${API_BASE}/api/alerts`);
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

export async function deleteAlert(id: number): Promise<void> {
  const res = await apiFetch(`${API_BASE}/api/alerts/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Error ${res.status}`);
}

// ─── Notificaciones (polling) ───────────────────────────────────────────────

export async function getTriggered(since?: string): Promise<TriggeredAlert[]> {
  const params = new URLSearchParams({ unseen_only: "true" });
  if (since) params.set("since", since);
  const res = await apiFetch(`${API_BASE}/api/alerts/triggered?${params}`);
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

export async function markSeen(id: number): Promise<void> {
  await apiFetch(`${API_BASE}/api/alerts/triggered/${id}/seen`, { method: "PUT" });
}

export async function testAlert(id: number): Promise<{ triggered: boolean; message: string }> {
  const res = await apiFetch(`${API_BASE}/api/alerts/test/${id}`, { method: "POST" });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

// ─── Etiquetas legibles ─────────────────────────────────────────────────────

export const CONDITION_LABELS: Record<ConditionType, string> = {
  rsi_overbought: "RSI sobrecompra",
  rsi_oversold:   "RSI sobreventa",
  candle_pattern: "Patrón de velas",
  volume_anomaly: "Volumen anómalo",
  breakout:       "Ruptura S/R",
  confluence:     "Confluencia (AND)",
};

export const CANDLE_PATTERNS = [
  "Hammer",
  "Shooting_Star",
  "Doji",
  "Bullish_Engulfing",
  "Bearish_Engulfing",
  "Morning_Star",
];
