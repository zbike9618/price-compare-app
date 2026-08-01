# ワンタイムパスコード管理画面 設計

## 背景・目的
現在、app.htmlのゲート用パスコード（`src/lib/passcode.js`の`PASSCODE`定数）はコードにハードコードされており、変更にはコード編集・ビルド・デプロイが必要。Zが手軽にパスコードを確認・変更できるよう、簡易的な管理画面を追加する。

## スコープ
- 今回実装するのは「現在のパスコード表示＋新しい値への変更」のみ（最小スコープ）。ランダムコード生成・変更履歴・複数コード管理は対象外（将来必要になれば別途）
- 対象: price-compare-appのフロントエンド・Supabase DB・LXC114のnginx設定
- 管理画面は本番サーバー(LXC114)にデプロイするが、nginxで`127.0.0.1`（ローカルホスト）からのアクセスのみ許可する。Zはサーバー上で直接、またはSSHポートフォワード（例: `ssh -L 8080:127.0.0.1:80 root@192.168.11.114`）経由でアクセスする

## ① パスコード保存先をSupabase DBに変更

### DBスキーマ
新規テーブル`app_settings`（単一行）:
```sql
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
```
- `anon`にはSELECTのみ許可（UPDATE/INSERT/DELETEポリシーは作成しない＝anonキーでは変更不可）。管理画面からの書き込みはservice role keyを使うため、RLSをバイパスして直接更新できる
- 初期値は現行の`TOKUCHIKA2026`を投入し、既存の招待者フローを壊さない

### アプリ側の変更
- `src/lib/passcode.js`から`PASSCODE`定数を削除。代わりに`fetchCurrentPasscode()`（`supabase.from('app_settings').select('passcode').single()`でDBから取得する非同期関数）を追加
- `checkPasscode(input, currentPasscode)`に引数を追加し、比較対象をDBから取得した値にする。あわせて`.normalize("NFKC")`を比較前に適用し、全角文字入力（IME変換ミス）にも対応する（既存レビューのMinor指摘の解消も兼ねる）
- `src/components/PasscodeGate.jsx`: マウント時に`fetchCurrentPasscode()`を呼び出し、取得中は簡易ローディング表示、取得失敗時は「読み込みに失敗しました。再読み込みしてください」というエラー表示にする（フェイルクローズ、取得できない間はゲートを突破させない）。取得成功後に通常の入力フォームを表示し、送信時に`checkPasscode(input, currentPasscode)`で照合する
- `isPasscodeUnlocked`/`unlockPasscode`（localStorageの解除フラグ）はそのまま変更しない。**既知の制約**: Zが管理画面でパスコードを変更しても、既にlocalStorageで解除済みの端末は再入力を求められない（今回のスコープでは許容する）

## ② 管理画面（admin.html）の新設

### ビルド構成
- `vite.config.js`の`rollupOptions.input`に`admin: resolve(__dirname, 'admin.html')`を追加
- `admin.html`（新規、`index.html`/`app.html`と同じ構成）→ `src/main-admin.jsx`（新規エントリーポイント）→ `src/pages/AdminPasscode.jsx`（新規、管理画面本体）
- `src/lib/supabaseAdminClient.js`（新規）: service role keyを埋め込んだ別のSupabaseクライアントインスタンス。`AdminPasscode.jsx`からのみimportし、他のページ・コンポーネントからは絶対にimportしない（公開バンドルにservice role keyが混入しないようにするため）

### 画面内容
- 現在のパスコードを`app_settings`テーブルから取得して表示（読み取りは既存の`supabase`（anonクライアント）で十分）
- テキスト入力欄に現在値をプリセットし、編集して「保存」ボタンで`supabaseAdmin.from('app_settings').update({ passcode: newValue, updated_at: new Date().toISOString() }).eq('id', 1)`を実行
- 保存成功時に「保存しました」、失敗時にエラーメッセージを表示するシンプルなUI（既存の`PasscodeGate.jsx`と同系統のインラインstyle・配色`#2563eb`を踏襲）

## ③ nginx設定（LXC114）でadmin.htmlをlocalhost限定にする

- Viteのマルチページビルドでは、`admin`エントリーのJSチャンクは`assets/admin-<hash>.js`のように、entry名`admin`を含んだファイル名で出力される（`main`/`app`/`demoApp`と同様の命名規則）
- `/etc/nginx/sites-enabled/price-compare-app`に以下を追加（このファイルはgit管理外・サーバー上でのみ変更、変更内容は`.secretary/debugging/`等に記録する運用を踏襲）:
```nginx
location = /admin.html {
    allow 127.0.0.1;
    deny all;
}
location ~ ^/assets/admin-.*\.(js|css)$ {
    allow 127.0.0.1;
    deny all;
}
```
- 上記以外（LP・app.html・共通アセット）は現行通り誰でもアクセス可能なまま

## テスト
- `src/lib/passcode.js`の`checkPasscode`（NFKC正規化を含む比較ロジック）は既存の`passcode.test.js`と同様にvitestでユニットテストする。DB取得を伴う`fetchCurrentPasscode`はSupabaseクライアントのモックを使って正常系・エラー系をテストする
- `PasscodeGate.jsx`のローディング/エラー/入力フォームの出し分け、`AdminPasscode.jsx`の表示・保存は既存の他コンポーネントと同様、ブラウザでの実機確認で担保する（nginxのlocalhost制限があるためSSHポートフォワード経由で確認する）

## 未確定事項（Zが後日対応可能な点）
- service role keyは`.env`（LXC114の`/opt/supabase/docker/.env`）から取得して`supabaseAdminClient.js`に埋め込む。既存のセッション（frontend-rebuild計画等）で取得方法は確立済み
