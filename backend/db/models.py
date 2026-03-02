"""
Modelos SQLAlchemy para el sistema de alertas.
"""
from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from db.database import Base


class Alert(Base):
    """Alerta configurada por el usuario."""
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    symbol: Mapped[str] = mapped_column(String(20), nullable=False)
    market: Mapped[str] = mapped_column(String(5), nullable=False, default="US")
    condition_type: Mapped[str] = mapped_column(String(30), nullable=False)
    # Parámetros extra en JSON (ej: {"pattern": "Hammer", "threshold": 70})
    condition_params: Mapped[str] = mapped_column(Text, default="{}")
    telegram_chat_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
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
