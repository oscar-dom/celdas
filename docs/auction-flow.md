# Flujo de Subastas

> **Lee esto cuando:** trabajes en la lógica de subastas (apertura, pujas, cierre, anti-sniping). Complementa a `business-rules.md` con detalles técnicos de implementación.

---

## Diagrama de estados de una subasta

```
                  admin/owner
                  abre subasta
                       │
                       ▼
                ┌─────────────┐
                │   active    │◀──────┐
                └──────┬──────┘       │
                       │              │ puja en últimos 2 min
   ends_at <= NOW()    │              │ (extiende ends_at)
                       ▼              │
            ┌─────────────────────────┘
            │
            ▼
      ¿hay pujas?
       │       │
   sí  │       │ no
       ▼       ▼
  ┌────────┐ ┌─────────────┐
  │completed│ │  cancelled  │
  └────────┘ └─────────────┘
       │           │
       ▼           ▼
   capturar    cell.status
   pago         → 'locked'
   ganador
       │
       ▼
   actualizar
   cells +
   ownership
   history
```

---

## Apertura de subasta

### Admin abre subasta de celda `locked`
**Server Action:** `openAdminAuction({ cellId, startingPrice, durationDays })`

```typescript
// pseudo-código
async function openAdminAuction({ cellId, startingPrice, durationDays }) {
  await assertIsAdmin();
  const cell = await getCellById(cellId);
  assert(cell.status === 'locked', 'Cell must be locked');

  const endsAt = new Date(Date.now() + durationDays * 86400 * 1000);

  await db.transaction(async (tx) => {
    await tx.insert(auctions).values({
      cell_id: cellId,
      opened_by: 'admin',
      opened_by_user_id: currentUser.id,
      starting_price: startingPrice,
      ends_at: endsAt,
      original_ends_at: endsAt,
    });
    await tx.update(cells).set({ status: 'in_auction' }).where(eq(cells.id, cellId));
  });
}
```

### Owner abre subasta de su celda `owned`
**Server Action:** `openOwnerAuction({ cellId, startingPrice, durationHours })`

Validaciones extra:
- `currentUser.id === cell.current_owner_id`.
- `1 <= durationHours <= 72`.
- No existe subasta activa ni listing fijo de esta celda.

Cambia `cells.status → 'for_sale'`.

---

## Sistema de pujas

### Server Action: `placeBid({ auctionId, amount })`

```typescript
async function placeBid({ auctionId, amount }) {
  const user = await requireAuth();
  const auction = await getAuction(auctionId);

  // Validaciones
  assert(auction.status === 'active', 'Auction not active');
  assert(auction.ends_at > new Date(), 'Auction ended');
  assert(user.id !== auction.current_highest_bidder_id, 'Already winning');

  const cell = await getCellById(auction.cell_id);
  assert(user.id !== cell.current_owner_id, 'Cannot bid on own cell');

  const minNext = (auction.current_highest_bid ?? auction.starting_price - 1) + getMinIncrement(auction.current_highest_bid);
  assert(amount >= minNext, `Min bid is ${minNext}`);

  // Pre-autorización Stripe
  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency: 'eur',
    customer: user.stripe_customer_id,
    capture_method: 'manual',
    metadata: { auction_id: auctionId, bidder_id: user.id },
  });

  // Si ya había puja anterior, liberar pre-autorización del anterior ganador
  if (auction.current_highest_bid) {
    await releasePriorBidHold(auctionId);
  }

  // Insertar puja + actualizar auction
  await db.transaction(async (tx) => {
    await tx.insert(bids).values({
      auction_id: auctionId,
      bidder_id: user.id,
      amount,
      stripe_payment_intent_id: paymentIntent.id,
      is_winning: true,
    });
    await tx.update(bids)
      .set({ is_winning: false })
      .where(and(eq(bids.auction_id, auctionId), ne(bids.id, newBidId)));

    // Anti-sniping
    let newEndsAt = auction.ends_at;
    const msUntilEnd = auction.ends_at.getTime() - Date.now();
    if (msUntilEnd <= AUCTION_CONFIG.ANTI_SNIPING_WINDOW_MS) {
      newEndsAt = new Date(Date.now() + AUCTION_CONFIG.ANTI_SNIPING_EXTENSION_MS);
    }

    await tx.update(auctions).set({
      current_highest_bid: amount,
      current_highest_bidder_id: user.id,
      ends_at: newEndsAt,
    }).where(eq(auctions.id, auctionId));
  });

  // Realtime broadcast (Supabase lo hace automáticamente con triggers de Postgres)
  return { success: true };
}
```

### Realtime con Supabase

**En el cliente** (Client Component en `cell/[id]/page.tsx`):
```typescript
useEffect(() => {
  const channel = supabase
    .channel(`auction:${auctionId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'bids',
      filter: `auction_id=eq.${auctionId}`,
    }, (payload) => {
      // Actualizar UI con nueva puja
    })
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'auctions',
      filter: `id=eq.${auctionId}`,
    }, (payload) => {
      // Actualizar countdown si ends_at cambió (anti-sniping)
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [auctionId]);
```

---

## Cierre de subasta (cron job)

**Endpoint:** `src/app/api/cron/close-auctions/route.ts` (protegido con `CRON_SECRET`).
**Frecuencia:** cada minuto (`vercel.json`).

```typescript
export async function GET(req: Request) {
  assertCronAuth(req);

  const expired = await db.select().from(auctions)
    .where(and(eq(auctions.status, 'active'), lte(auctions.ends_at, new Date())));

  for (const auction of expired) {
    await closeAuction(auction);
  }

  return Response.json({ closed: expired.length });
}

async function closeAuction(auction) {
  const winningBid = await getWinningBid(auction.id);

  if (!winningBid) {
    // Sin pujas → cancelar
    await db.transaction(async (tx) => {
      await tx.update(auctions).set({ status: 'cancelled' }).where(eq(auctions.id, auction.id));
      await tx.update(cells).set({ status: 'locked' }).where(eq(cells.id, auction.cell_id));
    });
    return;
  }

  // Capturar payment intent del ganador
  await stripe.paymentIntents.capture(winningBid.stripe_payment_intent_id);

  // Calcular comisión
  const systemFee = Math.round(winningBid.amount * 0.05);
  const ownerPayout = winningBid.amount - systemFee;

  // Si era subasta de owner → payout al owner
  if (auction.opened_by === 'owner') {
    await stripe.transfers.create({
      amount: ownerPayout,
      currency: 'eur',
      destination: auction.opened_by_user.stripe_account_id,
    });
  }

  // Cerrar ownership anterior y crear nuevo
  await db.transaction(async (tx) => {
    // Cerrar ownership anterior (si había)
    await tx.update(cellOwnershipHistory)
      .set({ sold_at: new Date(), sale_price: winningBid.amount })
      .where(and(
        eq(cellOwnershipHistory.cell_id, auction.cell_id),
        isNull(cellOwnershipHistory.sold_at),
      ));

    // Nuevo ownership
    await tx.insert(cellOwnershipHistory).values({
      cell_id: auction.cell_id,
      owner_id: winningBid.bidder_id,
      acquired_at: new Date(),
      acquisition_price: winningBid.amount,
      acquisition_type: 'auction',
    });

    // Actualizar cell
    await tx.update(cells).set({
      current_owner_id: winningBid.bidder_id,
      acquired_at: new Date(),
      expires_at: new Date(Date.now() + 365 * 86400 * 1000),
      current_acquisition_price: winningBid.amount,
      status: 'owned',
    }).where(eq(cells.id, auction.cell_id));

    // Cerrar auction
    await tx.update(auctions).set({
      status: 'completed',
      winner_id: winningBid.bidder_id,
      final_price: winningBid.amount,
    }).where(eq(auctions.id, auction.id));

    // Registrar transactions
    await tx.insert(transactions).values([
      { user_id: winningBid.bidder_id, type: 'bid_payment', amount: winningBid.amount, system_fee: systemFee, /* ... */ },
      { user_id: SYSTEM_USER_ID, type: 'system_fee', amount: systemFee, /* ... */ },
      ...(auction.opened_by === 'owner' ? [{ user_id: auction.opened_by_user_id, type: 'payout', amount: ownerPayout, /* ... */ }] : []),
    ]);
  });

  // Liberar pre-autorizaciones de perdedores
  await releaseLosingBids(auction.id, winningBid.id);
}
```

---

## Expiración anual (cron job)

**Endpoint:** `src/app/api/cron/expire-cells/route.ts`.
**Frecuencia:** diaria.

```typescript
export async function GET(req: Request) {
  assertCronAuth(req);

  const expired = await db.select().from(cells)
    .where(and(eq(cells.status, 'owned'), lte(cells.expires_at, new Date())));

  for (const cell of expired) {
    await expireCell(cell);
  }
}

async function expireCell(cell) {
  const refund = Math.round(cell.current_acquisition_price * 0.5);

  // Refund 50% al dueño actual
  const lastTransaction = await getLastBidPayment(cell.id, cell.current_owner_id);
  await stripe.refunds.create({
    payment_intent: lastTransaction.provider_transaction_id,
    amount: refund,
  });

  await db.transaction(async (tx) => {
    // Cerrar ownership
    await tx.update(cellOwnershipHistory)
      .set({ sold_at: new Date() })
      .where(and(
        eq(cellOwnershipHistory.cell_id, cell.id),
        isNull(cellOwnershipHistory.sold_at),
      ));

    // Crear nueva subasta
    const endsAt = new Date(Date.now() + 7 * 86400 * 1000);
    await tx.insert(auctions).values({
      cell_id: cell.id,
      opened_by: 'admin',
      opened_by_user_id: SYSTEM_USER_ID,
      starting_price: cell.current_acquisition_price,
      ends_at: endsAt,
      original_ends_at: endsAt,
    });

    // Actualizar cell
    await tx.update(cells).set({
      status: 'in_auction',
      current_owner_id: null,
      current_image_url: null,
      owner_message: null,
      acquired_at: null,
      expires_at: null,
      current_acquisition_price: null,
    }).where(eq(cells.id, cell.id));

    // Registrar refund
    await tx.insert(transactions).values({
      user_id: cell.current_owner_id,
      type: 'refund',
      amount: refund,
      /* ... */
    });
  });
}
```

---

## Edge cases técnicos

- **Concurrencia:** `db.transaction` con nivel `SERIALIZABLE` en operaciones críticas para evitar race conditions.
- **Idempotencia del cron:** chequear `status` antes de actuar (no procesar dos veces).
- **Fallos parciales:** si `stripe.paymentIntents.capture` falla → retry 3 veces, luego marcar manual y alertar admin.
- **Reloj distribuido:** confiar en `NOW()` de la DB, no en `Date.now()` del servidor app, para consistencia.
