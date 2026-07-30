# 「物の名前」(generic_name) 廃止 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `price-compare-app`から「物の名前」（`products.generic_name`、カテゴリと個別商品の中間層）の概念をスクレイパー・DB・フロントエンド全てから廃止し、「カテゴリ→個別商品」の2層構造に単純化する。

**Architecture:** 既存の`ProductRow`・`ListView`・`ShoppingListCompare`・`PriceCompareReal.jsx`は「物の名前グループ（複数商品をまとめた仮想的な行）」を中心に組まれているため、これを「個別商品（1行=1商品）」中心の構造に作り直す。買い物リスト比較の「店舗ごとに最安ブランドを自動選択する」動的な挙動は廃止し、カートは常に特定の1商品（JANコード）を指すシンプルなモデルにする。

**Tech Stack:** 既存と同じ（Vite + React + lucide-react + プレーンCSS + `@supabase/supabase-js`）。新規依存追加なし。

## Global Constraints

- プロジェクトルート: `C:\Users\RuiRu\OneDrive\Desktop\claude-code\price-compare-app\`
- Supabase self-host: `http://192.168.11.114:8000`（Kong経由）、DB操作は`ssh root@192.168.11.114`→`docker exec supabase-db psql -U postgres -d postgres`
- **本番のSupabase DBは現在デプロイ済みのフロントエンド（本日午前の全面刷新版）から直接参照されている**。`products.generic_name`列は、新しいフロントエンドのデプロイと同時（またはデプロイ直後）に削除すること。デプロイ前に列を削除すると、現在稼働中の（まだ`generic_name`列を参照する）本番フロントエンドが壊れるため、**列削除は必ず最終タスク（Task 6）でLXC114への新デプロイと合わせて行う**
- カスタムプリセット機能（`src/lib/presets.js`のJANコードベースの永続化）は変更しない
- `MapView.jsx`・`FavoritesView.jsx`・`AppShell.jsx`・`AuthContext.jsx`・`AuthForm.jsx`・`useFavorites.js`・`discount.js`・`format.js`は変更しない（今回の変更の影響を受けない）
- ビジュアルトーン（白背景＋青`#2563eb`アクセント）は変更しない
- このプロジェクトに自動UIテストの前例はなく、`npm run dev`でのブラウザ実機確認、またはNode/SSH経由でのSupabase実疎通確認が正式な検証手段

---

### Task 1: スクレイパーから`generic_name`書き込みを削除

**Files:**
- Modify: `scraper/lib/db.js:35-42`
- Modify: `scraper/run-aeon.js:21-26`
- Modify: `scraper/run-legacy.js:40-45`

**Interfaces:**
- Consumes: なし
- Produces: `export async function upsertProduct({ janCode, name, category })`（`genericName`引数を削除した新シグネチャ）。Task 6のDBマイグレーションで`generic_name`列自体を削除するが、それより前にこのタスクで書き込みを止めておくことで、列削除までの間も両立する

- [ ] **Step 1: `scraper/lib/db.js`の`upsertProduct`から`genericName`を削除**

```javascript
// scraper/lib/db.js:35-42 を以下に置き換え
export async function upsertProduct({ janCode, name, category }) {
  const rows = await rest("products?on_conflict=jan_code", {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify([{ jan_code: janCode, name, category }]),
  });
  return rows[0];
}
```

- [ ] **Step 2: `scraper/run-aeon.js`の呼び出し箇所から`genericName`を削除**

```javascript
// scraper/run-aeon.js:21-26 を以下に置き換え
      const product = await upsertProduct({
        janCode: item.janCode,
        name: item.name,
        category: KEYWORD_CATEGORY[keyword],
      });
```

- [ ] **Step 3: `scraper/run-legacy.js`の呼び出し箇所から`genericName`を削除**

```javascript
// scraper/run-legacy.js:40-45 を以下に置き換え
        const product = await upsertProduct({
          janCode: item.janCode,
          name: item.name,
          category: KEYWORD_CATEGORY[keyword],
        });
```

- [ ] **Step 4: 実際に外部サイトへスクレイピングせず、Supabaseへの書き込みパスだけをテストユーザーデータで検証する**

`scraper/`ディレクトリで一時スクリプトを作成して実行する（`SUPABASE_SERVICE_ROLE_KEY`環境変数が必要。値はLXC114の`/opt/supabase/docker/.env`の`SERVICE_ROLE_KEY`を`ssh root@192.168.11.114 "grep SERVICE_ROLE_KEY /opt/supabase/docker/.env"`で取得できる）:

```javascript
// scraper/verify-task1-tmp.mjs（検証後に削除する一時ファイル）
import { upsertProduct } from "./lib/db.js";

const product = await upsertProduct({
  janCode: "TEST-0000000000001",
  name: "検証用テスト商品",
  category: "日用品",
});
console.log("upsert結果:", product);
```

```bash
cd scraper
SUPABASE_SERVICE_ROLE_KEY="<取得したservice_role_key>" node verify-task1-tmp.mjs
```

Expected: `product.jan_code === "TEST-0000000000001"`、`product.generic_name === null`（引数を渡していないため）

- [ ] **Step 5: 検証用データを削除し、一時ファイルも削除する**

```bash
ssh root@192.168.11.114 "docker exec supabase-db psql -U postgres -d postgres -c \"delete from products where jan_code='TEST-0000000000001';\""
rm scraper/verify-task1-tmp.mjs
```

Expected: `DELETE 1`

- [ ] **Step 6: コミット**

```bash
git add scraper/lib/db.js scraper/run-aeon.js scraper/run-legacy.js
git commit -m "スクレイパーからgeneric_nameの書き込みを削除"
```

---

### Task 2: `cartKeys.js`簡略化・`ProductRow`を個別商品用に書き換え

**Files:**
- Modify: `src/lib/cartKeys.js`
- Modify: `src/components/ProductRow.jsx`（全面書き換え）

**Interfaces:**
- Consumes: `yen`（`src/lib/format.js`、既存）
- Produces: `src/lib/cartKeys.js`は`export const productKey = (id) => \`p:${id}\`;`のみ（`genericKey`は削除）。`export default function ProductRow({ product, categoryStyle, isOpen, onToggleExpand, isInCart, onToggleCart, isFavorite, onToggleFavorite, isDiscounted })` — `product`は`{ id, name, category, prices: [{storeId, storeName, price}] }`（`prices`は価格昇順ソート済み）。旧`item`（物の名前グループ）・`cartKeys`・`onToggleProductCart`propsは廃止。Task 3（ListView）がこれを使う

- [ ] **Step 1: `cartKeys.js`から`genericKey`を削除**

```javascript
// src/lib/cartKeys.js
// カート項目のキー種別: "p:<productId>"（商品を指定）
export const productKey = (id) => `p:${id}`;
```

- [ ] **Step 2: `ProductRow.jsx`を個別商品用に全面書き換え**

```jsx
// src/components/ProductRow.jsx
import { ChevronDown, ChevronRight, Star, TrendingDown } from "lucide-react";
import { yen } from "../lib/format.js";

export default function ProductRow({
  product,
  categoryStyle,
  isOpen,
  onToggleExpand,
  isInCart,
  onToggleCart,
  isFavorite,
  onToggleFavorite,
  isDiscounted,
}) {
  const Icon = categoryStyle.icon;
  const cheapest = product.prices[0];
  const others = product.prices.slice(1);

  return (
    <div style={{ borderTop: "1px solid #f1f5f9" }}>
      <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: 8 }}>
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-label="お気に入り"
          style={{ border: "none", background: "transparent", padding: 0, flexShrink: 0 }}
        >
          <Star size={16} color={isFavorite ? "#f59e0b" : "#cbd5e1"} fill={isFavorite ? "#f59e0b" : "none"} />
        </button>

        <button
          type="button"
          onClick={onToggleExpand}
          style={{
            flex: 1, display: "flex", alignItems: "center", gap: 8, border: "none",
            background: "transparent", textAlign: "left", padding: 0, minWidth: 0,
          }}
        >
          {others.length > 0 ? (
            isOpen ? (
              <ChevronDown size={14} color="#94a3b8" style={{ flexShrink: 0 }} />
            ) : (
              <ChevronRight size={14} color="#94a3b8" style={{ flexShrink: 0 }} />
            )
          ) : (
            <span style={{ width: 14, flexShrink: 0 }} />
          )}
          <div
            style={{
              width: 28, height: 28, borderRadius: 8, background: `${categoryStyle.color}1A`,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
          >
            <Icon size={14} color={categoryStyle.color} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {product.name}
              </span>
              {isDiscounted && (
                <span
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 2, background: "#fee2e2", color: "#dc2626",
                    fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 5, flexShrink: 0,
                  }}
                >
                  <TrendingDown size={10} /> 値下げ
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>
              {others.length > 0 ? `${product.prices.length}店舗で比較可能` : "1店舗のみ"}
            </div>
          </div>
        </button>

        <div className="price-num" style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#16a34a" }}>{yen(cheapest.price)}</div>
        </div>

        <button
          type="button"
          onClick={onToggleCart}
          style={{
            border: "1px solid #2563eb", borderRadius: 8, padding: "4px 8px", flexShrink: 0,
            background: isInCart ? "#2563eb" : "#fff", color: isInCart ? "#fff" : "#2563eb", fontSize: 11,
          }}
        >
          {isInCart ? "追加済み" : "追加"}
        </button>
      </div>

      {isOpen && others.length > 0 && (
        <div style={{ background: "#f8fafc", padding: "8px 16px 10px 34px", fontSize: 11, color: "#94a3b8" }}>
          {cheapest.storeName} {yen(cheapest.price)}
          {others.map((o) => (
            <span key={o.storeId}> ・ {o.storeName} {yen(o.price)}</span>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: ビルド確認（この時点ではまだ`ListView.jsx`が旧propsで`ProductRow`を呼んでいるためビルドエラーは無視してよい。構文エラーのみ確認する）**

```bash
npx oxlint src/components/ProductRow.jsx src/lib/cartKeys.js
```

Expected: 構文エラーなし（`ListView.jsx`との不整合はTask 3で解消するため、この時点でのpropsの不一致は許容する）

- [ ] **Step 4: コミット**

```bash
git add src/lib/cartKeys.js src/components/ProductRow.jsx
git commit -m "cartKeysからgenericKeyを削除しProductRowを個別商品表示に書き換え"
```

---

### Task 3: `ListView.jsx`を個別商品前提に書き換え

**Files:**
- Modify: `src/pages/ListView.jsx`（全面書き換え）

**Interfaces:**
- Consumes: `ProductRow`（Task 2）、`productKey`（Task 2の`cartKeys.js`）
- Produces: `export default function ListView({ query, setQuery, sortBy, setSortBy, categories, categoryCounts, activeCategory, setActiveCategory, sectionedProducts, cartKeys, onToggleProductCart, favoriteIds, onToggleFavorite, discountedProductIds })` — `sectionedProducts`は`{ category: string, items: Product[] }[]`（`Product`は`{ id, name, category, prices }`）。旧`sectionedGenericItems`・`onToggleGeneric`propsは廃止。Task 5（PriceCompareReal）がこれを使う

- [ ] **Step 1: 実装**

```jsx
// src/pages/ListView.jsx
import { useState } from "react";
import {
  Search, Carrot, Apple, Milk, Beef, Fish, Croissant, Soup, Droplet, Egg, Package,
} from "lucide-react";
import ProductRow from "../components/ProductRow.jsx";
import { productKey } from "../lib/cartKeys.js";

const CATEGORY_STYLE = {
  野菜: { icon: Carrot, color: "#16a34a" },
  果物: { icon: Apple, color: "#dc2626" },
  乳製品: { icon: Milk, color: "#2563eb" },
  精肉: { icon: Beef, color: "#92400e" },
  魚介: { icon: Fish, color: "#0891b2" },
  パン類: { icon: Croissant, color: "#ca8a04" },
  麺類: { icon: Soup, color: "#d97706" },
  調味料: { icon: Droplet, color: "#78716c" },
  日配食品: { icon: Egg, color: "#ca8a04" },
  日用品: { icon: Package, color: "#64748b" },
};
const DEFAULT_CATEGORY_STYLE = { icon: Package, color: "#64748b" };

const SORT_OPTIONS = [
  { id: "priceAsc", label: "最安値が安い順" },
  { id: "priceDesc", label: "最安値が高い順" },
  { id: "name", label: "名前順" },
];

export default function ListView({
  query,
  setQuery,
  sortBy,
  setSortBy,
  categories,
  categoryCounts,
  activeCategory,
  setActiveCategory,
  sectionedProducts,
  cartKeys,
  onToggleProductCart,
  favoriteIds,
  onToggleFavorite,
  discountedProductIds,
}) {
  const [expanded, setExpanded] = useState(() => new Set());

  const toggleExpanded = (productId) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  return (
    <>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div
          style={{
            flex: 1, display: "flex", alignItems: "center", gap: 6, background: "#fff",
            border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 12px",
          }}
        >
          <Search size={16} color="#94a3b8" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="商品名で検索"
            style={{ border: "none", flex: 1, fontSize: 14, background: "transparent" }}
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "0 10px", fontSize: 13, background: "#fff" }}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        <button
          type="button"
          onClick={() => setActiveCategory(null)}
          style={{
            display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 999,
            border: activeCategory === null ? "1px solid #2563eb" : "1px solid #e2e8f0",
            background: activeCategory === null ? "#2563eb" : "#fff",
            color: activeCategory === null ? "#fff" : "#0f172a", fontSize: 12,
          }}
        >
          すべて
        </button>
        {categories.map((c) => {
          const style = CATEGORY_STYLE[c] ?? DEFAULT_CATEGORY_STYLE;
          const Icon = style.icon;
          const active = activeCategory === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setActiveCategory(c)}
              style={{
                display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 999,
                border: active ? "1px solid #2563eb" : "1px solid #e2e8f0",
                background: active ? "#2563eb" : "#fff", color: active ? "#fff" : "#0f172a", fontSize: 12,
              }}
            >
              <Icon size={12} color={active ? "#fff" : style.color} />
              {c}
              <span
                style={{
                  fontSize: 10, padding: "1px 6px", borderRadius: 999,
                  background: active ? "rgba(255,255,255,0.25)" : "#f1f5f9",
                  color: active ? "#fff" : "#64748b",
                }}
              >
                {categoryCounts.get(c) ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {sectionedProducts.map((section) => {
        const sectionStyle = CATEGORY_STYLE[section.category] ?? DEFAULT_CATEGORY_STYLE;
        const SectionIcon = sectionStyle.icon;
        return (
          <div key={section.category} style={{ marginBottom: 16 }}>
            <p style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#64748b", margin: "0 0 6px" }}>
              <SectionIcon size={13} color={sectionStyle.color} />
              {section.category} <span style={{ fontWeight: 400, color: "#94a3b8" }}>（{section.items.length}）</span>
            </p>
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden" }}>
              {section.items.map((product) => {
                const isInCart = cartKeys.has(productKey(product.id));
                const isFavorite = favoriteIds.has(product.id);
                const isDiscounted = discountedProductIds.has(product.id);
                return (
                  <ProductRow
                    key={product.id}
                    product={product}
                    categoryStyle={CATEGORY_STYLE[product.category] ?? DEFAULT_CATEGORY_STYLE}
                    isOpen={expanded.has(product.id)}
                    onToggleExpand={() => toggleExpanded(product.id)}
                    isInCart={isInCart}
                    onToggleCart={() => onToggleProductCart(product.id)}
                    isFavorite={isFavorite}
                    onToggleFavorite={() => onToggleFavorite(product.id)}
                    isDiscounted={isDiscounted}
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      {sectionedProducts.length === 0 && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
          該当する商品がありません
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: コミット**

```bash
git add src/pages/ListView.jsx
git commit -m "ListViewをカテゴリ→個別商品の2層構造に書き換え"
```

---

### Task 4: `ShoppingListCompare.jsx`を商品名検索前提に書き換え

**Files:**
- Modify: `src/pages/ShoppingListCompare.jsx`

**Interfaces:**
- Consumes: `yen`（`src/lib/format.js`、既存）
- Produces: `export default function ShoppingListCompare({ cartEntries, cartSearch, setCartSearch, cartSearchResults, onAddProduct, onRemoveEntry, cartStoreTotals, builtinPresets, customPresets, onApplyPresetKeys, onApplyCustomPreset, onSavePreset, onDeletePreset })` — `cartSearchResults`は`Product[]`（`{ id, name, prices }`）。旧`onAddGeneric`propは`onAddProduct(productId)`にリネーム。Task 5（PriceCompareReal）がこれを使う

- [ ] **Step 1: 検索結果の描画・propの受け渡しを商品ベースに変更（他は変更なし）**

```jsx
// src/pages/ShoppingListCompare.jsx
import { useState } from "react";
import { Search, Bookmark, Trash2, X, Crown } from "lucide-react";
import { yen } from "../lib/format.js";

export default function ShoppingListCompare({
  cartEntries,
  cartSearch,
  setCartSearch,
  cartSearchResults,
  onAddProduct,
  onRemoveEntry,
  cartStoreTotals,
  builtinPresets,
  customPresets,
  onApplyPresetKeys,
  onApplyCustomPreset,
  onSavePreset,
  onDeletePreset,
}) {
  const [presetNameInput, setPresetNameInput] = useState("");
  const [showSaveForm, setShowSaveForm] = useState(false);

  return (
    <>
      {(builtinPresets.length > 0 || customPresets.length > 0) && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 11, color: "#94a3b8", margin: "0 0 6px" }}>プリセットから追加</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {builtinPresets.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => onApplyPresetKeys(preset.keys)}
                style={{
                  display: "flex", alignItems: "center", gap: 4, padding: "5px 12px", borderRadius: 999,
                  border: "1px solid #e2e8f0", background: "#fff", fontSize: 12,
                }}
              >
                <Bookmark size={12} /> {preset.name}
              </button>
            ))}
            {customPresets.map((preset) => (
              <span
                key={preset.id}
                style={{
                  display: "flex", alignItems: "center", gap: 4, padding: "5px 6px 5px 12px", borderRadius: 999,
                  border: "1px solid #2563eb", background: "#fff", fontSize: 12,
                }}
              >
                <button
                  type="button"
                  onClick={() => onApplyCustomPreset(preset)}
                  style={{ border: "none", background: "transparent", padding: 0, color: "#2563eb" }}
                >
                  {preset.name}
                </button>
                <button
                  type="button"
                  onClick={() => onDeletePreset(preset.id)}
                  style={{ border: "none", background: "transparent", padding: 2, color: "#94a3b8" }}
                  aria-label="プリセットを削除"
                >
                  <Trash2 size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ position: "relative", marginBottom: 12 }}>
        <div
          style={{
            display: "flex", alignItems: "center", gap: 6, background: "#fff",
            border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 12px",
          }}
        >
          <Search size={16} color="#94a3b8" />
          <input
            value={cartSearch}
            onChange={(e) => setCartSearch(e.target.value)}
            placeholder="商品名で検索してリストに追加（例: 牛乳）"
            style={{ border: "none", flex: 1, fontSize: 14, background: "transparent" }}
          />
        </div>
        {cartSearchResults.length > 0 && (
          <div
            style={{
              position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#fff",
              border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", zIndex: 10,
            }}
          >
            {cartSearchResults.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onAddProduct(p.id)}
                style={{
                  display: "block", width: "100%", textAlign: "left", padding: "10px 12px",
                  border: "none", background: "#fff", fontSize: 13, borderTop: "1px solid #f1f5f9",
                }}
              >
                {p.name}
                <span style={{ color: "#94a3b8", marginLeft: 8 }}>
                  最安 {yen(p.prices[0].price)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {cartEntries.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "32px 16px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
          上の検索欄から商品名を追加すると、一番安い店をすぐ診断します
        </div>
      ) : (
        <>
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", marginBottom: 12 }}>
            {cartEntries.map((entry, i) => (
              <div
                key={entry.key}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 14px", borderTop: i === 0 ? "none" : "1px solid #f1f5f9",
                }}
              >
                <span style={{ fontSize: 13 }}>{entry.label}</span>
                <button type="button" onClick={() => onRemoveEntry(entry.key)} style={{ border: "none", background: "transparent", color: "#94a3b8" }}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>

          {showSaveForm ? (
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              <input
                value={presetNameInput}
                onChange={(e) => setPresetNameInput(e.target.value)}
                placeholder="プリセット名（例: いつもの買い物）"
                style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 12px", fontSize: 13 }}
              />
              <button
                type="button"
                onClick={() => {
                  if (!presetNameInput.trim()) return;
                  onSavePreset(presetNameInput.trim());
                  setPresetNameInput("");
                  setShowSaveForm(false);
                }}
                style={{ border: "1px solid #2563eb", borderRadius: 10, padding: "0 14px", background: "#2563eb", color: "#fff", fontSize: 13 }}
              >
                保存
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowSaveForm(true)}
              style={{
                display: "flex", alignItems: "center", gap: 6, border: "1px solid #e2e8f0", borderRadius: 10,
                padding: "8px 12px", background: "#fff", fontSize: 13, marginBottom: 12,
              }}
            >
              <Bookmark size={14} /> このリストをプリセット保存
            </button>
          )}

          <div style={{ background: "#0f172a", borderRadius: 16, overflow: "hidden" }}>
            {cartStoreTotals.map((s, i) => (
              <div
                key={s.id}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px",
                  borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.1)", color: "#fff",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {i === 0 && <Crown size={16} color="#f59e0b" />}
                  <div>
                    <div style={{ fontSize: 13 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{s.foundCount}/{cartEntries.length}品目が対象</div>
                  </div>
                </div>
                <div className="price-num" style={{ fontSize: 18, fontWeight: 700 }}>{yen(s.total)}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
```

- [ ] **Step 2: コミット**

```bash
git add src/pages/ShoppingListCompare.jsx
git commit -m "ShoppingListCompareを商品名検索・onAddProduct前提に書き換え"
```

---

### Task 5: `PriceCompareReal.jsx`統合書き換え

**Files:**
- Modify: `src/pages/PriceCompareReal.jsx`（全面書き換え）

**Interfaces:**
- Consumes: `ListView`（Task 3）、`ShoppingListCompare`（Task 4）、`productKey`（Task 2の`cartKeys.js`）、`BUILTIN_PRESETS`・`loadCustomPresets`・`saveCustomPreset`・`deleteCustomPreset`（`src/lib/presets.js`、変更なし）
- Produces: `export default function PriceCompareReal()` — 既存と同じ（`main-app.jsx`から呼ばれる、propsなし）

- [ ] **Step 1: 実装**

`products`取得クエリから`generic_name`列を除外し、「物の名前」グルーピングロジック（`genericItems`・`genericItemByName`・`filteredGenericItems`・`sectionedGenericItems`）を全て削除、カテゴリ→個別商品の`sectionedProducts`に置き換える。カート・プリセットロジックも個別商品ベースに単純化する。

```jsx
// src/pages/PriceCompareReal.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { useAuth } from "../lib/AuthContext.jsx";
import { useFavorites } from "../lib/useFavorites.js";
import { isRecentPriceDrop } from "../lib/discount.js";
import { productKey } from "../lib/cartKeys.js";
import { BUILTIN_PRESETS, loadCustomPresets, saveCustomPreset, deleteCustomPreset } from "../lib/presets.js";
import AppShell from "../components/AppShell.jsx";
import ListView from "./ListView.jsx";
import ShoppingListCompare from "./ShoppingListCompare.jsx";
import MapView from "./MapView.jsx";
import FavoritesView from "./FavoritesView.jsx";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export default function PriceCompareReal() {
  const { user } = useAuth();
  const { favoriteIds, toggleFavorite } = useFavorites(user);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stores, setStores] = useState([]);
  const [products, setProducts] = useState([]);
  const [discountedProductIds, setDiscountedProductIds] = useState(() => new Set());
  const [view, setView] = useState("list");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("priceAsc");
  const [activeCategory, setActiveCategory] = useState(null);
  const [cart, setCart] = useState(() => new Set());
  const [cartSearch, setCartSearch] = useState("");
  const [customPresets, setCustomPresets] = useState(() => loadCustomPresets());
  const [showAuthForm, setShowAuthForm] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const sinceIso = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();

        const [{ data: storesData, error: storesError }, { data: productsData, error: productsError }, { data: priceHistoryData, error: priceHistoryError }] =
          await Promise.all([
            supabase.from("stores").select("id,name,lat,lng").eq("is_active", true),
            supabase.from("products").select("id,name,jan_code,category"),
            supabase
              .from("price_history")
              .select("store_id,product_id,price,scraped_at")
              .gte("scraped_at", sinceIso)
              .order("scraped_at", { ascending: false }),
          ]);

        if (storesError) throw storesError;
        if (productsError) throw productsError;
        if (priceHistoryError) throw priceHistoryError;

        const storeNameById = new Map(storesData.map((s) => [s.id, s.name]));

        // scraped_atの降順で取得済みなので、(store_id, product_id)ごとに先頭からの並びがそのまま新しい順の履歴になる
        const historyByPair = new Map();
        for (const ph of priceHistoryData) {
          const key = `${ph.store_id}:${ph.product_id}`;
          if (!historyByPair.has(key)) historyByPair.set(key, []);
          historyByPair.get(key).push({ price: ph.price, scrapedAt: ph.scraped_at });
        }

        const priceByProduct = new Map();
        const discounted = new Set();
        for (const [key, historyDesc] of historyByPair) {
          const [storeId, productId] = key.split(":");
          const latest = historyDesc[0];
          if (!priceByProduct.has(productId)) priceByProduct.set(productId, []);
          priceByProduct.get(productId).push({
            storeId,
            storeName: storeNameById.get(storeId) ?? "不明な店舗",
            price: latest.price,
          });
          if (isRecentPriceDrop(historyDesc)) discounted.add(productId);
        }

        const merged = productsData
          .map((p) => ({
            id: p.id,
            name: p.name,
            janCode: p.jan_code,
            category: p.category,
            prices: (priceByProduct.get(p.id) ?? []).sort((a, b) => a.price - b.price),
          }))
          .filter((p) => p.prices.length > 0);

        setStores(storesData);
        setProducts(merged);
        setDiscountedProductIds(discounted);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, "ja"));
  }, [products]);

  const categoryCounts = useMemo(() => {
    const counts = new Map();
    for (const p of products) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    return counts;
  }, [products]);

  const sectionedProducts = useMemo(() => {
    let list = products.filter(
      (p) => p.name.includes(query) && (activeCategory === null || p.category === activeCategory)
    );
    list = [...list].sort((a, b) => {
      if (sortBy === "priceAsc") return a.prices[0].price - b.prices[0].price;
      if (sortBy === "priceDesc") return b.prices[0].price - a.prices[0].price;
      if (sortBy === "name") return a.name.localeCompare(b.name, "ja");
      return 0;
    });

    const groups = new Map();
    for (const p of list) {
      if (!groups.has(p.category)) groups.set(p.category, []);
      groups.get(p.category).push(p);
    }
    return categories.filter((c) => groups.has(c)).map((c) => ({ category: c, items: groups.get(c) }));
  }, [products, query, activeCategory, sortBy, categories]);

  const toggleCartKey = (key) => {
    setCart((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const cartEntries = useMemo(() => {
    return [...cart]
      .map((key) => {
        const id = key.slice(2);
        const product = productById.get(id);
        if (!product) return null;
        return {
          key,
          label: product.name,
          priceAtStore: (storeId) => product.prices.find((pr) => pr.storeId === storeId)?.price ?? null,
          representativePrice: product.prices[0].price,
        };
      })
      .filter(Boolean);
  }, [cart, productById]);

  const builtinPresets = useMemo(() => {
    return BUILTIN_PRESETS.map((preset) => {
      const keys = preset.keywords
        .map((kw) => {
          const matches = products.filter((p) => p.name.includes(kw));
          if (matches.length === 0) return null;
          const cheapest = matches.reduce((min, p) => (p.prices[0].price < min.prices[0].price ? p : min));
          return productKey(cheapest.id);
        })
        .filter(Boolean);
      return { ...preset, keys };
    }).filter((preset) => preset.keys.length > 0);
  }, [products]);

  const applyKeys = (keys) => {
    setCart((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => next.add(k));
      return next;
    });
  };

  const applyCustomPreset = (preset) => {
    const ids = products.filter((p) => preset.janCodes.includes(p.janCode)).map((p) => productKey(p.id));
    applyKeys(ids);
  };

  const handleSaveCurrentAsPreset = (name) => {
    const janCodes = cartEntries
      .map((entry) => productById.get(entry.key.slice(2))?.janCode)
      .filter(Boolean);
    setCustomPresets(saveCustomPreset(name, janCodes));
  };

  const handleDeleteCustomPreset = (id) => {
    setCustomPresets(deleteCustomPreset(id));
  };

  const cartKeys = useMemo(() => new Set(cartEntries.map((e) => e.key)), [cartEntries]);

  const cartSearchResults = useMemo(() => {
    if (!cartSearch.trim()) return [];
    return products
      .filter((p) => p.name.includes(cartSearch) && !cartKeys.has(productKey(p.id)))
      .slice(0, 8);
  }, [products, cartSearch, cartKeys]);

  const cartStoreTotals = useMemo(() => {
    if (cartEntries.length === 0) return [];
    return stores
      .map((s) => {
        let total = 0;
        let foundCount = 0;
        for (const entry of cartEntries) {
          const price = entry.priceAtStore(s.id);
          if (price != null) {
            total += price;
            foundCount += 1;
          }
        }
        return { ...s, total, foundCount };
      })
      .filter((s) => s.foundCount > 0)
      .sort((a, b) => a.total - b.total);
  }, [stores, cartEntries]);

  if (loading) return <p style={{ padding: 24 }}>読み込み中...</p>;
  if (error) return <p style={{ padding: 24, color: "#dc2626" }}>データの取得に失敗しました: {error}</p>;

  return (
    <AppShell
      view={view}
      setView={setView}
      showAuthForm={showAuthForm}
      onRequestAuth={() => setShowAuthForm(true)}
      onCloseAuth={() => setShowAuthForm(false)}
    >
      {view === "list" && (
        <ListView
          query={query}
          setQuery={setQuery}
          sortBy={sortBy}
          setSortBy={setSortBy}
          categories={categories}
          categoryCounts={categoryCounts}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          sectionedProducts={sectionedProducts}
          cartKeys={cartKeys}
          onToggleProductCart={(id) => toggleCartKey(productKey(id))}
          favoriteIds={favoriteIds}
          onToggleFavorite={toggleFavorite}
          discountedProductIds={discountedProductIds}
        />
      )}

      {view === "cart" && (
        <ShoppingListCompare
          cartEntries={cartEntries}
          cartSearch={cartSearch}
          setCartSearch={setCartSearch}
          cartSearchResults={cartSearchResults}
          onAddProduct={(id) => {
            toggleCartKey(productKey(id));
            setCartSearch("");
          }}
          onRemoveEntry={(key) => toggleCartKey(key)}
          cartStoreTotals={cartStoreTotals}
          builtinPresets={builtinPresets}
          customPresets={customPresets}
          onApplyPresetKeys={applyKeys}
          onApplyCustomPreset={applyCustomPreset}
          onSavePreset={handleSaveCurrentAsPreset}
          onDeletePreset={handleDeleteCustomPreset}
        />
      )}

      {view === "map" && <MapView stores={stores} />}

      {view === "favorites" && (
        <FavoritesView
          products={products}
          favoriteIds={favoriteIds}
          isLoggedIn={!!user}
          onOpenAuth={() => setShowAuthForm(true)}
          onToggleFavorite={toggleFavorite}
          onAddProductToCart={(id) => toggleCartKey(productKey(id))}
          cartKeys={cartKeys}
        />
      )}
    </AppShell>
  );
}
```

- [ ] **Step 2: ブラウザ実機で確認**

```bash
npm run dev
```

以下を実機で確認する:
- 最安値一覧: カテゴリセクションの下に商品が1行ずつ表示され、複数店舗展開が正しく機能する
- 検索・ソート・カテゴリタブが商品単位で正しく機能する
- 買い物リスト比較: 商品名検索→追加→店舗別合計金額の算出が正しく行われる
- プリセット（定番野菜セット等）を適用すると、キーワードごとに最安の1商品が追加される
- お気に入り・値下げバッジ・地図ビューが引き続き正常に機能する（回帰確認）

- [ ] **Step 3: コミット**

```bash
git add src/pages/PriceCompareReal.jsx
git commit -m "PriceCompareRealをカテゴリ→個別商品の2層構造に統合"
```

---

### Task 6: DBマイグレーション・LXC114デプロイ・secretary記録更新

**Files:**
- Create: `supabase/migrations/2026-07-30-drop-generic-name.sql`

**Interfaces:**
- Consumes: 全タスクの成果物
- Produces: `products`テーブルから`generic_name`列が削除された状態。LXC114に新フロントエンドがデプロイされ、`http://192.168.11.114/app.html`が新しい2層構造で閲覧できる状態

- [ ] **Step 1: リポジトリ内に`generic_name`への参照が残っていないか確認**

```bash
grep -rn "generic_name\|genericName\|genericKey" src/ scraper/lib scraper/run-aeon.js scraper/run-legacy.js
```

Expected: 一致なし（Task 1〜5で全て削除済みのはず）

- [ ] **Step 2: マイグレーションSQLを作成**

```sql
-- supabase/migrations/2026-07-30-drop-generic-name.sql
alter table products drop column generic_name;
```

- [ ] **Step 3: 本番ビルド**

```bash
npm run build
```

Expected: `dist/`一式が生成される。エラーなし

- [ ] **Step 4: LXC114にデプロイ（先にフロントエンドを更新してから列を削除する順序を守る）**

```bash
scp -r dist/* root@192.168.11.114:/var/www/price-compare-app/
```

- [ ] **Step 5: デプロイを確認してからDBマイグレーションを適用**

```bash
curl -s -o /dev/null -w "app.html: %{http_code}\n" http://192.168.11.114/app.html
```

Expected: `200`。確認できたら以下でマイグレーションを適用する:

```bash
scp supabase/migrations/2026-07-30-drop-generic-name.sql root@192.168.11.114:/tmp/drop-generic-name.sql
ssh root@192.168.11.114 "docker exec -i supabase-db psql -U postgres -d postgres < /tmp/drop-generic-name.sql"
ssh root@192.168.11.114 "rm /tmp/drop-generic-name.sql"
```

Expected: `ALTER TABLE`

- [ ] **Step 6: マイグレーション結果を確認**

```bash
ssh root@192.168.11.114 "docker exec supabase-db psql -U postgres -d postgres -c '\d products'"
```

Expected: `generic_name`列が存在しない

- [ ] **Step 7: LAN内から実機で最終確認**

`http://192.168.11.114/app.html`をブラウザで開き、最安値一覧・買い物リスト比較・プリセット・お気に入り・値下げバッジ・地図ビューが正常に動作することを確認する

- [ ] **Step 8: コミット**

```bash
git add supabase/migrations/2026-07-30-drop-generic-name.sql
git commit -m "generic_name列を削除するマイグレーションを追加・本番適用"
```

- [ ] **Step 9: `.secretary`側の記録を更新する**

`.secretary/projects/price-compare-app/project.md`の該当箇所を編集する:
- 「タスク」セクションの「最安値一覧に値下げバッジを追加する」項目は変更しない（既に完了記録済み）
- 新しい進捗ログとして「2026-07-30 「物の名前」(generic_name)廃止」の見出しを追加し、本タスクの実施内容（カテゴリ→個別商品の2層構造化、買い物リスト比較の個別商品専用化、プリセットの最安1商品選択方式への変更、DB列削除）を記載する

`.secretary/todos/YYYY-MM-DD.md`（実施日の日次ファイル）で、「price-compare-app: 「物の名前」（generic_name、中カテゴリ）グルーピングをデータモデルごと完全廃止する」タスクを完了として`## 完了`セクションに移動し、`完了: YYYY-MM-DD`を付記する
