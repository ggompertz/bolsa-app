"""
Modelos SQLAlchemy para el sistema de alertas y trading.
"""
from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from db.database import Base


class User(Base):
    """Usuario del sistema."""
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(200), nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )


class Alert(Base):
    """Alerta configurada por el usuario."""
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    symbol: Mapped[str] = mapped_column(String(20), nullable=False)
    market: Mapped[str] = mapped_column(String(5), nullable=False, default="US")
    condition_type: Mapped[str] = mapped_column(String(30), nullable=False)
    condition_params: Mapped[str] = mapped_column(Text, default="{}")
    telegram_chat_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    # Cooldown: horas mínimas entre disparos de la misma alerta (0 = sin cooldown)
    cooldown_hours: Mapped[int] = mapped_column(Integer, default=24)
    last_triggered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )

    triggered: Mapped[list["TriggeredAlert"]] = relationship(
        "TriggeredAlert", back_populates="alert", cascade="all, delete-orphan"
    )


class TriggeredAlert(Base):
    """Registro de cada vez que una alerta se disparó."""
    __tablename__ = "triggered"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    alert_id: Mapped[int] = mapped_column(ForeignKey("alerts.id"), nullable=False)
    triggered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    message: Mapped[str] = mapped_column(Text, nullable=False)
    seen: Mapped[bool] = mapped_column(Boolean, default=False)

    alert: Mapped["Alert"] = relationship("Alert", back_populates="triggered")


class Trade(Base):
    """Registro de operación de trading apalancado (simulado)."""
    __tablename__ = "trades"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    symbol: Mapped[str] = mapped_column(String(20), nullable=False)
    market: Mapped[str] = mapped_column(String(10), nullable=False, default="CRYPTO")
    direction: Mapped[str] = mapped_column(String(5), nullable=False)      # "long" | "short"
    leverage: Mapped[int] = mapped_column(Integer, nullable=False)         # 20, 50, 100, 200
    entry_price: Mapped[float] = mapped_column(Float, nullable=False)
    stop_loss: Mapped[float] = mapped_column(Float, nullable=False)
    liquidation_price: Mapped[float] = mapped_column(Float, nullable=False)
    tp1: Mapped[float] = mapped_column(Float, nullable=False)
    tp2: Mapped[float] = mapped_column(Float, nullable=False)
    tp3: Mapped[float] = mapped_column(Float, nullable=False)
    capital: Mapped[float] = mapped_column(Float, nullable=False)          # capital en USD
    position_size: Mapped[float] = mapped_column(Float, nullable=False)    # unidades
    status: Mapped[str] = mapped_column(String(10), default="open")        # open | closed | stopped
    exit_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    pnl: Mapped[float | None] = mapped_column(Float, nullable=True)        # P&L en USD
    pnl_pct: Mapped[float | None] = mapped_column(Float, nullable=True)    # P&L en %
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    opened_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
