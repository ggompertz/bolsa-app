"""
Patrones gráficos basados en los materiales:
- Soporte y Resistencia
- Triángulos (simétrico, ascendente, descendente)
- Cuñas (ascendente, descendente)
- Rupturas y falsas rupturas
"""
import pandas as pd
import numpy as np
from scipy.signal import argrelextrema


def find_support_resistance(
    df: pd.DataFrame,
    window: int = 10,
    tolerance: float = 0.02,
) -> dict[str, list[float]]:
    """
    Identifica niveles de soporte y resistencia por máximos/mínimos locales.
    Agrupa niveles cercanos (dentro del tolerance %) en un solo nivel.
    """
    highs = df["High"].values
    lows  = df["Low"].values

    # Máximos y mínimos locales
    local_max_idx = argrelextrema(highs, np.greater, order=window)[0]
    local_min_idx = argrelextrema(lows,  np.less,    order=window)[0]

    # Convertir a float Python nativo desde numpy.float64
    resistance_levels = [float(v) for v in highs[local_max_idx]]
    support_levels    = [float(v) for v in lows[local_min_idx]]

    def cluster_levels(levels: list[float]) -> list[float]:
        if not levels:
            return []
        levels = sorted(levels)
        clustered = [levels[0]]
        for lvl in levels[1:]:
            if abs(lvl - clustered[-1]) / clustered[-1] < tolerance:
                clustered[-1] = (clustered[-1] + lvl) / 2
            else:
                clustered.append(lvl)
        return [float(v) for v in clustered]

    return {
        "resistance": cluster_levels(resistance_levels),
        "support":    cluster_levels(support_levels),
    }


def detect_triangle(df: pd.DataFrame, min_points: int = 4) -> dict:
    """
    Detecta patrones de triángulo en los últimos datos.
    Basado en: "Ruptura y estructura de las figuras triangulares",
               "Symmetrical Triangle Patterns", "Triángulo ascendente".

    Retorna tipo: 'symmetrical', 'ascending', 'descending', o None.
    """
    n = min(len(df), 60)  # Usar últimas 60 velas
    subset = df.tail(n)

    highs = subset["High"].values
    lows  = subset["Low"].values
    x = np.arange(n)

    # Regresión lineal sobre máximos y mínimos
    coeffs_high = np.polyfit(x, highs, 1)
    coeffs_low  = np.polyfit(x, lows,  1)

    slope_high = coeffs_high[0]
    slope_low  = coeffs_low[0]

    # Clasificación según pendientes
    flat = lambda s: abs(s) < 0.001 * np.mean(highs)

    pattern_type = None
    if slope_high < -0.001 and slope_low > 0.001:
        pattern_type = "symmetrical"    # Triángulo simétrico: convergencia
    elif flat(slope_high) and slope_low > 0.001:
        pattern_type = "ascending"      # Triángulo ascendente: techo plano
    elif slope_high < -0.001 and flat(slope_low):
        pattern_type = "descending"     # Triángulo descendente: piso plano

    return {
        "type": pattern_type,
        "slope_high": float(slope_high),
        "slope_low":  float(slope_low),
        "trend_high": [float(np.polyval(coeffs_high, i)) for i in x],
        "trend_low":  [float(np.polyval(coeffs_low,  i)) for i in x],
    }


def detect_breakout(
    df: pd.DataFrame,
    levels: dict[str, list[float]],
    threshold: float = 0.02,
    vol_confirmation: bool = True,
) -> dict:
    """
    Detecta ruptura de soporte/resistencia en las últimas velas.
    Basado en: "Evitar las falsas rupturas", "Ruptura falsa con quiebre real".

    Args:
        threshold: % mínimo de cierre sobre/bajo el nivel para confirmar ruptura
        vol_confirmation: requiere volumen sobre promedio para confirmar

    Returns:
        Dict con 'type' ('upside'|'downside'|None), 'level', 'confirmed'.
    """
    if df.empty:
        return {"type": None, "level": None, "confirmed": False}

    last  = df.iloc[-1]
    vol_avg = df["Volume"].rolling(20).mean().iloc[-1]
    high_vol = last["Volume"] > vol_avg * 1.3

    hv = bool(high_vol)  # convertir numpy.bool_ → bool Python

    for level in levels.get("resistance", []):
        if last["Close"] > level * (1 + threshold):
            return {
                "type": "upside",
                "level": float(level),
                "confirmed": hv if vol_confirmation else True,
                "false_breakout_risk": not hv,
            }

    for level in levels.get("support", []):
        if last["Close"] < level * (1 - threshold):
            return {
                "type": "downside",
                "level": float(level),
                "confirmed": hv if vol_confirmation else True,
                "false_breakout_risk": not hv,
            }

    return {"type": None, "level": None, "confirmed": False, "false_breakout_risk": False}
