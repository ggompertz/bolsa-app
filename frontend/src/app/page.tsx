"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import StockSearch from "@/components/StockSearch/StockSearch";
import ChartPanel from "@/components/Chart/ChartPanel";
import AnalysisPanel from "@/components/Dashboard/AnalysisPanel";
import AlertPanel from "@/components/Alerts/AlertPanel";
import AlertBanner from "@/components/Alerts/AlertBanner";
import TradingPanel from "@/components/Trading/TradingPanel";
import TradeHistory from "@/components/Trading/TradeHistory";
import { logout, authHeaders } from "@/lib/auth";
import { TradingLevels } from "@/lib/tradeApi";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const INDICATORS = ["SMA_20","SMA_50","SMA_200","EMA_9","BB_Upper","GMMA","ADX","Volume","RSI","MACD"];
type SideTab = "analysis" | "trading" | "alerts";
type MobileTab = "chart" | SideTab;

export default function Home() {
  const router = useRouter();
  const [symbol, setSymbol] = useState("AAPL");
  const [market, setMarket] = useState("US");
  const [interval, setInterval] = useState("1d");
  const [period, setPeriod] = useState("1y");
  const [indicators, setIndicators] = useState("SMA_20,SMA_50,Volume,RSI,MACD");
  const [isAdmin, setIsAdmin] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("chart");
  const [sideTab, setSideTab] = useState<SideTab>("analysis");
  const [lastPrice, setLastPrice] = useState<number | undefined>();
  const [tradingLevels, setTradingLevels] = useState<TradingLevels | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/auth/me`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.is_admin) setIsAdmin(true); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLastPrice(undefined);
    setTradingLevels(null);
  }, [symbol, market]);

  function toggleIndicator(ind: string) {
    const list = indicators.split(",").filter(Boolean);
    const next = list.includes(ind) ? list.filter(i => i !== ind) : [...list, ind];
    setIndicators(next.join(","));
  }

  function handleInterval(iv: string) {
    setInterval(iv);
    if (iv === "1m")                          setPeriod("5d");
    else if (["5m","15m","30m"].includes(iv)) setPeriod("1mo");
    else if (iv === "1h")                     setPeriod("3mo");
  }

  const SIDE_TABS: { key: SideTab; label: string }[] = [
    { key: "analysis", label: "Análisis" },
    { key: "trading",  label: "Trading"  },
    { key: "alerts",   label: "Alertas"  },
  ];

  const MOBILE_TABS: { key: MobileTab; label: string }[] = [
    { key: "chart",    label: "Gráfico"  },
    { key: "analysis", label: "Análisis" },
    { key: "trading",  label: "Trading"  },
    { key: "alerts",   label: "Alertas"  },
  ];

  function SideContent({ tab }: { tab: SideTab }) {
    if (tab === "analysis") return <AnalysisPanel symbol={symbol} market={market} />;
    if (tab === "alerts")   return <AlertPanel currentSymbol={symbol} currentMarket={market} />;
    return (
      <div className="space-y-6">
        <TradingPanel
          symbol={symbol}
          market={market}
          lastPrice={lastPrice}
          onLevelsChange={setTradingLevels}
        />
        <div className="border-t border-gray-800 pt-4">
          <TradeHistory />
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#131722] text-white flex flex-col">

      {/* ── Header ── */}
      <header className="border-b border-gray-800 px-4 py-2 flex items-center gap-3 shrink-0">
        <h1 className="text-lg font-bold text-[#2196f3] shrink-0">Bolsa App</h1>
        <span className="hidden sm:inline text-gray-500 text-xs">Análisis Técnico · Chile & USA</span>

        <div className="flex-1 min-w-0">
          <StockSearch onSelect={(sym, mkt) => { setSymbol(sym); setMarket(mkt); }} />
        </div>

        <div className="flex gap-1 shrink-0">
          <select className="bg-gray-800 text-xs rounded px-1.5 py-1 border border-gray-700"
            value={interval} onChange={e => handleInterval(e.target.value)}>
            <option value="1m">1m</option>
            <option value="5m">5m</option>
            <option value="15m">15m</option>
            <option value="30m">30m</option>
            <option value="1h">1h</option>
            <option value="1d">1D</option>
            <option value="1wk">1S</option>
            <option value="1mo">1M</option>
          </select>
          <select className="bg-gray-800 text-xs rounded px-1.5 py-1 border border-gray-700"
            value={period} onChange={e => setPeriod(e.target.value)}>
            {["1m"].includes(interval) && <option value="5d">5d</option>}
            {["1m","5m","15m","30m"].includes(interval) && <option value="1mo">1m</option>}
            {!["1m"].includes(interval) && <option value="3mo">3m</option>}
            {!["1m","5m","15m","30m"].includes(interval) && <>
              <option value="6mo">6m</option>
              <option value="1y">1a</option>
              <option value="2y">2a</option>
              <option value="5y">5a</option>
              <option value="max">Max</option>
            </>}
          </select>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isAdmin && (
            <button onClick={() => router.push("/admin")}
              className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1 rounded hover:bg-gray-800 transition">
              Usuarios
            </button>
          )}
          <button onClick={logout}
            className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1 rounded hover:bg-gray-800 transition">
            Salir
          </button>
        </div>
      </header>

      {/* ── Indicadores ── */}
      <div className="border-b border-gray-800 px-3 py-2 shrink-0">
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {INDICATORS.map(ind => {
            const active = indicators.split(",").includes(ind);
            return (
              <button key={ind} onClick={() => toggleIndicator(ind)}
                className={`shrink-0 px-2 py-0.5 rounded text-xs border transition ${
                  active ? "bg-[#2196f3] border-[#2196f3] text-white" : "bg-transparent border-gray-600 text-gray-400"
                }`}>
                {ind.replace("_", " ")}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tabs móvil ── */}
      <div className="xl:hidden border-b border-gray-800 flex shrink-0">
        {MOBILE_TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setMobileTab(key)}
            className={`flex-1 py-2 text-xs font-medium transition ${
              mobileTab === key ? "text-[#2196f3] border-b-2 border-[#2196f3]" : "text-gray-500"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Cuerpo ── */}
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-[1fr_320px] min-h-0">

        {/* Gráfico */}
        <div className={`p-3 ${mobileTab !== "chart" ? "hidden xl:block" : ""}`}>
          <ChartPanel
            symbol={symbol} market={market}
            interval={interval} period={period}
            indicators={indicators}
            tradingLevels={tradingLevels}
          />
        </div>

        {/* Panel lateral */}
        <div className={`xl:border-l border-gray-800 overflow-y-auto ${mobileTab === "chart" ? "hidden xl:flex xl:flex-col" : "flex flex-col"}`}>

          {/* Tabs desktop */}
          <div className="hidden xl:flex border-b border-gray-800 shrink-0">
            {SIDE_TABS.map(({ key, label }) => (
              <button key={key} onClick={() => setSideTab(key)}
                className={`px-4 py-2 text-xs font-medium transition border-b-2 ${
                  sideTab === key ? "text-[#2196f3] border-[#2196f3]" : "text-gray-500 border-transparent hover:text-gray-300"
                }`}>
                {label}
              </button>
            ))}
          </div>

          {/* Contenido desktop */}
          <div className="hidden xl:block p-4 flex-1">
            <SideContent tab={sideTab} />
          </div>

          {/* Contenido móvil */}
          <div className="xl:hidden p-4 flex-1">
            <SideContent tab={mobileTab as SideTab} />
          </div>

        </div>
      </div>

      <AlertBanner />
    </main>
  );
}
