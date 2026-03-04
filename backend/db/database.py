"""
Configuración de base de datos SQLite + SQLAlchemy.
"""
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from config import settings


engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},  # necesario para SQLite
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    """Dependency para inyectar sesión de BD en los endpoints."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Crea todas las tablas si no existen y migra columnas nuevas."""
    from db.models import Alert, TriggeredAlert, User  # noqa: F401
    Base.metadata.create_all(bind=engine)
    # Migración segura: agregar columnas nuevas si no existen (SQLite no soporta IF NOT EXISTS en ADD COLUMN)
    with engine.connect() as conn:
        for col, definition in [
            ("cooldown_hours",    "INTEGER NOT NULL DEFAULT 24"),
            ("last_triggered_at", "DATETIME"),
        ]:
            try:
                conn.execute(text(f"ALTER TABLE alerts ADD COLUMN {col} {definition}"))
                conn.commit()
            except Exception:
                pass  # columna ya existe


