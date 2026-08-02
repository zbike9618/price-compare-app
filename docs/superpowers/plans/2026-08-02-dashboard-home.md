# ダッシュボード（ホーム）新設 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** price-compare-appに5つ目のナビゲーションタブ「ホーム」を新設し、アプリ起動時の初期画面にする。各機能（最安値・比較・地図・お気に入り）への大きなカードボタンで導線を整理する。

**Architecture:** 新規コンポーネント`HomeView.jsx`を追加し、既存の`view`state（"list"/"cart"/"map"/"favorites"）に"home"を追加する形で統合する。既存4ビューのロジック・表示は一切変更しない。

**Tech Stack:** React 18, lucide-react（アイコン）, 既存の`src/lib/theme.js`（ACCENTカラー）, `src/lib/savings.js`（節約額取得）

## Global Constraints

- カードボタンのラベルは単語のみ（説明文を付けない） — Zのユーザーヒアリング知見「単語しかユーザーは読まない」に基づく
- 既存4タブ（最安値・比較・地図・お気に入り）の中身・機能は変更しない
- コンポーネントテストの慣習がこのリポジトリには無い（`src/`にtesting-library等は未導入）。テストは`src/lib/`のロジック関数のみに書く。`HomeView.jsx`自体はJSXを組み立てるだけの薄いコンポーネントなのでユニットテストを書かず、ビルド・lint・実機確認（390px幅）で担保する
- スタイルはインラインstyle（既存コード全体の慣習）。CSSファイル・styled-componentsは使わない

---

### Task 1: HomeView.jsx新規作成

**Files:**
- Create: `src/pages/HomeView.jsx`

**Interfaces:**
- Consumes: なし（親から渡されるpropsのみ使用）
- Produces: `HomeView({ onNavigate, monthlySavings })` — デフォルトエクスポート。`onNavigate(viewId)`はカードクリック時に`viewId`（"list" | "cart" | "map" | "favorites"のいずれか）を引数に呼ばれる。`monthlySavings`は数値（円）

- [ ] **Step 1: `HomeView.jsx`を作成する**

```jsx
// src/pages/HomeView.jsx
import { List, ShoppingCart, MapPin, Star } from "lucide-react";
import { yen } from "../lib/format.js";
import { ACCENT } from "../lib/theme.js";

const CARDS = [
  { id: "list", label: "最安値を見る", icon: List },
  { id: "cart", label: "買い物リストで比較", icon: ShoppingCart },
  { id: "map", label: "地図で探す", icon: MapPin },
  { id: "favorites", label: "お気に入り", icon: Star },
];

export default function HomeView({ onNavigate, monthlySavings }) {
  return (
    <div>
      {monthlySavings > 0 && (
        <div
          style={{
            background: "#ecfdf5", border: "1px solid #4ade80", borderRadius: 12,
            padding: "13px 16px", marginBottom: 14, fontSize: 15, color: "#15803d",
          }}
        >
          今月の節約額 <strong>{yen(monthlySavings)}</strong>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => onNavigate(card.id)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 10, aspectRatio: "1 / 1", border: "1px solid #e2e8f0", borderRadius: 16,
                background: "#fff", color: "#1e293b", fontSize: 15, fontWeight: 700,
              }}
            >
              <Icon size={30} color={ACCENT} />
              {card.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

`src/lib/format.js`の`yen()`は既存の`ShoppingListCompare.jsx`等で使われている金額フォーマット関数（`import { yen } from "../lib/format.js"`）をそのまま流用する。

- [ ] **Step 2: lintを通す**

Run: `cd price-compare-app && npx eslint src/pages/HomeView.jsx` （リポジトリに`.oxlintrc.json`がある場合は`npx oxlint src/pages/HomeView.jsx`）
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/pages/HomeView.jsx
git commit -m "ダッシュボード(ホーム)画面のコンポーネントを追加"
```

---

### Task 2: AppShell.jsxにホームタブを追加

**Files:**
- Modify: `src/components/AppShell.jsx:1-11`

**Interfaces:**
- Consumes: なし（既存の`NAV_ITEMS`配列に要素を追加するのみ）
- Produces: `NAV_ITEMS`の先頭に`{ id: "home", label: "ホーム", icon: Home }`が追加された状態。サイドバー・下部ナビ両方は既存の`NAV_ITEMS.map(...)`で自動的に描画されるため、この配列変更だけで両方に反映される

- [ ] **Step 1: `Home`アイコンをimportに追加する**

`src/components/AppShell.jsx`の1行目を変更:

```jsx
import { Home, ShoppingCart, List, MapPin, Star, LogIn, LogOut, HelpCircle } from "lucide-react";
```

- [ ] **Step 2: `NAV_ITEMS`の先頭に`home`を追加する**

`src/components/AppShell.jsx`の6-11行目を変更:

```jsx
const NAV_ITEMS = [
  { id: "home", label: "ホーム", icon: Home },
  { id: "list", label: "最安値", icon: List },
  { id: "cart", label: "比較", icon: ShoppingCart },
  { id: "map", label: "地図", icon: MapPin },
  { id: "favorites", label: "お気に入り", icon: Star },
];
```

- [ ] **Step 3: ビルドが通ることを確認する**

Run: `cd price-compare-app && npm run build`
Expected: ビルド成功（型エラー・構文エラーなし）

- [ ] **Step 4: コミット**

```bash
git add src/components/AppShell.jsx
git commit -m "ナビゲーションにホームタブを追加"
```

---

### Task 3: PriceCompareReal.jsxにホームビューを統合する

**Files:**
- Modify: `src/pages/PriceCompareReal.jsx:1-19`（import追加）
- Modify: `src/pages/PriceCompareReal.jsx:33`（view初期値変更）
- Modify: `src/pages/PriceCompareReal.jsx:381-398`（範囲設定バーの表示条件変更）
- Modify: `src/pages/PriceCompareReal.jsx:400`付近（home分岐を追加）

**Interfaces:**
- Consumes: `HomeView`（Task 1で作成、`{ onNavigate, monthlySavings }`）、`getMonthlySavings()`（`src/lib/savings.js`から、引数なしで呼び出し可）
- Produces: なし（末端の統合タスク）

- [ ] **Step 1: importを追加する**

`src/pages/PriceCompareReal.jsx`の16行目（`import FavoritesView from "./FavoritesView.jsx";`）の直後に追加:

```jsx
import HomeView from "./HomeView.jsx";
```

`src/pages/PriceCompareReal.jsx`の10行目（`import { dismissDrops, dropSignature, isDropDismissed } from "../lib/notifications.js";`）の直後に追加:

```jsx
import { getMonthlySavings } from "../lib/savings.js";
```

- [ ] **Step 2: `view`の初期値を`"home"`固定に変更する**

33行目を変更:

```jsx
// 変更前
const [view, setView] = useState(() => (loadRangeSetting() ? "list" : "map"));
// 変更後
const [view, setView] = useState("home");
```

- [ ] **Step 3: 範囲設定バーがホーム画面では出ないようにする**

381行目の条件を変更:

```jsx
// 変更前
{view !== "map" && (
// 変更後
{view !== "map" && view !== "home" && (
```

- [ ] **Step 4: `view === "home"`の分岐を追加する**

400行目（`{view === "list" && (`）の直前に追加:

```jsx
      {view === "home" && (
        <HomeView onNavigate={setView} monthlySavings={getMonthlySavings()} />
      )}

```

- [ ] **Step 5: テストを実行し、既存テストが壊れていないことを確認する**

Run: `cd price-compare-app && npx vitest run`
Expected: 既存の全テストがPASS（このタスクはロジック変更を伴わないため新規テスト追加はなし）

- [ ] **Step 6: ビルドを実行する**

Run: `cd price-compare-app && npm run build`
Expected: ビルド成功

- [ ] **Step 7: コミット**

```bash
git add src/pages/PriceCompareReal.jsx
git commit -m "起動時の初期画面をホーム画面に変更"
```

---

### Task 4: 実機確認とデプロイ

**Files:** なし（確認・デプロイのみ）

**Interfaces:**
- Consumes: Task 1-3の全成果物
- Produces: なし（最終確認タスク）

- [ ] **Step 1: devサーバーで実機確認する**

`npm run dev`でdevサーバーを起動し、ブラウザ幅390px（スマホ想定）で`/app.html`を開く。パスコードゲート通過後、以下を確認する:
- アプリ起動直後にホーム画面（節約額行 or 非表示＋2×2カードグリッド）が表示される
- 各カードをタップすると対応するタブ（最安値/比較/地図/お気に入り）に遷移する
- 下部ナビゲーションに「ホーム」アイコンが追加され、タップでホームに戻れる
- 既存4タブの表示・動作に変化がないこと

- [ ] **Step 2: LXC114へデプロイする**

```bash
scp -r dist/* root@192.168.11.114:/var/www/price-compare-app/
curl -s -o /dev/null -w "%{http_code}\n" https://tokuchika.gozakura.com/app.html
```

Expected: `200`

- [ ] **Step 3: 公開URLで最終確認する**

Step 1と同じ確認項目を、公開URL（`https://tokuchika.gozakura.com/app.html`）のブラウザキャッシュを避けた状態（キャッシュバスター付きURL等）で確認する。
