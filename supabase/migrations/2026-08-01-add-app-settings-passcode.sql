create table app_settings (
  id int primary key default 1,
  passcode text not null,
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id = 1)
);

insert into app_settings (id, passcode) values (1, 'TOKUCHIKA2026');

alter table app_settings enable row level security;

create policy "app_settings_anon_select" on app_settings
  for select to anon, authenticated using (true);
