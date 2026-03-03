"use client";

import { useState, useMemo } from "react";

export default function RiskCalculator() {
  const [capital, setCapital]     = useState("10000");
  const [riskPct, setRiskPct]     = useState("1");
  const [entry, setEntry]         = useState("");
  const [stopLoss, setStopLoss]   = useState("");
  const [target, setTarget]       = useState("");

  const result = useMemo(() => {
    const cap  = parseFloat(capital);
    const risk = parseFloat(riskPct) / 100;
    const ent  = parseFloat(entry);
    const sl   = parseFloat(stopLoss);
    const tgt  = parseFloat(target);

    if (!cap || !risk || !ent || !sl || ent <= sl) return null;

    const riskAmount  = cap * risk;
    const riskPerShare = ent - sl;
    const shares      = Math.floor(riskAmount / riskPerShare);
    const totalCost   = shares * ent;
    const maxLoss     = shares * riskPerShare;
    const rr          = tgt && tgt > ent ? (tgt - ent) / riskPerShare : null;

    return { shares, totalCost, maxLoss, riskAmount, rr };
  }, [capital, riskPct, entry, stopLoss, target]);

  const inputClass =
    "w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-[#2196f3]";
  const labelClass = "text-gray-400 text-xs block mb-0.5";

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
        Calculadora de riesgo
      </h2>

      <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelClass}>Capital ($)</label>
            <input type="number" value={capital} onChange={e => setCapital(e.target.value)}
              min={0} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Riesgo (%)</label>
            <input type="number" value={riskPct} onChange={e => setRiskPct(e.target.value)}
              min={0.1} max={100} step={0.1} className={inputClass} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className={labelClass}>Entrada</label>
            <input type="number" value={entry} onChange={e => setEntry(e.target.value)}
              placeholder="0.00" min={0} step={0.01} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Stop Loss</label>
            <input type="number" value={stopLoss} onChange={e => setStopLoss(e.target.value)}
              placeholder="0.00" min={0} step={0.01} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Objetivo</label>
            <input type="number" value={target} onChange={e => setTarget(e.target.value)}
              placeholder="0.00" min={0} step={0.01} className={inputClass} />
          </div>
        </div>

        {result ? (
          <div className="border-t border-gray-700 pt-2 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">Acciones a comprar</span>
              <span className="font-bold text-white text-sm">{result.shares}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Inversión total</span>
              <span className="text-white">${result.totalCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Pérdida máxima</span>
              <span className="text-red-400">-${result.maxLoss.toFixed(2)}</span>
            </div>
            {result.rr !== null && (
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Ratio R/B</span>
                <span className={`font-bold ${result.rr >= 2 ? "text-green-400" : result.rr >= 1 ? "text-yellow-400" : "text-red-400"}`}>
                  1 : {result.rr.toFixed(1)}
                  {result.rr < 1 && " ⚠️"}
                  {result.rr >= 2 && " ✓"}
                </span>
              </div>
            )}
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
