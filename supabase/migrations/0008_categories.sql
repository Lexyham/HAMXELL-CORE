-- HAMXELL CORE, Phase 11: project categories. Run after 0007.
-- product = /products, experiment = /experiments (small or informal), lab = /labs (R&D and concept work).
alter table public.projects
  add column category text not null default 'product' check (category in ('product', 'experiment', 'lab'));
