# 実用性強化（外部評価反映） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** price-compare-appを「実際に人が使おうと思うもの」にするため、外部評価（Codexレビュー）で指摘された品質面（価格鮮度・比較の公平性・geolocation制約・OGP/manifest）を改善し、LPを実データに更新する。

**Architecture:** 既存の`PriceCompareReal.jsx`が保持する`historyByPair`（直近30日分の価格履歴）を活用し、新規Supabaseクエリを追加せずに鮮度情報を導出する。`cartStoreTotals`の並び替えロジックと`ShoppingListCompare.jsx`の表示を変更して公平性を可視化する。`MapView.jsx`にHTTPS判定を追加する。`public/manifest.json`・OGPメタタグ・LPの実データ反映を行う。HTTPヘッダー（charset・キャッシュ）はnginx設定変更のため本計画の対象外（コントローラーが別途SSHで直接実施）。

**Tech Stack:** React 19、既存の`lucide-react`アイコン、Vitest。新規の外部npmランタイム依存は追加しない（アイコン生成に`sharp`を一時利用するのみ）。

## Global Constraints

- 新規の外部npmランタイム依存は追加しない
- DBスキーマ・Supabaseクエリの追加変更は行わない（既存の`historyByPair`を再利用する）
- 既存コードのインラインstyleオブジェクトによるスタイリング規約に合わせる
- 「サーバー側集計への移行」は本計画のスコープ外

---

## Task 1: LP実データ反映

**Files:**
- Modify: `src/pages/LandingPage.jsx`

**Interfaces:**
- Consumes: なし
- Produces: なし（末端の表示変更）

- [ ] **Step 1: 統計値とROADMAPを実データに更新する**

`src/pages/LandingPage.jsx`の`{ value: "3", unit: "店舗" }`を`{ value: "5", unit: "店舗" }`に、`{ value: "3,300", unit: "件超" }`を`{ value: "3,850", unit: "件超" }`に変更する。

`ROADMAP`配列の該当行を変更:

```jsx
const ROADMAP = [
  { done: true, label: "地図ビュー・最安値一覧・カテゴリ絞り込み" },
  { done: true, label: "お気に入り登録・値下げバッジ・買い物リスト診断" },
  { done: false, label: "単価(¥/100g等)表示" },
  { done: true, label: "岡山エリア内の店舗拡大（5店舗）" },
];
```

- [ ] **Step 2: ビルドが通ることを確認する**

Run: `cd price-compare-app && npm run build`
Expected: エラーなくビルド成功

- [ ] **Step 3: コミット**

```bash
git add src/pages/LandingPage.jsx
git commit -m "content: LPの店舗数・商品数を実データに更新、店舗拡大をROADMAP完了扱いに"
```

---

## Task 2: 価格の鮮度表示

**Files:**
- Create: `src/lib/freshness.js`
- Create: `src/lib/freshness.test.js`
- Modify: `src/pages/PriceCompareReal.jsx`
- Modify: `src/components/ProductRow.jsx`

**Interfaces:**
- Consumes: `PriceCompareReal.jsx`内で既に構築されている`historyByPair`（`Map<"storeId:productId", {price, scrapedAt}[]>`、新しい順）
- Produces:
  - `formatRelativeTime(isoString: string): string`（例: `"3時間前"`、`"2日前"`、`"1分前"`）
  - `isStalePrice(isoString: string): boolean`（現在時刻との差が24時間以上なら`true`）
  - `product.prices[]`の各要素に`scrapedAt`フィールドが追加される（Task 3・ProductRow.jsxが参照する）

- [ ] **Step 1: `src/lib/freshness.js`を作成する**

```js
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export function formatRelativeTime(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  if (diffMs < 0) return "たった今";

  const minutes = Math.floor(diffMs / (60 * 1000));
  if (minutes < 1) return "たった今";
  if (minutes < 60) return `${minutes}分前`;

  const hours = Math.floor(diffMs / HOUR_MS);
  if (hours < 24) return `${hours}時間前`;

  const days = Math.floor(diffMs / DAY_MS);
  return `${days}日前`;
}

export function isStalePrice(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  return diffMs >= DAY_MS;
}
```

- [ ] **Step 2: `src/lib/freshness.test.js`に失敗するテストを書く**

```js
import { describe, expect, it } from "vitest";
import { formatRelativeTime, isStalePrice } from "./freshness.js";

describe("formatRelativeTime", () => {
  it("30分前なら「30分前」", () => {
    const iso = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    expect(formatRelativeTime(iso)).toBe("30分前");
  });

  it("5時間前なら「5時間前」", () => {
    const iso = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(iso)).toBe("5時間前");
  });

  it("3日前なら「3日前」", () => {
    const iso = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(iso)).toBe("3日前");
  });

  it("30秒前なら「たった今」", () => {
    const iso = new Date(Date.now() - 30 * 1000).toISOString();
    expect(formatRelativeTime(iso)).toBe("たった今");
  });
});

describe("isStalePrice", () => {
  it("23時間前はfalse", () => {
    const iso = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString();
    expect(isStalePrice(iso)).toBe(false);
  });

  it("25時間前はtrue", () => {
    const iso = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    expect(isStalePrice(iso)).toBe(true);
  });
});
```

- [ ] **Step 3: テストを実行して失敗を確認する**

Run: `cd price-compare-app && npx vitest run src/lib/freshness.test.js`
Expected: FAIL（`freshness.js`が存在しないためimportエラー）

- [ ] **Step 4: Step 1のコードを反映し、テストを再実行する**

Run: `cd price-compare-app && npx vitest run src/lib/freshness.test.js`
Expected: 6 tests PASS

- [ ] **Step 5: `PriceCompareReal.jsx`で`prices[]`に`scrapedAt`を含める**

`src/pages/PriceCompareReal.jsx`内、`priceByProduct.get(productId).push({...})`の箇所（`storeId`・`storeName`・`price`を格納している箇所）を以下のように変更し、`scrapedAt`を追加する:

```js
priceByProduct.get(productId).push({
  storeId,
  storeName: storeNameById.get(storeId) ?? "不明な店舗",
  price: latest.price,
  scrapedAt: latest.scrapedAt,
});
```

- [ ] **Step 6: `ProductRow.jsx`の展開表示に鮮度情報を追加する**

`src/components/ProductRow.jsx`のimportに追加:

```jsx
import { ChevronDown, ChevronRight, Star, TrendingDown, AlertTriangle } from "lucide-react";
import { formatRelativeTime, isStalePrice } from "../lib/freshness.js";
```

展開時の店舗別価格一覧（94〜101行目付近）を以下のように変更する:

```jsx
{isOpen && others.length > 0 && (
  <div style={{ background: "#f8fafc", padding: "8px 16px 10px 34px", fontSize: 11, color: "#94a3b8" }}>
    {[cheapest, ...others].map((o, i) => (
      <div key={o.storeId} style={{ display: "flex", alignItems: "center", gap: 4, marginTop: i === 0 ? 0 : 4 }}>
        <span>{o.storeName} {yen(o.price)}</span>
        <span style={{ color: isStalePrice(o.scrapedAt) ? "#d97706" : "#cbd5e1" }}>
          （{formatRelativeTime(o.scrapedAt)}）
        </span>
        {isStalePrice(o.scrapedAt) && <AlertTriangle size={11} color="#d97706" />}
      </div>
    ))}
  </div>
)}
```

- [ ] **Step 7: テスト・ビルドを実行して確認する**

Run: `cd price-compare-app && npm test && npm run build`
Expected: 全テストPASS、ビルド成功

- [ ] **Step 8: コミット**

```bash
git add src/lib/freshness.js src/lib/freshness.test.js src/pages/PriceCompareReal.jsx src/components/ProductRow.jsx
git commit -m "feat: 価格の鮮度表示(相対時間・古いデータの注意表示)を追加"
```

---

## Task 3: 店舗別合計比較の公平性表示

**Files:**
- Modify: `src/pages/PriceCompareReal.jsx`
- Modify: `src/pages/ShoppingListCompare.jsx`

**Interfaces:**
- Consumes: 既存の`cartStoreTotals`（`{id, name, total, foundCount}[]`）、既存の`cartEntries.length`
- Produces: なし（表示・並び順の変更のみ）

- [ ] **Step 1: `cartStoreTotals`のソートを2段階に変更する**

`src/pages/PriceCompareReal.jsx`の`cartStoreTotals`の`useMemo`内、`.sort((a, b) => a.total - b.total)`の行を以下に変更する（`cartEntries`は同じ`useMemo`のスコープ内で既に参照可能）:

```js
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
    .sort((a, b) => {
      const aComplete = a.foundCount === cartEntries.length;
      const bComplete = b.foundCount === cartEntries.length;
      if (aComplete !== bComplete) return aComplete ? -1 : 1;
      return a.total - b.total;
    });
}, [stores, cartEntries]);
```

- [ ] **Step 2: `ShoppingListCompare.jsx`の店舗別合計表示にバッジを追加する**

`src/pages/ShoppingListCompare.jsx`の`cartStoreTotals.map`部分（170〜189行目付近）を以下のように変更する:

```jsx
<div style={{ background: "#0f172a", borderRadius: 16, overflow: "hidden" }}>
  {cartStoreTotals.map((s, i) => {
    const isComplete = s.foundCount === cartEntries.length;
    return (
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
            <div
              style={{
                fontSize: 11, fontWeight: isComplete ? 400 : 700,
                color: isComplete ? "#4ade80" : "#fb923c",
              }}
            >
              {isComplete ? "全品揃う店舗" : `${s.foundCount}/${cartEntries.length}品目のみ`}
            </div>
          </div>
        </div>
        <div className="price-num" style={{ fontSize: 18, fontWeight: 700 }}>{yen(s.total)}</div>
      </div>
    );
  })}
</div>
```

- [ ] **Step 3: テスト・ビルドを実行して確認する**

Run: `cd price-compare-app && npm test && npm run build`
Expected: 全テストPASS、ビルド成功

- [ ] **Step 4: コミット**

```bash
git add src/pages/PriceCompareReal.jsx src/pages/ShoppingListCompare.jsx
git commit -m "feat: 店舗別合計比較で全品揃う店舗を優先表示し、欠品情報を強調"
```

---

## Task 4: geolocationのHTTPS案内

**Files:**
- Modify: `src/pages/MapView.jsx`

**Interfaces:**
- Consumes: `window.isSecureContext`（ブラウザ標準API）
- Produces: なし（末端の表示変更）

- [ ] **Step 1: `handleUseCurrentLocation`にHTTPS判定を追加する**

`src/pages/MapView.jsx`の`handleUseCurrentLocation`関数の先頭に以下を追加する:

```js
const handleUseCurrentLocation = () => {
  if (!window.isSecureContext) {
    setGeoError("現在地取得にはHTTPS接続が必要です。https://tokuchika.gozakura.com からアクセスしてください");
    return;
  }
  if (!navigator.geolocation) {
    setGeoError("この端末では現在地を取得できません");
    return;
  }
  // ...既存の処理がこのまま続く
```

（既存の`if (!navigator.geolocation) { ... }`ブロックの直前に新しいチェックを挿入する形。既存コードの重複を避けるため、元の`if (!navigator.geolocation)`ブロックはそのまま残し、その前に新しい`if (!window.isSecureContext)`ブロックを追加するだけでよい）

- [ ] **Step 2: ビルドが通ることを確認する**

Run: `cd price-compare-app && npm run build`
Expected: エラーなくビルド成功

- [ ] **Step 3: コミット**

```bash
git add src/pages/MapView.jsx
git commit -m "feat: HTTP(非HTTPS)環境での現在地取得失敗時にHTTPS版への案内を表示"
```

---

## Task 5: PWA化・OGP整備

**Files:**
- Create: `public/manifest.json`
- Create: `public/icon-192.png`
- Create: `public/icon-512.png`
- Create: `public/og-image.png`
- Modify: `app.html`
- Modify: `index.html`

**Interfaces:**
- Consumes: なし
- Produces: なし（静的アセット追加とHTML head変更）

- [ ] **Step 1: アイコン・OGP画像を生成する**

`scraper/`ディレクトリの`sharp`（既にscraperの依存関係にインストール済み）を使い、一時スクリプトでアイコンを生成する。price-compare-appのルートで以下を実行する（Node.jsから`scraper/node_modules/sharp`を直接requireする形で、price-compare-app本体には`sharp`を依存追加しない）:

```bash
cd price-compare-app
node -e "
const sharp = require('./scraper/node_modules/sharp');
const svg192 = \`<svg xmlns='http://www.w3.org/2000/svg' width='192' height='192'><rect width='192' height='192' fill='#2563eb'/><text x='96' y='120' font-size='90' font-family='sans-serif' fill='white' text-anchor='middle'>¥</text></svg>\`;
const svg512 = \`<svg xmlns='http://www.w3.org/2000/svg' width='512' height='512'><rect width='512' height='512' fill='#2563eb'/><text x='256' y='320' font-size='240' font-family='sans-serif' fill='white' text-anchor='middle'>¥</text></svg>\`;
const svgOg = \`<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='630'><rect width='1200' height='630' fill='#0f172a'/><text x='60' y='300' font-size='64' font-family='sans-serif' font-weight='bold' fill='white'>近くのスーパー、</text><text x='60' y='380' font-size='64' font-family='sans-serif' font-weight='bold' fill='white'>最安値くらべ</text><text x='60' y='460' font-size='28' font-family='sans-serif' fill='#93c5fd'>岡山市内5店舗の価格を自動収集・比較</text></svg>\`;
Promise.all([
  sharp(Buffer.from(svg192)).png().toFile('public/icon-192.png'),
  sharp(Buffer.from(svg512)).png().toFile('public/icon-512.png'),
  sharp(Buffer.from(svgOg)).png().toFile('public/og-image.png'),
]).then(() => console.log('done'));
"
```

生成後、`public/icon-192.png`・`public/icon-512.png`・`public/og-image.png`が存在することを`ls public/`で確認する。

- [ ] **Step 2: `public/manifest.json`を作成する**

```json
{
  "name": "近くのスーパー、最安値くらべ",
  "short_name": "最安値くらべ",
  "start_url": "/app.html",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#2563eb",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 3: `app.html`のheadを更新する**

`app.html`の`<head>`を以下のように変更する（既存の`<meta charset>`・`<link rel="icon">`・`<meta name="viewport">`・`<title>`はそのまま残し、追加する）:

```html
<head>
  <meta charset="UTF-8" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="manifest" href="/manifest.json" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#2563eb" />
  <meta name="description" content="岡山市内のネットスーパー5店舗の価格を自動収集し、最安値・買い物リストごとの合計金額を比較できるアプリ。" />
  <meta property="og:title" content="近くのスーパー、最安値くらべ" />
  <meta property="og:description" content="岡山市内のネットスーパー5店舗の価格を自動収集し、最安値・買い物リストごとの合計金額を比較できるアプリ。" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://tokuchika.gozakura.com/app.html" />
  <meta property="og:image" content="https://tokuchika.gozakura.com/og-image.png" />
  <title>近くのスーパー、最安値くらべ</title>
</head>
```

- [ ] **Step 4: `index.html`のheadを更新する**

`index.html`の現在の中身を確認したうえで、同様に`meta description`・OGPタグ（`og:url`は`https://tokuchika.gozakura.com/`）を追加する。既存の`<meta charset>`・`<link rel="icon">`・`<title>`等は維持する。

- [ ] **Step 5: ビルドが通ることを確認する**

Run: `cd price-compare-app && npm run build`
Expected: エラーなくビルド成功。`dist/`に`manifest.json`・`icon-192.png`・`icon-512.png`・`og-image.png`がコピーされていることを`ls dist/`で確認する

- [ ] **Step 6: コミット**

```bash
git add public/manifest.json public/icon-192.png public/icon-512.png public/og-image.png app.html index.html
git commit -m "feat: PWA化(manifest・アイコン)とOGP/meta descriptionを追加"
```

---

## Task 6: 統合ビルド・デプロイ・実機確認

**Files:**
- なし（既存タスクの成果物をビルド・デプロイ・確認するのみ）

**Interfaces:**
- Consumes: Task 1〜5の全ての変更
- Produces: なし

- [ ] **Step 1: 全テスト・ビルドを実行する**

Run: `cd price-compare-app && npm test && npm run build`
Expected: 全テストPASS、ビルド成功

- [ ] **Step 2: ビルド成果物をLXC114にデプロイする**

Run: `cd price-compare-app && scp -r dist/* root@192.168.11.114:/var/www/price-compare-app/`

- [ ] **Step 3: ブラウザ実機で確認する**

claude-in-chromeで`https://tokuchika.gozakura.com/app.html`（またはLAN内`http://192.168.11.114/app.html`）を開き、以下を確認する:
- LPの店舗数・商品数の表示が「5店舗」「3,850件超」になっている
- 最安値一覧で商品を展開すると、各店舗の価格の横に「◯分前」「◯時間前」等の鮮度表示が出る
- 買い物リストに複数商品を追加し、「比較」タブで店舗別合計が「全品揃う店舗」優先で並び、欠品店舗には目立つ色で品目数が表示される
- LAN内HTTP版（`http://192.168.11.114/app.html`）の地図タブで「現在地を使う」をクリックすると、HTTPS版へ誘導するエラーメッセージが表示される（実際に位置情報の許可ダイアログは出ない）
- ブラウザのdevtoolsやページソースで、`<head>`に`manifest.json`・OGPタグ・`meta description`が入っていることを確認する

- [ ] **Step 4: このステップはコード変更を伴わない**

問題が見つかった場合はここで報告する。全て問題なければ完了とする。
