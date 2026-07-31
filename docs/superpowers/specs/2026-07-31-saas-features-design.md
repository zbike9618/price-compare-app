# 実用性強化（SaaS化に向けた機能追加） 設計

## 背景・目的
成果発表（学校の探究課題）に向け、「個人が作ったデモ」ではなく「実際に人が使おうと思うもの」であることを裏付けるため、以下5つの機能を追加する。

## スコープ

1. **公式LP整備**: `src/pages/LandingPage.jsx`の数値・導線を実データに更新
2. **毎日自動更新**: LXC114にsystemdタイマーを新設し、5店舗分のスクレイパーを毎日自動実行
3. **シェア機能**: 買い物リストをURLで共有（バックエンド変更なし）
4. **価格推移グラフ**: お気に入り画面で商品ごとの直近30日価格推移を表示（recharts活用）
5. **PWA化**: ホーム画面に追加してアプリ風に起動できるようにする（`manifest.json`のみ、Service Workerなし）

## 1. 公式LP整備

- `src/pages/LandingPage.jsx`の統計値を実データに更新: `{ value: "3", unit: "店舗" }` → `{ value: "5", unit: "店舗" }`、`{ value: "3,300", unit: "件超" }` → `{ value: "3,850", unit: "件超" }`
- `ROADMAP`配列のうち「対応エリア・対応店舗の拡大」は5店舗まで拡大済みのため`done: true`に変更（「対応エリア拡大」の文言は「岡山市内での店舗拡大」に近い状態のため、ラベルを「岡山エリア内の店舗拡大」に変更し完了扱いにする）
- 「単価(¥/100g等)表示」は本設計の対象外（今回は価格推移グラフ・シェア機能等を優先するため）なので`done: false`のまま維持
- CTAリンク（`/app.html`、2箇所）は相対パスのままで問題ない（LP自体が`tokuchika.gozakura.com`や`192.168.11.114`のどちらでホストされても同一オリジンの`/app.html`に飛ぶため、変更不要）

## 2. 毎日自動更新（systemdタイマー）

- 対象: `scraper/run-aeon.js`（イオン岡山店）・`run-aeon-aoe.js`（岡山青江）・`run-aeon-kurashiki.js`（倉敷）・`run-legacy.js marui`・`run-legacy.js nishina`の5スクリプトを順次実行
- LXC114上に`/opt/price-compare-scraper/run-daily.sh`（新規）を配置し、上記5スクリプトを`SUPABASE_URL`・`SUPABASE_SERVICE_ROLE_KEY`環境変数付きで順番に実行するシェルスクリプトとする（1つが失敗しても後続は続行し、最後にエラー件数をログに残す）
- スクレイパーのソースコード自体（`scraper/`ディレクトリ）をLXC114上にデプロイする必要がある（現状はフロントエンドのビルド成果物のみデプロイされており、スクレイパーはこのWindows開発機からしか実行していない）。`scp`でNode.jsスクリプト一式を転送し、LXC114上で`npm install`する
- systemd unit（`price-compare-scraper.service`、`Type=oneshot`）とtimer（`price-compare-scraper.timer`、`OnCalendar=*-*-* 03:00:00`、深夜3時）を新設し、`systemctl enable --now`する
- この作業はコントローラー（私）がSSH経由で直接実施する（サブエージェントには委譲しない。本番サーバーへの新規ソフトウェア配置・systemd設定という性質上、都度Zの確認を要する可能性があるため）

## 3. シェア機能（URLエンコード方式）

- `src/lib/cartKeys.js`に、カートの`Set<string>`（例: `p:<productId>`・`g:<productId>`形式のキー、既存の`productKey`関数が生成する形式）をURLセーフな文字列にエンコード/デコードする関数を追加する: `encodeCartToShareParam(cartKeys: Set<string>): string`・`decodeCartFromShareParam(param: string): string[]`
  - エンコード方式: カートキーの配列をJSON化 → `encodeURIComponent`ではなくBase64url（`btoa`をURLセーフ化: `+`→`-`、`/`→`_`、末尾`=`除去）でエンコードする。商品IDはUUID形式のため、素朴なJSON+Base64で十分小さく収まる（1商品あたり概算50バイト程度、10商品でも500バイト程度でURL長制限に収まる）
- `ShoppingListCompare.jsx`（買い物リスト比較画面）に「リストを共有」ボタンを追加。クリックで現在のカート内容を`encodeCartToShareParam`でエンコードし、`https://tokuchika.gozakura.com/app.html?share=<encoded>`形式のURLをクリップボードにコピーする（`navigator.clipboard.writeText`、失敗時はテキストを選択状態にして手動コピーを促すフォールバック）
- `PriceCompareReal.jsx`のマウント時（初回のみ）に`URLSearchParams`から`share`パラメータを検出し、`decodeCartFromShareParam`でデコードして`cart` stateに反映する。デコードに失敗した場合（不正なURL等）は無視して通常起動する
- 共有元のURLに`?share=...`が残り続けるとリロードのたびに再適用されて煩わしいため、反映後は`history.replaceState`でクエリを除去する

## 4. 価格推移グラフ

- `src/pages/FavoritesView.jsx`の各お気に入り商品行に展開トグル（既存の`ProductRow.jsx`が持つ`isOpen`/`onToggleExpand`と同様のUIパターン）を追加し、展開時に`PriceHistoryChart.jsx`（新規コンポーネント）を表示する
- `PriceHistoryChart`は、対象商品IDに対する`price_history`を直近30日分・店舗横断で取得し（Supabaseへの新規クエリ、`select("store_id,price,scraped_at").eq("product_id", id).gte("scraped_at", thirtyDaysAgoIso).order("scraped_at")）、rechartsの`LineChart`で日付×価格の折れ線を描画する。複数店舗のデータがある場合は店舗ごとに別系列（別の色の線）として重ねる
- データ取得は展開時に初めて行う（遅延ロード。全お気に入り商品分を一度に取得すると無駄なクエリが増えるため）
- 直近30日でデータ点が1件しかない商品（値動きがない）の場合は、グラフの代わりに「直近30日、価格の変動はありません」という文言を表示する

## 5. PWA化（ホーム画面追加のみ）

- `public/manifest.json`（新規）: `name`・`short_name`・`start_url: "/app.html"`・`display: "standalone"`・`background_color`・`theme_color: "#2563eb"`・`icons`（192x192・512x512の2サイズ、既存のfaviconやアプリのアクセントカラーを元にした簡易アイコンを新規生成）を定義
- アイコン画像は、`sharp`で単色背景＋「最」の文字（または買い物カゴのシンプルな図形）を描いたPNGをスクリプト生成する（外部デザインツール不要、Node.jsで完結させる）
- `app.html`の`<head>`に`<link rel="manifest" href="/manifest.json">`と`<meta name="theme-color" content="#2563eb">`を追加
- Service Workerは実装しない（このアプリは常にSupabaseの最新価格データが必要なため、オフラインキャッシュの価値が低く、スコープ外とする）

## Global Constraints（全機能共通）

- 新規の外部npmパッケージは、rechartsは既存依存（`package.json`に既にある）なので追加不要。それ以外（Base64エンコード等）もブラウザ標準API（`btoa`/`atob`）で完結させ、新規パッケージは追加しない
- 既存コードのインラインstyleオブジェクトによるスタイリング規約に合わせる
- DBスキーマの変更は行わない（`price_history`は既存テーブルをそのまま読むのみ）
