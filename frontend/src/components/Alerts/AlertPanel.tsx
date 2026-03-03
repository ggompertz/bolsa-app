"use client";

import { useEffect, useState } from "react";
import {
  listAlerts, createAlert, deleteAlert, testAlert,
  type Alert, type ConditionType,
  CONDITION_LABELS, CANDLE_PATTERNS,
} from "@/lib/alertApi";

interface Props {
  currentSymbol: string;
  currentMarket: string;
}

const SIMPLE_CONDITIONS: ConditionType[] = [
  "rsi_overbought", "rsi_oversold", "candle_pattern", "volume_anomaly", "breakout",
];

interface SubCondition {
  type: ConditionType;
  threshold?: string;
  pattern?: string;
  multiplier?: string;
}

const DEFAULT_SUB: SubCondition = { type: "rsi_oversold", threshold: "30" };

export default function AlertPanel({ currentSymbol, currentMarket }: Props) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [testResult, setTestResult] = useState<{ id: number; triggered: boolean; message: string } | null>(null);

  // Form
  const [symbol, setSymbol]         = useState(currentSymbol);
  const [market, setMarket]         = useState(currentMarket);
  const [condType, setCondType]     = useState<ConditionType>("rsi_overbought");
  const [threshold, setThreshold]   = useState("70");
  const [pattern, setPattern]       = useState("Hammer");
  const [multiplier, setMultiplier] = useState("2.0");
  const [chatId, setChatId]         = useState("");
  const [cooldown, setCooldown]     = useState("24");
  // Confluencia
  const [subConds, setSubConds]     = useState<SubCondition[]>([DEFAULT_SUB, DEFAULT_SUB]);
  const [minMatch, setMinMatch]     = useState("2");

  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  useEffect(() => { setSymbol(currentSymbol); setMarket(currentMarket); }, [currentSymbol, currentMarket]);
  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try { setAlerts(await listAlerts()); } catch { /* silencioso */ } finally { setLoading(false); }
  };

  const buildParams = (): Record<string, unknown> => {
    if (condType === "rsi_overbought" || condType === "rsi_oversold") return { threshold: parseFloat(threshold) };
    if (condType === "candle_pattern")  return { pattern };
    if (condType === "volume_anomaly")  return { multiplier: parseFloat(multiplier) };
    if (condType === "confluence") {
      return {
        min_match: parseInt(minMatch),
        conditions: subConds.map(sc => ({
          type: sc.type,
          params: sc.type === "rsi_overbought" || sc.type === "rsi_oversold"
            ? { threshold: parseFloat(sc.threshold ?? "30") }
            : sc.type === "candle_pattern"
            ? { pattern: sc.pattern ?? "Hammer" }
            : sc.type === "volume_anomaly"
            ? { multiplier: parseFloat(sc.multiplier ?? "2") }
            : {},
        })),
      };
    }
    return {};
  };

  const handleSave = async () => {
    setError("");
    setSaving(true);
    try {
      await createAlert({
        symbol, market, condition_type: condType,
        condition_params: buildParams(),
        telegram_chat_id: chatId.trim() || undefined,
        cooldown_hours: parseInt(cooldown) || 24,
      });
      setShowForm(false);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    try { await deleteAlert(id); setAlerts(prev => prev.filter(a => a.id !== id)); } catch { /* */ }
  };

  const handleTest = async (id: number) => {
    try {
      const r = await testAlert(id);
      setTestResult({ id, ...r });
      setTimeout(() => setTestResult(null), 5000);
    } catch { /* */ }
  };

  const updateSubCond = (i: number, patch: Partial<SubCondition>) => {
    setSubConds(prev => prev.map((sc, idx) => idx === i ? { ...sc, ...patch } : sc));
  };

  const condLabel = (type: ConditionType, params: Record<string, unknown>) => {
    if (type === "rsi_overbought") return `RSI > ${params.threshold ?? 70}`;
    if (type === "rsi_oversold")   return `RSI < ${params.threshold ?? 30}`;
    if (type === "candle_pattern") return `Vela: ${params.pattern ?? "—"}`;
    if (type === "volume_anomaly") return `Vol × ${params.multiplier ?? 2}`;
    if (type === "breakout")       return "Ruptura S/R";
    if (type === "confluence") {
      const conds = (params.conditions as { type: string }[] | undefined) ?? [];
      return `Confluencia ${params.min_match ?? 2}/${conds.length}`;
    }
    return type;
  };

  const inputCls = "w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs";
  const labelCls = "text-gray-400 text-xs block mb-0.5";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Alertas</h2>
        <button onClick={() => { setShowForm(!showForm); setError(""); }}
          className="text-xs px-2 py-1 rounded bg-[#2196f3] hover:bg-blue-500 text-white">
          {showForm ? "Cancelar" : "+ Alerta"}
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 space-y-2 text-xs">
          {/* Símbolo y mercado */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className={labelCls}>Símbolo</label>
              <input value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Mercado</label>
              <select value={market} onChange={e => setMarket(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs">
                <option value="US">USA</option>
                <option value="CL">Chile</option>
                <option value="CRYPTO">Cripto</option>
              </select>
            </div>
          </div>

          {/* Condición */}
          <div>
            <label className={labelCls}>Condición</label>
            <select value={condType} onChange={e => {
              const ct = e.target.value as ConditionType;
              setCondType(ct);
              if (ct === "rsi_overbought") setThreshold("70");
              if (ct === "rsi_oversold")   setThreshold("30");
            }} className={inputCls}>
              {(Object.keys(CONDITION_LABELS) as ConditionType[]).map(ct => (
                <option key={ct} value={ct}>{CONDITION_LABELS[ct]}</option>
              ))}
            </select>
          </div>

          {/* Parámetros condición simple */}
          {(condType === "rsi_overbought" || condType === "rsi_oversold") && (
            <div>
              <label className={labelCls}>Umbral RSI</label>
              <input type="number" value={threshold} onChange={e => setThreshold(e.target.value)}
                min={0} max={100} className={inputCls} />
            </div>
          )}
          {condType === "candle_pattern" && (
            <div>
              <label className={labelCls}>Patrón</label>
              <select value={pattern} onChange={e => setPattern(e.target.value)} className={inputCls}>
                {CANDLE_PATTERNS.map(p => <option key={p} value={p}>{p.replace(/_/g, " ")}</option>)}
              </select>
            </div>
          )}
          {condType === "volume_anomaly" && (
            <div>
              <label className={labelCls}>Multiplicador</label>
              <input type="number" value={multiplier} onChange={e => setMultiplier(e.target.value)}
                min={1} step={0.5} className={inputCls} />
            </div>
          )}

          {/* Confluencia */}
          {condType === "confluence" && (
            <div className="space-y-2 border border-gray-700 rounded p-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Condiciones (mínimo</span>
                <select value={minMatch} onChange={e => setMinMatch(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-white text-xs w-12">
                  {["1","2","3"].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <span className="text-gray-400">deben cumplirse)</span>
              </div>
              {subConds.map((sc, i) => (
                <div key={i} className="bg-gray-800 rounded p-2 space-y-1">
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500 w-3">{i + 1}.</span>
                    <select value={sc.type} onChange={e => updateSubCond(i, { type: e.target.value as ConditionType })}
                      className="flex-1 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-white text-xs">
                      {SIMPLE_CONDITIONS.map(ct => <option key={ct} value={ct}>{CONDITION_LABELS[ct]}</option>)}
                    </select>
                  </div>
                  {(sc.type === "rsi_overbought" || sc.type === "rsi_oversold") && (
                    <input type="number" value={sc.threshold ?? "30"}
                      onChange={e => updateSubCond(i, { threshold: e.target.value })}
                      placeholder="Umbral" className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-0.5 text-white text-xs" />
                  )}
                  {sc.type === "candle_pattern" && (
                    <select value={sc.pattern ?? "Hammer"} onChange={e => updateSubCond(i, { pattern: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-white text-xs">
                      {CANDLE_PATTERNS.map(p => <option key={p} value={p}>{p.replace(/_/g, " ")}</option>)}
                    </select>
                  )}
                  {sc.type === "volume_anomaly" && (
                    <input type="number" value={sc.multiplier ?? "2"}
                      onChange={e => updateSubCond(i, { multiplier: e.target.value })}
                      placeholder="Multiplicador" className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-0.5 text-white text-xs" />
                  )}
                </div>
              ))}
              <div className="flex gap-1">
                {subConds.length < 4 && (
                  <button onClick={() => setSubConds(p => [...p, DEFAULT_SUB])}
                    className="text-xs px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300">
                    + condición
                  </button>
                )}
                {subConds.length > 2 && (
                  <button onClick={() => setSubConds(p => p.slice(0, -1))}
                    className="text-xs px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600 text-red-400">
                    − quitar
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Cooldown */}
          <div>
            <label className={labelCls}>Cooldown (horas entre disparos)</label>
            <select value={cooldown} onChange={e => setCooldown(e.target.value)} className={inputCls}>
              <option value="0">Sin cooldown</option>
              <option value="1">1 hora</option>
              <option value="4">4 horas</option>
              <option value="24">24 horas</option>
              <option value="72">3 días</option>
            </select>
          </div>

          {/* Telegram */}
          <div>
            <label className={labelCls}>Chat ID Telegram (opcional)</label>
            <input value={chatId} onChange={e => setChatId(e.target.value)} placeholder="Ej: 123456789"
              className={`${inputCls} placeholder-gray-600`} />
            <p className="text-gray-500 mt-0.5">Obtenerlo con @userinfobot en Telegram</p>
          </div>

          {error && <p className="text-red-400">{error}</p>}
          <button onClick={handleSave} disabled={saving}
            className="w-full py-1.5 rounded bg-[#2196f3] hover:bg-blue-500 text-white font-medium disabled:opacity-50 text-xs">
            {saving ? "Guardando…" : "Guardar alerta"}
          </button>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <p className="text-xs text-gray-500">Cargando…</p>
      ) : alerts.length === 0 ? (
        <p className="text-xs text-gray-500">Sin alertas activas.</p>
      ) : (
        <div className="space-y-2">
          {alerts.map(alert => (
            <div key={alert.id} className="bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-white">{alert.symbol}</span>
                  <span className="text-gray-500 ml-1">{alert.market}</span>
                  <p className="text-gray-400 mt-0.5">{condLabel(alert.condition_type, alert.condition_params)}</p>
                  <p className="text-gray-600 mt-0.5">
                    Cooldown: {alert.cooldown_hours}h
                    {alert.last_triggered_at && (
                      <> · Último: {new Date(alert.last_triggered_at).toLocaleDateString("es-CL")}</>
                    )}
                  </p>
                  {alert.telegram_chat_id && <p className="text-blue-400 mt-0.5">✈ Telegram activo</p>}
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button onClick={() => handleTest(alert.id)} title="Evaluar ahora"
                    className="text-gray-400 hover:text-yellow-400 transition">▶</button>
                  <button onClick={() => handleDelete(alert.id)} title="Eliminar"
                    className="text-gray-400 hover:text-red-400 transition">✕</button>
                </div>
              </div>
              {testResult?.id === alert.id && (
                <div className={`mt-2 rounded px-2 py-1 ${testResult.triggered ? "bg-green-900/50 text-green-300" : "bg-gray-800 text-gray-400"}`}>
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
