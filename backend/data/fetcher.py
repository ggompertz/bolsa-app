"""
Módulo de obtención de datos de mercado via yfinance.
Cubre Bolsa de Santiago (Chile) y NYSE/NASDAQ (USA).
"""
import yfinance as yf
import pandas as pd
import diskcache
from pathlib import Path
from datetime import datetime

from config import settings

_cache = diskcache.Cache(settings.cache_dir)


def _cache_key(symbol: str, interval: str, period: str) -> str:
    return f"ohlcv:{symbol}:{interval}:{period}"


def get_ohlcv(
    symbol: str,
    interval: str = "1d",
    period: str = "1y",
    force_refresh: bool = False,
) -> pd.DataFrame:
    """
    Obtiene datos OHLCV (Open, High, Low, Close, Volume) para un ticker.

    Args:
        symbol:  Ticker (ej. 'COPEC.SN', 'AAPL')
        interval: Intervalo de tiempo ('1d', '1h', '15m', etc.)
        period:   Periodo ('1mo', '3mo', '6mo', '1y', '2y', '5y', 'max')
        force_refresh: Ignorar caché y actualizar

    Returns:
        DataFrame con columnas: Open, High, Low, Close, Volume
        Index: DatetimeIndex
    """
    key = _cache_key(symbol, interval, period)

    if not force_refresh and key in _cache:
        return _cache[key]

    ticker = yf.Ticker(symbol)
    df = ticker.history(period=period, interval=interval, auto_adjust=True)

    if df.empty:
        raise ValueError(f"No se encontraron datos para '{symbol}'. "
                         "Verifica el ticker y el mercado.")

    # Normalizar columnas
    df = df[["Open", "High", "Low", "Close", "Volume"]].copy()
    df.index.name = "Date"

    # TTL según intervalo
    ttl = settings.cache_ttl_daily if interval == "1d" else settings.cache_ttl_realtime
    _cache.set(key, df, expire=ttl)

    return df


def get_info(symbol: str) -> dict:
    """Retorna información general del instrumento (nombre, sector, moneda, etc.)."""
    cache_key = f"info:{symbol}"
    if cache_key in _cache:
        return _cache[cache_key]

    ticker = yf.Ticker(symbol)
    info = ticker.info or {}
    result = {
        "symbol": symbol,
        "name": info.get("longName") or info.get("shortName", symbol),
        "sector": info.get("sector", "N/A"),
        "industry": info.get("industry", "N/A"),
        "currency": info.get("currency", "N/A"),
        "exchange": info.get("exchange", "N/A"),
        "market_cap": info.get("marketCap"),
        "website": info.get("website"),
        "description": info.get("longBusinessSummary", ""),
    }
    _cache.set(cache_key, result, expire=settings.cache_ttl_historical)
    return result


def search_tickers(query: str, market: str = "US") -> list[dict]:
    """
    Busca tickers por nombre o símbolo.
    Nota: yfinance no tiene búsqueda nativa; usamos Yahoo Finance API directamente.
    """
    import httpx
    url = "https://query2.finance.yahoo.com/v1/finance/search"
    params = {"q": query, "lang": "es", "region": "CL" if market == "CL" else "US"}
    headers = {"User-Agent": "Mozilla/5.0"}

    with httpx.Client() as client:
        resp = client.get(url, params=params, headers=headers, timeout=10)
        resp.raise_for_status()
        data = resp.json()

    # Exchanges por mercado
    CL_EXCHANGES = {"SN", "SGO"}
    US_EXCHANGES = {"NMS", "NYQ", "NGM", "PCX", "BTS", "NCM", "OBB", "NAS", "NYSE", "NASDAQ"}

    def matches_market(q: dict) -> bool:
        exchange = q.get("exchange", "")
        symbol   = q.get("symbol", "")
        if market == "CL":
            return exchange in CL_EXCHANGES or symbol.endswith(".SN")
        else:
            return exchange in US_EXCHANGES or (
                not symbol.endswith(".SN") and "." not in symbol.split("-")[0]
            )

    quotes = data.get("quotes", [])
    return [
        {
            "symbol": q.get("symbol", ""),
            "name": q.get("shortname") or q.get("longname", ""),
            "exchange": q.get("exchange", ""),
            "type": q.get("quoteType", ""),
        }
        for q in quotes
        if q.get("quoteType") in ("EQUITY", "ETF") and matches_market(q)
    ]
