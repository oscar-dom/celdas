# Frontend

> **Lee esto cuando:** trabajes en componentes UI, páginas, estilos, o experiencia de usuario.

---

## Stack frontend

- **Next.js 15** con App Router (Server Components por defecto).
- **React 19**.
- **TypeScript** estricto.
- **Tailwind CSS** para estilos.
- **shadcn/ui** para componentes base (no es una dependencia, son componentes copiados que vivirán en `src/components/ui/`).
- **Lucide React** para iconos.
- **react-hook-form + zod** para formularios.
- **Supabase JS client** para auth y realtime.

---

## Estructura de rutas (App Router)

```
src/app/
├── (public)/                      # Layout público (sin autenticación requerida)
│   ├── page.tsx                   # Landing: grid 9 celdas
│   └── cell/[id]/page.tsx         # Detalle celda (público pero limitado si no logueado)
│
├── (auth)/                        # Layout para flows de auth
│   ├── login/page.tsx
│   ├── register/page.tsx
│   └── forgot-password/page.tsx
│
├── (app)/                         # Layout autenticado
│   ├── layout.tsx                 # Verifica sesión, redirige si no logueado
│   ├── profile/
│   │   ├── page.tsx               # Mi perfil + mis celdas + historial
│   │   ├── edit/page.tsx          # Editar perfil
│   │   └── payouts/page.tsx       # Stripe Connect onboarding
│   ├── cell/[id]/manage/page.tsx  # Si soy dueño: cambiar imagen, abrir venta
│   └── bids/page.tsx              # Mis pujas activas
│
├── admin/                         # Solo admins
│   ├── layout.tsx                 # Verifica is_admin
│   ├── page.tsx                   # Dashboard admin
│   ├── auctions/page.tsx          # Abrir subastas
│   ├── moderation/page.tsx        # Cola moderación
│   └── users/page.tsx
│
└── api/
    ├── webhooks/
    │   ├── stripe/route.ts
    │   └── paypal/route.ts
    └── cron/
        ├── close-auctions/route.ts
        └── expire-cells/route.ts
```

**Convenciones:**
- Grupos `()` no afectan la URL pero permiten layouts distintos.
- Server Components por defecto (`'use server'` no necesario para fetching).
- Client Components con `'use client'` solo cuando hay interactividad (forms, realtime, animaciones).

---

## Componentes principales

### `<CellGrid />` (página principal)
- Grid 3x3 de 9 celdas.
- Cada celda muestra: imagen actual (si owned) / placeholder (locked) / countdown (in_auction).
- Click → navega a `/cell/[id]`.
- Animaciones sutiles (hover, transiciones).

### `<CellCard />`
Variantes según estado:
- **`locked`**: gris, candado icon, "Próximamente".
- **`in_auction`**: borde animado, countdown, "En subasta - actual: X€".
- **`owned`**: imagen + nombre del dueño + mensaje.
- **`for_sale`**: badge "En venta" + precio o "En subasta".

### `<CellDetail />`
- Imagen ampliada arriba.
- Info debajo: precio actual, countdown si subasta, dueño actual + mensaje.
- Pestañas: "Subasta actual" | "Historial" | "Acciones" (si soy dueño).
- Sección historial: lista cronológica de propietarios pasados con sus mensajes y precios.

### `<BidForm />` (Client Component)
- Input de cantidad con incremento mínimo pre-rellenado.
- Stripe PaymentElement embebido.
- Botón "Pujar X€" → llama Server Action.
- Estados: loading, success, error.

### `<BidHistory />` (Client Component, realtime)
- Lista de pujas en tiempo real.
- Suscripción a canal Supabase Realtime.
- Animación al añadir nueva puja (slide-in).

### `<Countdown />` (Client Component)
- Tiempo restante hasta `ends_at`.
- Re-renderiza cada segundo.
- Cambia color cuando queda < 2 min (warning anti-sniping).
- Muestra extensión cuando se prolonga ("¡Subasta extendida!").

### `<AdminAuctionForm />`
- Form para abrir subasta (admin) con duración + precio inicial.

### `<OwnerSellForm />`
- Tabs: "Subasta" | "Precio fijo".
- Subasta: duración (slider 1h-72h) + precio inicial.
- Precio fijo: solo precio.

### `<ImageUploadForm />`
- Drag & drop de imagen.
- Preview.
- Mensaje opcional.
- Sube a Supabase Storage → entra en `moderation_queue`.

### `<ModerationPanel />` (admin)
- Lista de items pending.
- Vista lado a lado: imagen propuesta + imagen actual de la celda.
- Botones aprobar / rechazar (con campo de nota).

---

## Estado global y data fetching

### Server data
- Fetched en Server Components con queries de Supabase server-side.
- Cacheo con `revalidatePath` / `revalidateTag` tras mutaciones.

### Client state
- **No usar Redux/Zustand para empezar.** React state local + Server Actions es suficiente.
- Si se complica: Zustand para estado UI no-server (ej: modales abiertos).

### Realtime
- Custom hook `useAuctionRealtime(auctionId)` para suscripción.
- Actualiza React Query cache (si lo añadimos) o estado local.

---

## Estilo y diseño visual

### Sistema de diseño
- **Colores:** definir paleta en `tailwind.config.ts` con `primary`, `secondary`, etc.
- **Tipografía:** Inter (Google Fonts) o similar.
- **Spacing:** sistema de Tailwind (4, 8, 12, 16, 24, 32, 48, 64).
- **Border radius:** consistente, prefer `rounded-lg` o `rounded-xl`.

### Componentes shadcn/ui a instalar (orden recomendado)
1. `button`, `input`, `label`, `card`
2. `dialog`, `sheet`, `tabs`
3. `form`, `toast`, `alert`
4. `avatar`, `badge`, `skeleton`
5. `dropdown-menu`, `select`

### Accesibilidad
- Todos los componentes interactivos con `aria-*` apropiados.
- Contraste mínimo WCAG AA.
- Navegación con teclado funcional.
- Loading states con `aria-busy` y skeletons.

### Responsive
- Mobile-first (la mayoría del tráfico será mobile).
- Grid 3x3 en desktop → 1 columna en mobile, 3 en md, etc.
- Modal full-screen en mobile, dialog centrado en desktop.

---

## Internacionalización

**MVP:** Solo español (no usar i18n library todavía).
**Futuro:** `next-intl` cuando necesitemos inglés u otros idiomas.

Pero ya escribir strings centralizadas en `src/lib/strings.ts` para facilitar migración:
```typescript
export const t = {
  cells: {
    locked: 'Próximamente',
    inAuction: 'En subasta',
    placeBid: 'Pujar',
    timeLeft: 'Tiempo restante',
  },
  // ...
};
```

---

## Performance

- **Server Components** por defecto → menos JS.
- **Imágenes con `next/image`** para optimización automática.
- **Streaming SSR** con Suspense boundaries.
- **Realtime selectivo:** solo suscribirse cuando el usuario está viendo una subasta activa.
- **Skeleton loaders** mientras carga.

---

## Testing (post-MVP)

- **Vitest** para unit tests de utilidades.
- **Playwright** para E2E (flow completo: registro → puja → cierre).
- **Storybook** opcional si los componentes crecen mucho.
