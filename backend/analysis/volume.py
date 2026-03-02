"""
Análisis de volumen basado en los materiales:
- "Usar el volumen para detectar señales de giro"
- "Precio cae, volumen contrae"
- "Precio sube, volumen disminuye"
- "Precio plano, volumen en aumento"
- "Absorción de capital, sacudida del mercado"
"""
import pandas as pd
import numpy as np


def classify_volume_signals(df: pd.DataFrame, vol_threshold: float = 1.5) -> pd.DataFrame:
    """
    Clasifica señales precio/volumen según los patrones estudiados.

    Señales:
    - ACUMULACION: precio plano + volumen alto  → preparación alcista
    - DISTRIBUCION: precio plano + volumen alto en techo → preparación bajista
    - IMPULSO_ALCISTA: precio sube + volumen alto → confirmación
    - IMPULSO_BAJISTA: precio baja + volumen alto → confirmación
    - DEBILIDAD_ALCISTA: precio sube + volumen bajo → señal de agotamiento
    - CONTRACCION_BAJISTA: precio baja + volumen bajo → agotamiento bajista
    - SACUDIDA: caída brusca + volumen extremo + recuperación → trampa bajista
    """
    df = df.copy()
    df["Vol_SMA20"] = df["Volume"].rolling(20).mean()
    df["Vol_Ratio"] = df["Volume"] / df["Vol_SMA20"]

    price_change = df["Close"].pct_change()
    df["Price_Change_Pct"] = price_change * 100

    flat_threshold = 0.5   # % cambio para considerar precio "plano"
    high_vol = df["Vol_Ratio"] >= vol_threshold
    low_vol  = df["Vol_Ratio"] < (1 / vol_threshold)
    price_up   = price_change >  flat_threshold / 100
    price_down = price_change < -flat_threshold / 100
    price_flat = price_change.abs() <= flat_threshold / 100

    df["Signal"] = "NEUTRO"
    df.loc[price_up   & high_vol, "Signal"] = "IMPULSO_ALCISTA"
    df.loc[price_down & high_vol, "Signal"] = "IMPULSO_BAJISTA"
    df.loc[price_up   & low_vol,  "Signal"] = "DEBILIDAD_ALCISTA"
    df.loc[price_down & low_vol,  "Signal"] = "CONTRACCION_BAJISTA"
    df.loc[price_flat & high_vol, "Signal"] = "ACUMULACION_DISTRIBUCION"

    return df


def detect_volume_divergence(df: pd.DataFrame, window: int = 5) -> pd.DataFrame:
    """
    Detecta divergencias precio/volumen.
    Divergencia bajista: precio hace nuevos máximos pero volumen disminuye.
    Divergencia alcista: precio hace nuevos mínimos pero volumen disminuye.
    """
    df = df.copy()
    df["Price_High"] = df["High"].rolling(window).max() == df["High"]
    df["Price_Low"]  = df["Low"].rolling(window).min() == df["Low"]
    df["Vol_Decreasing"] = df["Volume"] < df["Volume"].rolling(window).mean()

    df["Bearish_Divergence"] = df["Price_High"] & df["Vol_Decreasing"]
    df["Bullish_Divergence"] = df["Price_Low"]  & df["Vol_Decreasing"]

    return df[["Bearish_Divergence", "Bullish_Divergence"]]


def detect_absorption(df: pd.DataFrame, vol_multiplier: float = 2.0) -> pd.Series:
    """
    Absorción de capital: vela con volumen muy alto y cuerpo pequeño.
    Indica que una fuerza opuesta está "absorbiendo" la presión vendedora/compradora.
    """
    body  = (df["Close"] - df["Open"]).abs()
    rng   = df["High"] - df["Low"]
    body_ratio = body / rng.replace(0, np.nan)

    vol_avg = df["Volume"].rolling(20).mean()
    high_vol = df["Volume"] > vol_avg * vol_multiplier

    return (high_vol & (body_ratio < 0.3)).fillna(False)
