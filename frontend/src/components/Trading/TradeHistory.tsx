"use client";

import { useEffect, useState } from "react";
import { Trade, listTrades, closeTrade, deleteTrade } from "@/lib/tradeApi";

function fmt(n: number) {
  if (n >= 1) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 6 });
}

export default function TradeHistory() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [filter, setFilter] = useState<"all" | "open" | "closed">("all");
  const [closing, setClosing] = useState<number | null>(null);
  const [exitPrice, setExitPrice] = useState("");
  const [closeStatus, setCloseStatus] = useState<"closed" | "stopped">("closed");

  async function load() {
    try {
      const data = await listTrades(filter === "all" ? undefined : filter);
      setTrades(data);
    } catch { /* silencioso */ }
  }

  useEffect(() => { load(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleClose(id: number) {
    const price = parseFloat(exitPrice);
    if (!price || price <= 0) return;
    try {
      await closeTrade(id, price, closeStatus);
      setClosing(null);
      setExitPrice("");
      load();
    } catch { /* silencioso */ }
  }

  async function handleDelete(id: number) {
    try {
      await deleteTrade(id);
      load();
    } catch { /* silencioso */ }
  }

  const openTrades = trades.filter(t => t.status === "open");
  const closedTrades = trades.filter(t => t.status !== "open");
  const totalPnl = closedTrades.reduce((s, t) => s + (t.pnl ?? 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
          Historial de Trades
        </h2>
        <button onClick={load} className="text-xs text-gray-500 hover:text-gray-300">↻</button>
      </div>

      {/* Filtros */}
      <div className="flex gap-1 text-xs">
        {(["all", "open", "closed"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-2 py-0.5 rounded border transition ${
              filter === f ? "bg-[#2196f3] border-[#2196f3] text-white" : "border-gray-700 text-gray-400"
            }`}>
            {f === "all" ? "Todos" : f === "open" ? "Abiertos" : "Cerrados"}
          </button>
        ))}
      </div>

      {/* Resumen P&L */}
      {closedTrades.length > 0 && (
        <div className={`text-xs rounded px-3 py-2 border ${totalPnl >= 0 ? "bg-green-900/20 border-green-800" : "bg-red-900/20 border-red-800"}`}>
          <span className="text-gray-400">P&L total cerradas: </span>
          <span className={`font-bold ${totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
            {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
          </span>
        </div>
      )}

      {trades.length === 0 && (
        <p className="text-xs text-gray-600">No hay operaciones registradas</p>
      )}

      <div className="space-y-2">
        {trades.map(trade => {
          const isLong = trade.direction === "long";
          const isOpen = trade.status === "open";
          return (
            <div key={trade.id} className="bg-gray-900 border border-gray-700 rounded-lg p-3 space-y-2 text-xs">

              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white">{trade.symbol}</span>
                  <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${isLong ? "bg-green-900 text-green-400" : "bg-red-900 text-red-400"}`}>
                    {isLong ? "LONG" : "SHORT"} {trade.leverage}x
                  </span>
                  <span className={`text-xs ${isOpen ? "text-blue-400" : trade.status === "stopped" ? "text-red-400" : "text-gray-500"}`}>
                    ● {isOpen ? "Abierta" : trade.status === "stopped" ? "Stop" : "Cerrada"}
                  </span>
                </div>
                <button onClick={() => handleDelete(trade.id)} className="text-gray-600 hover:text-red-400 transition">✕</button>
              </div>

              {/* Niveles */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Entrada</span>
                  <span className="text-white">{fmt(trade.entry_price)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Capital</span>
                  <span className="text-white">${trade.capital}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-red-400">Stop</span>
                  <span className="text-red-400">{fmt(trade.stop_loss)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-yellow-500">Liq.</span>
                  <span className="text-yellow-400">{fmt(trade.liquidation_price)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-green-400">TP1</span>
                  <span className="text-green-400">{fmt(trade.tp1)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-green-400">TP2</span>
                  <span className="text-green-400">{fmt(trade.tp2)}</span>
                </div>
              </div>

              {/* P&L (trades cerradas) */}
              {!isOpen && trade.pnl !== null && (
                <div className={`flex justify-between border-t border-gray-800 pt-1.5 font-semibold ${trade.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                  <span>P&L</span>
                  <span>{trade.pnl >= 0 ? "+" : ""}${trade.pnl.toFixed(2)} ({trade.pnl_pct?.toFixed(1)}%)</span>
                </div>
              )}

              {/* Cerrar trade */}
              {isOpen && (
                closing === trade.id ? (
                  <div className="border-t border-gray-800 pt-2 space-y-1.5">
                    <div className="flex gap-1">
                      <input type="number" value={exitPrice} onChange={e => setExitPrice(e.target.value)}
                        placeholder="Precio de salida" step="any"
                        className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-[#2196f3]" />
                      <select value={closeStatus} onChange={e => setCloseStatus(e.target.value as "closed" | "stopped")}
                        className="bg-gray-800 border border-gray-700 rounded px-1 text-xs text-white">
                        <option value="closed">TP</option>
                        <option value="stopped">SL</option>
                      </select>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => handleClose(trade.id)}
                        className="flex-1 py-1 bg-[#2196f3] rounded text-white text-xs font-semibold">
                        Confirmar
                      </button>
                      <button onClick={() => setClosing(null)}
                        className="flex-1 py-1 bg-gray-700 rounded text-gray-300 text-xs">
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setClosing(trade.id)}
                    className="w-full py-1 border border-gray-600 rounded text-gray-400 hover:text-white hover:border-gray-400 transition text-xs">
                    Cerrar operación
                  </button>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
