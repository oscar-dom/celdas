# Progreso del Proyecto

> **Lee esto cuando:** quieras saber el estado actual del proyecto, qué se ha completado, qué sigue, y dónde retomar el trabajo.

> **Actualiza este archivo cuando:** completes una tarea, cambies de fase, o tomes decisiones importantes.

---

## Estado actual

**Fase actual:** Fase 0 — Setup base
**Última actualización:** 2026-05-02

---

## Completado

### Inicialización (2026-05-01)
- ✅ Repositorio Git local creado en `Desktop/GitHub/Celdas`
- ✅ `CLAUDE.md` inicial creado
- ✅ `README.md` y `.gitignore` base
- ✅ Primer commit con estructura inicial
- ✅ Plan completo validado con el usuario

### Documentación (2026-05-02)
- ✅ `CLAUDE.md` actualizado con visión, stack y referencias
- ✅ `docs/architecture.md` — arquitectura técnica completa
- ✅ `docs/database-schema.md` — schema PostgreSQL + RLS
- ✅ `docs/business-rules.md` — reglas de negocio (subastas, pagos, propiedad)
- ✅ `docs/auction-flow.md` — flujos detallados de subastas
- ✅ `docs/payment-flow.md` — Stripe Connect + PayPal
- ✅ `docs/frontend.md` — patrones y estructura UI
- ✅ `docs/backend.md` — server actions, cron jobs, integraciones
- ✅ `docs/progress.md` — este archivo

### Git Flow setup (2026-05-02)
- ✅ GitHub CLI (`gh`) instalado y autenticado como `oscar-dom`
- ✅ Rama `develop` creada y pusheada
- ✅ `.github/PULL_REQUEST_TEMPLATE.md` — plantilla de PRs
- ✅ `.github/ISSUE_TEMPLATE/bug_report.md` y `feature_request.md`
- ✅ `.github/CODEOWNERS` — auto-asignación de revisores
- ✅ `.github/workflows/ci.yml` — CI con lint + typecheck + build + commitlint
- ✅ `CONTRIBUTING.md` — guía de contribución completa
- ✅ `.gitignore` reforzado con patrones de secretos
- ✅ Repo cambiado a **público** (para acceder a branch protection en plan free)
- ✅ Branch protection (rulesets) activa en `main` (squash-only, conversaciones resueltas, linear history) y `develop` (PR required)
- ✅ Secret scanning + push protection activados
- ✅ Dependabot vulnerability alerts + automated security fixes activados
- ✅ Skill `setup-git-flow` creado en `~/.claude/skills/` para replicar en futuros proyectos
- ✅ `docs/git-cheatsheet.md` — referencia rápida de Git/PRs/commits para humanos e IAs (también incluida en el skill)
- ⏳ commitlint + husky local (cuando exista `package.json` tras setup Next.js)

---

## Próximos pasos inmediatos (Fase 0)

### Setup del proyecto
- [ ] Crear repositorio en GitHub y conectar el local
- [ ] Inicializar Next.js 15 con TypeScript en `Desktop/GitHub/Celdas`
  - Comando: `pnpm dlx create-next-app@latest . --typescript --tailwind --app --no-src-dir=false`
- [ ] Configurar Tailwind CSS y shadcn/ui (`pnpm dlx shadcn@latest init`)
- [ ] Instalar componentes shadcn iniciales: button, input, card, dialog, form, toast
- [ ] Configurar ESLint + Prettier
- [ ] Setup de paths absolutos en `tsconfig.json` (`@/`)

### Supabase
- [ ] Crear cuenta y proyecto en supabase.com
- [ ] Instalar Supabase CLI localmente
- [ ] `supabase init` en el proyecto
- [ ] Crear primera migration con schema completo (de `docs/database-schema.md`)
- [ ] Crear `supabase/seed.sql` con las 9 celdas iniciales
- [ ] Configurar variables de entorno (`.env.local` + `.env.example`)
- [ ] Generar tipos TypeScript: `supabase gen types`

### Vercel
- [ ] Crear cuenta Vercel
- [ ] Conectar repositorio GitHub
- [ ] Configurar variables de entorno en Vercel dashboard
- [ ] Deploy inicial

### Stripe
- [ ] Crear cuenta Stripe (modo test)
- [ ] Activar Stripe Connect Express
- [ ] Configurar webhook endpoint local (Stripe CLI: `stripe listen`)

---

## Fase 1 — MVP Core (próxima)

**Objetivo:** Una celda funcional con puja real (Stripe test mode), realtime, y cierre automático.

- [ ] Auth: páginas login/register con Supabase Auth
- [ ] Layout principal con header y session
- [ ] Página principal: grid 9 celdas (8 locked, 1 in_auction)
- [ ] Página detalle celda
- [ ] Server Action `placeBid` con pre-autorización Stripe
- [ ] Realtime de pujas con Supabase
- [ ] Countdown component con anti-sniping visual
- [ ] Cron `close-auctions` con captura de pago
- [ ] Cell ownership history mínimo
- [ ] Panel admin minimal: abrir subasta en celda 1

---

## Fase 2 — Funcionalidades completas

- [ ] Las 9 celdas activables progresivamente
- [ ] Sistema de mensajes históricos por dueño
- [ ] Upload de imagen (Supabase Storage)
- [ ] Cola de moderación + panel admin completo
- [ ] Venta por dueño (subasta + precio fijo)
- [ ] PayPal como alternativa de pago
- [ ] Cron de expiración anual + refund 50%
- [ ] Profile completo con celdas poseídas e historial

---

## Fase 3 — Pulido y producción

- [ ] Notificaciones por email (Resend)
- [ ] Tests E2E con Playwright
- [ ] Mejoras UX (animaciones, loading states)
- [ ] SEO + OpenGraph
- [ ] Audit de seguridad
- [ ] T&C + Política de privacidad (GDPR)
- [ ] Producción: Stripe live mode

---

## Decisiones tomadas

| Fecha | Decisión | Motivo |
|-------|----------|--------|
| 2026-05-01 | Stack: Next.js 15 + TypeScript + Supabase + Vercel | Simple, gratis, bien documentado |
| 2026-05-01 | Pagos: Stripe + PayPal | Stripe principal por Connect; PayPal opcional |
| 2026-05-01 | Realtime con WebSockets (Supabase Realtime) | Mejor UX en pujas |
| 2026-05-01 | Anti-sniping: extender 2 min si puja en últimos 2 min | Estándar industria, justo |
| 2026-05-01 | Subasta sin pujas → celda vuelve a `locked` | Simple, sin penalizaciones |
| 2026-05-01 | Duración subastas: admin libre, owner 1h-72h | Balance flexibilidad/control |
| 2026-05-02 | Documentación distribuida en `docs/` (no todo en CLAUDE.md) | Eficiencia de tokens en Claude |
| 2026-05-02 | Git Flow ligero: `main` + `develop` + `feat/fix/chore` | Profesional, escalable, separa producción de integración |
| 2026-05-02 | Conventional Commits con linter automático | Historial legible, posibilidad de changelogs auto |
| 2026-05-02 | GitHub Actions CI desde el inicio | Red de seguridad: bloquea merges con código roto |

---

## Decisiones pendientes (cuando lleguemos)

- [ ] Diseño visual: paleta de colores, tipografía, look & feel
- [ ] Política de moderación detallada (T&C)
- [ ] Modelo de impuestos (IVA en España)
- [ ] Política de protección de datos (GDPR completo)
- [ ] Decisión: ¿usar React Query/SWR o solo Server Actions?
- [ ] Decisión: ¿Drizzle ORM o Supabase client directo?

---

## Bloqueos / Riesgos

- *(Ninguno actualmente)*

---

## Cómo retomar el trabajo

1. Lee este archivo (`docs/progress.md`).
2. Si vas a trabajar en una sección específica, lee el doc correspondiente:
   - Setup → este archivo + `CLAUDE.md`
   - Frontend → `docs/frontend.md`
   - Backend → `docs/backend.md`
   - DB → `docs/database-schema.md`
3. Marca tareas completadas con `[x]` y añade fecha cuando sea relevante.
4. Si tomas una decisión nueva, añádela a "Decisiones tomadas".
