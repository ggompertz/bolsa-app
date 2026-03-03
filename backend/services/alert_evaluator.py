"""
Evaluación de condiciones de alerta usando las funciones de analysis/.
"""
import json
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from data.fetcher import get_ohlcv
from data.markets import format_ticker
from analysis.indicators import add_rsi, add_volume_indicators
from analysis.candlesticks import get_all_patterns
from analysis.volume import detect_absorption
from analysis.patterns import find_support_resistance, detect_breakout
from db.models import Alert, TriggeredAlert
from services.telegram_service import send_message

logger = logging.getLogger(__name__)

CONDITION_TYPES = {
    "rsi_overbought",
    "rsi_oversold",
    "candle_pattern",
    "volume_anomaly",
    "breakout",
    "confluence",
}


def _check_single_condition(ctype: str, params: dict, df) -> tuple[bool, str]:
    """Evalúa una condición simple. Retorna (disparada, mensaje_corto)."""

    if ctype == "rsi_overbought":
        threshold = float(params.get("threshold", 70))
        df = add_rsi(df)
        rsi = float(df["RSI"].iloc[-1])
        if rsi > threshold:
            return True, f"RSI sobrecompra ({rsi:.1f} > {threshold})"
        return False, ""

    if ctype == "rsi_oversold":
        threshold = float(params.get("threshold", 30))
        df = add_rsi(df)
        rsi = float(df["RSI"].iloc[-1])
        if rsi < threshold:
            return True, f"RSI sobreventa ({rsi:.1f} < {threshold})"
        return False, ""

    if ctype == "candle_pattern":
        pattern = params.get("pattern", "Hammer")
        patterns_df = get_all_patterns(df)
        if pattern in patterns_df.columns and bool(patterns_df[pattern].iloc[-1]):
            return True, f"Patrón {pattern}"
        return False, ""

    if ctype == "volume_anomaly":
        multiplier = float(params.get("multiplier", 2.0))
        df = add_volume_indicators(df)
        vol_ratio = float(df["Volume_Ratio"].iloc[-1])
        absorbed = bool(detect_absorption(df).iloc[-1])
        if vol_ratio >= multiplier or absorbed:
            detail = "absorción" if absorbed else f"vol {vol_ratio:.1f}x"
            return True, f"Volumen anómalo ({detail})"
        return False, ""

    if ctype == "breakout":
        sr = find_support_resistance(df)
        result = detect_breakout(df, sr)
        if result["type"] is not None and result["confirmed"]:
            direction = "alcista" if result["type"] == "upside" else "bajista"
            return True, f"Ruptura {direction} en {result['level']:.2f}"
        return False, ""

    return False, ""


def _evaluate_condition(alert: Alert) -> tuple[bool, str]:
    """
    Evalúa la condición completa de una alerta (incluye confluencia).
    Retorna (disparada, mensaje_formateado).
    """
    ticker = format_ticker(alert.symbol, alert.market)
    params = json.loads(alert.condition_params or "{}")

    try:
        df = get_ohlcv(ticker, interval="1d", period="3mo")
    except Exception as exc:
        logger.error("Error obteniendo datos para %s: %s", ticker, exc)
        return False, ""

    # ── Confluencia de señales ─────────────────────────────────────────────
    if alert.condition_type == "confluence":
        conditions = params.get("conditions", [])
        min_match = int(params.get("min_match", 2))
        matched = []
        for cond in conditions:
            hit, detail = _check_single_condition(cond["type"], cond.get("params", {}), df)
            if hit:
                matched.append(detail)
        if len(matched) >= min_match:
            signals = " + ".join(matched)
            return True, f"🎯 <b>{ticker}</b>: Confluencia ({len(matched)}/{len(conditions)}) — {signals}"
        return False, ""

    # ── Condición simple ───────────────────────────────────────────────────
    hit, detail = _check_single_condition(alert.condition_type, params, df)
    if not hit:
        return False, ""

    emoji_map = {
        "rsi_overbought": "🔴", "rsi_oversold": "🟢",
        "candle_pattern": "🕯️", "volume_anomaly": "📊", "breakout": "⚡",
    }
    emoji = emoji_map.get(alert.condition_type, "🔔")
    return True, f"{emoji} <b>{ticker}</b>: {detail}"


def _in_cooldown(alert: Alert) -> bool:
    """Retorna True si la alerta está dentro del período de cooldown."""
    if not alert.cooldown_hours or alert.last_triggered_at is None:
        return False
    elapsed = datetime.now(timezone.utc) - alert.last_triggered_at
    return elapsed < timedelta(hours=alert.cooldown_hours)


async def evaluate_all_alerts(db: Session) -> int:
    """Evalúa todas las alertas activas respetando cooldown."""
    alerts = db.query(Alert).filter(Alert.active == True).all()  # noqa: E712
    fired = 0

    for alert in alerts:
        if _in_cooldown(alert):
            logger.debug("Alerta id=%s en cooldown — omitida", alert.id)
            continue

        try:
            triggered, message = _evaluate_condition(alert)
        except Exception as exc:
            logger.error("Error evaluando alerta id=%s: %s", alert.id, exc)
            continue

        if not triggered:
            continue

        # Actualizar last_triggered_at
        now = datetime.now(timezone.utc)
        alert.last_triggered_at = now

        record = TriggeredAlert(
            alert_id=alert.id,
            triggered_at=now,
            message=message,
            seen=False,
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        fired += 1
        logger.info("Alerta disparada id=%s: %s", alert.id, message)

        if alert.telegram_chat_id:
            await send_message(alert.telegram_chat_id, message)

    return fired


def evaluate_alert_now(alert: Alert) -> tuple[bool, str]:
    """Evalúa una sola alerta inmediatamente (sin persistir ni verificar cooldown)."""
    return _evaluate_condition(alert)
