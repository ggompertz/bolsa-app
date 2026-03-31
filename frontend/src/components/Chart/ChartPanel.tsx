"use client";

import { useEffect, useRef, useState } from "react";
import { fetchChart } from "@/lib/api";
import { TradingLevels } from "@/lib/tradeApi";

interface Props {
  symbol: string;
  market: string;
  interval: string;
  period: string;
  indicators: string;
  tradingLevels?: TradingLevels | null;
}

function buildTradingShapes(levels: TradingLevels) {
  const isLong = levels.direction === "long";
  const lines = [
    { y: levels.liquidation, color: "#f59e0b", dash: "dot",  label: `LIQ ${levels.liquidation}` },
    { y: levels.stopLoss,    color: "#ef4444", dash: "dash", label: `SL ${levels.stopLoss}` },
    { y: levels.entry,       color: "#e2e8f0", dash: "solid",label: `Entrada ${levels.entry}` },
    { y: levels.tp1,         color: "#4ade80", dash: "dash", label: `TP1 ${levels.tp1}` },
    { y: levels.tp2,         color: "#22c55e", dash: "dash", label: `TP2 ${levels.tp2}` },
    { y: levels.tp3,         color: "#16a34a", dash: "dash", label: `TP3 ${levels.tp3}` },
  ];

  // Zona de riesgo (entrada → stop loss)
  const shapes = [
    {
      type: "rect",
      xref: "paper", yref: "y",
      x0: 0, x1: 1,
      y0: Math.min(levels.entry, levels.stopLoss),
      y1: Math.max(levels.entry, levels.stopLoss),
      fillcolor: isLong ? "rgba(239,68,68,0.08)" : "rgba(239,68,68,0.08)",
      line: { width: 0 },
      layer: "below",
    },
    ...lines.map(l => ({
      type: "line",
      xref: "paper", yref: "y",
      x0: 0, x1: 1,
      y0: l.y, y1: l.y,
      line: { color: l.color, width: 1, dash: l.dash },
    })),
  ];

  const annotations = lines.map(l => ({
    xref: "paper", yref: "y",
    x: 1, y: l.y,
    xanchor: "right",
    text: l.label,
    showarrow: false,
    font: { size: 10, color: l.color },
    bgcolor: "rgba(19,23,34,0.8)",
    borderpad: 2,
  }));

  return { shapes, annotations };
}

export default function ChartPanel({ symbol, market, interval, period, indicators, tradingLevels }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadChart = async () => {
      setLoading(true);
      setError(null);
      try {
        const { chart } = await fetchChart(symbol, market, interval, period, indicators);
        if (cancelled) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Plotly = (await import("plotly.js-dist-min")) as any;
        const figure = JSON.parse(chart);

        // Agregar líneas de trading si hay niveles activos
        if (tradingLevels) {
          const { shapes, annotations } = buildTradingShapes(tradingLevels);
          figure.layout.shapes = [...(figure.layout.shapes ?? []), ...shapes];
          figure.layout.annotations = [...(figure.layout.annotations ?? []), ...annotations];
        }

        if (containerRef.current) {
          await Plotly.react(containerRef.current, figure.data, figure.layout, {
            responsive: true,
            displaylogo: false,
            scrollZoom: true,
            modeBarButtonsToRemove: ["lasso2d", "select2d", "autoScale2d"],
            modeBarButtonsToAdd: ["resetScale2d"],
          });
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error al cargar gráfico");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadChart();
    return () => { cancelled = true; };
  }, [symbol, market, interval, period, indicators, tradingLevels]);

  return (
    <div className="relative w-full">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#131722]/80 z-10 rounded">
          <span className="text-[#2196f3] text-sm">Cargando {symbol}...</span>
        </div>
      )}
      {error && (
        <div className="text-red-400 text-sm p-4 bg-red-900/20 rounded border border-red-800">
          {error}
        </div>
      )}
      <div ref={containerRef} style={{ width: "100%", minHeight: 480 }} />
    </div>
  );
}
