-- supabase/migrations/2026-07-30-favorites-user-scoped.sql
begin;

alter table favorites
  add column user_id uuid not null references auth.users(id) on delete cascade;

alter table favorites drop constraint favorites_pkey;
alter table favorites add primary key (user_id, product_id);

alter table favorites enable row level security;

drop policy if exists "favorites are managed by owner" on favorites;
create policy "favorites are managed by owner"
  on favorites
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

commit;
