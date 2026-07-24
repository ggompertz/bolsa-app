# CLAUDE.md — bolsa-app

**Stack:** FastAPI (Python) · Next.js · SQLite · Vercel (frontend)
**Estado:** PAUSADO — backend sin hosting activo

- Frontend desplegado: https://frontend-zeta-weld-77.vercel.app
- Backend: código en GitHub, Fly.io expirado
- Última opción económica: Fly.io ~$2-4/mes (todo ya configurado)

**Features implementadas (pendientes de deploy):** panel de trading apalancado (20x/50x/100x/200x), calculadora de liquidación (TP1/2/3, pérdida máxima), historial de trades con P&L, fix del buscador de acciones.

**Al retomar:**
1. Agregar tarjeta en Fly.io
2. `flyctl deploy` desde `/root/bolsa-app/backend`
3. Actualizar env vars del frontend en Vercel con la nueva URL del backend

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- ALWAYS read graphify-out/GRAPH_REPORT.md before reading any source files, running grep/glob searches, or answering codebase questions. The graph is your primary map of the codebase.
- IF graphify-out/wiki/index.md EXISTS, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
