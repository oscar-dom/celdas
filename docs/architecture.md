# Arquitectura Técnica

> **Lee esto cuando:** vayas a tomar decisiones de diseño cross-cutting, integrar nuevas piezas del sistema, o entender cómo encaja todo.

---

## Visión arquitectónica

Aplicación **monolítica full-stack** construida sobre Next.js 15 (App Router). Una sola codebase que sirve frontend y backend. La elección prioriza **simplicidad operacional** y **velocidad de desarrollo** sobre escalabilidad horizontal extrema (innecesaria en MVP).

```
┌─────────────────────────────────────────────────────────────┐
│                       CLIENTE (Navegador)                    │
│   Next.js Pages (RSC)  +  React Client Components            │
│   Supabase Realtime client (WebSockets para pujas)           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ HTTP / WSS
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    VERCEL (Edge + Node)                      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Next.js Server                                     │    │
│  │  - Server Components (data fetching)                │    │
│  │  - Server Actions (mutaciones: pujar, comprar)      │    │
│  │  - API Routes (webhooks Stripe/PayPal)              │    │
│  │  - Cron Functions (cierre subastas, expiraciones)   │    │
│  └─────────────────────────────────────────────────────┘    │
└──────┬─────────────────────────────────────────┬────────────┘
       │                                          │
       │                                          │
┌──────▼──────────────┐                ┌──────────▼──────────┐
│      SUPABASE       │                │   STRIPE / PAYPAL   │
│ - PostgreSQL        │                │ - Pagos / Payouts   │
│ - Auth              │                │ - Webhooks          │
│ - Storage (imágenes)│                │ - Connect (5% fee)  │
│ - Realtime (pujas)  │                └─────────────────────┘
│ - RLS               │
└─────────────────────┘
```

---

## Decisiones arquitectónicas clave

### 1. Next.js App Router (no Pages Router)
- **Por qué:** Server Components reducen JS enviado al cliente, mejor SEO, streaming nativo.
- **Trade-off:** Curva de aprendizaje mayor, pero la documentación oficial es excelente.

### 2. Supabase como BaaS (Backend-as-a-Service)
- **Por qué:** Una sola plataforma para DB + Auth + Storage + Realtime. Open-source (no lock-in extremo, podemos migrar a PostgreSQL puro).
- **Trade-off:** Dependencia de un proveedor; mitigado porque Supabase = PostgreSQL estándar + servicios opcionales.

### 3. Server Actions sobre API Routes
- **Por qué:** Type-safe, menos boilerplate, integración directa con React.
- **Cuándo usar API Routes:** Solo para webhooks externos (Stripe, PayPal) que no pueden usar Server Actions.

### 4. RLS (Row Level Security) como capa de seguridad principal
- **Por qué:** La seguridad vive en la DB, no en el código de aplicación. Imposible bypassear desde el cliente.
- **Implicación:** Todas las queries deben funcionar con RLS activo. Operaciones privilegiadas usan service role key (solo en server).

### 5. Pre-autorización de pagos al pujar (no captura inmediata)
- **Por qué:** Evita cargar dinero real hasta que se gane la subasta. Si pierdes, se libera la pre-autorización.
- **Implicación:** Stripe `payment_intent` con `capture_method: 'manual'`.

### 6. Cron jobs para operaciones críticas (no triggers de DB)
- **Por qué:** Más fácil de debuggear, idempotente, observabilidad clara.
- **Frecuencia:** Cada minuto para cierre de subastas; diario para expiraciones anuales.

---

## Flujo de datos típico (ejemplo: usuario puja)

1. Usuario hace click en "Pujar 50€" en `cell/[id]/page.tsx` (Server Component que renderiza un Client Component con form).
2. El form llama a una **Server Action** `placeBid(auctionId, amount)`.
3. La Server Action:
   - Valida sesión del usuario (Supabase Auth).
   - Valida amount > current_highest_bid + min_increment.
   - Crea pre-autorización en Stripe (`payment_intent` con `capture_method: 'manual'`).
   - Inserta fila en tabla `bids` con RLS validando que `bidder_id = auth.uid()`.
   - Actualiza `auctions.current_highest_bid`.
   - Si entra en últimos 2 min → extiende `ends_at` 2 min (anti-sniping).
4. Trigger de Postgres / Supabase Realtime emite evento.
5. Todos los clientes suscritos al canal `auction:{id}` reciben la nueva puja.
6. Cliente actualiza UI optimistamente.

---

## Capa por capa

### Capa de presentación (`src/app/`, `src/components/`)
- **Server Components** por defecto (mejor performance).
- **Client Components** solo para interactividad (forms, realtime, animaciones).
- Composición con `shadcn/ui` (componentes copiados, no dependencia, fácil customización).

### Capa de lógica de negocio (`src/server-actions/`, `src/lib/`)
- Server Actions agrupadas por dominio: `auctions/`, `bids/`, `cells/`, `payments/`, `users/`.
- `lib/` contiene utilidades reutilizables (clientes Supabase, Stripe, PayPal, validadores).

### Capa de datos (`supabase/`)
- Migrations versionadas en `supabase/migrations/`.
- RLS policies definidas en cada migration.
- Seeds en `supabase/seed.sql` (9 celdas iniciales).

### Capa de integraciones externas
- **Stripe:** En `src/lib/stripe/`, con cliente server-side y webhook handler.
- **PayPal:** En `src/lib/paypal/`, similar estructura.
- **Email** (futuro): Resend en `src/lib/email/`.

---

## Observabilidad y errores

- **Logging:** `console.log` en MVP, migrar a Logtail/Axiom en producción.
- **Errores:** Sentry (futuro) para errores frontend y backend.
- **Métricas:** Vercel Analytics gratuito en MVP.

---

## Escalabilidad futura

Si el proyecto crece más allá del MVP:
- **DB:** Supabase escala vertical fácilmente. Si necesitamos sharding, migrar a PostgreSQL gestionado en RDS/Cloud SQL.
- **Cron jobs:** Si Vercel Cron no basta, migrar a un worker dedicado (BullMQ + Redis).
- **Realtime:** Supabase Realtime escala bien; alternativa Pusher si necesitamos más conexiones.
- **CDN para imágenes:** Cloudflare o Bunny CDN delante de Supabase Storage.
