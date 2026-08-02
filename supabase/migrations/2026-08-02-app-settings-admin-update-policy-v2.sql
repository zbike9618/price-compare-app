-- 管理者アカウントをzealousbike9618@gmail.comからadmin@tokuchika.local専用アカウントに切り替えるため、
-- app_settings_admin_updateポリシーのuser_idを更新する。
-- 旧アカウント(zealousbike9618@gmail.com)は本移行後に削除する。
drop policy "app_settings_admin_update" on app_settings;

create policy "app_settings_admin_update" on app_settings
  for update to authenticated
  using (auth.uid() = '2a037afa-3b33-4477-b021-413990545a92')
  with check (auth.uid() = '2a037afa-3b33-4477-b021-413990545a92');
