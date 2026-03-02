"use client";

import { useEffect, useState } from "react";
import {
  listAlerts,
  createAlert,
  deleteAlert,
  testAlert,
  type Alert,
  type ConditionType,
  CONDITION_LABELS,
  CANDLE_PATTERNS,
} from "@/lib/alertApi";

interface Props {
  currentSymbol: string;
  currentMarket: string;
}

const DEFAULT_PARAMS: Record<ConditionType, Record<string, unknown>> = {
  rsi_overbought: { threshold: 70 },
  rsi_oversold:   { threshold: 30 },
  candle_pattern: { pattern: "Hammer" },
  volume_anomaly: { multiplier: 2.0 },
  breakout:       {},
};

export default function AlertPanel({ currentSymbol, currentMarket }: Props) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [testResult, setTestResult] = useState<{ id: number; triggered: boolean; message: string } | null>(null);

  // Form state
  const [symbol, setSymbol] = useState(currentSymbol);
  const [market, setMarket] = useState(currentMarket);
  const [condType, setCondType] = useState<ConditionType>("rsi_overbought");
  const [threshold, setThreshold] = useState("70");
  const [pattern, setPattern] = useState("Hammer");
  const [multiplier, setMultiplier] = useState("2.0");
  const [chatId, setChatId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setSymbol(currentSymbol);
    setMarket(currentMarket);
  }, [currentSymbol, currentMarket]);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listAlerts();
      setAlerts(data);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  };

  const handleCondTypeChange = (ct: ConditionType) => {
    setCondType(ct);
    const defaults = DEFAULT_PARAMS[ct];
    if (ct === "rsi_overbought") setThreshold("70");
    if (ct === "rsi_oversold") setThreshold("30");
    if (ct === "volume_anomaly") setMultiplier("2.0");
  };

  const buildParams = (): Record<string, unknown> => {
    if (condType === "rsi_overbought" || condType === "rsi_oversold") {
      return { threshold: parseFloat(threshold) };
    }
    if (condType === "candle_pattern") return { pattern };
    if (condType === "volume_anomaly") return { multiplier: parseFloat(multiplier) };
    return {};
  };

  const handleSave = async () => {
    setError("");
    setSaving(true);
    try {
      await createAlert({
        symbol,
        market,
        condition_type: condType,
        condition_params: buildParams(),
        telegram_chat_id: chatId.trim() || undefined,
      });
      setShowForm(false);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteAlert(id);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch {
      // silencioso
    }
  };

  const handleTest = async (id: number) => {
    try {
      const result = await testAlert(id);
      setTestResult({ id, ...result });
      setTimeout(() => setTestResult(null), 5000);
    } catch {
      // silencioso
    }
  };

  const condLabel = (type: ConditionType, params: Record<string, unknown>) => {
    if (type === "rsi_overbought") return `RSI > ${params.threshold ?? 70}`;
    if (type === "rsi_oversold")   return `RSI < ${params.threshold ?? 30}`;
    if (type === "candle_pattern") return `Vela: ${params.pattern ?? "—"}`;
    if (type === "volume_anomaly") return `Vol × ${params.multiplier ?? 2}`;
    if (type === "breakout")       return "Ruptura S/R";
    return type;
  };

  return (
    <div className="space-y-3">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Alertas</h2>
        <button
          onClick={() => { setShowForm(!showForm); setError(""); }}
          className="text-xs px-2 py-1 rounded bg-[#2196f3] hover:bg-blue-500 text-white"
        >
          {showForm ? "Cancelar" : "+ Alerta"}
        </button>
      </div>

      {/* Formulario de creación */}
      {showForm && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 space-y-2 text-xs">
          {/* Símbolo y mercado */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-gray-400 block mb-0.5">Símbolo</label>
              <input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white"
              />
            </div>
            <div>
              <label className="text-gray-400 block mb-0.5">Mercado</label>
              <select
                value={market}
                onChange={(e) => setMarket(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white"
              >
                <option value="US">USA</option>
                <option value="CL">Chile</option>
              </select>
            </div>
          </div>

          {/* Condición */}
          <div>
            <label className="text-gray-400 block mb-0.5">Condición</label>
            <select
              value={condType}
              onChange={(e) => handleCondTypeChange(e.target.value as ConditionType)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white"
            >
              {(Object.keys(CONDITION_LABELS) as ConditionType[]).map((ct) => (
                <option key={ct} value={ct}>{CONDITION_LABELS[ct]}</option>
              ))}
            </select>
          </div>

          {/* Parámetros según condición */}
          {(condType === "rsi_overbought" || condType === "rsi_oversold") && (
            <div>
              <label className="text-gray-400 block mb-0.5">
                Umbral RSI ({condType === "rsi_overbought" ? "dispara si RSI >" : "dispara si RSI <"})
              </label>
              <input
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                min={0} max={100}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white"
              />
            </div>
          )}

          {condType === "candle_pattern" && (
            <div>
              <label className="text-gray-400 block mb-0.5">Patrón de velas</label>
              <select
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white"
              >
                {CANDLE_PATTERNS.map((p) => (
                  <option key={p} value={p}>{p.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
          )}

          {condType === "volume_anomaly" && (
            <div>
              <label className="text-gray-400 block mb-0.5">Multiplicador (ej. 2 = 2x promedio)</label>
              <input
                type="number"
                value={multiplier}
                onChange={(e) => setMultiplier(e.target.value)}
                min={1} step={0.5}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white"
              />
            </div>
          )}

          {/* Telegram (opcional) */}
          <div>
            <label className="text-gray-400 block mb-0.5">Chat ID Telegram (opcional)</label>
            <input
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="Ej: 123456789"
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white placeholder-gray-600"
            />
            <p className="text-gray-500 mt-0.5">Obtenerlo con @userinfobot en Telegram</p>
          </div>

          {error && <p className="text-red-400">{error}</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-1.5 rounded bg-[#2196f3] hover:bg-blue-500 text-white font-medium disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Guardar alerta"}
          </button>
        </div>
      )}

      {/* Lista de alertas */}
      {loading ? (
        <p className="text-xs text-gray-500">Cargando…</p>
      ) : alerts.length === 0 ? (
        <p className="text-xs text-gray-500">Sin alertas activas. Crea una con <span className="text-[#2196f3]">+ Alerta</span>.</p>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-white">{alert.symbol}</span>
                  <span className="text-gray-500 ml-1">{alert.market}</span>
                  <p className="text-gray-400 mt-0.5">
                    {condLabel(alert.condition_type, alert.condition_params)}
                  </p>
                  {alert.telegram_chat_id && (
                    <p className="text-blue-400 mt-0.5">✈ Telegram activo</p>
                  )}
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleTest(alert.id)}
                    title="Evaluar ahora"
                    className="text-gray-400 hover:text-yellow-400 transition"
                  >
                    ▶
                  </button>
                  <button
                    onClick={() => handleDelete(alert.id)}
                    title="Eliminar"
                    className="text-gray-400 hover:text-red-400 transition"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Resultado del test */}
              {testResult?.id === alert.id && (
                <div className={`mt-2 rounded px-2 py-1 ${
                  testResult.triggered ? "bg-green-900/50 text-green-300" : "bg-gray-800 text-gray-400"
                }`}>
                  {testResult.triggered
                    ? `✓ ${testResult.message.replace(/<[^>]+>/g, "")}`
                    : "Condición no cumplida aún"}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
