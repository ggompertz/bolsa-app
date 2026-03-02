"use client";

import { useEffect, useState } from "react";
import { fetchAnalysis } from "@/lib/api";

interface Analysis {
  symbol: string;
  last_price: number;
  last_volume: number;
  volume_signal: string;
  rsi: number;
  macd: number;
  support_resistance: { support: number[]; resistance: number[] };
  triangle_pattern: { type: string | null };
  breakout: { type: string | null; level: number | null; confirmed: boolean; false_breakout_risk: boolean };
  candle_patterns: Record<string, boolean>;
  absorption_signal: boolean;
}

const SIGNAL_LABELS: Record<string, { label: string; color: string }> = {
  IMPULSO_ALCISTA:       { label: "Impulso Alcista",       color: "text-green-400" },
  IMPULSO_BAJISTA:       { label: "Impulso Bajista",       color: "text-red-400" },
  DEBILIDAD_ALCISTA:     { label: "Debilidad Alcista",     color: "text-yellow-400" },
  CONTRACCION_BAJISTA:   { label: "Contracción Bajista",   color: "text-orange-400" },
  ACUMULACION_DISTRIBUCION: { label: "Acumulación/Dist.",  color: "text-blue-400" },
  NEUTRO:                { label: "Neutro",                color: "text-gray-400" },
};

const PATTERN_LABELS: Record<string, string> = {
  Doji: "Doji",
  Hammer: "Martillo",
  Shooting_Star: "Estrella Fugaz",
  Bullish_Engulfing: "Envolvente Alcista",
  Bearish_Engulfing: "Envolvente Bajista",
  Morning_Star: "Estrella Mañana",
};

export default function AnalysisPanel({ symbol, market }: { symbol: string; market: string }) {
  const [data, setData] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchAnalysis(symbol, market)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [symbol, market]);

  if (loading) return <p className="text-gray-500 text-sm p-2">Analizando...</p>;
  if (error)   return <p className="text-red-400 text-sm p-2">{error}</p>;
  if (!data)   return null;

  const volSignal = SIGNAL_LABELS[data.volume_signal] ?? SIGNAL_LABELS.NEUTRO;
  const activePatterns = Object.entries(data.candle_patterns)
    .filter(([, v]) => v)
    .map(([k]) => PATTERN_LABELS[k] ?? k);

  const rsiColor =
    data.rsi > 70 ? "text-red-400" :
    data.rsi < 30 ? "text-green-400" : "text-white";

  return (
    <div className="text-sm space-y-4">
      <h2 className="font-bold text-[#2196f3] text-base">{data.symbol}</h2>

      {/* Precio y volumen */}
      <section>
        <Row label="Último precio" value={data.last_price.toLocaleString()} />
        <Row label="Volumen" value={Number(data.last_volume).toLocaleString()} />
      </section>

      <Divider />

      {/* Indicadores */}
      <section>
        <Label>Indicadores</Label>
        <Row label="RSI (14)" value={<span className={rsiColor}>{data.rsi}</span>} />
        <Row label="MACD" value={
          <span className={data.macd >= 0 ? "text-green-400" : "text-red-400"}>
            {data.macd}
          </span>
        } />
      </section>

      <Divider />

      {/* Señal de volumen */}
      <section>
        <Label>Volumen</Label>
        <p className={`font-medium ${volSignal.color}`}>{volSignal.label}</p>
        {data.absorption_signal && (
          <p className="text-blue-400 text-xs mt-1">Absorción de capital detectada</p>
        )}
      </section>

      <Divider />

      {/* Patrones de velas */}
      <section>
        <Label>Velas (última barra)</Label>
        {activePatterns.length > 0
          ? activePatterns.map((p) => (
              <span key={p} className="inline-block bg-gray-800 text-xs px-2 py-0.5 rounded mr-1 mb-1">
                {p}
              </span>
            ))
          : <p className="text-gray-500 text-xs">Sin patrones activos</p>
        }
      </section>

      <Divider />

      {/* Soportes y resistencias */}
      <section>
        <Label>Resistencias</Label>
        {data.support_resistance.resistance.slice(-3).reverse().map((r) => (
          <p key={r} className="text-red-300 text-xs">{r.toLocaleString()}</p>
        ))}
        <Label className="mt-2">Soportes</Label>
        {data.support_resistance.support.slice(-3).reverse().map((s) => (
          <p key={s} className="text-green-300 text-xs">{s.toLocaleString()}</p>
        ))}
      </section>

      {/* Patrón triangular */}
      {data.triangle_pattern.type && (
        <>
          <Divider />
          <section>
            <Label>Patrón Triangular</Label>
            <p className="text-yellow-400 text-xs capitalize">{data.triangle_pattern.type}</p>
          </section>
        </>
      )}

      {/* Ruptura */}
      {data.breakout.type && (
        <>
          <Divider />
          <section>
            <Label>Ruptura Detectada</Label>
            <p className={data.breakout.type === "upside" ? "text-green-400" : "text-red-400"}>
              {data.breakout.type === "upside" ? "Ruptura Alcista" : "Ruptura Bajista"}
              {" "}en {data.breakout.level?.toLocaleString()}
            </p>
            {data.breakout.false_breakout_risk && (
              <p className="text-orange-400 text-xs">Riesgo de falsa ruptura (volumen bajo)</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-gray-400">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function Label({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-gray-500 text-xs uppercase tracking-wide mb-1 ${className}`}>{children}</p>;
}

function Divider() {
  return <hr className="border-gray-800" />;
}
