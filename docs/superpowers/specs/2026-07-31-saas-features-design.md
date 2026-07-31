# 実用性強化（外部評価を踏まえた品質改善） 設計

## 背景・目的
成果発表（学校の探究課題）に向け、「個人が作ったデモ」ではなく「実際に人が使おうと思うもの」であることを裏付ける。当初は機能追加（シェア・価格推移グラフ・自動更新等）を検討したが、外部評価（Codexによるレビュー、`tokuchika-evaluation.md`）を受け、**信頼性・品質面の改善を優先**する方針に転換した。

## 経緯（スコープ変更の記録）
- 当初案: LP整備・毎日自動更新・シェア機能・価格推移グラフ・PWA化の5機能
- Codexによる外部評価で、charset未指定・価格鮮度の不透明さ・店舗別合計比較の公平性リスク・geolocationのHTTPS制約・OGP/manifest不足・キャッシュ設定が短いことが指摘された
- Z判断: 評価の優先改善項目を全て取り込み、当初案のうちシェア機能・価格推移グラフ・毎日自動更新は今回見送り、LP整備・PWA化のみ残す
- 「サーバー側集計への移行」（評価の優先改善2番目）は、既存のデータ取得ロジック全体を作り直す規模でありリスクが高いため、今回は実装せず`project.md`のbacklogに記録するに留める

## スコープ

1. **公式LP整備**: 実データの数値に更新
2. **HTTPレスポンスヘッダー改善**: charset明示・ハッシュ付きアセットの長期キャッシュ化（nginx設定、コントローラーが直接実施）
3. **価格の鮮度表示**: 商品ごとに「何時間前の価格か」を表示し、古いデータには注意表示を出す
4. **店舗別合計比較の公平性表示**: 「5品中3品のみ」等の欠品情報を強調し、全品揃う店舗を優先表示する
5. **geolocationのHTTPS案内**: LAN内HTTP版（`192.168.11.114`）で現在地機能を使おうとした際、失敗理由と公開HTTPS版へのリンクを案内する
6. **PWA化・OGP整備**: `manifest.json`・OGPメタタグ・`meta description`・favicon確認・theme-color

## 1. 公式LP整備

- `src/pages/LandingPage.jsx`の統計値を実データに更新: `{ value: "3", unit: "店舗" }` → `{ value: "5", unit: "店舗" }`、`{ value: "3,300", unit: "件超" }` → `{ value: "3,850", unit: "件超" }`
- `ROADMAP`配列の「対応エリア・対応店舗の拡大」を`done: true`に変更（ラベルを「岡山エリア内の店舗拡大（5店舗）」に更新）

## 2. HTTPレスポンスヘッダー改善（nginx、コントローラー実施）

LXC114の`/etc/nginx/sites-enabled/price-compare-app`を編集する:
- `text/html`レスポンスに`charset=utf-8`を明示: `charset utf-8;`をserverブロックに追加
- ハッシュ付きの`dist/assets/`配下（Viteが生成する`[name]-[hash].js`/`.css`）に対して`Cache-Control: public, max-age=31536000, immutable`を設定する`location`ブロックを追加（`app.html`・`index.html`本体は逆に短いキャッシュのままでよい。更新のたびにコンテンツが変わるファイルだけを長期キャッシュ対象から除外する）

## 3. 価格の鮮度表示

- 既に`PriceCompareReal.jsx`は`price_history`を直近30日分取得しており、`historyByPair`（`Map<"storeId:productId", {price, scrapedAt}[]>`、新しい順にソート済み）としてstateに保持している。**新規のSupabaseクエリは不要**で、この既存データから鮮度情報を導出する
- `src/lib/freshness.js`（新規）: `scrapedAt`（ISO文字列）を受け取り、「3時間前」「2日前」のような相対時間文字列を返す`formatRelativeTime(isoString)`関数と、24時間以上前なら`true`を返す`isStalePrice(isoString)`関数を実装する
- `products`配列の各要素の`prices[]`（店舗ごとの価格情報）に、対応する`historyByPair`のエントリから取得した`scrapedAt`を持たせる（`PriceCompareReal.jsx`の`priceByProduct`構築部分で、`latest.scrapedAt`を`price`と一緒に格納するよう1行追加する）
- `ProductRow.jsx`の展開時の店舗別価格一覧に、`formatRelativeTime`で算出した鮮度文字列を小さく表示し、`isStalePrice`が`true`の場合は注意アイコン（`AlertTriangle`、lucide-react）と薄い警告色で「取得から時間が経っています」を添える

## 4. 店舗別合計比較の公平性表示

- `PriceCompareReal.jsx`の`cartStoreTotals`（`useMemo`で計算済み、`{ id, name, total, foundCount }[]`を`total`昇順でソート）の並び順ロジックを変更する: 現状は単純に合計金額の安い順だが、まず「全品揃う店舗（`foundCount === cartEntries.length`）」を優先グループとして先頭にまとめ、その中で金額が安い順に並べ、次に「一部欠品の店舗」を金額順で続ける2段階ソートに変更する
- `ShoppingListCompare.jsx`の店舗別合計表示（`cartStoreTotals.map`部分）で、`s.foundCount === cartEntries.length`の場合は「全品揃う」バッジ（緑）を、そうでない場合は現在の`{foundCount}/{cartEntries.length}品目が対象`の文字を、より目立つオレンジ系の色・太字に変更して「未取得あり」であることを強調する

## 5. geolocationのHTTPS案内

- `src/components/MapView.jsx`の`handleUseCurrentLocation`関数内、`navigator.geolocation`が呼ばれる前に`window.isSecureContext`をチェックする（HTTPSまたはlocalhostなら`true`、LAN内HTTPアクセスなら`false`になるブラウザ標準API）
- `isSecureContext`が`false`の場合は、実際に位置情報取得を試みず即座に`setGeoError("現在地取得にはHTTPS接続が必要です。https://tokuchika.gozakura.com からアクセスしてください")`を呼ぶ（既存の`geoError`表示の仕組みをそのまま使う）

## 6. PWA化・OGP整備

- `public/manifest.json`（新規）: `name: "近くのスーパー、最安値くらべ"`・`short_name: "最安値くらべ"`・`start_url: "/app.html"`・`display: "standalone"`・`background_color: "#ffffff"`・`theme_color: "#2563eb"`・`icons`（192x192・512x512の2サイズ）
- アイコン画像は`sharp`で生成するスクリプトを一時的に使い、`public/icon-192.png`・`public/icon-512.png`として書き出す（青地に白文字「¥」など、シンプルな図形で構わない）
- `app.html`の`<head>`に以下を追加:
  - `<link rel="manifest" href="/manifest.json">`
  - `<meta name="theme-color" content="#2563eb">`
  - `<meta name="description" content="岡山市内のネットスーパー5店舗の価格を自動収集し、最安値・買い物リストごとの合計金額を比較できるアプリ。">`
  - OGPタグ（`og:title`・`og:description`・`og:type`・`og:url`・`og:image`。`og:image`は`public/`に置く簡易画像でよい）
- `index.html`（LP）にも同様に`meta description`・OGPタグを追加する（LPはSNS等でシェアされる可能性が`app.html`より高いため）

## Global Constraints（全項目共通）

- 新規の外部npmパッケージは追加しない（`sharp`はアイコン生成の一時利用のみで、ビルド成果物の依存には含まれない）
- 既存コードのインラインstyleオブジェクトによるスタイリング規約に合わせる
- DBスキーマの変更は行わない（既存の`price_history`取得ロジックを維持し、新規クエリを追加しない）
- 「サーバー側集計への移行」は本設計のスコープ外。`project.md`のタスクとして別途記録する
