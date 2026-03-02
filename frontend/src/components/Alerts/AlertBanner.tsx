"use client";

import { useEffect, useRef, useState } from "react";
import { getTriggered, markSeen, type TriggeredAlert, CONDITION_LABELS } from "@/lib/alertApi";

const POLL_INTERVAL_MS = 30_000;

export default function AlertBanner() {
  const [queue, setQueue] = useState<TriggeredAlert[]>([]);
  const [current, setCurrent] = useState<TriggeredAlert | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Polling cada 30s
  useEffect(() => {
    const poll = async () => {
      try {
        const items = await getTriggered();
        if (items.length > 0) {
          setQueue((prev) => {
            const existingIds = new Set(prev.map((x) => x.id));
            const fresh = items.filter((x) => !existingIds.has(x.id));
            return [...prev, ...fresh];
          });
        }
      } catch {
        // silencioso — la app sigue funcionando sin alertas
      }
    };

    poll();
    timerRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Mostrar el primero de la cola
  useEffect(() => {
    if (!current && queue.length > 0) {
      setCurrent(queue[0]);
      setQueue((prev) => prev.slice(1));
    }
  }, [queue, current]);

  const dismiss = async () => {
    if (current) {
      await markSeen(current.id).catch(() => {});
      setCurrent(null);
    }
  };

  if (!current) return null;

  const isRsi =
    current.condition_type === "rsi_overbought" ||
    current.condition_type === "rsi_oversold";
  const bgColor = current.condition_type === "rsi_overbought"
    ? "bg-red-900/90 border-red-500"
    : current.condition_type === "rsi_oversold"
    ? "bg-green-900/90 border-green-500"
    : "bg-blue-900/90 border-blue-500";

  // Limpiar HTML del mensaje para mostrar como texto plano
  const plainMessage = current.message.replace(/<[^>]+>/g, "");

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 max-w-sm rounded-lg border px-4 py-3 shadow-2xl
                  backdrop-blur-sm transition-all ${bgColor}`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-0.5">
            {CONDITION_LABELS[current.condition_type]} · {current.symbol}
          </p>
          <p className="text-sm text-white leading-snug">{plainMessage}</p>
        </div>
        <button
          onClick={dismiss}
          className="text-white/50 hover:text-white text-lg leading-none mt-0.5 flex-shrink-0"
          aria-label="Cerrar"
        >
          ×
        </button>
      </div>
      {queue.length > 0 && (
        <p className="text-xs text-white/40 mt-1">+{queue.length} más</p>
      )}
    </div>
  );
}
