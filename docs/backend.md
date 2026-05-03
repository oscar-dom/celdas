# Backend

> **Lee esto cuando:** trabajes en server actions, lógica de negocio, integraciones externas, cron jobs o queries a la DB.

---

## Stack backend

- **Next.js Server Components + Server Actions** como capa de aplicación.
- **API Routes** solo para webhooks externos y cron endpoints.
- **Supabase** como BaaS:
  - PostgreSQL para datos.
  - Auth para sesiones.
  - Storage para imágenes.
  - Realtime para WebSockets.
- **Stripe SDK** + **PayPal SDK** para pagos.
- **Vercel Cron** para tareas programadas.

---

## Organización del código

```
src/
├── lib/                          # Clientes y utilidades reutilizables
│   ├── supabase/
│   │   ├── server.ts             # createServerClient (con cookies de Next)
│   │   ├── client.ts             # createBrowserClient
│   │   ├── admin.ts              # createServiceRoleClient (operaciones privilegiadas)
│   │   └── types.ts              # Tipos generados con Supabase CLI
│   ├── stripe/
│   │   ├── client.ts             # Stripe instance
│   │   ├── payment-intents.ts    # createBidHold, releaseBidHold, captureWinningBid
│   │   ├── connect.ts            # Onboarding cuentas vendedores
│   │   ├── refunds.ts
│   │   └── webhooks.ts           # Handlers de eventos
│   ├── paypal/                   # (post-MVP)
│   ├── auth/
│   │   ├── server.ts             # requireAuth, requireAdmin helpers
│   │   └── session.ts
│   ├── auctions/
│   │   ├── config.ts             # AUCTION_CONFIG constants
│   │   ├── min-increment.ts      # getMinIncrement(currentBid)
│   │   └── validators.ts         # canBid, canOpenAuction, etc.
│   └── validation/               # Schemas zod compartidos
│
├── server-actions/               # Server Actions agrupadas por dominio
│   ├── auctions/
│   │   ├── open-admin-auction.ts
│   │   ├── open-owner-auction.ts
│   │   └── cancel-auction.ts
│   ├── bids/
│   │   └── place-bid.ts
│   ├── cells/
│   │   ├── update-image.ts
│   │   ├── list-fixed-price.ts
│   │   └── buy-fixed-price.ts
│   ├── moderation/
│   │   ├── approve.ts
│   │   └── reject.ts
│   └── profile/
│       ├── update.ts
│       └── start-stripe-onboarding.ts
│
└── app/api/                      # API routes (solo para casos no-action)
    ├── webhooks/
    │   ├── stripe/route.ts
    │   └── paypal/route.ts
    └── cron/
        ├── close-auctions/route.ts
        └── expire-cells/route.ts
```

---

## Patrón de Server Action

Toda Server Action sigue esta estructura:

```typescript
"use server";

import { z } from "zod";
import { requireAuth } from "@/lib/auth/server";
import { createServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const InputSchema = z.object({
  auctionId: z.string().uuid(),
  amount: z.number().int().positive(),
});

export async function placeBid(input: unknown) {
  // 1. Validar input
  const data = InputSchema.parse(input);

  // 2. Autenticar
  const user = await requireAuth();

  // 3. Lógica de negocio (con transacciones donde aplique)
  const supabase = createServerClient();
  // ... ejecutar lógica

  // 4. Invalidar caché de rutas afectadas
  revalidatePath(`/cell/${cellId}`);

  // 5. Retornar resultado tipado
  return { success: true, bidId };
}
```

**Reglas:**

- Inputs siempre validados con zod.
- Errores con mensajes claros (se muestran al usuario).
- Operaciones críticas en transacciones DB.
- `revalidatePath` o `revalidateTag` tras mutaciones.

---

## Cliente Supabase: cuándo usar cada uno

| Cliente                     | Cuándo                                                  | Permisos               |
| --------------------------- | ------------------------------------------------------- | ---------------------- |
| `createBrowserClient()`     | Client Components, suscripciones realtime               | RLS aplica             |
| `createServerClient()`      | Server Components, Server Actions con sesión de usuario | RLS aplica             |
| `createServiceRoleClient()` | Cron jobs, webhooks, operaciones admin                  | RLS bypassed (cuidado) |

**Regla de oro:** usar `serviceRole` solo cuando absolutamente necesario (cron, webhooks). En el resto, dejar que RLS proteja.

---

## Auth helpers

```typescript
// src/lib/auth/server.ts

export async function getSession() {
  const supabase = createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

export async function requireAuth() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session.user;
}

export async function requireAdmin() {
  const user = await requireAuth();
  const supabase = createServerClient();
  const { data } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!data?.is_admin) throw new Error("Admin access required");
  return user;
}
```

---

## Cron jobs

### Configuración (`vercel.json`)

```json
{
  "crons": [
    { "path": "/api/cron/close-auctions", "schedule": "* * * * *" },
    { "path": "/api/cron/expire-cells", "schedule": "0 3 * * *" }
  ]
}
```

### Protección de endpoints

```typescript
// src/lib/auth/cron.ts
export function assertCronAuth(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    throw new Response("Unauthorized", { status: 401 });
  }
}
```

Vercel envía `Authorization: Bearer ${CRON_SECRET}` automáticamente si está en env.

### Idempotencia

Cada cron debe ser idempotente (ejecutar 2 veces = ejecutar 1 vez):

- Usar status checks: `WHERE status = 'active'` antes de actuar.
- Usar `idempotencyKey` en llamadas Stripe.
- Logear `event_id` procesado en webhooks.

---

## Validación con Zod

Todos los inputs externos pasan por zod. Schemas compartidos en `src/lib/validation/`:

```typescript
// src/lib/validation/bids.ts
import { z } from "zod";

export const PlaceBidSchema = z.object({
  auctionId: z.string().uuid(),
  amount: z.number().int().min(50, "Mínimo 0.50€"),
});

export type PlaceBidInput = z.infer<typeof PlaceBidSchema>;
```

---

## Manejo de errores

### Tipos de error

```typescript
// src/lib/errors.ts
export class BusinessError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export class AuthError extends Error {}
export class ValidationError extends Error {}
```

### En Server Actions

```typescript
try {
  // ...
} catch (e) {
  if (e instanceof BusinessError) {
    return { error: { code: e.code, message: e.message } };
  }
  if (e instanceof z.ZodError) {
    return { error: { code: "VALIDATION", message: e.errors[0].message } };
  }
  console.error("Unexpected error:", e);
  return { error: { code: "UNKNOWN", message: "Algo salió mal" } };
}
```

---

## Migrations de Supabase

```bash
# Crear migration
supabase migration new add_auctions_table

# Aplicar en local
supabase db reset

# Push a remoto
supabase db push
```

**Convenciones:**

- Nombres descriptivos: `0001_initial_schema.sql`, `0002_add_moderation.sql`.
- Migrations idempotentes donde sea posible (`CREATE TABLE IF NOT EXISTS`).
- RLS policies en la misma migration que la tabla.

---

## Variables de entorno

```bash
# .env.example
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=                  # solo server

# Stripe
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_CONNECT_CLIENT_ID=

# PayPal (post-MVP)
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=

# Cron
CRON_SECRET=                                # generar con: openssl rand -hex 32

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
SYSTEM_USER_ID=                             # UUID del usuario "sistema"
```

---

## Logging y observabilidad

### MVP

- `console.log` / `console.error` con prefijos: `[auctions]`, `[bids]`, etc.
- Errores en webhooks loggeados con `event.id` para correlación.

### Producción (futuro)

- **Sentry** para errores.
- **Logtail** o **Axiom** para logs estructurados.
- **Vercel Analytics** ya viene con la plataforma.

---

## Testing backend

### MVP: tests críticos manualmente

- Flujo de puja end-to-end (con Stripe test mode).
- Cierre de subasta (forzar `ends_at` en pasado).
- Refund anual (forzar `expires_at` en pasado).

### Post-MVP

- **Vitest** para unit tests de validadores y utilidades.
- **Tests de integración** contra Supabase local (`supabase start`).
- **Mock Stripe** con `stripe-mock` para tests deterministas.
