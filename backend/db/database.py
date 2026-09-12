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
            ("user_id",           "INTEGER REFERENCES users(id)"),
        ]:
            try:
                conn.execute(text(f"ALTER TABLE alerts ADD COLUMN {col} {definition}"))
                conn.commit()
            except Exception:
                pass  # columna ya existe
        # Backfill de alertas preexistentes sin dueño (creadas antes del fix de
        # ownership) — se asignan al primer admin, único dato razonable
        # disponible hoy dado que nunca se registró quién las creó.
        try:
            conn.execute(text("""
                UPDATE alerts SET user_id = (
                    SELECT id FROM users WHERE is_admin = 1 ORDER BY id LIMIT 1
                ) WHERE user_id IS NULL
            """))
            conn.commit()
        except Exception:
            pass
        # Migración tabla users
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1"))
            conn.commit()
        except Exception:
            pass  # columna ya existe


