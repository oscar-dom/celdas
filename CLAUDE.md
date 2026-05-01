# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Documentación distribuida:** Este archivo es el punto de entrada y contiene la visión general. Los detalles técnicos están en `docs/` y se cargan bajo demanda para optimizar uso de tokens.

---

## Visión del Proyecto

**Celdas** es una webapp de subastas donde los usuarios compran "celdas" (9 inicialmente). Cada celda permite mostrar contenido personalizado (imagen → futuro: video/gif) y guarda un historial completo de propietarios.

### Modelo de negocio
- Las celdas se adquieren mediante **subastas** con tiempo limitado.
- El propietario tiene la celda durante **1 año**, tras el cual vuelve a subasta y se le reembolsa el **50%** del precio original.
- El propietario puede **vender antes** mediante subasta (1h-72h) o precio fijo.
- El sistema cobra una **comisión del 5%** en cada transacción.
- Las imágenes/contenido pasan por una **cola de moderación** antes de mostrarse.

### Estado del proyecto
**Fase actual:** Fase 0 - Setup base (proyecto recién inicializado)

Ver `docs/progress.md` para el estado detallado y próximos pasos.

---

## Stack Tecnológico

| Capa | Tecnología | Notas |
|------|-----------|-------|
| Framework | Next.js 15 (App Router) | Full-stack en una codebase |
| Lenguaje | TypeScript | Type-safety crítica con dinero real |
| UI | Tailwind CSS + shadcn/ui | Diseño rápido con buenos defaults |
| DB / Auth / Storage | Supabase (PostgreSQL) | Auth + Realtime + Storage incluidos |
| Realtime (pujas) | Supabase Realtime | WebSockets gestionados |
| Pagos | Stripe Connect + PayPal | Stripe principal, PayPal alternativo |
| Hosting | Vercel | Deploy automático desde Git |
| Cron jobs | Vercel Cron | Cierre subastas + refunds anuales |

**Costo MVP estimado:** $0/mes (free tiers).

---

## Estructura del Repositorio

```
Celdas/
├── CLAUDE.md                    # Este archivo (visión + índice)
├── README.md                    # Quick start público
├── docs/                        # Documentación técnica detallada
│   ├── architecture.md          # Arquitectura técnica
│   ├── database-schema.md       # Schema completo de DB + RLS
│   ├── business-rules.md        # Reglas de negocio (subastas, pagos, refunds)
│   ├── auction-flow.md          # Flujo detallado de subastas
│   ├── payment-flow.md          # Flujo de pagos Stripe/PayPal
│   ├── frontend.md              # Decisiones y patrones de frontend
│   ├── backend.md               # Decisiones y patrones de backend
│   └── progress.md              # Estado del proyecto + roadmap
├── src/                         # Código de la aplicación (a crear)
│   ├── app/                     # Next.js App Router
│   ├── components/              # Componentes React
│   ├── lib/                     # Utilidades (supabase, stripe, paypal)
│   ├── hooks/                   # React hooks
│   ├── types/                   # TypeScript types
│   └── server-actions/          # Server actions (lógica de negocio)
└── supabase/
    ├── migrations/              # SQL migrations
    └── seed.sql                 # Datos iniciales (9 celdas)
```

---

## Cómo navegar la documentación

Según en qué estés trabajando, lee solo los docs relevantes:

| Si trabajas en... | Lee primero... |
|------------------|----------------|
| Diseño general / arquitectura | `docs/architecture.md` |
| Base de datos / queries | `docs/database-schema.md` |
| Lógica de subastas | `docs/auction-flow.md` + `docs/business-rules.md` |
| Lógica de pagos | `docs/payment-flow.md` + `docs/business-rules.md` |
| Componentes UI / páginas | `docs/frontend.md` |
| API / Server actions / Cron | `docs/backend.md` |
| Saber qué falta hacer | `docs/progress.md` |

---

## Comandos comunes

*A documentar cuando esté el setup hecho. Por ahora:*

```bash
# Inicializar proyecto (pendiente)
# pnpm install
# pnpm dev
# pnpm build
```

---

## Convenciones del proyecto

- **Idioma del código:** Inglés (variables, funciones, comentarios técnicos).
- **Idioma de la UI:** Español (audiencia hispanohablante).
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, etc.). Sin atribuciones de IA.
- **Estilo:** TypeScript estricto, ESLint + Prettier (a configurar en setup).

### Git Flow

```
main      ← producción, protegida, solo PRs aprobados
develop   ← integración, protegida, solo PRs aprobados
feat/<x>  ← nueva funcionalidad (parte de develop, vuelve a develop)
fix/<x>   ← bugfix
chore/<x> ← mantenimiento, deps, configuración
docs/<x>  ← solo documentación
```

**Nunca** se pushea directo a `main` o `develop`. Ver `CONTRIBUTING.md` para el flujo completo.

---

## Notas críticas de seguridad

- **Nunca** se guardan datos bancarios en nuestra DB → Stripe los maneja.
- **RLS (Row Level Security)** activo en todas las tablas de Supabase.
- **Webhooks** de Stripe/PayPal validan firma criptográfica.
- **Pre-autorización** de pagos al pujar para evitar usuarios sin fondos.
- **Idempotencia** en transacciones para evitar dobles cobros.
- `.env` nunca se commitea, solo `.env.example` con valores ficticios.

---

## Última actualización

**2026-05-01:** Plan validado, estructura de docs creada, listos para iniciar Fase 0.
