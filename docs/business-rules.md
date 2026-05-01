# Reglas de Negocio

> **Lee esto cuando:** implementes lógica relacionada con subastas, pagos, propiedad o moderación. Es la fuente de verdad sobre **qué debe hacer** el sistema.

---

## Estados de una celda

```
   ┌──────────┐  admin abre subasta   ┌──────────────┐
   │  locked  │──────────────────────▶│  in_auction  │
   └──────────┘                       └──────┬───────┘
        ▲                                    │ subasta termina
        │ sin pujas                          │
        │                                    ▼
        │                              ┌──────────┐
        └──────────────────────────────│  owned   │
                                       └─────┬────┘
                            owner pone venta │
                                             ▼
                                       ┌──────────┐
                                       │ for_sale │
                                       └──────────┘
                                             │ se vende → vuelve a 'owned' (con nuevo dueño)
                                             │ se cancela → vuelve a 'owned'
```

**Estado `for_sale`** puede subdividirse en:
- Subasta abierta por dueño (1h-72h) → registro en `auctions` con `opened_by = 'owner'`.
- Precio fijo → registro en `fixed_price_listings`.

---

## Subastas

### Apertura

| Quién abre | Duración | Precio inicial |
|-----------|----------|----------------|
| Admin (celda `locked`) | Libre, define el admin | Define el admin |
| Owner (celda `owned`) | Mínimo 1h, máximo 72h | Define el owner |

### Reglas de pujas

1. **Incremento mínimo:** se calcula sobre la puja actual:
   - < 10€ → +0.50€
   - 10€ - 100€ → +1€
   - 100€ - 1000€ → +5€
   - \> 1000€ → +10€
   *(Configurable en `lib/auctions/min-increment.ts`)*

2. **Validaciones al pujar:**
   - Usuario autenticado.
   - No es el `current_highest_bidder` (no puedes pujar contra ti mismo).
   - No es el dueño actual de la celda (no puede pujar en sus propias subastas).
   - Pre-autorización Stripe exitosa por el monto.
   - Subasta sigue `active`.

3. **Anti-sniping:**
   - Si una puja entra a < 2 minutos del `ends_at`, se extiende `ends_at += 2 minutos`.
   - `original_ends_at` se preserva para análisis.
   - No hay límite de extensiones (mientras haya actividad, sigue extendiéndose).

### Cierre

Cron job ejecuta cada minuto:
1. Selecciona auctions con `ends_at <= NOW() AND status = 'active'`.
2. Para cada una:
   - **Si hay pujas:**
     - `status → 'completed'`, `winner_id`, `final_price`.
     - Captura el `payment_intent` del ganador (cobro real).
     - Libera las pre-autorizaciones de los perdedores.
     - Calcula comisión 5%.
     - Si era subasta de owner: 95% al owner via Stripe Connect payout / PayPal.
     - Si era subasta inicial (admin): 95% queda en sistema.
     - Inserta fila en `cell_ownership_history`.
     - Actualiza `cells`: `current_owner_id`, `acquired_at = NOW()`, `expires_at = NOW() + 1 año`, `status = 'owned'`, `current_acquisition_price = final_price`.
   - **Si NO hay pujas:**
     - `status → 'cancelled'`.
     - `cells.status → 'locked'` (vuelve al estado inicial).
     - No hay penalizaciones para el owner que abrió la subasta sin éxito.

---

## Propiedad de celda

### Duración: 1 año
- `expires_at = acquired_at + INTERVAL '1 year'`.

### Personalización
- El dueño puede subir/cambiar imagen y mensaje en cualquier momento.
- Cualquier cambio entra en `moderation_queue` con status `pending`.
- El contenido **público** sigue siendo el último aprobado hasta que el nuevo se apruebe.
- Si se rechaza, el dueño recibe el motivo (`review_notes`) y debe enviar otro.

### Venta voluntaria
El dueño puede vender en cualquier momento durante el año:
- **Subasta:** abre auction con duración 1h-72h, define `starting_price`.
- **Precio fijo:** crea `fixed_price_listing` con `price`. Cualquier usuario autenticado puede comprar.

### Expiración (anual)
Cron job diario:
1. Selecciona cells con `expires_at <= NOW() AND status = 'owned'`.
2. Para cada una:
   - Reembolsa **50%** de `current_acquisition_price` al `current_owner_id` (via mismo provider del pago original).
   - Inserta en `cell_ownership_history` el cierre del periodo (`sold_at = NOW()`, `sale_price = NULL` porque no fue venta).
   - Crea nueva auction con:
     - `opened_by = 'admin'` (sistema).
     - `starting_price = current_acquisition_price` (precio que costó la última vez).
     - `ends_at = NOW() + INTERVAL '7 days'` (default).
   - `cells.status → 'in_auction'`.

---

## Comisiones

### Sistema cobra 5% en cada transacción exitosa
Aplica a:
- Compra inicial vía subasta (admin-opened): el sistema retiene 5%, 95% se queda como ingreso del sistema (no hay vendedor).
- Reventa por subasta (owner-opened): 5% para sistema, 95% para owner.
- Reventa a precio fijo: 5% para sistema, 95% para owner.

### Reembolso anual del 50%
- Aplica solo a celdas que **expiran** sin haber sido vendidas durante el año.
- No aplica si el dueño vendió antes del año (en ese caso ya recibió el 95% de la venta).
- El 50% sale del fondo del sistema (que acumuló comisiones + ingresos previos).

### Implicación financiera
El sistema necesita mantener reservas para cubrir reembolsos. **Importante:** modelar esto en producción para no quedarse sin liquidez. En MVP no es crítico (volumen bajo).

---

## Moderación de contenido

### Flujo
1. Usuario sube imagen/mensaje → entra en `moderation_queue` con `status = 'pending'`.
2. Admin revisa en panel `/admin/moderation`.
3. Admin aprueba → `status = 'approved'`, se actualiza `cells.current_image_url` y `cells.owner_message`.
4. Admin rechaza → `status = 'rejected'`, escribe `review_notes`. El dueño es notificado (futuro: email).

### Normativa básica (a refinar con T&C legal)
- Sin contenido sexual explícito.
- Sin violencia gráfica.
- Sin contenido ilegal o que incite al odio.
- Sin marcas registradas sin autorización.
- Sin información personal de terceros.

### Futuro: pre-filtro automático
- AWS Rekognition / OpenAI Moderation API filtra obvios.
- Solo casos límite van a moderación humana.

---

## Casos extremos

| Caso | Comportamiento |
|------|----------------|
| Usuario gana subasta pero su tarjeta falla al capturar | Cancelar venta, ofrecer al segundo mayor pujador (futuro) o reabrir |
| Dos pujas iguales en el mismo milisegundo | La que se inserta primera gana (DB serializa) |
| Owner abre subasta y luego quiere cancelar antes del fin | Permitido si no hay pujas; bloqueado si hay pujas |
| Admin marca imagen como rechazada después de aprobada | Permitido; vuelve a estado pendiente, dueño debe resubir |
| Sistema sin liquidez para refund anual | Bloquear renovación, alertar admin (futuro: alarma) |
| Usuario borra cuenta con celda activa | La celda vuelve a `locked`, no hay refund (cancelación voluntaria) |
| Subasta sigue extendiéndose por anti-sniping indefinidamente | OK por diseño; los participantes deciden cuándo parar |

---

## Configuración (constantes)

Se definen en `src/lib/auctions/config.ts`:

```typescript
export const AUCTION_CONFIG = {
  ANTI_SNIPING_WINDOW_MS: 2 * 60 * 1000,      // 2 minutos
  ANTI_SNIPING_EXTENSION_MS: 2 * 60 * 1000,   // extender 2 minutos
  OWNER_AUCTION_MIN_HOURS: 1,
  OWNER_AUCTION_MAX_HOURS: 72,
  ADMIN_AUCTION_DEFAULT_DAYS: 7,               // tras expiración anual
  SYSTEM_FEE_PERCENT: 5,                        // 5%
  ANNUAL_REFUND_PERCENT: 50,                    // 50%
  OWNERSHIP_DURATION_DAYS: 365,
};
```
