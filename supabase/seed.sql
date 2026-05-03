-- =====================================================================
-- Seed data for Celdas
-- =====================================================================
-- Inserts the 9 fixed cells in 'locked' state. Admins open auctions
-- on each cell from the admin panel (no auctions seeded so the system
-- starts empty and predictable).
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
