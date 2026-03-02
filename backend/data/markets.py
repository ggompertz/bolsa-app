"""
Configuración de mercados bursátiles soportados.
Chile usa sufijo .SN (Bolsa de Santiago via Yahoo Finance).
"""

MARKETS = {
    "CL": {
        "name": "Bolsa de Santiago",
        "suffix": ".SN",
        "currency": "CLP",
        "timezone": "America/Santiago",
        "popular": [
            "COPEC.SN", "SQM-B.SN", "BSANTANDER.SN", "CHILE.SN",
            "LTM.SN", "ENELAM.SN", "CMPC.SN", "FALABELLA.SN",
            "CENCOSUD.SN", "ENELCHILE.SN", "BCI.SN", "PARAUCO.SN",
        ],
    },
    "US": {
        "name": "NYSE / NASDAQ",
        "suffix": "",
        "currency": "USD",
        "timezone": "America/New_York",
        "popular": [
            "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA",
            "TSLA", "META", "NFLX", "AMD", "INTC",
        ],
    },
}

# Intervalos válidos y su periodo máximo en yfinance
VALID_INTERVALS = {
    "1m":  {"max_period": "7d",  "label": "1 minuto"},
    "5m":  {"max_period": "60d", "label": "5 minutos"},
    "15m": {"max_period": "60d", "label": "15 minutos"},
    "30m": {"max_period": "60d", "label": "30 minutos"},
    "1h":  {"max_period": "730d","label": "1 hora"},
    "1d":  {"max_period": "max", "label": "Diario"},
    "1wk": {"max_period": "max", "label": "Semanal"},
    "1mo": {"max_period": "max", "label": "Mensual"},
}


def format_ticker(symbol: str, market: str = "US") -> str:
    """Agrega el sufijo del mercado si no está presente."""
    market_cfg = MARKETS.get(market.upper(), MARKETS["US"])
    suffix = market_cfg["suffix"]
    if suffix and not symbol.upper().endswith(suffix):
        return f"{symbol.upper()}{suffix}"
    return symbol.upper()
