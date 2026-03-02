"""
Evaluación de condiciones de alerta usando las funciones de analysis/.
"""
import json
import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from data.fetcher import get_ohlcv
from data.markets import format_ticker
from analysis.indicators import add_rsi, add_volume_indicators
from analysis.candlesticks import get_all_patterns
from analysis.volume import classify_volume_signals, detect_absorption
from analysis.patterns import find_support_resistance, detect_breakout
from db.models import Alert, TriggeredAlert
from services.telegram_service import send_message

logger = logging.getLogger(__name__)

# Tipos de condición soportados
CONDITION_TYPES = {
    "rsi_overbought",
    "rsi_oversold",
    "candle_pattern",
    "volume_anomaly",
    "breakout",
}


def _evaluate_condition(alert: Alert) -> tuple[bool, str]:
    """
    Evalúa la condición de una alerta contra los datos actuales.
    Retorna (disparada: bool, mensaje: str).
    """
    ticker = format_ticker(alert.symbol, alert.market)
    params = json.loads(alert.condition_params or "{}")

    try:
        df = get_ohlcv(ticker, interval="1d", period="3mo")
    except Exception as exc:
        logger.error("Error obteniendo datos para %s: %s", ticker, exc)
        return False, ""

    ctype = alert.condition_type

    # ── RSI sobrecompra ────────────────────────────────────────────────────
    if ctype == "rsi_overbought":
        threshold = float(params.get("threshold", 70))
        df = add_rsi(df)
        rsi = float(df["RSI"].iloc[-1])
        if rsi > threshold:
            return True, f"🔴 <b>{ticker}</b>: RSI en sobrecompra ({rsi:.1f} &gt; {threshold})"
        return False, ""

    # ── RSI sobreventa ─────────────────────────────────────────────────────
    if ctype == "rsi_oversold":
        threshold = float(params.get("threshold", 30))
        df = add_rsi(df)
        rsi = float(df["RSI"].iloc[-1])
        if rsi < threshold:
            return True, f"🟢 <b>{ticker}</b>: RSI en sobreventa ({rsi:.1f} &lt; {threshold})"
        return False, ""

    # ── Patrón de velas ────────────────────────────────────────────────────
    if ctype == "candle_pattern":
        pattern = params.get("pattern", "Hammer")
        patterns_df = get_all_patterns(df)
        if pattern in patterns_df.columns and bool(patterns_df[pattern].iloc[-1]):
            return True, f"🕯️ <b>{ticker}</b>: Patrón <b>{pattern}</b> detectado en última vela"
        return False, ""

    # ── Volumen anómalo ────────────────────────────────────────────────────
    if ctype == "volume_anomaly":
        multiplier = float(params.get("multiplier", 2.0))
        df = add_volume_indicators(df)
        vol_ratio = float(df["Volume_Ratio"].iloc[-1])
        absorption = detect_absorption(df)
        absorbed = bool(absorption.iloc[-1])
        if vol_ratio >= multiplier or absorbed:
            detail = f"absorción detectada" if absorbed else f"volumen {vol_ratio:.1f}x promedio"
            return True, f"📊 <b>{ticker}</b>: Volumen anómalo — {detail}"
        return False, ""

    # ── Ruptura de soporte/resistencia ─────────────────────────────────────
    if ctype == "breakout":
        sr = find_support_resistance(df)
        result = detect_breakout(df, sr)
        if result["type"] is not None and result["confirmed"]:
            arrow = "⬆️" if result["type"] == "upside" else "⬇️"
            direction = "alcista" if result["type"] == "upside" else "bajista"
            level = result["level"]
            return True, f"{arrow} <b>{ticker}</b>: Ruptura {direction} confirmada en nivel {level:.2f}"
        return False, ""

    logger.warning("Tipo de condición desconocido: %s", ctype)
    return False, ""


async def evaluate_all_alerts(db: Session) -> int:
    """
    Evalúa todas las alertas activas. Guarda disparos y envía Telegram.
    Retorna la cantidad de alertas disparadas.
    """
    alerts = db.query(Alert).filter(Alert.active == True).all()  # noqa: E712
    fired = 0

    for alert in alerts:
        try:
            triggered, message = _evaluate_condition(alert)
        except Exception as exc:
            logger.error("Error evaluando alerta id=%s: %s", alert.id, exc)
            continue

        if not triggered:
            continue

        # Registrar en BD
        record = TriggeredAlert(
            alert_id=alert.id,
            triggered_at=datetime.now(timezone.utc),
            message=message,
            seen=False,
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        fired += 1
        logger.info("Alerta disparada id=%s: %s", alert.id, message)

        # Enviar Telegram si está configurado
        if alert.telegram_chat_id:
            await send_message(alert.telegram_chat_id, message)

    return fired


def evaluate_alert_now(alert: Alert) -> tuple[bool, str]:
    """Evalúa una sola alerta inmediatamente (sin persistir). Para endpoint /test."""
    return _evaluate_condition(alert)
