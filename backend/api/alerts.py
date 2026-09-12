"""
Endpoints CRUD para el sistema de alertas.
"""
import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import Alert, TriggeredAlert
from services.alert_evaluator import evaluate_alert_now, CONDITION_TYPES
from api.auth import get_current_user, User

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


# ─── Schemas ───────────────────────────────────────────────────────────────

class AlertCreate(BaseModel):
    symbol: str
    market: str = "US"
    condition_type: str
    condition_params: dict = {}
    telegram_chat_id: Optional[str] = None
    cooldown_hours: int = 24


class AlertOut(BaseModel):
    id: int
    symbol: str
    market: str
    condition_type: str
    condition_params: dict
    telegram_chat_id: Optional[str]
    active: bool
    created_at: datetime
    cooldown_hours: int
    last_triggered_at: Optional[datetime]

    model_config = {"from_attributes": True}


class TriggeredOut(BaseModel):
    id: int
    alert_id: int
    triggered_at: datetime
    message: str
    seen: bool
    symbol: str
    condition_type: str

    model_config = {"from_attributes": True}


# ─── Endpoints ─────────────────────────────────────────────────────────────

@router.post("", response_model=AlertOut, status_code=201)
def create_alert(
    body: AlertCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.condition_type not in CONDITION_TYPES:
        raise HTTPException(
            400,
            f"condition_type inválido. Válidos: {sorted(CONDITION_TYPES)}"
        )
    alert = Alert(
        user_id=current_user.id,
        symbol=body.symbol.upper(),
        market=body.market.upper(),
        condition_type=body.condition_type,
        condition_params=json.dumps(body.condition_params),
        telegram_chat_id=body.telegram_chat_id,
        cooldown_hours=body.cooldown_hours,
        active=True,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return _alert_to_out(alert)


@router.get("", response_model=list[AlertOut])
def list_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    alerts = (
        db.query(Alert)
        .filter(Alert.active == True, Alert.user_id == current_user.id)  # noqa: E712
        .order_by(Alert.created_at.desc())
        .all()
    )
    return [_alert_to_out(a) for a in alerts]


@router.delete("/{alert_id}", status_code=204)
def delete_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    alert = db.get(Alert, alert_id)
    if not alert or alert.user_id != current_user.id:
        raise HTTPException(404, "Alerta no encontrada")
    alert.active = False
    db.commit()


@router.get("/triggered", response_model=list[TriggeredOut])
def get_triggered(
    since: Optional[str] = Query(None, description="ISO datetime — solo retorna desde esta fecha"),
    unseen_only: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retorna alertas disparadas (para polling del frontend)."""
    q = (
        db.query(TriggeredAlert)
        .join(Alert)
        .filter(Alert.active == True, Alert.user_id == current_user.id)  # noqa: E712
    )
    if unseen_only:
        q = q.filter(TriggeredAlert.seen == False)  # noqa: E712
    if since:
        try:
            since_dt = datetime.fromisoformat(since.replace("Z", "+00:00"))
            q = q.filter(TriggeredAlert.triggered_at >= since_dt)
        except ValueError:
            raise HTTPException(400, "Formato de 'since' inválido. Usar ISO 8601.")
    records = q.order_by(TriggeredAlert.triggered_at.desc()).limit(50).all()
    return [_triggered_to_out(r) for r in records]


@router.put("/triggered/{triggered_id}/seen", status_code=204)
def mark_seen(
    triggered_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = db.get(TriggeredAlert, triggered_id)
    if not record or record.alert.user_id != current_user.id:
        raise HTTPException(404, "Notificación no encontrada")
    record.seen = True
    db.commit()


@router.post("/test/{alert_id}")
def test_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Evalúa la condición de una alerta ahora mismo (sin guardar ni enviar Telegram)."""
    alert = db.get(Alert, alert_id)
    if not alert or alert.user_id != current_user.id:
        raise HTTPException(404, "Alerta no encontrada")
    triggered, message = evaluate_alert_now(alert)
    return {"triggered": triggered, "message": message}


# ─── Helpers ───────────────────────────────────────────────────────────────

def _alert_to_out(alert: Alert) -> AlertOut:
    return AlertOut(
        id=alert.id,
        symbol=alert.symbol,
        market=alert.market,
        condition_type=alert.condition_type,
        condition_params=json.loads(alert.condition_params or "{}"),
        telegram_chat_id=alert.telegram_chat_id,
        active=alert.active,
        created_at=alert.created_at,
        cooldown_hours=alert.cooldown_hours or 24,
        last_triggered_at=alert.last_triggered_at,
    )


def _triggered_to_out(r: TriggeredAlert) -> TriggeredOut:
    return TriggeredOut(
        id=r.id,
        alert_id=r.alert_id,
        triggered_at=r.triggered_at,
        message=r.message,
        seen=r.seen,
        symbol=r.alert.symbol,
        condition_type=r.alert.condition_type,
    )
