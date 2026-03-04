"use client";

import { useEffect, useRef, useState } from "react";
import { fetchChart } from "@/lib/api";

interface Props {
  symbol: string;
  market: string;
  interval: string;
  period: string;
  indicators: string;
}

export default function ChartPanel({ symbol, market, interval, period, indicators }: Props) {
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

        // Plotly se carga dinámicamente para evitar SSR issues
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Plotly = (await import("plotly.js-dist-min")) as any;
        const figure = JSON.parse(chart);

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
  }, [symbol, market, interval, period, indicators]);

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
