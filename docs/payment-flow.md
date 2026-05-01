# Flujo de Pagos

> **Lee esto cuando:** integres Stripe o PayPal, gestiones webhooks, o resuelvas problemas de pagos. Complementa a `auction-flow.md` con detalles específicos del proveedor.

---

## Principios de diseño

1. **Nunca tocamos datos bancarios.** Stripe y PayPal los gestionan en sus servidores. Nuestra DB solo guarda IDs de transacciones.
2. **Pre-autorización antes de captura.** Pujar pre-autoriza dinero (no se cobra). Solo se cobra al ganar.
3. **Idempotencia.** Toda operación de pago lleva un `idempotency_key` para evitar dobles cobros si la red falla.
4. **Webhooks validados.** Stripe y PayPal envían webhooks con firma criptográfica que validamos.
5. **Audit trail.** Cada movimiento de dinero deja una fila en `transactions`.

---

## Stripe Connect

Usamos **Stripe Connect** porque permite:
- Cobrar al usuario que puja.
- Transferir parte al vendedor (si era subasta de owner).
- Quedarnos con el 5% como `application_fee_amount`.
- Gestionar refunds.

### Configuración inicial

1. Crear cuenta Stripe → activar **Connect Express** (más simple para usuarios).
2. Cuando un user gana su primera subasta de owner (vende), se le pide onboarding a Stripe Connect.
3. Webhooks endpoint: `https://celdas.app/api/webhooks/stripe`.

### Variables de entorno

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CONNECT_CLIENT_ID=ca_...
```

---

## Flujos de Stripe

### 1. Pre-autorización al pujar

```typescript
// src/lib/stripe/payment-intents.ts
export async function createBidHold({ userId, amount, auctionId }) {
  const customer = await getOrCreateStripeCustomer(userId);

  const intent = await stripe.paymentIntents.create({
    amount,                              // céntimos
    currency: 'eur',
    customer: customer.id,
    capture_method: 'manual',            // ⚠️ clave: no captura inmediato
    automatic_payment_methods: { enabled: true },
    metadata: {
      auction_id: auctionId,
      user_id: userId,
      type: 'bid_hold',
    },
  }, {
    idempotencyKey: `bid:${auctionId}:${userId}:${amount}`,
  });

  return intent;
}
```

**En el cliente** se confirma con Stripe Elements (PaymentElement). El usuario autoriza el cargo, pero no se cobra hasta `capture()`.

### 2. Liberar pre-autorización (cuando alguien supera tu puja)

```typescript
export async function releaseBidHold(paymentIntentId: string) {
  await stripe.paymentIntents.cancel(paymentIntentId, {
    cancellation_reason: 'abandoned',
  });
}
```

### 3. Capturar al cerrar subasta (cobrar al ganador)

```typescript
export async function captureWinningBid(intent: Stripe.PaymentIntent, opts: {
  systemFee: number;        // céntimos
  sellerStripeAccount?: string;  // si era subasta de owner
}) {
  const { systemFee, sellerStripeAccount } = opts;

  if (sellerStripeAccount) {
    // Subasta de owner: transferir al vendedor con fee del 5%
    await stripe.paymentIntents.update(intent.id, {
      application_fee_amount: systemFee,
      transfer_data: { destination: sellerStripeAccount },
    });
  }
  // En subasta admin (inicial), todo se queda en el sistema → no transfer.

  return await stripe.paymentIntents.capture(intent.id, {}, {
    idempotencyKey: `capture:${intent.id}`,
  });
}
```

### 4. Refund 50% en expiración anual

```typescript
export async function refundHalf(paymentIntentId: string, originalAmount: number) {
  const refundAmount = Math.round(originalAmount * 0.5);

  return await stripe.refunds.create({
    payment_intent: paymentIntentId,
    amount: refundAmount,
    reason: 'requested_by_customer',
    metadata: { type: 'annual_expiry_refund' },
  }, {
    idempotencyKey: `refund:expiry:${paymentIntentId}`,
  });
}
```

### 5. Onboarding de Stripe Connect (vendedores)

Cuando un usuario va a vender por primera vez:

```typescript
// Crear cuenta Connect Express
const account = await stripe.accounts.create({
  type: 'express',
  country: 'ES',
  email: user.email,
  capabilities: {
    transfers: { requested: true },
  },
});

// Generar onboarding link
const link = await stripe.accountLinks.create({
  account: account.id,
  refresh_url: 'https://celdas.app/profile/payouts/refresh',
  return_url: 'https://celdas.app/profile/payouts/done',
  type: 'account_onboarding',
});

// Guardar account.id en profiles.stripe_account_id
// Redirigir al usuario a link.url
```

---

## Webhooks de Stripe

**Endpoint:** `src/app/api/webhooks/stripe/route.ts`

```typescript
export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return new Response('Invalid signature', { status: 400 });
  }

  switch (event.type) {
    case 'payment_intent.succeeded':
      await handleCaptureSuccess(event.data.object);
      break;
    case 'payment_intent.payment_failed':
      await handleCaptureFailed(event.data.object);
      break;
    case 'charge.refunded':
      await handleRefundCompleted(event.data.object);
      break;
    case 'account.updated':
      await syncConnectAccountStatus(event.data.object);
      break;
  }

  return Response.json({ received: true });
}
```

**Importante:**
- Responder rápido (< 5s) o Stripe reintenta.
- Idempotencia: chequear `event.id` contra una tabla `webhook_events_processed` antes de actuar.

---

## PayPal

PayPal es **alternativa secundaria**. Para MVP, podemos lanzar solo Stripe y añadir PayPal después.

### Diferencias clave con Stripe

- PayPal **no tiene equivalente directo a `capture_method: manual`** con la misma flexibilidad. Se puede usar **Order Authorization → Capture** (válido 29 días).
- No hay equivalente a Connect tan integrado. Para payouts a vendedores: **PayPal Payouts API** (separado, hay que construir el flujo).

### Implementación recomendada (post-MVP)

```typescript
// 1. Crear order con intent='AUTHORIZE'
const order = await paypal.orders.create({
  intent: 'AUTHORIZE',
  purchase_units: [{ amount: { currency_code: 'EUR', value: amount.toFixed(2) } }],
});

// 2. Usuario aprueba en frontend (PayPal SDK)

// 3. Authorize (al confirmar puja)
const auth = await paypal.orders.authorize(order.id);

// 4. Capture (al ganar) o Void (al perder)
await paypal.authorizations.capture(auth.id);
// o
await paypal.authorizations.void(auth.id);
```

---

## Tabla de mapeo: evento → acción

| Evento | Stripe webhook | Acción nuestra |
|--------|---------------|----------------|
| Usuario gana subasta | `payment_intent.amount_capturable_updated` (al pre-autorizar) → `payment_intent.succeeded` (tras capture) | Confirmar transferencia de propiedad |
| Pago falla en captura | `payment_intent.payment_failed` | Marcar transacción failed, notificar admin, considerar reabrir |
| Refund procesado | `charge.refunded` | Actualizar `transactions.status = 'refunded'` |
| Vendedor completa onboarding | `account.updated` con `charges_enabled: true` | Permitir vender |
| Disputa | `charge.dispute.created` | Bloquear cuenta usuario, notificar admin |

---

## Seguridad

### Validaciones críticas
- ✅ Verificar firma webhook (`stripe.webhooks.constructEvent`).
- ✅ Verificar que el `payment_intent.metadata.user_id` coincide con el `bid.bidder_id`.
- ✅ Verificar que el `payment_intent.metadata.auction_id` coincide.
- ✅ Verificar que el `amount` capturado es exactamente el de la puja ganadora.
- ✅ Idempotencia con `idempotencyKey` en cada llamada Stripe.

### Variables sensibles
- Nunca exponer `STRIPE_SECRET_KEY` al cliente.
- Solo `STRIPE_PUBLISHABLE_KEY` en el frontend (Stripe Elements).
- Service role key de Supabase solo en server.

### Logs
- No logear datos completos de tarjetas (Stripe ya nunca los expone, pero por si acaso).
- Sí logear IDs de transacción para debugging.

---

## Testing

### Stripe Test Mode
- Usar `STRIPE_SECRET_KEY=sk_test_...` en desarrollo.
- Tarjetas de prueba: `4242 4242 4242 4242` (success), `4000 0000 0000 0002` (decline).
- Webhook testing: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.

### Casos a testear
1. Puja exitosa → pre-autorización en Stripe dashboard visible.
2. Puja superada → pre-autorización liberada.
3. Cierre de subasta → captura exitosa, transferencia al owner si aplica, fee del 5% registrado.
4. Reembolso anual → refund visible en dashboard.
5. Pago falla → manejo correcto, no se asigna celda.
