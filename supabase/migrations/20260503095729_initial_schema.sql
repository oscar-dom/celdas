-- =====================================================================
-- Initial schema for Celdas
-- =====================================================================
-- Reference: docs/database-schema.md
--
-- Conventions:
--   - Money fields are INTEGER cents (no DECIMAL).
--   - Timestamps are TIMESTAMPTZ defaulting to NOW().
--   - All tables in `public` have RLS enabled.
--   - Authorization is based on `public.profiles.is_admin`, never on
--     `auth.users.raw_user_meta_data` (which is user-editable).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions; -- gen_random_uuid()

-- ---------------------------------------------------------------------
-- ENUM types
-- ---------------------------------------------------------------------
create type public.cell_status as enum ('locked', 'in_auction', 'owned', 'for_sale');
create type public.auction_status as enum ('active', 'completed', 'cancelled');
create type public.auction_opener as enum ('admin', 'owner');
create type public.acquisition_type as enum ('auction', 'fixed_price', 'initial');
create type public.transaction_type as enum ('bid_payment', 'refund', 'system_fee', 'payout');
create type public.transaction_status as enum ('pending', 'completed', 'failed', 'refunded');
create type public.payment_provider as enum ('stripe', 'paypal');
create type public.moderation_status as enum ('pending', 'approved', 'rejected');
create type public.listing_status as enum ('active', 'sold', 'cancelled');

-- ---------------------------------------------------------------------
-- Helper: updated_at trigger function
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  username            text unique not null,
  display_name        text,
  avatar_url          text,
  bio                 text,
  stripe_customer_id  text unique,
  stripe_account_id   text unique,
  paypal_account_id   text unique,
  is_admin            boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint username_format check (username ~ '^[a-z0-9_-]{3,30}$')
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Block self-promotion to admin / tampering with payment IDs.
-- Only service_role (which bypasses RLS) can set these fields.
create or replace function public.profiles_block_sensitive_updates()
returns trigger
language plpgsql
as $$
begin
  if new.is_admin is distinct from old.is_admin then
    raise exception 'is_admin can only be modified via service_role';
  end if;
  if new.stripe_customer_id is distinct from old.stripe_customer_id then
    raise exception 'stripe_customer_id can only be modified via service_role';
  end if;
  if new.stripe_account_id is distinct from old.stripe_account_id then
    raise exception 'stripe_account_id can only be modified via service_role';
  end if;
  if new.paypal_account_id is distinct from old.paypal_account_id then
    raise exception 'paypal_account_id can only be modified via service_role';
  end if;
  return new;
end;
$$;

create trigger profiles_block_sensitive_updates
  before update on public.profiles
  for each row execute function public.profiles_block_sensitive_updates();

-- ---------------------------------------------------------------------
-- is_admin() helper - safe because profiles SELECT is public
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- ---------------------------------------------------------------------
-- cells
-- ---------------------------------------------------------------------
create table public.cells (
  id                          int primary key check (id between 1 and 9),
  status                      public.cell_status not null default 'locked',
  current_owner_id            uuid references public.profiles(id) on delete set null,
  current_image_url           text,
  owner_message               text,
  acquired_at                 timestamptz,
  expires_at                  timestamptz,
  current_acquisition_price   int check (current_acquisition_price is null or current_acquisition_price > 0),
  updated_at                  timestamptz not null default now()
);

create trigger cells_set_updated_at
  before update on public.cells
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- auctions
-- ---------------------------------------------------------------------
create table public.auctions (
  id                          uuid primary key default gen_random_uuid(),
  cell_id                     int not null references public.cells(id),
  opened_by                   public.auction_opener not null,
  opened_by_user_id           uuid references public.profiles(id),
  status                      public.auction_status not null default 'active',
  starting_price              int not null check (starting_price > 0),
  current_highest_bid         int check (current_highest_bid is null or current_highest_bid > 0),
  current_highest_bidder_id   uuid references public.profiles(id),
  starts_at                   timestamptz not null default now(),
  ends_at                     timestamptz not null,
  original_ends_at            timestamptz not null,
  winner_id                   uuid references public.profiles(id),
  final_price                 int check (final_price is null or final_price > 0),
  created_at                  timestamptz not null default now(),
  constraint ends_after_start check (ends_at > starts_at),
  constraint owner_auction_has_user check (
    (opened_by = 'admin') or (opened_by = 'owner' and opened_by_user_id is not null)
  )
);

create index auctions_active_ending_idx on public.auctions(ends_at) where status = 'active';
create index auctions_cell_idx on public.auctions(cell_id);
create index auctions_winner_idx on public.auctions(winner_id) where winner_id is not null;

-- ---------------------------------------------------------------------
-- bids
-- ---------------------------------------------------------------------
create table public.bids (
  id                        uuid primary key default gen_random_uuid(),
  auction_id                uuid not null references public.auctions(id) on delete cascade,
  bidder_id                 uuid not null references public.profiles(id),
  amount                    int not null check (amount > 0),
  stripe_payment_intent_id  text,
  is_winning                boolean not null default false,
  placed_at                 timestamptz not null default now()
);

create index bids_auction_amount_idx on public.bids(auction_id, amount desc);
create index bids_bidder_idx on public.bids(bidder_id);
create unique index bids_auction_winning_idx on public.bids(auction_id) where is_winning;

-- ---------------------------------------------------------------------
-- cell_ownership_history
-- ---------------------------------------------------------------------
create table public.cell_ownership_history (
  id                    uuid primary key default gen_random_uuid(),
  cell_id               int not null references public.cells(id),
  owner_id              uuid not null references public.profiles(id),
  acquired_at           timestamptz not null,
  sold_at               timestamptz,
  acquisition_price     int not null check (acquisition_price > 0),
  sale_price            int check (sale_price is null or sale_price > 0),
  acquisition_type      public.acquisition_type not null,
  displayed_message     text,
  displayed_image_url   text,
  created_at            timestamptz not null default now(),
  constraint sold_after_acquired check (sold_at is null or sold_at > acquired_at)
);

create index cell_ownership_history_cell_idx
  on public.cell_ownership_history(cell_id, acquired_at desc);
create index cell_ownership_history_owner_idx
  on public.cell_ownership_history(owner_id);

-- ---------------------------------------------------------------------
-- transactions
-- ---------------------------------------------------------------------
create table public.transactions (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references public.profiles(id),
  type                      public.transaction_type not null,
  amount                    int not null check (amount > 0),
  currency                  text not null default 'EUR',
  system_fee                int not null default 0 check (system_fee >= 0),
  provider                  public.payment_provider not null,
  provider_transaction_id   text not null,
  related_auction_id        uuid references public.auctions(id),
  related_cell_id           int references public.cells(id),
  status                    public.transaction_status not null default 'pending',
  metadata                  jsonb,
  created_at                timestamptz not null default now(),
  completed_at              timestamptz
);

create unique index transactions_provider_id_idx
  on public.transactions(provider, provider_transaction_id);
create index transactions_user_idx on public.transactions(user_id);

-- ---------------------------------------------------------------------
-- moderation_queue
-- ---------------------------------------------------------------------
create table public.moderation_queue (
  id              uuid primary key default gen_random_uuid(),
  cell_id         int not null references public.cells(id),
  submitted_by    uuid not null references public.profiles(id),
  image_url       text not null,
  message         text,
  status          public.moderation_status not null default 'pending',
  reviewed_by     uuid references public.profiles(id),
  review_notes    text,
  submitted_at    timestamptz not null default now(),
  reviewed_at     timestamptz
);

create index moderation_queue_pending_idx
  on public.moderation_queue(submitted_at)
  where status = 'pending';
create index moderation_queue_submitter_idx
  on public.moderation_queue(submitted_by);

-- ---------------------------------------------------------------------
-- fixed_price_listings
-- ---------------------------------------------------------------------
create table public.fixed_price_listings (
  id              uuid primary key default gen_random_uuid(),
  cell_id         int not null references public.cells(id),
  owner_id        uuid not null references public.profiles(id),
  price           int not null check (price > 0),
  status          public.listing_status not null default 'active',
  buyer_id        uuid references public.profiles(id),
  listed_at       timestamptz not null default now(),
  sold_at         timestamptz,
  cancelled_at    timestamptz
);

create unique index fixed_price_listings_active_idx
  on public.fixed_price_listings(cell_id)
  where status = 'active';

-- =====================================================================
-- Row Level Security
-- =====================================================================

alter table public.profiles                enable row level security;
alter table public.cells                   enable row level security;
alter table public.auctions                enable row level security;
alter table public.bids                    enable row level security;
alter table public.cell_ownership_history  enable row level security;
alter table public.transactions            enable row level security;
alter table public.moderation_queue        enable row level security;
alter table public.fixed_price_listings    enable row level security;

-- ---------------------------------------------------------------------
-- profiles policies
-- ---------------------------------------------------------------------
create policy "profiles: anyone can read"
  on public.profiles for select
  using (true);

create policy "profiles: user can insert own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles: user can update own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------
-- cells policies
-- ---------------------------------------------------------------------
create policy "cells: anyone can read"
  on public.cells for select
  using (true);

create policy "cells: admin can update"
  on public.cells for update
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- auctions policies
-- ---------------------------------------------------------------------
create policy "auctions: anyone can read"
  on public.auctions for select
  using (true);

-- INSERT: admin can open admin auctions; cell owner can open owner auctions.
create policy "auctions: admin or cell owner can insert"
  on public.auctions for insert
  with check (
    (opened_by = 'admin' and public.is_admin())
    or (
      opened_by = 'owner'
      and opened_by_user_id = auth.uid()
      and exists (
        select 1 from public.cells c
        where c.id = cell_id
          and c.current_owner_id = auth.uid()
          and c.status = 'owned'
      )
    )
  );

-- UPDATE: only admin (cron jobs run via service_role so they bypass RLS).
create policy "auctions: admin can update"
  on public.auctions for update
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- bids policies
-- ---------------------------------------------------------------------
create policy "bids: anyone can read"
  on public.bids for select
  using (true);

-- A user can only insert bids as themselves on an active auction
-- where they are not the current owner of the cell.
create policy "bids: bidder must be authenticated user"
  on public.bids for insert
  with check (
    auth.uid() = bidder_id
    and exists (
      select 1
      from public.auctions a
      join public.cells c on c.id = a.cell_id
      where a.id = auction_id
        and a.status = 'active'
        and a.ends_at > now()
        and (c.current_owner_id is null or c.current_owner_id <> auth.uid())
    )
  );

-- ---------------------------------------------------------------------
-- cell_ownership_history policies
-- ---------------------------------------------------------------------
create policy "cell_ownership_history: anyone can read"
  on public.cell_ownership_history for select
  using (true);

-- INSERT/UPDATE only via service_role (no policy = denied to anon/authenticated).

-- ---------------------------------------------------------------------
-- transactions policies
-- ---------------------------------------------------------------------
create policy "transactions: user can read own"
  on public.transactions for select
  using (auth.uid() = user_id or public.is_admin());

-- INSERT/UPDATE only via service_role.

-- ---------------------------------------------------------------------
-- moderation_queue policies
-- ---------------------------------------------------------------------
create policy "moderation_queue: submitter or admin can read"
  on public.moderation_queue for select
  using (auth.uid() = submitted_by or public.is_admin());

create policy "moderation_queue: user can submit own as cell owner"
  on public.moderation_queue for insert
  with check (
    auth.uid() = submitted_by
    and exists (
      select 1 from public.cells c
      where c.id = cell_id and c.current_owner_id = auth.uid()
    )
  );

create policy "moderation_queue: admin can update"
  on public.moderation_queue for update
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- fixed_price_listings policies
-- ---------------------------------------------------------------------
create policy "fixed_price_listings: anyone can read"
  on public.fixed_price_listings for select
  using (true);

create policy "fixed_price_listings: cell owner can list"
  on public.fixed_price_listings for insert
  with check (
    auth.uid() = owner_id
    and exists (
      select 1 from public.cells c
      where c.id = cell_id
        and c.current_owner_id = auth.uid()
        and c.status = 'owned'
    )
  );

create policy "fixed_price_listings: owner can cancel"
  on public.fixed_price_listings for update
  using (auth.uid() = owner_id and status = 'active')
  with check (auth.uid() = owner_id and status in ('active', 'cancelled'));
