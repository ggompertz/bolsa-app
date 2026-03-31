"""
Endpoints de trading apalancado: registro y historial de operaciones.
"""
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import Trade
from api.auth import get_current_user, User

router = APIRouter(prefix="/api/trades", tags=["trades"])


# ─── Schemas ───────────────────────────────────────────────────────────────

class TradeCreate(BaseModel):
    symbol: str
    market: str = "CRYPTO"
    direction: str              # "long" | "short"
    leverage: int               # 20, 50, 100, 200
    entry_price: float
    stop_loss: float
    liquidation_price: float
    tp1: float
    tp2: float
    tp3: float
    capital: float
    position_size: float
    notes: Optional[str] = None


class TradeClose(BaseModel):
    exit_price: float
    status: str = "closed"      # "closed" | "stopped"


class TradeOut(BaseModel):
    id: int
    symbol: str
    market: str
    direction: str
    leverage: int
    entry_price: float
    stop_loss: float
    liquidation_price: float
    tp1: float
    tp2: float
    tp3: float
    capital: float
    position_size: float
    status: str
    exit_price: Optional[float]
    pnl: Optional[float]
    pnl_pct: Optional[float]
    notes: Optional[str]
    opened_at: datetime
    closed_at: Optional[datetime]
    model_config = {"from_attributes": True}


# ─── Helpers ───────────────────────────────────────────────────────────────

def _calc_pnl(direction: str, entry: float, exit_price: float, leverage: int, capital: float):
    if direction == "long":
        pnl_pct = (exit_price - entry) / entry * leverage * 100
    else:
        pnl_pct = (entry - exit_price) / entry * leverage * 100
    pnl = capital * pnl_pct / 100
    return round(pnl, 2), round(pnl_pct, 2)


# ─── Endpoints ─────────────────────────────────────────────────────────────

@router.post("", response_model=TradeOut, status_code=201)
def create_trade(
    body: TradeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.direction not in ("long", "short"):
        raise HTTPException(400, "direction debe ser 'long' o 'short'")
    if body.leverage not in (20, 50, 100, 200):
        raise HTTPException(400, "leverage debe ser 20, 50, 100 o 200")

    trade = Trade(
        user_id=current_user.id,
        **body.model_dump(),
    )
    db.add(trade)
    db.commit()
    db.refresh(trade)
    return trade


@router.get("", response_model=list[TradeOut])
def list_trades(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Trade).filter(Trade.user_id == current_user.id)
    if status:
        q = q.filter(Trade.status == status)
    return q.order_by(Trade.opened_at.desc()).all()


@router.patch("/{trade_id}/close", response_model=TradeOut)
def close_trade(
    trade_id: int,
    body: TradeClose,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    trade = db.get(Trade, trade_id)
    if not trade or trade.user_id != current_user.id:
        raise HTTPException(404, "Operación no encontrada")
    if trade.status != "open":
        raise HTTPException(400, "La operación ya está cerrada")

    trade.exit_price = body.exit_price
    trade.status = body.status
    trade.closed_at = datetime.now(timezone.utc)
    trade.pnl, trade.pnl_pct = _calc_pnl(
        trade.direction, trade.entry_price, body.exit_price, trade.leverage, trade.capital
    )
    db.commit()
    db.refresh(trade)
    return trade


@router.delete("/{trade_id}", status_code=204)
def delete_trade(
    trade_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    trade = db.get(Trade, trade_id)
    if not trade or trade.user_id != current_user.id:
        raise HTTPException(404, "Operación no encontrada")
    db.delete(trade)
    db.commit()
