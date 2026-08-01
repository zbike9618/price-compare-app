# アプリ用パスコードゲート + LPフィードバックフォーム Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `app.html`に共通パスコードによる簡易ゲートを追加し、LP（`index.html`）にはGoogleフォームへのフィードバック導線を追加する。

**Architecture:** 既存の`src/lib/onboarding.js`（定数＋localStorageヘルパー関数）と同じパターンで`src/lib/passcode.js`を新設し、`PriceCompareReal.jsx`のトップレベルで未解除なら`PasscodeGate`コンポーネントのみを描画する早期returnを追加する。LP側は`src/lib/feedbackForm.js`にGoogleフォームURLを1箇所にまとめ、`LandingPage.jsx`に新規セクションとして導線ボタンを追加する。

**Tech Stack:** React 19 + Vite（マルチページ構成、`index.html`=LP／`app.html`=アプリ）、vitest + jsdom（ユニットテスト）、lucide-react（アイコン）

## Global Constraints
- パスコードは共通の固定コード1つ（個別発行はしない）。デフォルト値は`TOKUCHIKA2026`とし、Zが変更したい場合は`src/lib/passcode.js`の`PASSCODE`定数を書き換えるだけでよい設計にする
- 比較は前後の空白除去・大文字小文字を無視する
- サーバー側の認可（Supabase RLS等）は変更しない。既存の`favorites`等のRLSポリシーはそのまま
- LP（`index.html`／`LandingPage.jsx`）の既存の見た目・導線は変更しない。パスコードゲートは`app.html`側のみに適用する
- GoogleフォームのURLは未確定。`src/lib/feedbackForm.js`にプレースホルダー文字列`"https://forms.gle/REPLACE_ME"`を入れ、1箇所差し替えで反映できるようにする
- デプロイは既存パターンを踏襲: `cd price-compare-app && npm run build && scp -r dist/* root@192.168.11.114:/var/www/price-compare-app/`

---

### Task 1: パスコード判定ロジック（`src/lib/passcode.js`）

**Files:**
- Create: `src/lib/passcode.js`
- Test: `src/lib/passcode.test.js`

**Interfaces:**
- Consumes: なし（新規モジュール）
- Produces:
  - `export const PASSCODE: string`（値: `"TOKUCHIKA2026"`）
  - `export function isPasscodeUnlocked(): boolean`
  - `export function unlockPasscode(): void`
  - `export function checkPasscode(input: string): boolean`

- [ ] **Step 1: Write the failing test**

`src/lib/passcode.test.js`を新規作成する（`src/lib/onboarding.test.js`と同じ`@vitest-environment jsdom`パターンに合わせる）:

```javascript
// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";
import { PASSCODE, isPasscodeUnlocked, unlockPasscode, checkPasscode } from "./passcode.js";

describe("checkPasscode", () => {
  it("正しいコードならtrueを返す", () => {
    expect(checkPasscode(PASSCODE)).toBe(true);
  });

  it("大文字小文字が違ってもtrueを返す", () => {
    expect(checkPasscode(PASSCODE.toLowerCase())).toBe(true);
  });

  it("前後に空白があってもtrueを返す", () => {
    expect(checkPasscode(`  ${PASSCODE}  `)).toBe(true);
  });

  it("間違ったコードならfalseを返す", () => {
    expect(checkPasscode("wrong-code")).toBe(false);
  });

  it("空文字ならfalseを返す", () => {
    expect(checkPasscode("")).toBe(false);
  });

  it("文字列以外が渡されてもfalseを返す（例外を投げない）", () => {
    expect(checkPasscode(undefined)).toBe(false);
    expect(checkPasscode(null)).toBe(false);
  });
});

describe("isPasscodeUnlocked / unlockPasscode", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("未設定ならfalseを返す", () => {
    expect(isPasscodeUnlocked()).toBe(false);
  });

  it("unlockPasscode後はtrueを返す", () => {
    unlockPasscode();
    expect(isPasscodeUnlocked()).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd price-compare-app && npx vitest run src/lib/passcode.test.js`
Expected: FAIL（`src/lib/passcode.js`が存在しない、`Failed to resolve import`エラー）

- [ ] **Step 3: Write minimal implementation**

`src/lib/passcode.js`を新規作成する:

```javascript
// 共通の固定パスコード。Zが変更したい場合はこの値を書き換えるだけでよい
export const PASSCODE = "TOKUCHIKA2026";

const PASSCODE_STORAGE_KEY = "priceCompareApp.passcodeUnlocked";

export function isPasscodeUnlocked() {
  try {
    return localStorage.getItem(PASSCODE_STORAGE_KEY) === "true";
  } catch {
    return true;
  }
}

export function unlockPasscode() {
  try {
    localStorage.setItem(PASSCODE_STORAGE_KEY, "true");
  } catch {
    // localStorageが使えない環境では何もしない
  }
}

export function checkPasscode(input) {
  if (typeof input !== "string") return false;
  return input.trim().toLowerCase() === PASSCODE.toLowerCase();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd price-compare-app && npx vitest run src/lib/passcode.test.js`
Expected: PASS（8件全て）

- [ ] **Step 5: Commit**

```bash
cd price-compare-app
git add src/lib/passcode.js src/lib/passcode.test.js
git commit -m "feat: 共通パスコードの判定ロジックを追加"
```

---

### Task 2: パスコード入力UI（`src/components/PasscodeGate.jsx`）

**Files:**
- Create: `src/components/PasscodeGate.jsx`

**Interfaces:**
- Consumes: `checkPasscode`, `unlockPasscode` from `src/lib/passcode.js`（Task 1で定義）
- Produces: `export default function PasscodeGate({ onUnlock }: { onUnlock: () => void })` — React コンポーネント。`onUnlock`は解除成功時に呼ばれるコールバック

- [ ] **Step 1: Implement the component**

`src/components/PasscodeGate.jsx`を新規作成する（既存の`src/components/OnboardingTour.jsx`と同じインラインstyleパターン、色は既存の青`#2563eb`アクセントに合わせる）:

```jsx
import { useState } from "react";
import { Lock } from "lucide-react";
import { checkPasscode, unlockPasscode } from "../lib/passcode.js";

export default function PasscodeGate({ onUnlock }) {
  const [value, setValue] = useState("");
  const [showError, setShowError] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (checkPasscode(value)) {
      unlockPasscode();
      onUnlock();
    } else {
      setShowError(true);
    }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "#0f172a",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16, zIndex: 3000,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: "#fff", borderRadius: 16, padding: 28, width: "100%", maxWidth: 340,
          display: "flex", flexDirection: "column", gap: 14, alignItems: "center",
        }}
      >
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Lock size={20} color="#2563eb" strokeWidth={2.2} />
        </div>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a", textAlign: "center" }}>
          招待コードを入力してください
        </h2>
        <p style={{ margin: 0, fontSize: 12.5, color: "#64748b", textAlign: "center", lineHeight: 1.6 }}>
          このアプリは現在、招待された方のみ利用できます。
        </p>
        <input
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setShowError(false);
          }}
          placeholder="招待コード"
          style={{
            width: "100%", border: "1px solid #e2e8f0", borderRadius: 10,
            padding: "10px 12px", fontSize: 14, textAlign: "center", boxSizing: "border-box",
          }}
          autoFocus
        />
        {showError && (
          <p style={{ margin: 0, fontSize: 12, color: "#dc2626" }}>コードが正しくありません</p>
        )}
        <button
          type="submit"
          style={{
            width: "100%", border: "none", background: "#2563eb", color: "#fff",
            borderRadius: 10, padding: "11px 0", fontSize: 13.5, fontWeight: 700, cursor: "pointer",
          }}
        >
          進む
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

このタスクは見た目のみのコンポーネントで自動テスト対象外（既存の`OnboardingTour.jsx`と同じ方針、実機確認はTask 5でまとめて行う）。

```bash
cd price-compare-app
git add src/components/PasscodeGate.jsx
git commit -m "feat: パスコード入力ゲートUIを追加"
```

---

### Task 3: `PriceCompareReal.jsx`にゲートを組み込む

**Files:**
- Modify: `src/pages/PriceCompareReal.jsx`

**Interfaces:**
- Consumes: `isPasscodeUnlocked` from `src/lib/passcode.js`（Task 1）、`PasscodeGate` from `src/components/PasscodeGate.jsx`（Task 2）
- Produces: なし（末端の画面コンポーネント）

- [ ] **Step 1: import文を追加**

`src/pages/PriceCompareReal.jsx`の9行目`import { hasSeenOnboarding } from "../lib/onboarding.js";`の直後に追加:

```javascript
import { isPasscodeUnlocked } from "../lib/passcode.js";
```

11行目`import OnboardingTour from "../components/OnboardingTour.jsx";`の直後に追加:

```javascript
import PasscodeGate from "../components/PasscodeGate.jsx";
```

- [ ] **Step 2: stateを追加**

37行目`const [showOnboarding, setShowOnboarding] = useState(() => !hasSeenOnboarding());`の直後に追加:

```javascript
  const [passcodeUnlocked, setPasscodeUnlocked] = useState(() => isPasscodeUnlocked());
```

- [ ] **Step 3: 早期returnを追加**

270行目の`if (loading) {`の直前（既存の`if (loading)` / `if (error)`と同じ、全hooks呼び出し後の位置）に追加:

```javascript
  if (!passcodeUnlocked) {
    return <PasscodeGate onUnlock={() => setPasscodeUnlocked(true)} />;
  }

```

- [ ] **Step 4: 変更後のファイルを確認**

Run: `cd price-compare-app && npx vitest run`
Expected: 既存の全テスト（onboarding/geo/discount/freshness/passcode）がPASSしたまま変わらないこと

- [ ] **Step 5: Commit**

```bash
cd price-compare-app
git add src/pages/PriceCompareReal.jsx
git commit -m "feat: app.htmlにパスコードゲートを組み込む"
```

---

### Task 4: LPフィードバックセクション

**Files:**
- Create: `src/lib/feedbackForm.js`
- Modify: `src/pages/LandingPage.jsx`

**Interfaces:**
- Consumes: なし
- Produces: `export const FEEDBACK_FORM_URL: string`（`src/lib/feedbackForm.js`から。Zがフォーム作成後にこの値を実URLへ差し替える）

- [ ] **Step 1: `src/lib/feedbackForm.js`を新規作成**

```javascript
// GoogleフォームのURL。Zがフォーム作成後にここを実URLへ差し替える
export const FEEDBACK_FORM_URL = "https://forms.gle/REPLACE_ME";
```

- [ ] **Step 2: `LandingPage.jsx`にimportを追加**

`src/pages/LandingPage.jsx`の1〜3行目のimport文を以下に置き換える:

```javascript
import {
  MapPin, List, Star, TrendingDown, ShoppingCart, Store, ArrowRight, Check, Clock, MessageSquare,
} from "lucide-react";
import { FEEDBACK_FORM_URL } from "../lib/feedbackForm.js";
```

- [ ] **Step 3: フィードバックセクションを追加**

`src/pages/LandingPage.jsx`の142行目（ROADMAPセクションの閉じ`</div>`、`144行目`の最終CTAブロック`<div style={{ padding: "30px 24px 36px" }}>`の直前）に、新規セクションを挿入する。挿入前後は以下の通り:

```jsx
        </div>
      </div>

      <div style={{ padding: "30px 24px 8px" }}>
        <div
          style={{
            background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14,
            padding: "20px 18px", display: "flex", flexDirection: "column",
            alignItems: "center", textAlign: "center", gap: 10,
          }}
        >
          <div style={{ width: 34, height: 34, borderRadius: 10, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <MessageSquare size={16} color="#2563eb" strokeWidth={2.2} />
          </div>
          <h2 style={{ fontSize: 15, fontWeight: 900, margin: 0 }}>ご意見・フィードバックをお寄せください</h2>
          <p style={{ fontSize: 12, color: "#64748b", margin: 0, lineHeight: 1.7 }}>
            使ってみた感想や、こうだったら良いのに、という点をぜひ教えてください。
          </p>
          <a
            href={FEEDBACK_FORM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="cta"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, background: "#2563eb", color: "#fff",
              border: "none", borderRadius: 999, padding: "10px 20px", fontSize: 13, fontWeight: 700,
              textDecoration: "none", marginTop: 4,
            }}
          >
            フィードバックを送る
            <ArrowRight size={14} />
          </a>
        </div>
      </div>

      <div style={{ padding: "30px 24px 36px" }}>
```

（挿入位置の目印: 直前は`ROADMAP.map(...)`を閉じる`</div>`が2つ連続する箇所、直後は既存の最終CTAブロックの開始行）

- [ ] **Step 4: ビルド確認**

Run: `cd price-compare-app && npm run build`
Expected: エラーなく`dist/`が生成されること

- [ ] **Step 5: Commit**

```bash
cd price-compare-app
git add src/lib/feedbackForm.js src/pages/LandingPage.jsx
git commit -m "feat: LPにフィードバックフォームへの導線を追加"
```

---

### Task 5: 統合ビルド・デプロイ・実機確認

**Files:**
- なし（ビルド・デプロイ・確認のみ）

**Interfaces:**
- Consumes: Task 1〜4の全成果物
- Produces: なし（最終確認タスク）

- [ ] **Step 1: 全テストを実行**

Run: `cd price-compare-app && npx vitest run`
Expected: 全テストPASS（passcode.test.jsの新規8件を含む）

- [ ] **Step 2: ビルド**

Run: `cd price-compare-app && npm run build`
Expected: エラーなく完了

- [ ] **Step 3: LXC114へデプロイ**

Run: `cd price-compare-app && scp -r dist/* root@192.168.11.114:/var/www/price-compare-app/`
Expected: 転送完了（エラーなし）

- [ ] **Step 4: 実機確認（コントローラー自身がclaude-in-chrome等で実施）**

以下を確認する:
- `https://tokuchika.gozakura.com/app.html?cb=<任意の値>`（キャッシュバスター付き）にアクセスし、パスコード入力画面が表示されること
- 間違ったコードを入力すると「コードが正しくありません」が表示されること
- 正しいコード（`TOKUCHIKA2026`）を入力すると、通常のアプリ画面（読み込み中→最安値一覧等）に遷移すること
- ページを再読み込みしても、再度パスコード入力を求められないこと（localStorageに解除状態が保存されている）
- `https://tokuchika.gozakura.com/`（LP）はパスコードなしで従来通り表示され、末尾に「ご意見・フィードバックをお寄せください」セクションと「フィードバックを送る」ボタンが表示されること（クリック時のリンク先はまだプレースホルダーURLのため実際には開かなくてよい）

- [ ] **Step 5: Zへの引き継ぎ事項をprojects/price-compare-app/project.mdに記録**

`.secretary/projects/price-compare-app/project.md`の「進捗」に本日の実施内容（パスコードゲート実装・LPフィードバック導線追加）を追記し、「タスク」セクションに以下を追加する:

```markdown
- [ ] Googleフォームを実際に作成し質問項目（設計案8問、`docs/superpowers/specs/2026-08-01-passcode-and-feedback-form-design.md`参照）を登録。発行されたURLを`src/lib/feedbackForm.js`の`FEEDBACK_FORM_URL`に反映しビルド・再デプロイする | 優先度: 高 | 期限: 未定
- [ ] 共通パスコード（現在値: `TOKUCHIKA2026`）を招待者に配布する（LINE等）。値を変更したい場合は`src/lib/passcode.js`の`PASSCODE`を書き換えてビルド・再デプロイ | 優先度: 高 | 期限: 未定
```

（このステップはコントローラー自身が`.secretary`側のファイル書き込みルールに従って実施する）

---

## Self-Review メモ（実行前チェック済み）
- spec.mdの①②③すべてに対応するタスクがある（①=Task1-3、②=Task4、③=Task4のセクション文言＋spec内の質問項目案そのままZに引き継ぎ、Task5で明示的にタスク化）
- プレースホルダーなし（`FEEDBACK_FORM_URL`の`REPLACE_ME`は意図的な仮値であり、Task5で差し替えタスクとして明示済み）
- 型・関数名の一貫性: `isPasscodeUnlocked`/`unlockPasscode`/`checkPasscode`/`PASSCODE`はTask1で定義した名前をTask2・Task3で一貫して使用
