-- =====================================================================
-- Seed: insert the 9 fixed cells in `locked` state
-- =====================================================================
-- The 9 cells are infrastructure (not test data), so they live in a
-- migration to guarantee they exist in every environment (local, remote,
-- preview branches). `on conflict do nothing` keeps it idempotent.
-- =====================================================================

insert into public.cells (id, status) values
  (1, 'locked'),
  (2, 'locked'),
  (3, 'locked'),
  (4, 'locked'),
  (5, 'locked'),
  (6, 'locked'),
  (7, 'locked'),
  (8, 'locked'),
  (9, 'locked')
on conflict (id) do nothing;
