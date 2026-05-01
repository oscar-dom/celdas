# Database Schema

> **Lee esto cuando:** modifiques tablas, escribas queries complejas, ajustes RLS policies o crees migrations.

---

## Convenciones

- Nombres de tablas: `snake_case`, plural (`users`, `cells`, `auctions`).
- Primary keys: `id UUID DEFAULT gen_random_uuid()`, excepto `cells.id` que es `INT 1-9`.
- Timestamps: `created_at`, `updated_at` con `TIMESTAMPTZ` y default `NOW()`.
- Foreign keys: `<tabla_singular>_id` (ej: `auction_id`, `bidder_id`).
- Money: `INTEGER` representando céntimos (no `DECIMAL`) para evitar problemas de precisión.

---

## Tablas

### `profiles`
Datos públicos del usuario (la tabla `users` la gestiona Supabase Auth).
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  stripe_customer_id TEXT UNIQUE,
  paypal_account_id TEXT UNIQUE,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `cells`
Las 9 celdas (entidades fijas del sistema).
```sql
CREATE TYPE cell_status AS ENUM ('locked', 'in_auction', 'owned', 'for_sale');

CREATE TABLE cells (
  id INT PRIMARY KEY CHECK (id BETWEEN 1 AND 9),
  status cell_status NOT NULL DEFAULT 'locked',
  current_owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  current_image_url TEXT,
  owner_message TEXT,
  acquired_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,  -- acquired_at + 1 año
  current_acquisition_price INT,  -- en céntimos
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `auctions`
Subastas (activas e históricas).
```sql
CREATE TYPE auction_status AS ENUM ('active', 'completed', 'cancelled');
CREATE TYPE auction_opener AS ENUM ('admin', 'owner');

CREATE TABLE auctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cell_id INT NOT NULL REFERENCES cells(id),
  opened_by auction_opener NOT NULL,
  opened_by_user_id UUID REFERENCES profiles(id),
  status auction_status NOT NULL DEFAULT 'active',
  starting_price INT NOT NULL,  -- céntimos
  current_highest_bid INT,
  current_highest_bidder_id UUID REFERENCES profiles(id),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ NOT NULL,
  original_ends_at TIMESTAMPTZ NOT NULL,  -- para tracking anti-sniping
  winner_id UUID REFERENCES profiles(id),
  final_price INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_auctions_active_ending ON auctions(ends_at) WHERE status = 'active';
CREATE INDEX idx_auctions_cell ON auctions(cell_id);
```

### `bids`
Todas las pujas realizadas.
```sql
CREATE TABLE bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  bidder_id UUID NOT NULL REFERENCES profiles(id),
  amount INT NOT NULL,  -- céntimos
  stripe_payment_intent_id TEXT,  -- pre-autorización
  is_winning BOOLEAN NOT NULL DEFAULT FALSE,  -- denormalizado, actualizado por trigger
  placed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bids_auction ON bids(auction_id, amount DESC);
CREATE INDEX idx_bids_bidder ON bids(bidder_id);
```

### `cell_ownership_history`
Histórico de propiedad para mostrar en la vista detallada.
```sql
CREATE TYPE acquisition_type AS ENUM ('auction', 'fixed_price', 'initial');

CREATE TABLE cell_ownership_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cell_id INT NOT NULL REFERENCES cells(id),
  owner_id UUID NOT NULL REFERENCES profiles(id),
  acquired_at TIMESTAMPTZ NOT NULL,
  sold_at TIMESTAMPTZ,  -- NULL si aún es dueño actual
  acquisition_price INT NOT NULL,
  sale_price INT,
  acquisition_type acquisition_type NOT NULL,
  displayed_message TEXT,
  displayed_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_history_cell ON cell_ownership_history(cell_id, acquired_at DESC);
```

### `transactions`
Registro completo de movimientos de dinero (auditoría).
```sql
CREATE TYPE transaction_type AS ENUM ('bid_payment', 'refund', 'system_fee', 'payout');
CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
CREATE TYPE payment_provider AS ENUM ('stripe', 'paypal');

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  type transaction_type NOT NULL,
  amount INT NOT NULL,  -- céntimos
  currency TEXT NOT NULL DEFAULT 'EUR',
  system_fee INT NOT NULL DEFAULT 0,
  provider payment_provider NOT NULL,
  provider_transaction_id TEXT NOT NULL,
  related_auction_id UUID REFERENCES auctions(id),
  related_cell_id INT REFERENCES cells(id),
  status transaction_status NOT NULL DEFAULT 'pending',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_transactions_provider_id ON transactions(provider, provider_transaction_id);
```

### `moderation_queue`
Cola de moderación de imágenes/contenido antes de publicar.
```sql
CREATE TYPE moderation_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE moderation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cell_id INT NOT NULL REFERENCES cells(id),
  submitted_by UUID NOT NULL REFERENCES profiles(id),
  image_url TEXT NOT NULL,
  message TEXT,
  status moderation_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES profiles(id),
  review_notes TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX idx_moderation_pending ON moderation_queue(submitted_at) WHERE status = 'pending';
```

### `fixed_price_listings`
Cuando un dueño pone su celda a precio fijo.
```sql
CREATE TYPE listing_status AS ENUM ('active', 'sold', 'cancelled');

CREATE TABLE fixed_price_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cell_id INT NOT NULL REFERENCES cells(id),
  owner_id UUID NOT NULL REFERENCES profiles(id),
  price INT NOT NULL,
  status listing_status NOT NULL DEFAULT 'active',
  buyer_id UUID REFERENCES profiles(id),
  listed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sold_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

CREATE INDEX idx_listings_active ON fixed_price_listings(cell_id) WHERE status = 'active';
```

---

## RLS Policies (resumen)

| Tabla | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| profiles | público (todos) | propio | propio | nadie |
| cells | público | nadie (seed) | service_role / admin | nadie |
| auctions | público | service_role / admin (admin-opened) o owner (owner-opened) | service_role | nadie |
| bids | público | bidder = auth.uid() | nadie | nadie |
| cell_ownership_history | público | service_role | service_role | nadie |
| transactions | propio | service_role | service_role | nadie |
| moderation_queue | propio + admin | submitted_by = auth.uid() | admin | nadie |
| fixed_price_listings | público | owner = auth.uid() (debe ser dueño actual) | owner | owner (cancel) |

**Notas:**
- "Public" = `SELECT` permitido a usuarios no autenticados (para ver celdas y subastas).
- "service_role" = solo desde server con la service key (no expuesta al cliente).
- "admin" = `profiles.is_admin = TRUE`.

---

## Triggers importantes

1. **Actualizar `bids.is_winning`** cuando se inserta una nueva puja mayor.
2. **Auto-update `updated_at`** en cada UPDATE de cualquier tabla.
3. **Validar incremento mínimo** al insertar puja (error si `amount < current_highest_bid + min_increment`).

---

## Seed inicial

`supabase/seed.sql` debe insertar las 9 celdas en estado `locked`, con la celda `id=1` en estado `in_auction` (para tener algo funcional desde el primer momento) o lista para que admin abra subasta.
