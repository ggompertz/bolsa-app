"use client";

import { useState, useRef, useEffect } from "react";
import { searchTickers } from "@/lib/api";

interface Props {
  onSelect: (symbol: string, market: string) => void;
}

const POPULAR = {
  US: ["AAPL", "MSFT", "NVDA", "TSLA", "GOOGL", "META", "AMZN"],
  CL: ["COPEC.SN", "SQM-B.SN", "BSANTANDER.SN", "CHILE.SN", "LTM.SN", "ENELAM.SN"],
};

export default function StockSearch({ onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [market, setMarket] = useState<"US" | "CL">("US");
  const [results, setResults] = useState<Array<{ symbol: string; name: string }>>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchTickers(query, market);
        setResults(data.results.slice(0, 8));
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);
  }, [query, market]);

  const select = (sym: string) => {
    onSelect(sym, market);
    setQuery(sym);
    setOpen(false);
  };

  return (
    <div className="relative flex gap-2 items-center">
      <select
        className="bg-gray-800 text-sm rounded px-2 py-1 border border-gray-700"
        value={market}
        onChange={(e) => setMarket(e.target.value as "US" | "CL")}
      >
        <option value="US">NYSE/NASDAQ</option>
        <option value="CL">Bolsa Santiago</option>
      </select>

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length < 2 && setOpen(true)}
          placeholder="Buscar ticker..."
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1 text-sm w-48 focus:outline-none focus:border-[#2196f3]"
        />
        {loading && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">...</span>
        )}
        {open && (
          <div className="absolute top-full left-0 mt-1 w-64 bg-gray-900 border border-gray-700 rounded shadow-xl z-50">
            {query.length < 2 ? (
              <div className="p-2">
                <p className="text-xs text-gray-500 px-2 pb-1">Populares {market}</p>
                {POPULAR[market].map((sym) => (
                  <button
                    key={sym}
                    onClick={() => select(sym)}
                    className="w-full text-left px-3 py-1 text-sm hover:bg-gray-800 rounded"
                  >
                    {sym}
                  </button>
                ))}
              </div>
            ) : results.length > 0 ? (
              results.map((r) => (
                <button
                  key={r.symbol}
                  onClick={() => select(r.symbol)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-800 flex gap-2"
                >
                  <span className="font-mono text-[#2196f3]">{r.symbol}</span>
                  <span className="text-gray-400 truncate">{r.name}</span>
                </button>
              ))
            ) : (
              <p className="p-3 text-sm text-gray-500">Sin resultados</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
