"""
Bolsa App - API Principal (FastAPI)
Endpoints para obtener datos, indicadores y gráficos bursátiles.
"""
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.encoders import jsonable_encoder
from typing import Optional
import pandas as pd
import numpy as np

from apscheduler.schedulers.asyncio import AsyncIOScheduler

logger = logging.getLogger(__name__)


def _to_python(obj):
    """Convierte tipos numpy a tipos Python nativos para serialización JSON."""
    if isinstance(obj, dict):
        return {k: _to_python(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_to_python(v) for v in obj]
    if isinstance(obj, (np.bool_,)):
        return bool(obj)
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj)
    return obj

from config import settings
from data.fetcher import get_ohlcv, get_info, search_tickers
from data.markets import MARKETS, VALID_INTERVALS, format_ticker
from analysis.indicators import add_all_indicators, add_moving_averages, add_rsi, add_macd, add_bollinger_bands, add_volume_indicators, add_guppy
from analysis.candlesticks import get_all_patterns
from analysis.volume import classify_volume_signals, detect_absorption
from analysis.patterns import find_support_resistance, detect_triangle, detect_breakout
from charts.candlestick import build_candlestick_chart
from db.database import init_db, SessionLocal
from services.alert_evaluator import evaluate_all_alerts
from api.alerts import router as alerts_router


async def _run_alert_check():
    """Tarea periódica: evalúa todas las alertas activas."""
    db = SessionLocal()
    try:
        fired = await evaluate_all_alerts(db)
        if fired:
            logger.info("Scheduler: %d alerta(s) disparada(s)", fired)
    except Exception as exc:
        logger.error("Error en ciclo de alertas: %s", exc)
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        _run_alert_check,
        "interval",
        minutes=settings.alert_check_minutes,
        id="alert_check",
    )
    scheduler.start()
    logger.info("Scheduler iniciado — evaluación cada %d min", settings.alert_check_minutes)
    yield
    # Shutdown
    scheduler.shutdown(wait=False)


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Sistema de análisis técnico para mercados bursátiles Chile y USA",
    lifespan=lifespan,
)

app.include_router(alerts_router)

_origins = [settings.frontend_url]
if settings.allowed_origins:
    _origins += [o.strip() for o in settings.allowed_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",  # cualquier deploy de Vercel
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Mercados ──────────────────────────────────────────────────────────────

@app.get("/api/markets")
def list_markets():
    return {"markets": MARKETS, "intervals": VALID_INTERVALS}


# ─── Búsqueda ──────────────────────────────────────────────────────────────

@app.get("/api/search")
def search(q: str = Query(..., min_length=1), market: str = "US"):
    try:
        results = search_tickers(q, market)
        return {"results": results}
    except Exception as e:
        raise HTTPException(400, str(e))


# ─── Información del instrumento ───────────────────────────────────────────

@app.get("/api/stock/{symbol}/info")
def stock_info(symbol: str, market: str = Query("US")):
    ticker = format_ticker(symbol, market)
    try:
        return get_info(ticker)
    except Exception as e:
        raise HTTPException(404, f"Ticker '{ticker}' no encontrado: {e}")


# ─── Datos OHLCV ───────────────────────────────────────────────────────────

@app.get("/api/stock/{symbol}/ohlcv")
def stock_ohlcv(
    symbol: str,
    market: str = Query("US"),
    interval: str = Query("1d"),
    period: str = Query("1y"),
    refresh: bool = False,
):
    if interval not in VALID_INTERVALS:
        raise HTTPException(400, f"Intervalo inválido. Válidos: {list(VALID_INTERVALS)}")

    ticker = format_ticker(symbol, market)
    try:
        df = get_ohlcv(ticker, interval=interval, period=period, force_refresh=refresh)
    except ValueError as e:
        raise HTTPException(404, str(e))

    return {
        "symbol": ticker,
        "interval": interval,
        "period": period,
        "rows": len(df),
        "data": df.reset_index().to_dict(orient="records"),
    }


# ─── Gráfico principal ─────────────────────────────────────────────────────

@app.get("/api/stock/{symbol}/chart")
def stock_chart(
    symbol: str,
    market: str = Query("US"),
    interval: str = Query("1d"),
    period: str = Query("1y"),
    indicators: str = Query("SMA_20,SMA_50,Volume,RSI,MACD",
                            description="Indicadores separados por coma"),
    show_patterns: bool = True,
    show_sr: bool = True,
):
    """
    Retorna JSON de gráfico Plotly con velas, indicadores y patrones.
    """
    ticker = format_ticker(symbol, market)

    try:
        df = get_ohlcv(ticker, interval=interval, period=period)
    except ValueError as e:
        raise HTTPException(404, str(e))

    ind_list = [i.strip() for i in indicators.split(",") if i.strip()]

    # Calcular indicadores seleccionados
    df = add_volume_indicators(df)
    if any(i.startswith("SMA") or i.startswith("EMA") for i in ind_list):
        df = add_moving_averages(df)
    if "RSI" in ind_list:
        df = add_rsi(df)
    if "MACD" in ind_list:
        df = add_macd(df)
    if "BB_Upper" in ind_list:
        df = add_bollinger_bands(df)
    if "GMMA" in ind_list:
        df = add_guppy(df)

    # Patrones de velas
    patterns = get_all_patterns(df) if show_patterns else None

    # Soporte y resistencia
    sr = find_support_resistance(df) if show_sr else None

    chart_json = build_candlestick_chart(
        df, symbol=ticker,
        indicators=ind_list,
        support_resistance=sr,
        patterns=patterns,
        show_volume="Volume" in ind_list,
    )

    return {"chart": chart_json}


# ─── Análisis ──────────────────────────────────────────────────────────────

@app.get("/api/stock/{symbol}/analysis")
def stock_analysis(
    symbol: str,
    market: str = Query("US"),
    period: str = Query("6mo"),
):
    """Análisis técnico completo: patrones, volumen, soportes, rupturas."""
    ticker = format_ticker(symbol, market)

    try:
        df = get_ohlcv(ticker, interval="1d", period=period)
    except ValueError as e:
        raise HTTPException(404, str(e))

    df = add_all_indicators(df)
    patterns_df  = get_all_patterns(df)
    volume_df    = classify_volume_signals(df)
    sr_levels    = find_support_resistance(df)
    triangle     = detect_triangle(df)
    breakout     = detect_breakout(df, sr_levels)
    absorption   = detect_absorption(df)

    # Últimos patrones activos
    recent_patterns = {
        col: bool(patterns_df[col].iloc[-1])
        for col in patterns_df.columns
    }

    last = df.iloc[-1]

    result = {
        "symbol": ticker,
        "last_price": round(float(last["Close"]), 2),
        "last_volume": int(last["Volume"]),
        "volume_signal": str(volume_df["Signal"].iloc[-1]),
        "rsi": round(float(last.get("RSI", 0) or 0), 2),
        "macd": round(float(last.get("MACD", 0) or 0), 4),
        "support_resistance": sr_levels,
        "triangle_pattern": triangle,
        "breakout": breakout,
        "candle_patterns": recent_patterns,
        "absorption_signal": bool(absorption.iloc[-1]),
    }
    return _to_python(result)


if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
