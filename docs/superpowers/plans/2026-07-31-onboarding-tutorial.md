# アプリ内チュートリアル（オンボーディング） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** price-compare-appに、初回訪問時に自動表示され、いつでもヘルプボタンから再表示できるアプリ内チュートリアル（ツアー型・モーダル型の2モード、相互に切り替え可能）を追加する。

**Architecture:** `src/lib/onboarding.js`にステップデータとlocalStorage永続化ヘルパーを定義し、`src/components/OnboardingTour.jsx`が単一コンポーネントでツアー型（ナビゲーション項目を暗転オーバーレイでハイライト＋吹き出し）とモーダル型（中央カード）を内部stateで出し分ける。`AppShell.jsx`にヘルプボタンと`data-tour-id`属性を追加し、`PriceCompareReal.jsx`が表示制御の起点になる。

**Tech Stack:** React 19、既存の`lucide-react`アイコン、`localStorage`、Vitest（ユニットテスト）。新規の外部ライブラリは追加しない。

## Global Constraints

- 対象4ステップは`最安値一覧`・`買い物リスト比較`・`地図範囲選択`・`お気に入り`の順（既存`NAV_ITEMS`の`id`: `list`・`cart`・`map`・`favorites`と対応）。ログイン機能は対象に含めない
- デフォルトの表示モードは「ツアー型」。チュートリアル内のリンクで「モーダル型」に切り替え可能、切り替えてもステップ番号は保持する
- 初回訪問判定は`localStorage`キー`priceCompareApp.onboardingSeen`。完了・スキップどちらでもこのキーを立てて次回から自動表示しない
- ツアー型は裏側の`view`（画面）を切り替えない。ナビゲーション項目の位置をハイライトするだけに留める
- 新規の外部npmパッケージは追加しない（既存の`lucide-react`のみ使用）
- 既存コードのインラインstyleオブジェクトによるスタイリング規約（`AppShell.jsx`・`ListView.jsx`等と同じパターン）に合わせる。CSS Modulesやstyled-componentsは導入しない

---

## Task 1: onboardingステップデータと永続化ヘルパー

**Files:**
- Create: `src/lib/onboarding.js`
- Test: `src/lib/onboarding.test.js`

**Interfaces:**
- Consumes: なし
- Produces:
  - `ONBOARDING_STEPS: { id: string, targetId: string, title: string, description: string }[]`（4件、順序固定）— Task 3の`OnboardingTour.jsx`が参照する
  - `hasSeenOnboarding(): boolean`
  - `markOnboardingSeen(): void`

- [ ] **Step 1: `src/lib/onboarding.js`を作成する**

```js
export const ONBOARDING_STEPS = [
  {
    id: "list",
    targetId: "list",
    title: "最安値一覧",
    description: "カテゴリごとに、今いちばん安い商品と店を一覧で見られます。商品名で検索や並べ替えもできます。",
  },
  {
    id: "cart",
    targetId: "cart",
    title: "買い物リスト比較",
    description: "欲しい商品を選ぶだけで、店舗ごとの合計金額を安い順にランキング表示します。",
  },
  {
    id: "map",
    targetId: "map",
    title: "地図で範囲を選ぶ",
    description: "地図をタップして範囲（半径1〜10km）を指定すると、その中に入る店舗だけで比較できます。",
  },
  {
    id: "favorites",
    targetId: "favorites",
    title: "お気に入り",
    description: "気になる商品を保存しておけば、値下げがあったときにバッジで気づけます（ログインが必要です）。",
  },
];

const ONBOARDING_STORAGE_KEY = "priceCompareApp.onboardingSeen";

export function hasSeenOnboarding() {
  try {
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) === "true";
  } catch {
    return true;
  }
}

export function markOnboardingSeen() {
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
  } catch {
    // localStorageが使えない環境では何もしない
  }
}
```

- [ ] **Step 2: `src/lib/onboarding.test.js`に失敗するテストを書く**

```js
import { describe, expect, it, beforeEach } from "vitest";
import { ONBOARDING_STEPS, hasSeenOnboarding, markOnboardingSeen } from "./onboarding.js";

describe("ONBOARDING_STEPS", () => {
  it("4ステップ、list→cart→map→favoritesの順で定義されている", () => {
    expect(ONBOARDING_STEPS.map((s) => s.id)).toEqual(["list", "cart", "map", "favorites"]);
  });

  it("各ステップがtitle・description・targetIdを持つ", () => {
    for (const step of ONBOARDING_STEPS) {
      expect(step.targetId).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
    }
  });
});

describe("hasSeenOnboarding / markOnboardingSeen", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("未設定ならfalseを返す", () => {
    expect(hasSeenOnboarding()).toBe(false);
  });

  it("markOnboardingSeen後はtrueを返す", () => {
    markOnboardingSeen();
    expect(hasSeenOnboarding()).toBe(true);
  });
});
```

- [ ] **Step 3: テストを実行して失敗を確認する**

Run: `cd price-compare-app && npx vitest run src/lib/onboarding.test.js`
Expected: FAIL（`onboarding.js`が存在しないためimportエラー）

- [ ] **Step 4: Step 1のコードを反映し、テストを再実行する**

Run: `cd price-compare-app && npx vitest run src/lib/onboarding.test.js`
Expected: 4 tests PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/onboarding.js src/lib/onboarding.test.js
git commit -m "feat: オンボーディングのステップデータとlocalStorage永続化ヘルパーを追加"
```

---

## Task 2: AppShellにヘルプボタンとdata-tour-id属性を追加

**Files:**
- Modify: `src/components/AppShell.jsx`

**Interfaces:**
- Consumes: なし（新規propsを追加するのみ）
- Produces: `AppShell`が新規propとして`onRequestOnboarding: () => void`を受け取るようになる（Task 4で`PriceCompareReal.jsx`から渡される）。各ナビゲーションボタンのDOMに`data-tour-id={item.id}`属性が付く（Task 3の`OnboardingTour.jsx`が`document.querySelector('[data-tour-id="..."]')`で参照する）

- [ ] **Step 1: `AppShell`のpropsに`onRequestOnboarding`を追加し、各NAV_ITEMSボタンに`data-tour-id`を付与する**

`src/components/AppShell.jsx`の関数シグネチャを変更:

```jsx
export default function AppShell({ view, setView, children, showAuthForm, onRequestAuth, onCloseAuth, onRequestOnboarding }) {
```

サイドバーの`NAV_ITEMS.map`内のbutton（37〜51行目付近）に`data-tour-id`を追加:

```jsx
<button
  key={item.id}
  type="button"
  data-tour-id={item.id}
  onClick={() => setView(item.id)}
  style={{
    display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "10px 4px",
    border: "none", borderRadius: 10, background: active ? "#eff6ff" : "transparent",
    color: active ? "#2563eb" : "#64748b", fontSize: 10,
  }}
>
  <Icon size={18} />
  {item.label}
</button>
```

下部ナビの`NAV_ITEMS.map`内のbutton（91〜103行目付近）にも同様に`data-tour-id={item.id}`を追加する。

- [ ] **Step 2: サイドバーの一番下（ログイン/ログアウトボタンの下）にヘルプボタンを追加する**

`import { ShoppingCart, List, MapPin, Star, LogIn, LogOut } from "lucide-react";`を以下に変更:

```jsx
import { ShoppingCart, List, MapPin, Star, LogIn, LogOut, HelpCircle } from "lucide-react";
```

サイドバーの`<div style={{ marginTop: "auto" }}>`ブロックの直前（ログイン/ログアウトボタンの直前）に以下を追加:

```jsx
<button
  type="button"
  onClick={onRequestOnboarding}
  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "10px 4px", border: "none", background: "transparent", color: "#64748b", fontSize: 10, width: "100%" }}
>
  <HelpCircle size={18} />
  使い方
</button>
```

- [ ] **Step 3: 下部ナビにもヘルプボタンを追加する**

下部ナビ（`className="app-bottomnav"`の`<nav>`内）の、ログイン/ログアウトボタンの直後に以下を追加:

```jsx
<button
  type="button"
  onClick={onRequestOnboarding}
  style={{
    flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "6px 4px",
    border: "none", background: "transparent", color: "#94a3b8", fontSize: 10,
  }}
>
  <HelpCircle size={18} />
  使い方
</button>
```

- [ ] **Step 4: ビルドが通ることを確認する**

Run: `cd price-compare-app && npm run build`
Expected: エラーなくビルド成功（`onRequestOnboarding`は未使用でも呼び出し元から渡されないだけでビルドは通る）

- [ ] **Step 5: コミット**

```bash
git add src/components/AppShell.jsx
git commit -m "feat: AppShellにヘルプボタンとdata-tour-id属性を追加"
```

---

## Task 3: OnboardingTourコンポーネント（ツアー型・モーダル型）

**Files:**
- Create: `src/components/OnboardingTour.jsx`

**Interfaces:**
- Consumes: `ONBOARDING_STEPS`・`markOnboardingSeen`（Task 1の`src/lib/onboarding.js`）
- Produces: `OnboardingTour({ onClose: () => void })`コンポーネント。`onClose`は完了・スキップ両方のタイミングで呼ばれる（内部で`markOnboardingSeen()`を呼んでから`onClose()`を呼ぶ）。Task 4の`PriceCompareReal.jsx`がこのコンポーネントを描画する

- [ ] **Step 1: `src/components/OnboardingTour.jsx`を作成する**

```jsx
import { useEffect, useState } from "react";
import { X, ArrowRight, ArrowLeft } from "lucide-react";
import { ONBOARDING_STEPS, markOnboardingSeen } from "../lib/onboarding.js";

export default function OnboardingTour({ onClose }) {
  const [mode, setMode] = useState("tour");
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState(null);

  const current = ONBOARDING_STEPS[step];
  const isLast = step === ONBOARDING_STEPS.length - 1;

  useEffect(() => {
    if (mode !== "tour") {
      setTargetRect(null);
      return;
    }
    const measure = () => {
      const el = document.querySelector(`[data-tour-id="${current.targetId}"]`);
      if (el) setTargetRect(el.getBoundingClientRect());
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [mode, current.targetId]);

  const finish = () => {
    markOnboardingSeen();
    onClose();
  };

  const goNext = () => {
    if (isLast) finish();
    else setStep((s) => s + 1);
  };
  const goBack = () => setStep((s) => Math.max(0, s - 1));

  const modeToggleLink = (
    <button
      type="button"
      onClick={() => setMode(mode === "tour" ? "modal" : "tour")}
      style={{ border: "none", background: "transparent", color: "#93c5fd", fontSize: 12, cursor: "pointer", padding: 0, textDecoration: "underline" }}
    >
      {mode === "tour" ? "一覧形式で見る" : "画面上で見る"}
    </button>
  );

  const dots = (
    <div style={{ display: "flex", gap: 6 }}>
      {ONBOARDING_STEPS.map((s, i) => (
        <span
          key={s.id}
          style={{
            width: 6, height: 6, borderRadius: "50%",
            background: i === step ? "#2563eb" : "#cbd5e1",
          }}
        />
      ))}
    </div>
  );

  if (mode === "modal") {
    return (
      <div
        style={{
          position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16,
        }}
      >
        <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700 }}>
              使い方（{step + 1}/{ONBOARDING_STEPS.length}）
            </span>
            <button type="button" onClick={finish} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#94a3b8" }}>
              <X size={18} />
            </button>
          </div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0f172a" }}>{current.title}</h3>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: "#475569" }}>{current.description}</p>
          {dots}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
            <button
              type="button"
              onClick={() => setMode("tour")}
              style={{ border: "none", background: "transparent", color: "#2563eb", fontSize: 12, cursor: "pointer", padding: 0, textDecoration: "underline" }}
            >
              画面上で見る
            </button>
            <div style={{ display: "flex", gap: 8 }}>
              {step > 0 && (
                <button
                  type="button"
                  onClick={goBack}
                  style={{ display: "flex", alignItems: "center", gap: 4, border: "1px solid #e2e8f0", background: "#fff", borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer", color: "#334155" }}
                >
                  <ArrowLeft size={14} /> 戻る
                </button>
              )}
              <button
                type="button"
                onClick={goNext}
                style={{ display: "flex", alignItems: "center", gap: 4, border: "none", background: "#2563eb", color: "#fff", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                {isLast ? "はじめる" : "次へ"} {!isLast && <ArrowRight size={14} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ツアー型: 対象要素の位置が取れるまでは何も描画しない
  if (!targetRect) return null;

  const pad = 8;
  const holeStyle = {
    position: "fixed",
    top: targetRect.top - pad,
    left: targetRect.left - pad,
    width: targetRect.width + pad * 2,
    height: targetRect.height + pad * 2,
    borderRadius: 12,
    boxShadow: "0 0 0 9999px rgba(15,23,42,0.65)",
    zIndex: 200,
    pointerEvents: "none",
  };

  // 吹き出しは対象要素の右側（サイドバー時）または上側（下部ナビ時）に出す。
  // 画面幅が狭い(下部ナビ表示時)は対象が画面下部にあるとみなし、吹き出しを対象の上に出す
  const showAbove = targetRect.top > window.innerHeight / 2;
  const tooltipStyle = {
    position: "fixed",
    zIndex: 201,
    background: "#0f172a",
    color: "#fff",
    borderRadius: 12,
    padding: 16,
    width: 260,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    ...(showAbove
      ? { left: Math.max(12, Math.min(targetRect.left, window.innerWidth - 272)), bottom: window.innerHeight - targetRect.top + 12 }
      : { left: Math.min(targetRect.right + 12, window.innerWidth - 272), top: Math.max(12, targetRect.top) }),
  };

  return (
    <>
      <div style={holeStyle} />
      <div style={tooltipStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <span style={{ fontSize: 11, color: "#93c5fd", fontWeight: 700 }}>
            使い方（{step + 1}/{ONBOARDING_STEPS.length}）
          </span>
          <button type="button" onClick={finish} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#93c5fd" }}>
            <X size={16} />
          </button>
        </div>
        <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{current.title}</h4>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: "#cbd5e1" }}>{current.description}</p>
        {dots}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
          {modeToggleLink}
          <div style={{ display: "flex", gap: 8 }}>
            {step > 0 && (
              <button
                type="button"
                onClick={goBack}
                style={{ border: "1px solid #475569", background: "transparent", color: "#e2e8f0", borderRadius: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer" }}
              >
                戻る
              </button>
            )}
            <button
              type="button"
              onClick={goNext}
              style={{ border: "none", background: "#2563eb", color: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              {isLast ? "はじめる" : "次へ"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: ビルドが通ることを確認する**

Run: `cd price-compare-app && npm run build`
Expected: エラーなくビルド成功

- [ ] **Step 3: コミット**

```bash
git add src/components/OnboardingTour.jsx
git commit -m "feat: ツアー型・モーダル型を切り替え可能なOnboardingTourコンポーネントを追加"
```

---

## Task 4: PriceCompareRealへの統合と実機確認

**Files:**
- Modify: `src/pages/PriceCompareReal.jsx`

**Interfaces:**
- Consumes: `hasSeenOnboarding`（`src/lib/onboarding.js`、Task 1）、`AppShell`の新規prop`onRequestOnboarding`（Task 2）、`OnboardingTour`（Task 3）
- Produces: なし（末端の統合タスク）

- [ ] **Step 1: importを追加する**

`src/pages/PriceCompareReal.jsx`の先頭のimport群に以下を追加:

```jsx
import { hasSeenOnboarding } from "../lib/onboarding.js";
import OnboardingTour from "../components/OnboardingTour.jsx";
```

- [ ] **Step 2: `showOnboarding`のstateを追加する**

既存の`const [showAuthForm, setShowAuthForm] = useState(false);`の直後に追加:

```jsx
const [showOnboarding, setShowOnboarding] = useState(() => !hasSeenOnboarding());
```

- [ ] **Step 3: `AppShell`の呼び出しに`onRequestOnboarding`を渡す**

`<AppShell ...>`のprops一覧（`view`・`setView`・`showAuthForm`・`onRequestAuth`・`onCloseAuth`を渡している箇所）に追加:

```jsx
onRequestOnboarding={() => setShowOnboarding(true)}
```

- [ ] **Step 4: `<AppShell>`の子要素として`OnboardingTour`を条件付きで描画する**

`{showAuthForm && <AuthForm onClose={onCloseAuth} />}`と同様のパターンで、`AppShell`の`children`の外側（`AppShell`が返すJSXの中、`{showAuthForm && ...}`の直後）に既にAuthFormがあるため、`PriceCompareReal.jsx`側の`return`文内、`</AppShell>`の直前または直後に以下を追加する:

```jsx
{showOnboarding && <OnboardingTour onClose={() => setShowOnboarding(false)} />}
```

具体的には、`return (\n    <AppShell ...>\n      {...view別の描画...}\n    </AppShell>\n  );`の構造になっているはずなので、`</AppShell>`の直後（`AppShell`と兄弟要素として）に配置する。`AppShell`と`OnboardingTour`を`<>...</>`（Fragment）で包む必要がある場合はFragmentに変更する。

- [ ] **Step 5: ビルドが通ることを確認する**

Run: `cd price-compare-app && npm run build`
Expected: エラーなくビルド成功

- [ ] **Step 6: ブラウザ実機で動作確認する**

claude-in-chromeを使い、`http://192.168.11.114/app.html`（本番LXC114、まだこの変更はデプロイされていないため、Task 5でのデプロイ後に確認するか、`npm run dev`のローカル開発サーバーで確認する）で以下を確認する:
- ブラウザの`localStorage`から`priceCompareApp.onboardingSeen`を削除した状態でページを開くと、ツアー型のチュートリアルが自動表示される
- 「次へ」で4ステップ進み、各ステップで対応するnav項目がハイライトされる（サイドバー表示のPC幅、下部ナビ表示のモバイル幅の両方で確認）
- 「一覧形式で見る」でモーダル型に切り替わり、ステップ番号が保持されている
- 「はじめる」または「×」で閉じると、リロードしても再表示されない
- サイドバー・下部ナビの「使い方」ボタンをクリックすると、完了後でも再表示される

- [ ] **Step 7: コミット**

```bash
git add src/pages/PriceCompareReal.jsx
git commit -m "feat: PriceCompareRealにオンボーディング表示制御を統合"
```
