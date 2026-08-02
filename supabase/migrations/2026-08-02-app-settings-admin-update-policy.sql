-- service role keyをフロントに埋め込まずパスコードを管理できるようにするため、
-- 管理者アカウント(Z本人)のみapp_settingsを更新できるRLSポリシーを追加する。
-- これによりAdminPasscode.jsxはservice role clientではなく、通常のログイン(anonキー+authenticatedセッション)で
-- 更新できるようになり、supabaseAdminClient.js（VITE_SUPABASE_SERVICE_ROLE_KEYをビルド時にJSへ直書きする設計）を廃止できる。
create policy "app_settings_admin_update" on app_settings
  for update to authenticated
  using (auth.uid() = '1fed7ff3-6375-44ce-a268-d6cc779d65b6')
  with check (auth.uid() = '1fed7ff3-6375-44ce-a268-d6cc779d65b6');
