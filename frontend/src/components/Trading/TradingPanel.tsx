"use client";

import { useState, useMemo } from "react";
import { calcLevels, saveTrade, TradingLevels, Direction } from "@/lib/tradeApi";

interface Props {
  symbol: string;
  market: string;
  lastPrice?: number;
  onLevelsChange?: (levels: TradingLevels | null) => void;
}

const LEVERAGES = [20, 50, 100, 200];

function fmt(n: number, decimals = 2) {
  if (n >= 1) return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  // Para cripto con precios pequeños, mostrar más decimales
  return n.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 6 });
}

export default function TradingPanel({ symbol, market, lastPrice, onLevelsChange }: Props) {
  const [direction, setDirection] = useState<Direction>("long");
  const [leverage, setLeverage] = useState(20);
  const [entry, setEntry] = useState(lastPrice ? String(lastPrice) : "");
  const [stopLoss, setStopLoss] = useState("");
  const [capital, setCapital] = useState("1000");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const levels = useMemo(() => {
    const e = parseFloat(entry);
    const sl = parseFloat(stopLoss);
    const cap = parseFloat(capital);
    const result = calcLevels(direction, leverage, e, sl, cap);
    onLevelsChange?.(result);
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direction, leverage, entry, stopLoss, capital]);

  async function handleSave() {
    if (!levels) return;
    setSaving(true);
    try {
      await saveTrade(symbol, market, levels);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // silencioso
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-[#2196f3]";
  const labelCls = "text-gray-400 text-xs block mb-0.5";

  const isLong = direction === "long";
  const dirColor = isLong ? "text-green-400" : "text-red-400";

  // Validaciones visuales
  const slInvalid = stopLoss !== "" && entry !== "" && (
    isLong ? parseFloat(stopLoss) >= parseFloat(entry)
           : parseFloat(stopLoss) <= parseFloat(entry)
  );

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
        Trading Apalancado
      </h2>

      <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 space-y-3">

        {/* Long / Short */}
        <div className="flex rounded overflow-hidden border border-gray-700 text-xs font-semibold">
          <button
            onClick={() => setDirection("long")}
            className={`flex-1 py-1.5 transition ${direction === "long" ? "bg-green-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}
          >
            LONG ↑
          </button>
          <button
            onClick={() => setDirection("short")}
            className={`flex-1 py-1.5 transition ${direction === "short" ? "bg-red-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}
          >
            SHORT ↓
          </button>
        </div>

        {/* Leverage */}
        <div>
          <label className={labelCls}>Apalancamiento</label>
          <div className="flex gap-1">
            {LEVERAGES.map(lv => (
              <button
                key={lv}
                onClick={() => setLeverage(lv)}
                className={`flex-1 py-1 rounded text-xs border transition ${
                  leverage === lv
                    ? "bg-[#2196f3] border-[#2196f3] text-white font-bold"
                    : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white"
                }`}
              >
                {lv}x
              </button>
            ))}
          </div>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className={labelCls}>Capital ($)</label>
            <input type="number" value={capital} onChange={e => setCapital(e.target.value)}
              min={0} step={100} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Entrada</label>
            <input type="number" value={entry} onChange={e => setEntry(e.target.value)}
              placeholder={lastPrice ? String(lastPrice) : "0.00"} min={0} step="any" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Stop Loss</label>
            <input type="number" value={stopLoss} onChange={e => setStopLoss(e.target.value)}
              placeholder="0.00" min={0} step="any"
              className={`${inputCls} ${slInvalid ? "border-red-500" : ""}`} />
          </div>
        </div>
        {slInvalid && (
          <p className="text-xs text-red-400">
            {isLong ? "Stop loss debe ser menor que la entrada" : "Stop loss debe ser mayor que la entrada"}
          </p>
        )}

        {/* Resultados */}
        {levels ? (
          <div className="border-t border-gray-700 pt-2 space-y-1.5 text-xs">

            <div className="flex justify-between">
              <span className="text-gray-400">Dirección</span>
              <span className={`font-bold ${dirColor}`}>{isLong ? "LONG ↑" : "SHORT ↓"} {leverage}x</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-400">Posición</span>
              <span className="text-white">{levels.positionSize} {symbol.replace("-USD","")}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-400">Exposición</span>
              <span className="text-white">${(levels.capital * leverage).toLocaleString("en-US", {maximumFractionDigits: 0})}</span>
            </div>

            <div className="border-t border-gray-800 pt-1.5 space-y-1">
              <div className="flex justify-between">
                <span className="text-yellow-500">⚠ Liquidación</span>
                <span className="text-yellow-400 font-bold">{fmt(levels.liquidation)}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-red-400">✕ Stop Loss</span>
                <span className="text-red-400">{fmt(levels.stopLoss)}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-300">→ Entrada</span>
                <span className="text-white font-semibold">{fmt(levels.entry)}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-green-400">✓ TP1 (1:1)</span>
                <span className="text-green-400">{fmt(levels.tp1)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-400">✓ TP2 (1:2)</span>
                <span className="text-green-400">{fmt(levels.tp2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-400">✓ TP3 (1:3)</span>
                <span className="text-green-400">{fmt(levels.tp3)}</span>
              </div>
            </div>

            <div className="border-t border-gray-800 pt-1.5 flex justify-between">
              <span className="text-gray-400">Pérdida máx.</span>
              <span className="text-red-400 font-bold">
                -${levels.maxLoss.toFixed(2)} ({levels.maxLossPct.toFixed(1)}%)
              </span>
            </div>

            {levels.maxLossPct >= 100 && (
              <p className="text-xs text-yellow-400 bg-yellow-900/20 rounded px-2 py-1">
                ⚠ Con este stop loss perderías todo el capital
              </p>
            )}

            <button
              onClick={handleSave}
              disabled={saving || saved}
              className={`w-full mt-1 py-1.5 rounded text-xs font-semibold transition ${
                saved
                  ? "bg-green-700 text-white"
                  : "bg-[#2196f3] hover:bg-[#1976d2] text-white disabled:opacity-50"
              }`}
            >
              {saved ? "✓ Guardado en historial" : saving ? "Guardando..." : "Guardar operación"}
            </button>
          </div>
        ) : (
          <p className="text-xs text-gray-600 pt-1">
            Ingresa entrada y stop loss para calcular
          </p>
        )}
      </div>
    </div>
  );
}
