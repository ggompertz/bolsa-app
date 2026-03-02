# Bolsa App - Sistema de Análisis Bursátil

Sistema de análisis técnico para mercados bursátiles de Chile y USA.

## Características

- **Obtención de datos**: Precios OHLCV en tiempo real e histórico (Bolsa de Santiago + NYSE/NASDAQ)
- **Indicadores técnicos**: Medias móviles (SMA, EMA), RSI, MACD, Bandas de Bollinger, Estocástico
- **Análisis de velas**: Patrones japoneses (Doji, Martillo, Envolvente, Estrella del Amanecer, etc.)
- **Análisis de volumen**: Detección de señales de giro, absorción de capital, divergencias
- **Patrones gráficos**: Soportes/Resistencias, Triángulos, Cuñas, Rupturas y falsas rupturas
- **Dashboard interactivo**: Gráficos dinámicos con Plotly

## Stack Tecnológico

### Backend (Python)
- **FastAPI** - API REST
- **yfinance** - Datos de mercado (Chile: sufijo `.SN`, USA: ticker directo)
- **pandas-ta** - Indicadores técnicos
- **Plotly** - Generación de gráficos

### Frontend (Next.js + React)
- **Next.js 15** - Framework web
- **Lightweight Charts** (TradingView) - Gráficos de velas profesionales
- **Tailwind CSS** - Estilos

## Mercados Soportados

| Mercado | Prefijo/Sufijo | Ejemplo |
|---------|---------------|---------|
| Bolsa de Santiago (Chile) | `.SN` | `COPEC.SN`, `SQM-B.SN` |
| NYSE / NASDAQ (USA) | directo | `AAPL`, `MSFT`, `TSLA` |

## Instalación

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

## Estructura del Proyecto

```
bolsa-app/
├── backend/
│   ├── data/           # Obtención y caché de datos
│   ├── analysis/       # Indicadores y patrones
│   ├── charts/         # Generación de gráficos
│   └── api/            # Endpoints REST
├── frontend/
│   └── src/
│       ├── app/        # Páginas Next.js
│       └── components/ # Componentes React
├── notebooks/          # Exploración y prototipado
└── docs/               # Documentación técnica
```
