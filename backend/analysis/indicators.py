"""
Indicadores técnicos basados en los materiales de estudio.
Cubre: Medias Móviles, RSI, MACD, Bandas de Bollinger, Estocástico, ATR.
"""
import pandas as pd
import pandas_ta as ta
from typing import Optional


def add_moving_averages(
    df: pd.DataFrame,
    sma_periods: list[int] = [20, 50, 200],
    ema_periods: list[int] = [9, 21],
) -> pd.DataFrame:
    """
    Agrega Medias Móviles Simples (SMA) y Exponenciales (EMA).
    Relevante para: rupturas de media móvil, tendencias.
    """
    df = df.copy()
    for period in sma_periods:
        df[f"SMA_{period}"] = ta.sma(df["Close"], length=period)
    for period in ema_periods:
        df[f"EMA_{period}"] = ta.ema(df["Close"], length=period)
    return df


def add_rsi(df: pd.DataFrame, period: int = 14) -> pd.DataFrame:
    """RSI (Relative Strength Index). Sobrecompra > 70, Sobreventa < 30."""
    df = df.copy()
    df["RSI"] = ta.rsi(df["Close"], length=period)
    return df


def add_macd(
    df: pd.DataFrame,
    fast: int = 12,
    slow: int = 26,
    signal: int = 9,
) -> pd.DataFrame:
    """MACD con línea de señal y histograma."""
    df = df.copy()
    macd = ta.macd(df["Close"], fast=fast, slow=slow, signal=signal)
    if macd is not None:
        col_macd = next((c for c in macd.columns if c.startswith("MACD_")), None)
        col_sig  = next((c for c in macd.columns if c.startswith("MACDs_")), None)
        col_hist = next((c for c in macd.columns if c.startswith("MACDh_")), None)
        if col_macd: df["MACD"]        = macd[col_macd]
        if col_sig:  df["MACD_Signal"] = macd[col_sig]
        if col_hist: df["MACD_Hist"]   = macd[col_hist]
    return df


def add_bollinger_bands(
    df: pd.DataFrame,
    period: int = 20,
    std: float = 2.0,
) -> pd.DataFrame:
    """Bandas de Bollinger: banda superior, media y banda inferior."""
    df = df.copy()
    bb = ta.bbands(df["Close"], length=period, std=std)
    if bb is not None:
        # Buscar columnas dinámicamente (el formato varía entre versiones de pandas-ta)
        upper = next((c for c in bb.columns if c.startswith("BBU_")), None)
        mid   = next((c for c in bb.columns if c.startswith("BBM_")), None)
        lower = next((c for c in bb.columns if c.startswith("BBL_")), None)
        width = next((c for c in bb.columns if c.startswith("BBB_")), None)
        if upper: df["BB_Upper"] = bb[upper]
        if mid:   df["BB_Mid"]   = bb[mid]
        if lower: df["BB_Lower"] = bb[lower]
        if width: df["BB_Width"] = bb[width]
    return df


def add_stochastic(
    df: pd.DataFrame,
    k: int = 14,
    d: int = 3,
    smooth_k: int = 3,
) -> pd.DataFrame:
    """Oscilador Estocástico %K y %D."""
    df = df.copy()
    stoch = ta.stoch(df["High"], df["Low"], df["Close"], k=k, d=d, smooth_k=smooth_k)
    if stoch is not None:
        col_k = next((c for c in stoch.columns if c.startswith("STOCHk_")), None)
        col_d = next((c for c in stoch.columns if c.startswith("STOCHd_")), None)
        if col_k: df["Stoch_K"] = stoch[col_k]
        if col_d: df["Stoch_D"] = stoch[col_d]
    return df


def add_atr(df: pd.DataFrame, period: int = 14) -> pd.DataFrame:
    """ATR (Average True Range): volatilidad del instrumento."""
    df = df.copy()
    df["ATR"] = ta.atr(df["High"], df["Low"], df["Close"], length=period)
    return df


def add_volume_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """
    Indicadores basados en volumen:
    - OBV (On Balance Volume)
    - Volume SMA para detectar volumen sobre/bajo promedio
    - VWAP (Volume Weighted Average Price)
    """
    df = df.copy()
    df["OBV"] = ta.obv(df["Close"], df["Volume"])
    df["Volume_SMA20"] = ta.sma(df["Volume"], length=20)
    df["Volume_Ratio"] = df["Volume"] / df["Volume_SMA20"]
    return df


def add_all_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """Agrega todos los indicadores de una vez."""
    df = add_moving_averages(df)
    df = add_rsi(df)
    df = add_macd(df)
    df = add_bollinger_bands(df)
    df = add_stochastic(df)
    df = add_atr(df)
    df = add_volume_indicators(df)
    return df
