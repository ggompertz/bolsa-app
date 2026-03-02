from pydantic_settings import BaseSettings
from typing import Literal


class Settings(BaseSettings):
    app_name: str = "Bolsa App"
    app_version: str = "0.1.0"
    debug: bool = False

    # CORS — en producción setear FRONTEND_URL con la URL de Vercel
    frontend_url: str = "http://localhost:3000"
    allowed_origins: str = ""  # extra orígenes separados por coma

    # Cache
    cache_dir: str = ".cache"
    cache_ttl_realtime: int = 60        # 1 minuto para datos en tiempo real
    cache_ttl_daily: int = 3600         # 1 hora para datos diarios
    cache_ttl_historical: int = 86400   # 24 horas para histórico

    # Mercados
    default_interval: Literal["1m","5m","15m","30m","1h","1d","1wk","1mo"] = "1d"
    default_period: str = "1y"

    class Config:
        env_file = ".env"


settings = Settings()
