# 「物の名前」（generic_name）廃止 設計

## 背景・目的

`price-compare-app`は現在、「カテゴリ（大分類、野菜/果物/乳製品等10種）→物の名前（中間層、`products.generic_name`、スクレイパーの検索キーワードをそのまま保存）→個別商品（ブランド商品名+JANコード）」の3層構造で最安値一覧・買い物リスト比較を構成している。Zの判断により、この中間層（「物の名前」＝中カテゴリ）の概念をデータモデルごと完全に廃止し、「カテゴリ→個別商品」の2層構造にシンプル化する。

## スコープ

**対象**:
- スクレイパー（`scraper/lib/db.js`・`scraper/run-aeon.js`・`scraper/run-legacy.js`）
- Supabase DBスキーマ（`products.generic_name`列の削除）
- フロントエンド（`PriceCompareReal.jsx`・`ListView.jsx`・`ProductRow.jsx`・`ShoppingListCompare.jsx`・`src/lib/cartKeys.js`・`src/lib/presets.js`）

**対象外**（変更なし）:
- `MapView.jsx`・`FavoritesView.jsx`・`AppShell.jsx`・`AuthContext.jsx`・`AuthForm.jsx`・`useFavorites.js`・`discount.js`・`format.js`（いずれも個別商品ID単位で完結しており影響を受けない）
- カスタムプリセット機能（JANコードベースで既に個別商品単位のため変更不要）
- `favorites`テーブル・お気に入り機能・値下げバッジ機能（本日午前の全面刷新で実装済み、今回の変更と独立）

## DB・スクレイパー変更

### DBマイグレーション
```sql
alter table products drop column generic_name;
```
（`products_generic_name_idx`インデックスは列削除に伴い自動的に削除される）

### スクレイパー
- `scraper/lib/db.js`の`upsertProduct({ janCode, name, category, genericName })`から`genericName`引数と、それを書き込む`generic_name: genericName`を削除
- `scraper/run-aeon.js:25`・`scraper/run-legacy.js:44`の呼び出し箇所から`genericName: keyword`を削除

## データ構造の変更（フロントエンド）

`PriceCompareReal.jsx`で以下の再構築を行う:
- `genericItems`・`genericItemByName`・`filteredGenericItems`・`sectionedGenericItems`（generic_name単位の集約ロジック）を削除
- 代わりに`products`を直接カテゴリでグルーピングした`sectionedProducts`（`{ category, items: Product[] }[]`）を構築する。フィルタ（検索語・カテゴリ）・ソート（価格昇順/降順/名前順）は個別商品（`product.name`・`product.prices[0].price`）に対して直接行う
- カート: `cart`のキーは`"p:<productId>"`のみに統一し、`"g:<genericName>"`分岐を削除する。`cartEntries`は個別商品のみを扱うシンプルな構造になる
- `src/lib/cartKeys.js`から`genericKey`を削除し、`productKey`のみ残す

## UIの変更

### ListView
カテゴリセクション（見出し）の直下に、商品行（1商品1行）を直接並べる2層構造にする。検索・カテゴリタブ・ソートのUI自体は変更しない。

### ProductRow
現在は「物の名前グループ（複数商品）」を1行として表示し、展開すると内部の複数商品＋各商品の店舗別価格が見える構造になっている。これを「1つの個別商品」を1行として表示し、展開すると**その商品自体の店舗別価格一覧**が見える構造に作り直す。お気に入り☆・値下げバッジは引き続き商品ID単位でそのまま機能する。「これを指定」ボタン（商品間の選択）は不要になり削除する（1行＝1商品のため）。

### ShoppingListCompare
検索欄の挙動を、物の名前ではなく商品名の部分一致検索に変更する。検索結果から選んだ商品はその商品自体（`p:<productId>`）としてカートに追加される。「店舗ごとに最安のブランドを自動選択する」という動的な挙動は廃止し、カートの各行＝特定の1商品として、その商品が売られている店舗の価格のみが合計に反映される。

## プリセット機能の変更

`BUILTIN_PRESETS`（定番野菜セット・朝ごはんセット・自炊定番セット）は現在、キーワードごとに`generic_name`グループまたは商品名の部分一致で該当アイテムを探し、`genericKey`または`productKey`を返している。これを、キーワードごとに商品名部分一致で該当する商品を探し、その中で**最安の1商品**を選んで`productKey`を返す方式に変更する。プリセット適用時の体験は「キーワードに対応する代表的な1商品が追加される」に変わる（複数店舗をまたいだ動的な最安自動選択は行わない）。

カスタムプリセット（`saveCustomPreset`/`loadCustomPresets`/`deleteCustomPreset`、JANコードベース）は変更不要。ただし`handleSaveCurrentAsPreset`内の「物の名前」キー（`"g:"`）に対する分岐処理は、カートが個別商品のみになるため不要になり削除する。

## テスト・確認方針

- 本プロジェクトに自動UIテストの前例はなく、`npm run dev`でのブラウザ実機確認が正式な検証手段（既存方針を踏襲）
- スクレイパー変更後、実際に1回スクレイピングを実行し、`products`テーブルに`generic_name`列が存在しないこと・新規商品が正常にupsertされることをSSH経由のpsqlで確認する
- フロントエンド変更後、ブラウザ実機で以下を確認する:
  - 最安値一覧: カテゴリセクション内に商品が1行ずつ表示され、展開すると店舗別価格が見えること
  - 検索・ソート・カテゴリタブが商品単位で正しく機能すること
  - 買い物リスト比較: 商品名検索→追加→店舗別合計金額の算出が正しく行われること
  - プリセット（定番野菜セット等）を適用すると、キーワードごとに最安の1商品が追加されること
  - カスタムプリセットの保存・呼び出しが従来通り機能すること
  - お気に入り・値下げバッジ・地図ビューが引き続き正常に機能すること（今回の変更の影響を受けないはずだが回帰確認する）

## 関連
- `docs/superpowers/plans/2026-07-30-frontend-rebuild.md`（本日午前実施したフロントエンド全面刷新、今回の変更の前提となる現行コード構成）
- `.secretary/projects/price-compare-app/project.md`（2026-07-27の「物の名前」導入の経緯）
