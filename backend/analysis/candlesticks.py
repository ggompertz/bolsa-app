"""
Detección de patrones de velas japonesas.
Basado en los materiales: "Velas Japonesas", "Avanzado en Gráficos de Velas",
"El lenguaje oculto de las velas".
"""
import pandas as pd
import numpy as np


def _body_size(row: pd.Series) -> float:
    return abs(row["Close"] - row["Open"])


def _candle_range(row: pd.Series) -> float:
    return row["High"] - row["Low"]


def _upper_shadow(row: pd.Series) -> float:
    return row["High"] - max(row["Open"], row["Close"])


def _lower_shadow(row: pd.Series) -> float:
    return min(row["Open"], row["Close"]) - row["Low"]


def _is_bullish(row: pd.Series) -> bool:
    return row["Close"] > row["Open"]


def detect_doji(df: pd.DataFrame, threshold: float = 0.1) -> pd.Series:
    """
    Doji: cuerpo muy pequeño respecto al rango total.
    Indica indecisión del mercado.
    """
    body = (df["Close"] - df["Open"]).abs()
    rng  = df["High"] - df["Low"]
    return ((body / rng.replace(0, np.nan)) < threshold).fillna(False)


def detect_hammer(df: pd.DataFrame) -> pd.Series:
    """
    Martillo (Hammer): patrón alcista.
    - Sombra inferior >= 2x el cuerpo
    - Sombra superior pequeña
    - Aparece en tendencia bajista
    """
    body  = (df["Close"] - df["Open"]).abs()
    lower = df[["Open", "Close"]].min(axis=1) - df["Low"]
    upper = df["High"] - df[["Open", "Close"]].max(axis=1)
    rng   = df["High"] - df["Low"]
    return (
        (lower >= 2 * body) &
        (upper < 0.1 * rng) &
        (body > 0)
    )


def detect_shooting_star(df: pd.DataFrame) -> pd.Series:
    """
    Estrella Fugaz (Shooting Star): patrón bajista.
    - Sombra superior >= 2x el cuerpo
    - Sombra inferior pequeña
    - Aparece en tendencia alcista
    """
    body  = (df["Close"] - df["Open"]).abs()
    upper = df["High"] - df[["Open", "Close"]].max(axis=1)
    lower = df[["Open", "Close"]].min(axis=1) - df["Low"]
    rng   = df["High"] - df["Low"]
    return (
        (upper >= 2 * body) &
        (lower < 0.1 * rng) &
        (body > 0)
    )


def detect_engulfing(df: pd.DataFrame) -> pd.DataFrame:
    """
    Patrón Envolvente (Engulfing): alcista o bajista.
    Returns DataFrame con columnas 'Bullish_Engulfing' y 'Bearish_Engulfing'.
    """
    result = pd.DataFrame(index=df.index)
    result["Bullish_Engulfing"] = False
    result["Bearish_Engulfing"] = False

    for i in range(1, len(df)):
        prev = df.iloc[i - 1]
        curr = df.iloc[i]

        # Bajista previo + alcista que lo envuelve
        if (prev["Close"] < prev["Open"] and
                curr["Close"] > curr["Open"] and
                curr["Open"] < prev["Close"] and
                curr["Close"] > prev["Open"]):
            result.iloc[i, result.columns.get_loc("Bullish_Engulfing")] = True

        # Alcista previo + bajista que lo envuelve
        if (prev["Close"] > prev["Open"] and
                curr["Close"] < curr["Open"] and
                curr["Open"] > prev["Close"] and
                curr["Close"] < prev["Open"]):
            result.iloc[i, result.columns.get_loc("Bearish_Engulfing")] = True

    return result


def detect_morning_star(df: pd.DataFrame) -> pd.Series:
    """
    Estrella del Amanecer (Morning Star): patrón alcista de 3 velas.
    Vela bajista grande + Doji/pequeña + vela alcista grande.
    """
    result = pd.Series(False, index=df.index)
    doji   = detect_doji(df)

    for i in range(2, len(df)):
        v1, v2, v3 = df.iloc[i-2], df.iloc[i-1], df.iloc[i]
        body1 = abs(v1["Close"] - v1["Open"])
        body3 = abs(v3["Close"] - v3["Open"])
        avg_body = df[["Open", "Close"]].apply(lambda r: abs(r["Close"] - r["Open"]), axis=1).mean()

        if (v1["Close"] < v1["Open"] and          # V1 bajista
                doji.iloc[i-1] or abs(v2["Close"] - v2["Open"]) < 0.3 * avg_body and  # V2 pequeña
                v3["Close"] > v3["Open"] and          # V3 alcista
                body1 > avg_body and body3 > avg_body and  # V1 y V3 grandes
                v3["Close"] > (v1["Open"] + v1["Close"]) / 2):  # V3 cierra sobre mitad V1
            result.iloc[i] = True

    return result


def get_all_patterns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Detecta todos los patrones y retorna un DataFrame con columnas booleanas.
    """
    patterns = pd.DataFrame(index=df.index)
    patterns["Doji"]          = detect_doji(df)
    patterns["Hammer"]        = detect_hammer(df)
    patterns["Shooting_Star"] = detect_shooting_star(df)
    engulfing = detect_engulfing(df)
    patterns["Bullish_Engulfing"] = engulfing["Bullish_Engulfing"]
    patterns["Bearish_Engulfing"] = engulfing["Bearish_Engulfing"]
    patterns["Morning_Star"]  = detect_morning_star(df)
    return patterns
