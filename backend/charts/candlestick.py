"""
Generación de gráficos interactivos con Plotly.
Gráfico principal de velas + subgráficos de indicadores y volumen.
"""
import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import json


def build_candlestick_chart(
    df: pd.DataFrame,
    symbol: str,
    indicators: list[str] = None,
    support_resistance: dict = None,
    patterns: pd.DataFrame = None,
    show_volume: bool = True,
) -> str:
    """
    Construye gráfico completo de velas con indicadores y retorna JSON de Plotly.

    Args:
        df: DataFrame con OHLCV e indicadores calculados
        symbol: Nombre del ticker
        indicators: Lista de indicadores a mostrar (ej. ['SMA_20', 'RSI', 'MACD'])
        support_resistance: Dict con listas 'support' y 'resistance'
        patterns: DataFrame con columnas booleanas de patrones detectados
        show_volume: Mostrar subgráfico de volumen

    Returns:
        JSON string de la figura Plotly (para enviar al frontend)
    """
    indicators = indicators or []

    # Determinar número de filas del subplot
    has_rsi  = "RSI"  in indicators
    has_macd = "MACD" in indicators
    n_rows   = 1 + int(show_volume) + int(has_rsi) + int(has_macd)
    row_heights = [0.5] + [0.15] * (n_rows - 1)

    subplot_titles = [symbol]
    if show_volume: subplot_titles.append("Volumen")
    if has_rsi:     subplot_titles.append("RSI (14)")
    if has_macd:    subplot_titles.append("MACD")

    fig = make_subplots(
        rows=n_rows, cols=1,
        shared_xaxes=True,
        vertical_spacing=0.02,
        subplot_titles=subplot_titles,
        row_heights=row_heights,
    )

    # --- Velas japonesas ---
    fig.add_trace(
        go.Candlestick(
            x=df.index,
            open=df["Open"], high=df["High"],
            low=df["Low"],   close=df["Close"],
            name=symbol,
            increasing_line_color="#26a69a",
            decreasing_line_color="#ef5350",
        ),
        row=1, col=1,
    )

    # --- Medias Móviles sobre el precio ---
    ma_colors = {
        "SMA_20": "#f0a500", "SMA_50": "#e040fb",
        "SMA_200": "#29b6f6", "EMA_9": "#ff7043", "EMA_21": "#66bb6a",
    }
    for ind in indicators:
        if ind in df.columns and ind in ma_colors:
            fig.add_trace(
                go.Scatter(x=df.index, y=df[ind], name=ind,
                           line=dict(color=ma_colors[ind], width=1.2)),
                row=1, col=1,
            )

    # --- Bandas de Bollinger ---
    if "BB_Upper" in df.columns and "BB_Upper" in indicators:
        fig.add_trace(go.Scatter(x=df.index, y=df["BB_Upper"], name="BB Sup",
                                 line=dict(color="rgba(100,100,255,0.5)", dash="dash")), row=1, col=1)
        fig.add_trace(go.Scatter(x=df.index, y=df["BB_Lower"], name="BB Inf",
                                 line=dict(color="rgba(100,100,255,0.5)", dash="dash"),
                                 fill="tonexty", fillcolor="rgba(100,100,255,0.05)"), row=1, col=1)

    # --- Niveles de Soporte y Resistencia ---
    if support_resistance:
        for lvl in support_resistance.get("support", []):
            fig.add_hline(y=lvl, line_dash="dot", line_color="#26a69a",
                          line_width=1, opacity=0.6, row=1, col=1)
        for lvl in support_resistance.get("resistance", []):
            fig.add_hline(y=lvl, line_dash="dot", line_color="#ef5350",
                          line_width=1, opacity=0.6, row=1, col=1)

    # --- Marcadores de patrones de velas ---
    if patterns is not None:
        _add_pattern_markers(fig, df, patterns)

    current_row = 2

    # --- Volumen ---
    if show_volume:
        colors = ["#26a69a" if c >= o else "#ef5350"
                  for c, o in zip(df["Close"], df["Open"])]
        fig.add_trace(
            go.Bar(x=df.index, y=df["Volume"], name="Volumen",
                   marker_color=colors, showlegend=False),
            row=current_row, col=1,
        )
        if "Volume_SMA20" in df.columns:
            fig.add_trace(
                go.Scatter(x=df.index, y=df["Volume_SMA20"], name="Vol SMA20",
                           line=dict(color="#f0a500", width=1)),
                row=current_row, col=1,
            )
        current_row += 1

    # --- RSI ---
    if has_rsi and "RSI" in df.columns:
        fig.add_trace(
            go.Scatter(x=df.index, y=df["RSI"], name="RSI",
                       line=dict(color="#ab47bc", width=1.5)),
            row=current_row, col=1,
        )
        fig.add_hline(y=70, line_dash="dash", line_color="#ef5350",
                      line_width=1, row=current_row, col=1)
        fig.add_hline(y=30, line_dash="dash", line_color="#26a69a",
                      line_width=1, row=current_row, col=1)
        current_row += 1

    # --- MACD ---
    if has_macd and "MACD" in df.columns:
        colors_macd = ["#26a69a" if v >= 0 else "#ef5350" for v in df["MACD_Hist"]]
        fig.add_trace(go.Bar(x=df.index, y=df["MACD_Hist"], name="MACD Hist",
                             marker_color=colors_macd, showlegend=False), row=current_row, col=1)
        fig.add_trace(go.Scatter(x=df.index, y=df["MACD"], name="MACD",
                                 line=dict(color="#26c6da", width=1.5)), row=current_row, col=1)
        fig.add_trace(go.Scatter(x=df.index, y=df["MACD_Signal"], name="Señal",
                                 line=dict(color="#ff7043", width=1.5)), row=current_row, col=1)

    # --- Layout ---
    fig.update_layout(
        template="plotly_dark",
        height=700,
        xaxis_rangeslider_visible=False,
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        margin=dict(l=40, r=40, t=60, b=40),
        paper_bgcolor="#131722",
        plot_bgcolor="#131722",
    )

    return fig.to_json()


def _add_pattern_markers(fig, df: pd.DataFrame, patterns: pd.DataFrame):
    """Agrega marcadores visuales para patrones de velas detectados."""
    pattern_config = {
        "Hammer":           {"symbol": "triangle-up",   "color": "#26a69a", "position": "below", "label": "Martillo"},
        "Shooting_Star":    {"symbol": "triangle-down", "color": "#ef5350", "position": "above", "label": "Estrella Fugaz"},
        "Bullish_Engulfing":{"symbol": "star",          "color": "#26a69a", "position": "below", "label": "Envolvente Alcista"},
        "Bearish_Engulfing":{"symbol": "star",          "color": "#ef5350", "position": "above", "label": "Envolvente Bajista"},
        "Doji":             {"symbol": "circle",        "color": "#ffa726", "position": "above", "label": "Doji"},
        "Morning_Star":     {"symbol": "diamond",       "color": "#26a69a", "position": "below", "label": "Estrella Mañana"},
    }

    for pattern, cfg in pattern_config.items():
        if pattern not in patterns.columns:
            continue
        mask = patterns[pattern]
        if not mask.any():
            continue

        y_vals = (df["Low"][mask] * 0.98 if cfg["position"] == "below"
                  else df["High"][mask] * 1.02)
        fig.add_trace(
            go.Scatter(
                x=df.index[mask], y=y_vals,
                mode="markers",
                marker=dict(symbol=cfg["symbol"], size=10,
                            color=cfg["color"], opacity=0.8),
                name=cfg["label"],
            ),
            row=1, col=1,
        )
