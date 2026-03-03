"use client";

import { useState } from "react";
import StockSearch from "@/components/StockSearch/StockSearch";
import ChartPanel from "@/components/Chart/ChartPanel";
import AnalysisPanel from "@/components/Dashboard/AnalysisPanel";
import AlertPanel from "@/components/Alerts/AlertPanel";
import AlertBanner from "@/components/Alerts/AlertBanner";
import RiskCalculator from "@/components/RiskCalculator/RiskCalculator";

export default function Home() {
  const [symbol, setSymbol] = useState("AAPL");
  const [market, setMarket] = useState("US");
  const [interval, setInterval] = useState("1d");
  const [period, setPeriod] = useState("1y");
  const [indicators, setIndicators] = useState(
    "SMA_20,SMA_50,Volume,RSI,MACD"
  );

  return (
    <main className="min-h-screen bg-[#131722] text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-3 flex items-center gap-4">
        <h1 className="text-xl font-bold text-[#2196f3]">Bolsa App</h1>
        <span className="text-gray-500 text-sm">Análisis Técnico · Chile & USA</span>
      </header>

      {/* Barra de búsqueda y controles */}
      <div className="px-6 py-3 border-b border-gray-800 flex flex-wrap gap-3 items-center">
        <StockSearch
          onSelect={(sym, mkt) => {
            setSymbol(sym);
            setMarket(mkt);
          }}
        />

        <select
          className="bg-gray-800 text-sm rounded px-2 py-1 border border-gray-700"
          value={interval}
          onChange={(e) => setInterval(e.target.value)}
        >
          <option value="5m">5 min</option>
          <option value="15m">15 min</option>
          <option value="1h">1 hora</option>
          <option value="1d">Diario</option>
          <option value="1wk">Semanal</option>
          <option value="1mo">Mensual</option>
        </select>

        <select
          className="bg-gray-800 text-sm rounded px-2 py-1 border border-gray-700"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        >
          <option value="1mo">1 mes</option>
          <option value="3mo">3 meses</option>
          <option value="6mo">6 meses</option>
          <option value="1y">1 año</option>
          <option value="2y">2 años</option>
          <option value="5y">5 años</option>
          <option value="max">Máximo</option>
        </select>

        <div className="flex flex-wrap gap-2 text-sm">
          {["SMA_20","SMA_50","SMA_200","EMA_9","BB_Upper","GMMA","ADX","Volume","RSI","MACD"].map((ind) => {
            const active = indicators.split(",").includes(ind);
            return (
              <button
                key={ind}
                className={`px-2 py-0.5 rounded text-xs border transition ${
                  active
                    ? "bg-[#2196f3] border-[#2196f3] text-white"
                    : "bg-transparent border-gray-600 text-gray-400 hover:border-gray-400"
                }`}
                onClick={() => {
                  const list = indicators.split(",").filter(Boolean);
                  const next = active
                    ? list.filter((i) => i !== ind)
                    : [...list, ind];
                  setIndicators(next.join(","));
                }}
              >
                {ind.replace("_", " ")}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cuerpo principal */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-0">
        {/* Gráfico */}
        <div className="p-4">
          <ChartPanel
            symbol={symbol}
            market={market}
            interval={interval}
            period={period}
            indicators={indicators}
          />
        </div>

        {/* Panel lateral: análisis + calculadora + alertas */}
        <div className="border-l border-gray-800 p-4 space-y-6">
          <AnalysisPanel symbol={symbol} market={market} />
          <div className="border-t border-gray-800 pt-4">
            <RiskCalculator />
          </div>
          <div className="border-t border-gray-800 pt-4">
            <AlertPanel currentSymbol={symbol} currentMarket={market} />
          </div>
        </div>
      </div>

      {/* Banner flotante de notificaciones */}
      <AlertBanner />
    </main>
  );
}
