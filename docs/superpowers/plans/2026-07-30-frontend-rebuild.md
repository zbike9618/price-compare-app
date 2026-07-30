# price-compare-app フロントエンド全面刷新 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `price-compare-app`のLP・アプリ本体のフロントエンドを全面刷新し、お気に入り機能（Supabase Auth必須・ゲストは非永続）と値下げバッジ（直近30日最安値更新基準）を追加する。

**Architecture:** 既存のVite + React構成（`app.html`→`main-app.jsx`、`index.html`→`main.jsx`）を維持しつつ、`PriceCompareReal.jsx`（1058行の単一ファイル）を`AppShell`・`ProductRow`・`ListView`・`ShoppingListCompare`・`MapView`・`FavoritesView`・`AuthContext`・`AuthForm`に分割する。認証・お気に入りの永続化は`@supabase/supabase-js`経由でSupabase Auth + `favorites`テーブル（ユーザースコープ化のためマイグレーション必要）を利用する。

**Tech Stack:** Vite 8 + React 19 + lucide-react + プレーンCSS（インラインstyle + `<style>`タグ、既存パターン踏襲）、Leaflet（地図）、新規追加: `@supabase/supabase-js`（Auth・DB両方の呼び出しをこれに統一）、`vitest`（純粋関数のみユニットテスト対象）。

## Global Constraints

- プロジェクトルート: `C:\Users\RuiRu\OneDrive\Desktop\claude-code\price-compare-app\`
- Supabase self-host: `http://192.168.11.114:8000`（Kong経由）、DB操作は`ssh root@192.168.11.114`→`docker exec supabase-db psql -U postgres -d postgres`
- 既存の`SUPABASE_ANON_KEY`（`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg1MDcyNzAyLCJleHAiOjE5NDI3NTI3MDJ9.Td8X4Gbl2mkslj0Kspaznme5RuNK8sqJawZGZrAavS8`）を`src/lib/supabaseClient.js`に引き継ぐ。変更・再発行しない
- ビジュアルトーン: 白背景＋青アクセント（`#2563eb`系）、カード型・角丸・余白多め（現行の緑系`#2F6B4A`テーマから置き換える）
- ナビゲーション: 画面幅768px未満はスマホ判定で下部固定ナビ、768px以上はサイドバー（レスポンシブCSSで両方の要素を用意し`display`で出し分ける）
- スクレイパー・DBスキーマ（`favorites`のuser_id対応を除く）・既存データは変更しない
- 単価表示（¥/100g等）・Googleログインは本計画のスコープ外（`.secretary/projects/price-compare-app/project.md`のタスクに別途記載済み）
- 認証: メール/パスワードのみ。Supabase側は`ENABLE_EMAIL_AUTOCONFIRM=true`が既に設定済みのため、確認メール送信フローの実装は不要（署名直後に確定済みユーザーとして扱われる）
- **既存の動作確認方針を踏襲**: このプロジェクトに自動UIテストの前例はなく、`npm run dev`でのブラウザ実機確認が正式な検証手段。本計画でも純粋関数（値下げ判定ロジック）のみvitestで自動テストし、Reactコンポーネントの検証はブラウザ実機で行う
- 実データの制約: `price_history`は2026-07-26・2026-07-27の2日分しか存在せず、自然な「直近30日で最安値更新」を実データ上で必ず再現できるとは限らない（毎日自動スクレイピングは別タスクで未着手のため）。値下げバッジの正しさはTask 4のユニットテストで担保し、実データでの表示確認は「該当する組み合わせが無ければ無表示のままで正常」という前提で行う

---

### Task 1: `favorites`テーブルのユーザースコープ化マイグレーション

**Files:**
- Create: `supabase/migrations/2026-07-30-favorites-user-scoped.sql`

**Interfaces:**
- Consumes: なし（既存の`favorites`テーブル。現状 `product_id uuid primary key, created_at timestamptz`、RLS有効・ポリシーなし・データ0件）
- Produces: `favorites(user_id uuid, product_id uuid, created_at timestamptz)` 複合PK `(user_id, product_id)`、`authenticated`ロール向けRLSポリシー。Task 8の`useFavorites`フックが`.from("favorites")`でこのテーブルにアクセスする前提となる

- [ ] **Step 1: マイグレーションSQLを作成**

```sql
-- supabase/migrations/2026-07-30-favorites-user-scoped.sql
begin;

alter table favorites
  add column user_id uuid not null references auth.users(id) on delete cascade;

alter table favorites drop constraint favorites_pkey;
alter table favorites add primary key (user_id, product_id);

alter table favorites enable row level security;

drop policy if exists "favorites are managed by owner" on favorites;
create policy "favorites are managed by owner"
  on favorites
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

commit;
```

- [ ] **Step 2: 現状のスキーマを確認（適用前のベースライン）**

Run: `ssh root@192.168.11.114 "docker exec supabase-db psql -U postgres -d postgres -c '\d favorites'"`
Expected: `product_id`・`created_at`のみのカラム、`Policies (row security enabled): (none)`

- [ ] **Step 3: マイグレーションを適用**

ローカルのSQLファイルをLXC114にコピーしてから実行する:

```bash
scp "C:\Users\RuiRu\OneDrive\Desktop\claude-code\price-compare-app\supabase\migrations\2026-07-30-favorites-user-scoped.sql" root@192.168.11.114:/tmp/favorites-migration.sql
ssh root@192.168.11.114 "docker exec -i supabase-db psql -U postgres -d postgres < /tmp/favorites-migration.sql"
```

Expected: `ALTER TABLE` `ALTER TABLE` `ALTER TABLE` `ALTER TABLE` `ALTER TABLE` `DROP POLICY` `CREATE POLICY` `COMMIT` が順に出力され、エラーなし

- [ ] **Step 4: マイグレーション結果を確認**

Run: `ssh root@192.168.11.114 "docker exec supabase-db psql -U postgres -d postgres -c '\d favorites'"`
Expected: `user_id uuid not null`列が追加され、`PRIMARY KEY, btree (user_id, product_id)`、`Policies: POLICY "favorites are managed by owner" FOR ALL TO authenticated USING (...) WITH CHECK (...)`が表示される

- [ ] **Step 5: 一時ファイルを削除しコミット**

```bash
ssh root@192.168.11.114 "rm /tmp/favorites-migration.sql"
git add supabase/migrations/2026-07-30-favorites-user-scoped.sql
git commit -m "favoritesテーブルをユーザースコープ化するマイグレーションを追加"
```

---

### Task 2: Supabase Authの一般ユーザー登録を有効化

**Files:**
- Modify: `/opt/supabase/docker/.env`（LXC114上、リポジトリ管理外）

**Interfaces:**
- Consumes: なし
- Produces: `POST /auth/v1/signup`がエラーを返さず利用可能な状態。Task 6の`AuthForm`（新規登録）がこのエンドポイントを呼ぶ前提となる

- [ ] **Step 1: 現状の設定値を確認**

Run: `ssh root@192.168.11.114 "grep -n 'DISABLE_SIGNUP\|ENABLE_EMAIL_AUTOCONFIRM' /opt/supabase/docker/.env"`
Expected: `DISABLE_SIGNUP=true` と `ENABLE_EMAIL_AUTOCONFIRM=true`

- [ ] **Step 2: `DISABLE_SIGNUP`を`false`に変更**

```bash
ssh root@192.168.11.114 "sed -i 's/^DISABLE_SIGNUP=true/DISABLE_SIGNUP=false/' /opt/supabase/docker/.env"
ssh root@192.168.11.114 "grep -n 'DISABLE_SIGNUP' /opt/supabase/docker/.env"
```

Expected: `DISABLE_SIGNUP=false`

- [ ] **Step 3: authコンテナを再起動して設定を反映**

```bash
ssh root@192.168.11.114 "cd /opt/supabase/docker && docker compose -f docker-compose.min.yml restart auth"
```

Expected: `Container supabase-auth  Started`

- [ ] **Step 4: 新規登録エンドポイントの動作確認（テストユーザーで検証後に削除）**

```bash
ssh root@192.168.11.114 "curl -s -X POST http://localhost:8000/auth/v1/signup \
  -H 'apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg1MDcyNzAyLCJleHAiOjE5NDI3NTI3MDJ9.Td8X4Gbl2mkslj0Kspaznme5RuNK8sqJawZGZrAavS8' \
  -H 'Content-Type: application/json' \
  -d '{\"email\":\"plan-verify-signup@example.com\",\"password\":\"verify-signup-12345\"}'"
```

Expected: JSONレスポンスに`\"id\"`と`\"email\":\"plan-verify-signup@example.com\"`が含まれ、`\"confirmed_at\"`が`null`でない（autoconfirm済み）

- [ ] **Step 5: 検証用テストユーザーを削除**

```bash
ssh root@192.168.11.114 "docker exec supabase-db psql -U postgres -d postgres -c \"delete from auth.users where email='plan-verify-signup@example.com';\""
```

Expected: `DELETE 1`

---

### Task 3: `@supabase/supabase-js`導入と共有クライアントの作成

**Files:**
- Modify: `package.json`（依存追加）
- Create: `src/lib/supabaseClient.js`

**Interfaces:**
- Consumes: なし
- Produces: `export const supabase`（`SupabaseClient`インスタンス）。以降の全タスク（Task 5〜12）がこれをimportして`.auth.*`・`.from(table)`を呼ぶ

- [ ] **Step 1: パッケージを追加**

```bash
cd "C:\Users\RuiRu\OneDrive\Desktop\claude-code\price-compare-app"
npm install @supabase/supabase-js
```

Expected: `package.json`の`dependencies`に`@supabase/supabase-js`が追加される

- [ ] **Step 2: 共有クライアントを作成**

```javascript
// src/lib/supabaseClient.js
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "http://192.168.11.114:8000";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg1MDcyNzAyLCJleHAiOjE5NDI3NTI3MDJ9.Td8X4Gbl2mkslj0Kspaznme5RuNK8sqJawZGZrAavS8";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

- [ ] **Step 3: 動作確認（ブラウザ実機）**

`src/main-app.jsx`は次のTaskまで変更しないため、一時的に`src/main.jsx`の末尾でコンソール確認する:

```bash
npm run dev
```

ブラウザのdevtoolsコンソールで以下を実行し、公開テーブルへの読み取りができることを確認する（RLSのanonポリシーが既にあるため成功するはず）:

```javascript
import("/src/lib/supabaseClient.js").then(async (m) => {
  const { data, error } = await m.supabase.from("stores").select("id,name").limit(1);
  console.log({ data, error });
});
```

Expected: `error`が`null`、`data`に店舗が1件入る

- [ ] **Step 4: コミット**

```bash
git add package.json package-lock.json src/lib/supabaseClient.js
git commit -m "@supabase/supabase-jsを導入し共有クライアントを追加"
```

---

### Task 4: 値下げバッジ判定ロジック（純粋関数・vitestでTDD）

**Files:**
- Modify: `package.json`（devDependencies・testスクリプト追加）
- Create: `src/lib/discount.js`
- Create: `src/lib/discount.test.js`

**Interfaces:**
- Consumes: なし
- Produces: `export function isRecentPriceDrop(historyDesc: Array<{ price: number, scrapedAt: string }>): boolean`。Task 9（ListView）がこの関数を使い商品ごとの値下げバッジ表示を判定する

- [ ] **Step 1: vitestを追加**

```bash
npm install -D vitest
```

`package.json`の`scripts`に追加:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "oxlint",
    "preview": "vite preview",
    "test": "vitest run"
  }
}
```

- [ ] **Step 2: 失敗するテストを書く**

```javascript
// src/lib/discount.test.js
import { describe, expect, it } from "vitest";
import { isRecentPriceDrop } from "./discount.js";

describe("isRecentPriceDrop", () => {
  it("直近の価格が過去30日の最安値を更新していればtrue", () => {
    const historyDesc = [
      { price: 150, scrapedAt: "2026-07-30T00:00:00Z" },
      { price: 180, scrapedAt: "2026-07-20T00:00:00Z" },
      { price: 170, scrapedAt: "2026-07-10T00:00:00Z" },
    ];
    expect(isRecentPriceDrop(historyDesc)).toBe(true);
  });

  it("直近の価格が前回と同じか値上がりしていればfalse", () => {
    const historyDesc = [
      { price: 180, scrapedAt: "2026-07-30T00:00:00Z" },
      { price: 150, scrapedAt: "2026-07-20T00:00:00Z" },
    ];
    expect(isRecentPriceDrop(historyDesc)).toBe(false);
  });

  it("直近の価格は下がったが過去30日の最安値ではない場合はfalse", () => {
    const historyDesc = [
      { price: 160, scrapedAt: "2026-07-30T00:00:00Z" },
      { price: 180, scrapedAt: "2026-07-25T00:00:00Z" },
      { price: 140, scrapedAt: "2026-07-15T00:00:00Z" },
    ];
    expect(isRecentPriceDrop(historyDesc)).toBe(false);
  });

  it("履歴が1件以下ならfalse", () => {
    expect(isRecentPriceDrop([{ price: 150, scrapedAt: "2026-07-30T00:00:00Z" }])).toBe(false);
    expect(isRecentPriceDrop([])).toBe(false);
  });
});
```

- [ ] **Step 3: テストを実行し失敗を確認**

Run: `npx vitest run src/lib/discount.test.js`
Expected: FAIL（`discount.js`が存在しない、または`isRecentPriceDrop is not a function`）

- [ ] **Step 4: 実装を書く**

```javascript
// src/lib/discount.js

/**
 * 直近30日分の価格履歴（新しい順）から、直近の価格が「値下げによる30日最安値更新」かどうかを判定する。
 * @param {Array<{ price: number, scrapedAt: string }>} historyDesc scrapedAt降順（最新が先頭）で並んだ、直近30日分の価格履歴
 * @returns {boolean}
 */
export function isRecentPriceDrop(historyDesc) {
  if (!historyDesc || historyDesc.length < 2) return false;
  const [latest, previous] = historyDesc;
  if (latest.price >= previous.price) return false;
  const minPrice = Math.min(...historyDesc.map((h) => h.price));
  return latest.price === minPrice;
}
```

- [ ] **Step 5: テストを実行し成功を確認**

Run: `npx vitest run src/lib/discount.test.js`
Expected: PASS（4件すべて）

- [ ] **Step 6: コミット**

```bash
git add package.json package-lock.json src/lib/discount.js src/lib/discount.test.js
git commit -m "値下げバッジ判定ロジック(isRecentPriceDrop)をTDDで実装"
```

---

### Task 5: `AuthContext`（セッション管理）

**Files:**
- Create: `src/lib/AuthContext.jsx`
- Modify: `src/main-app.jsx`

**Interfaces:**
- Consumes: `supabase`（Task 3の`src/lib/supabaseClient.js`）
- Produces: `export function AuthProvider({ children })`（コンポーネント）、`export function useAuth()`が返す`{ session, user, isLoggedIn, authLoading, signUp(email, password), signIn(email, password), signOut() }`。Task 6（AuthForm）・Task 8（useFavorites）・Task 13（AppShell）・Task 14（PriceCompareReal）がこれを使う

- [ ] **Step 1: AuthContextを実装**

```jsx
// src/lib/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabaseClient.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const value = {
    session,
    user: session?.user ?? null,
    isLoggedIn: !!session,
    authLoading,
    signUp: (email, password) => supabase.auth.signUp({ email, password }),
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signOut: () => supabase.auth.signOut(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
```

- [ ] **Step 2: `main-app.jsx`に組み込む**

```jsx
// src/main-app.jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { AuthProvider } from './lib/AuthContext.jsx'
import PriceCompareReal from './pages/PriceCompareReal.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <PriceCompareReal />
    </AuthProvider>
  </StrictMode>,
)
```

- [ ] **Step 3: 動作確認（ブラウザ実機）**

```bash
npm run dev
```

`PriceCompareReal`はまだ`useAuth`を呼んでいないため、コンソールエラーなくアプリが今まで通り表示されることを確認する（Reactの`StrictMode`二重実行でエラーが出ないことも確認）

- [ ] **Step 4: コミット**

```bash
git add src/lib/AuthContext.jsx src/main-app.jsx
git commit -m "Supabase Authのセッション管理AuthContextを追加"
```

---

### Task 6: `AuthForm`（ログイン・新規登録）

**Files:**
- Create: `src/components/AuthForm.jsx`

**Interfaces:**
- Consumes: `useAuth()`（Task 5）
- Produces: `export default function AuthForm({ onClose })`。Task 13（AppShell）がモーダルとして表示する

- [ ] **Step 1: 実装**

```jsx
// src/components/AuthForm.jsx
import { useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "../lib/AuthContext.jsx";

export default function AuthForm({ onClose }) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: authError } = mode === "signin" ? await signIn(email, password) : await signUp(email, password);
    setSubmitting(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        style={{ background: "#fff", borderRadius: 16, padding: 24, width: 320, position: "relative" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          style={{ position: "absolute", top: 12, right: 12, border: "none", background: "transparent", color: "#94a3b8" }}
        >
          <X size={18} />
        </button>

        <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
          {mode === "signin" ? "ログイン" : "新規登録"}
        </h2>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="メールアドレス"
            style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 12px", fontSize: 14 }}
          />
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="パスワード（8文字以上）"
            style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 12px", fontSize: 14 }}
          />
          {error && <p style={{ color: "#dc2626", fontSize: 12, margin: 0 }}>{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            style={{
              background: "#2563eb", color: "#fff", border: "none", borderRadius: 8,
              padding: "10px 12px", fontSize: 14, fontWeight: 700, opacity: submitting ? 0.6 : 1,
            }}
          >
            {mode === "signin" ? "ログイン" : "登録する"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); }}
          style={{ marginTop: 12, border: "none", background: "transparent", color: "#2563eb", fontSize: 12 }}
        >
          {mode === "signin" ? "アカウントを新規作成する" : "すでにアカウントをお持ちの方はこちら"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: ブラウザ実機で仮マウントして確認**

`src/main-app.jsx`の`AuthProvider`直下に一時的に`<AuthForm onClose={() => {}} />`を追加して`npm run dev`で表示確認する（新規登録→Task 2で有効化した`/auth/v1/signup`が呼ばれ成功すること、ログイン→既存ユーザーで成功すること、を実際に1回ずつ試す）。確認後、一時追加分は元に戻す

Expected: 新規登録が成功しモーダルが閉じる（`onClose`が呼ばれる）。誤ったパスワードでログインするとエラーメッセージが表示される

- [ ] **Step 3: コミット**

```bash
git add src/components/AuthForm.jsx
git commit -m "メール/パスワードのログイン・新規登録フォームAuthFormを追加"
```

---

### Task 7: `ProductRow`共通コンポーネント（最安値一覧の行表示）

**Files:**
- Create: `src/components/ProductRow.jsx`

**Interfaces:**
- Consumes: なし（純粋な表示コンポーネント。カテゴリスタイルは呼び出し側から渡される）
- Produces: `export default function ProductRow({ item, categoryStyle, isOpen, onToggleExpand, isInCart, onToggleCart, isFavorite, onToggleFavorite, isDiscounted, cartKeys, onToggleProductCart })` — `item`は`{ genericName, products, cheapestPrice, highestPrice }`形状（`products`各要素は`{ id, name, prices: [{storeId, storeName, price}] }`、`PriceCompareReal.jsx`の既存`genericItems`と同じ）。`cartKeys`は`Set<string>`（`"p:<productId>"`形式）、`onToggleProductCart(productId)`は展開時の個別商品「これを指定」ボタン用コールバック。Task 9（ListView）がこれを使う。**既存アプリの「行をクリックすると店舗別価格が展開され、個別商品を指定できる」機能をそのまま踏襲する**（favorite・値下げバッジは新規追加分のみ）

- [ ] **Step 1: 実装**

```jsx
// src/components/ProductRow.jsx
import { ChevronDown, ChevronRight, Star, TrendingDown } from "lucide-react";
import { productKey } from "../lib/cartKeys.js";

function yen(n) {
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

export default function ProductRow({
  item,
  categoryStyle,
  isOpen,
  onToggleExpand,
  isInCart,
  onToggleCart,
  isFavorite,
  onToggleFavorite,
  isDiscounted,
  cartKeys,
  onToggleProductCart,
}) {
  const Icon = categoryStyle.icon;

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
          {isOpen ? (
            <ChevronDown size={14} color="#94a3b8" style={{ flexShrink: 0 }} />
          ) : (
            <ChevronRight size={14} color="#94a3b8" style={{ flexShrink: 0 }} />
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
                {item.genericName}
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
              {item.products.length}商品・{item.products.length > 1 ? "複数店舗で比較可能" : "1店舗のみ"}
            </div>
          </div>
        </button>

        <div className="price-num" style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#16a34a" }}>{yen(item.cheapestPrice)}〜</div>
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

      {isOpen && (
        <div style={{ background: "#f8fafc", padding: "4px 16px 10px 34px" }}>
          {item.products.map((p) => {
            const cheapest = p.prices[0];
            const others = p.prices.slice(1);
            const productInCart = cartKeys.has(productKey(p.id));
            return (
              <div
                key={p.id}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px solid #e2e8f0" }}
              >
                <div>
                  <div style={{ fontSize: 13 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>
                    {cheapest.storeName} {yen(cheapest.price)}
                    {others.length > 0 && (
                      <span> ・ 他{others.map((o) => `${o.storeName} ${yen(o.price)}`).join("、")}</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleProductCart(p.id)}
                  style={{
                    border: "1px solid #2563eb", borderRadius: 8, padding: "3px 8px", flexShrink: 0, marginLeft: 8,
                    background: productInCart ? "#2563eb" : "#fff", color: productInCart ? "#fff" : "#2563eb", fontSize: 11,
                  }}
                >
                  {productInCart ? "指定済み" : "これを指定"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: コミット**

```bash
git add src/components/ProductRow.jsx
git commit -m "最安値一覧の行表示を共通コンポーネントProductRowに切り出し"
```

---

### Task 8: `useFavorites`フック（お気に入りのSupabase連携）

**Files:**
- Create: `src/lib/useFavorites.js`

**Interfaces:**
- Consumes: `supabase`（Task 3）
- Produces: `export function useFavorites(user)` が返す `{ favoriteIds: Set<string>, toggleFavorite(productId: string): Promise<void> }`。`user`は`useAuth().user`（`null`ならゲスト扱い、Supabaseへの永続化は行わずローカル状態のみ）。Task 9（ListView）・Task 12（FavoritesView）・Task 14（PriceCompareReal）が使う

- [ ] **Step 1: 実装**

```javascript
// src/lib/useFavorites.js
import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient.js";

export function useFavorites(user) {
  const [favoriteIds, setFavoriteIds] = useState(() => new Set());

  useEffect(() => {
    if (!user) {
      setFavoriteIds(new Set());
      return;
    }
    let cancelled = false;
    supabase
      .from("favorites")
      .select("product_id")
      .then(({ data, error }) => {
        if (cancelled || error) return;
        setFavoriteIds(new Set(data.map((row) => row.product_id)));
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const toggleFavorite = useCallback(
    async (productId) => {
      const wasFavorite = favoriteIds.has(productId);

      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (wasFavorite) next.delete(productId);
        else next.add(productId);
        return next;
      });

      // ゲストモード: ローカル状態のみで永続化しない
      if (!user) return;

      if (wasFavorite) {
        await supabase.from("favorites").delete().eq("product_id", productId);
      } else {
        await supabase.from("favorites").insert({ product_id: productId, user_id: user.id });
      }
    },
    [favoriteIds, user]
  );

  return { favoriteIds, toggleFavorite };
}
```

- [ ] **Step 2: ブラウザ実機で確認**

`npm run dev`実行中に、devtoolsコンソールで以下を実行してSupabase呼び出し部分を単体確認する（ログイン中セッションが必要。Task 6のAuthFormで事前にログインしておく）:

```javascript
import("/src/lib/supabaseClient.js").then(async (m) => {
  const { data: sessionData } = await m.supabase.auth.getSession();
  console.log("logged in:", !!sessionData.session);
  const { data, error } = await m.supabase.from("favorites").select("product_id");
  console.log({ data, error });
});
```

Expected: ログイン中なら`error`が`null`（Task 1のRLSポリシーにより本人のfavoritesのみ取得できる。0件でもエラーにならない）

- [ ] **Step 3: コミット**

```bash
git add src/lib/useFavorites.js
git commit -m "お気に入りのSupabase連携フックuseFavoritesを追加"
```

---

### Task 9: `ListView`刷新（最安値一覧）

**Files:**
- Create: `src/pages/ListView.jsx`

**Interfaces:**
- Consumes: `ProductRow`（Task 7）、`isRecentPriceDrop`（Task 4）
- Produces: `export default function ListView({ query, setQuery, sortBy, setSortBy, categories, categoryCounts, activeCategory, setActiveCategory, sectionedGenericItems, cartKeys, onToggleGeneric, onToggleProductCart, favoriteIds, onToggleFavorite, discountedProductIds })` — 既存`PriceCompareReal.jsx`内`ListView`と同じprops構造に`favoriteIds`（`Set<string>`）・`onToggleFavorite(productId)`・`discountedProductIds`（`Set<string>`、値下げ中の商品IDの集合）を追加し、旧`onToggleProduct`は`onToggleProductCart`にリネームして`ProductRow`の展開表示にそのまま橋渡しする。Task 14（PriceCompareReal）が使う

- [ ] **Step 1: 実装（既存ロジックを移設し、検索・カテゴリタブをクリーン・ミニマル配色に、行表示をProductRowに置き換え）**

```jsx
// src/pages/ListView.jsx
import { useState } from "react";
import {
  Search, Carrot, Apple, Milk, Beef, Fish, Croissant, Soup, Droplet, Egg, Package,
} from "lucide-react";
import ProductRow from "../components/ProductRow.jsx";
import { genericKey, productKey } from "../lib/cartKeys.js";

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
  sectionedGenericItems,
  cartKeys,
  onToggleGeneric,
  onToggleProductCart,
  favoriteIds,
  onToggleFavorite,
  discountedProductIds,
}) {
  const [expanded, setExpanded] = useState(() => new Set());

  const toggleExpanded = (genericName) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(genericName)) next.delete(genericName);
      else next.add(genericName);
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
            placeholder="物の名前・商品名で検索"
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

      {sectionedGenericItems.map((section) => {
        const sectionStyle = CATEGORY_STYLE[section.category] ?? DEFAULT_CATEGORY_STYLE;
        const SectionIcon = sectionStyle.icon;
        return (
          <div key={section.category} style={{ marginBottom: 16 }}>
            <p style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#64748b", margin: "0 0 6px" }}>
              <SectionIcon size={13} color={sectionStyle.color} />
              {section.category} <span style={{ fontWeight: 400, color: "#94a3b8" }}>（{section.items.length}）</span>
            </p>
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden" }}>
              {section.items.map((g) => {
                const isInCart = cartKeys.has(genericKey(g.genericName));
                const isFavorite = g.products.some((p) => favoriteIds.has(p.id));
                const isDiscounted = g.products.some((p) => discountedProductIds.has(p.id));
                return (
                  <ProductRow
                    key={g.genericName}
                    item={g}
                    categoryStyle={CATEGORY_STYLE[g.category] ?? DEFAULT_CATEGORY_STYLE}
                    isOpen={expanded.has(g.genericName)}
                    onToggleExpand={() => toggleExpanded(g.genericName)}
                    isInCart={isInCart}
                    onToggleCart={() => onToggleGeneric(g.genericName)}
                    isFavorite={isFavorite}
                    onToggleFavorite={() => onToggleFavorite(g.products[0].id)}
                    isDiscounted={isDiscounted}
                    cartKeys={cartKeys}
                    onToggleProductCart={onToggleProductCart}
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      {sectionedGenericItems.length === 0 && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
          該当する商品がありません
        </div>
      )}
    </>
  );
}
```

`genericKey`/`productKey`は既存`PriceCompareReal.jsx`内で定義されていたヘルパーだが、複数ファイルから参照するため共通モジュールに切り出す:

```javascript
// src/lib/cartKeys.js
// カート項目のキー種別: "g:<genericName>"（物の名前・最安自動選択） / "p:<productId>"（特定商品指定）
export const genericKey = (genericName) => `g:${genericName}`;
export const productKey = (id) => `p:${id}`;
```

- [ ] **Step 2: コミット**

```bash
git add src/pages/ListView.jsx src/lib/cartKeys.js
git commit -m "最安値一覧ListViewをクリーン・ミニマル配色で刷新しProductRow/値下げバッジ対応"
```

---

### Task 10: `ShoppingListCompare`刷新（旧CartView）

**Files:**
- Create: `src/pages/ShoppingListCompare.jsx`

**Interfaces:**
- Consumes: `src/lib/presets.js`（既存、変更なし）
- Produces: `export default function ShoppingListCompare({ cartEntries, cartSearch, setCartSearch, cartSearchResults, onAddGeneric, onRemoveEntry, cartStoreTotals, builtinPresets, customPresets, onApplyPresetKeys, onApplyCustomPreset, onSavePreset, onDeletePreset })` — 既存`CartView`と同じprops構造。Task 14（PriceCompareReal）が使う

- [ ] **Step 1: 実装（既存`CartView`のロジックはそのまま、配色のみ緑`#2F6B4A`系→青`#2563eb`系に置き換え）**

```jsx
// src/pages/ShoppingListCompare.jsx
import { useState } from "react";
import { Search, Bookmark, Trash2, X, Crown } from "lucide-react";

function yen(n) {
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

export default function ShoppingListCompare({
  cartEntries,
  cartSearch,
  setCartSearch,
  cartSearchResults,
  onAddGeneric,
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
            placeholder="物の名前で検索してリストに追加（例: 牛乳）"
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
            {cartSearchResults.map((g) => (
              <button
                key={g.genericName}
                type="button"
                onClick={() => onAddGeneric(g.genericName)}
                style={{
                  display: "block", width: "100%", textAlign: "left", padding: "10px 12px",
                  border: "none", background: "#fff", fontSize: 13, borderTop: "1px solid #f1f5f9",
                }}
              >
                {g.genericName}
                <span style={{ color: "#94a3b8", marginLeft: 8 }}>
                  最安 {yen(g.cheapestPrice)}（{g.cheapestProductName}）
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {cartEntries.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "32px 16px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
          上の検索欄から物の名前を追加すると、一番安い店をすぐ診断します
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
git commit -m "買い物リスト比較をShoppingListCompareとしてクリーン・ミニマル配色で切り出し"
```

---

### Task 11: `MapView`刷新（配色のみ）

**Files:**
- Create: `src/pages/MapView.jsx`

**Interfaces:**
- Consumes: なし
- Produces: `export default function MapView({ stores })` — 既存`MapView`と同一のprops・ロジック。Task 14（PriceCompareReal）が使う

- [ ] **Step 1: 実装（既存ロジックそのまま、枠線色のみ`#D9DED2`→`#e2e8f0`に置き換え）**

```jsx
// src/pages/MapView.jsx
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export default function MapView({ stores }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    const withCoords = stores.filter((s) => s.lat != null && s.lng != null);
    if (!containerRef.current || withCoords.length === 0) return;

    if (!mapRef.current) {
      mapRef.current = L.map(containerRef.current);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(mapRef.current);
    }

    const map = mapRef.current;
    const markers = withCoords.map((s) => L.marker([s.lat, s.lng]).addTo(map).bindPopup(s.name));
    const bounds = L.latLngBounds(withCoords.map((s) => [s.lat, s.lng]));
    map.fitBounds(bounds.pad(0.3));

    return () => {
      markers.forEach((m) => map.removeLayer(m));
    };
  }, [stores]);

  const withCoords = stores.filter((s) => s.lat != null && s.lng != null);

  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden" }}>
      {withCoords.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
          座標データのある店舗がありません
        </div>
      ) : (
        <div ref={containerRef} style={{ height: 420, width: "100%" }} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: コミット**

```bash
git add src/pages/MapView.jsx
git commit -m "地図ビューをMapViewとして切り出しクリーン・ミニマル配色に統一"
```

---

### Task 12: `FavoritesView`（お気に入り一覧・新規）

**Files:**
- Create: `src/pages/FavoritesView.jsx`

**Interfaces:**
- Consumes: なし
- Produces: `export default function FavoritesView({ products, favoriteIds, isLoggedIn, onOpenAuth, onToggleFavorite, onAddProductToCart, cartKeys })` — `products`は`PriceCompareReal.jsx`の既存`products`配列（`{ id, name, category, prices: [{storeId, storeName, price}] }`）。Task 14が使う

- [ ] **Step 1: 実装**

```jsx
// src/pages/FavoritesView.jsx
import { Star, LogIn } from "lucide-react";
import { productKey } from "../lib/cartKeys.js";

function yen(n) {
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

export default function FavoritesView({ products, favoriteIds, isLoggedIn, onOpenAuth, onToggleFavorite, onAddProductToCart, cartKeys }) {
  if (!isLoggedIn) {
    return (
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "32px 16px", textAlign: "center" }}>
        <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 12px" }}>
          お気に入りはログインすると保存され、次回訪問時も見られます
        </p>
        <button
          type="button"
          onClick={onOpenAuth}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6, border: "none", borderRadius: 999,
            padding: "10px 18px", background: "#2563eb", color: "#fff", fontSize: 13, fontWeight: 700,
          }}
        >
          <LogIn size={14} /> ログイン・新規登録
        </button>
      </div>
    );
  }

  const favoriteProducts = products.filter((p) => favoriteIds.has(p.id));

  if (favoriteProducts.length === 0) {
    return (
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "32px 16px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
        最安値一覧の☆マークからお気に入りを登録してください
      </div>
    );
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden" }}>
      {favoriteProducts.map((p, i) => {
        const cheapest = p.prices[0];
        const isInCart = cartKeys.has(productKey(p.id));
        return (
          <div
            key={p.id}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "12px 16px",
              borderTop: i === 0 ? "none" : "1px solid #f1f5f9",
            }}
          >
            <button
              type="button"
              onClick={() => onToggleFavorite(p.id)}
              aria-label="お気に入り解除"
              style={{ border: "none", background: "transparent", padding: 0, flexShrink: 0 }}
            >
              <Star size={16} color="#f59e0b" fill="#f59e0b" />
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>{cheapest.storeName} {yen(cheapest.price)}</div>
            </div>
            <button
              type="button"
              onClick={() => onAddProductToCart(p.id)}
              style={{
                border: "1px solid #2563eb", borderRadius: 8, padding: "4px 8px", flexShrink: 0,
                background: isInCart ? "#2563eb" : "#fff", color: isInCart ? "#fff" : "#2563eb", fontSize: 11,
              }}
            >
              {isInCart ? "追加済み" : "追加"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: コミット**

```bash
git add src/pages/FavoritesView.jsx
git commit -m "お気に入り一覧FavoritesViewを新規実装（未ログイン時はログイン導線を表示）"
```

---

### Task 13: `AppShell`（レスポンシブナビゲーション）

**Files:**
- Create: `src/components/AppShell.jsx`

**Interfaces:**
- Consumes: `useAuth()`（Task 5）、`AuthForm`（Task 6）
- Produces: `export default function AppShell({ view, setView, children })` — `view`は`"cart" | "list" | "map" | "favorites"`。Task 14（PriceCompareReal）がこれで各ビューをラップする

- [ ] **Step 1: 実装**

```jsx
// src/components/AppShell.jsx
import { useState } from "react";
import { ShoppingCart, List, MapPin, Star, LogIn, LogOut } from "lucide-react";
import { useAuth } from "../lib/AuthContext.jsx";
import AuthForm from "./AuthForm.jsx";

const NAV_ITEMS = [
  { id: "list", label: "最安値", icon: List },
  { id: "cart", label: "比較", icon: ShoppingCart },
  { id: "map", label: "地図", icon: MapPin },
  { id: "favorites", label: "お気に入り", icon: Star },
];

export default function AppShell({ view, setView, children }) {
  const { isLoggedIn, signOut } = useAuth();
  const [showAuthForm, setShowAuthForm] = useState(false);

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <style>{`
        .app-sidebar { display: none; }
        .app-bottomnav { display: flex; }
        @media (min-width: 768px) {
          .app-sidebar { display: flex; }
          .app-bottomnav { display: none; }
        }
      `}</style>

      <nav
        className="app-sidebar"
        style={{
          flexDirection: "column", width: 88, borderRight: "1px solid #e2e8f0",
          background: "#fff", padding: "20px 8px", gap: 4, flexShrink: 0,
        }}
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = view === item.id;
          return (
            <button
              key={item.id}
              type="button"
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
          );
        })}
        <div style={{ marginTop: "auto" }}>
          {isLoggedIn ? (
            <button
              type="button"
              onClick={signOut}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "10px 4px", border: "none", background: "transparent", color: "#64748b", fontSize: 10, width: "100%" }}
            >
              <LogOut size={18} />
              ログアウト
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowAuthForm(true)}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "10px 4px", border: "none", background: "transparent", color: "#64748b", fontSize: 10, width: "100%" }}
            >
              <LogIn size={18} />
              ログイン
            </button>
          )}
        </div>
      </nav>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ flex: 1, maxWidth: 760, width: "100%", margin: "0 auto", padding: "20px 16px 80px" }}>
          {children}
        </div>

        <nav
          className="app-bottomnav"
          style={{
            position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff",
            borderTop: "1px solid #e2e8f0", padding: "6px 4px",
          }}
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                style={{
                  flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "6px 4px",
                  border: "none", background: "transparent", color: active ? "#2563eb" : "#94a3b8", fontSize: 10,
                }}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => (isLoggedIn ? signOut() : setShowAuthForm(true))}
            style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "6px 4px",
              border: "none", background: "transparent", color: "#94a3b8", fontSize: 10,
            }}
          >
            {isLoggedIn ? <LogOut size={18} /> : <LogIn size={18} />}
            {isLoggedIn ? "ログアウト" : "ログイン"}
          </button>
        </nav>
      </div>

      {showAuthForm && <AuthForm onClose={() => setShowAuthForm(false)} />}
    </div>
  );
}
```

- [ ] **Step 2: コミット**

```bash
git add src/components/AppShell.jsx
git commit -m "レスポンシブナビゲーションAppShell（スマホ下部ナビ/PCサイドバー）を追加"
```

---

### Task 14: `PriceCompareReal.jsx`の全面書き直し（統合）

**Files:**
- Modify: `src/pages/PriceCompareReal.jsx`（全面書き換え）

**Interfaces:**
- Consumes: `AppShell`（Task 13）、`ListView`（Task 9）、`ShoppingListCompare`（Task 10）、`MapView`（Task 11）、`FavoritesView`（Task 12）、`useAuth`（Task 5）、`useFavorites`（Task 8）、`isRecentPriceDrop`（Task 4）、`genericKey`/`productKey`（Task 9で作成した`src/lib/cartKeys.js`）、`supabase`（Task 3）
- Produces: `export default function PriceCompareReal()` — `main-app.jsx`から呼ばれる最上位コンポーネント（既存と同じデフォルトエクスポート、propsなし）

- [ ] **Step 1: 実装**

既存のデータ取得・集計ロジック（`products`・`genericItems`・`cartEntries`等の算出）はそのまま踏襲しつつ、(a) 直近30日分の`price_history`も取得して値下げ判定に使う、(b) `AppShell`でラップする、(c) `favoriteIds`/`toggleFavorite`を`useFavorites`から取得して各ビューに配る、という3点を追加する。

```jsx
// src/pages/PriceCompareReal.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { useAuth } from "../lib/AuthContext.jsx";
import { useFavorites } from "../lib/useFavorites.js";
import { isRecentPriceDrop } from "../lib/discount.js";
import { genericKey, productKey } from "../lib/cartKeys.js";
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

  useEffect(() => {
    (async () => {
      try {
        const sinceIso = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();

        const [{ data: storesData, error: storesError }, { data: productsData, error: productsError }, { data: priceHistoryData, error: priceHistoryError }] =
          await Promise.all([
            supabase.from("stores").select("id,name,lat,lng").eq("is_active", true),
            supabase.from("products").select("id,name,jan_code,category,generic_name"),
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
            genericName: p.generic_name || p.name,
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

  const genericItems = useMemo(() => {
    const groups = new Map();
    for (const p of products) {
      if (!groups.has(p.genericName)) groups.set(p.genericName, []);
      groups.get(p.genericName).push(p);
    }
    return [...groups.entries()].map(([genericName, items]) => {
      const sortedItems = [...items].sort((a, b) => a.prices[0].price - b.prices[0].price);
      const cheapestProduct = sortedItems[0];
      const allPrices = items.flatMap((p) => p.prices.map((pr) => pr.price));
      return {
        genericName,
        category: cheapestProduct.category,
        products: sortedItems,
        cheapestPrice: cheapestProduct.prices[0].price,
        highestPrice: Math.max(...allPrices),
        cheapestStoreName: cheapestProduct.prices[0].storeName,
        cheapestProductName: cheapestProduct.name,
      };
    });
  }, [products]);

  const genericItemByName = useMemo(() => new Map(genericItems.map((g) => [g.genericName, g])), [genericItems]);

  const categoryCounts = useMemo(() => {
    const counts = new Map();
    for (const g of genericItems) counts.set(g.category, (counts.get(g.category) ?? 0) + 1);
    return counts;
  }, [genericItems]);

  const filteredGenericItems = useMemo(() => {
    let list = genericItems.filter(
      (g) =>
        (g.genericName.includes(query) || g.products.some((p) => p.name.includes(query))) &&
        (activeCategory === null || g.category === activeCategory)
    );
    list = [...list].sort((a, b) => {
      if (sortBy === "priceAsc") return a.cheapestPrice - b.cheapestPrice;
      if (sortBy === "priceDesc") return b.cheapestPrice - a.cheapestPrice;
      if (sortBy === "name") return a.genericName.localeCompare(b.genericName, "ja");
      return 0;
    });
    return list;
  }, [genericItems, query, activeCategory, sortBy]);

  const sectionedGenericItems = useMemo(() => {
    const groups = new Map();
    for (const g of filteredGenericItems) {
      if (!groups.has(g.category)) groups.set(g.category, []);
      groups.get(g.category).push(g);
    }
    return categories.filter((c) => groups.has(c)).map((c) => ({ category: c, items: groups.get(c) }));
  }, [filteredGenericItems, categories]);

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
        if (key.startsWith("g:")) {
          const genericName = key.slice(2);
          const group = genericItemByName.get(genericName);
          if (!group) return null;
          return {
            key,
            label: `${genericName}（最安: ${group.cheapestProductName}）`,
            priceAtStore: (storeId) => {
              const prices = group.products
                .map((p) => p.prices.find((pr) => pr.storeId === storeId))
                .filter(Boolean);
              if (prices.length === 0) return null;
              return Math.min(...prices.map((pr) => pr.price));
            },
            representativePrice: group.cheapestPrice,
          };
        }
        if (key.startsWith("p:")) {
          const id = key.slice(2);
          const product = productById.get(id);
          if (!product) return null;
          return {
            key,
            label: product.name,
            priceAtStore: (storeId) => product.prices.find((pr) => pr.storeId === storeId)?.price ?? null,
            representativePrice: product.prices[0].price,
          };
        }
        return null;
      })
      .filter(Boolean);
  }, [cart, genericItemByName, productById]);

  const builtinPresets = useMemo(() => {
    return BUILTIN_PRESETS.map((preset) => {
      const matched = preset.keywords
        .map((kw) => genericItems.find((g) => g.genericName.includes(kw)) || products.find((p) => p.name.includes(kw)))
        .filter(Boolean);
      return {
        ...preset,
        keys: matched.map((m) => (m.genericName !== undefined && m.products ? genericKey(m.genericName) : productKey(m.id))),
      };
    }).filter((preset) => preset.keys.length > 0);
  }, [genericItems, products]);

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
      .map((entry) => {
        if (entry.key.startsWith("p:")) return productById.get(entry.key.slice(2))?.janCode;
        const genericName = entry.key.slice(2);
        return genericItemByName.get(genericName)?.products[0]?.janCode;
      })
      .filter(Boolean);
    setCustomPresets(saveCustomPreset(name, janCodes));
  };

  const handleDeleteCustomPreset = (id) => {
    setCustomPresets(deleteCustomPreset(id));
  };

  const cartKeys = useMemo(() => new Set(cartEntries.map((e) => e.key)), [cartEntries]);

  const cartSearchResults = useMemo(() => {
    if (!cartSearch.trim()) return [];
    return genericItems
      .filter((g) => g.genericName.includes(cartSearch) && !cartKeys.has(genericKey(g.genericName)))
      .slice(0, 8);
  }, [genericItems, cartSearch, cartKeys]);

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
    <AppShell view={view} setView={setView}>
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
          sectionedGenericItems={sectionedGenericItems}
          cartKeys={cartKeys}
          onToggleGeneric={(genericName) => toggleCartKey(genericKey(genericName))}
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
          onAddGeneric={(genericName) => {
            toggleCartKey(genericKey(genericName));
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
          onOpenAuth={() => setView("favorites")}
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
- 最安値一覧: 商品行の☆をクリックしてお気に入りトグルできる（ログイン前はページリロードで消える＝ゲスト非永続の確認）
- Task 6のAuthFormでログイン後、☆を押すとリロードしても保持される（`favorites`テーブルへの実際の永続化確認）
- 買い物リスト比較・地図ビューが今まで通り動作する
- お気に入りタブ: 未ログイン時はログイン導線、ログイン後は☆登録した商品が一覧表示される
- ブラウザ幅を768px未満に狭めると下部ナビに、768px以上でサイドバーに切り替わる

- [ ] **Step 3: コミット**

```bash
git add src/pages/PriceCompareReal.jsx
git commit -m "PriceCompareRealを分割済みコンポーネント構成に統合し値下げバッジ・お気に入り連携を配線"
```

---

### Task 15: `LandingPage.jsx`の全面書き直し

**Files:**
- Modify: `src/pages/LandingPage.jsx`（全面書き換え）

**Interfaces:**
- Consumes: なし
- Produces: `export default function LandingPage()` — `main.jsx`から呼ばれる（既存と同じデフォルトエクスポート、propsなし）

- [ ] **Step 1: 実装（クリーン・ミニマル配色、ダミーデータ表記を削除し実データの数値に置き換え、お気に入り・値下げバッジの訴求を追加）**

```jsx
// src/pages/LandingPage.jsx
import {
  MapPin, List, Star, TrendingDown, ShoppingCart, Store, ArrowRight, Check, Clock,
} from "lucide-react";

const FEATURES = [
  {
    icon: MapPin,
    title: "地図で、近くの店がひと目でわかる",
    body: "店舗のピンをタップするだけで、その店の価格一覧がすぐ開きます。",
  },
  {
    icon: List,
    title: "カテゴリ別の最安値一覧",
    body: "野菜・精肉・日用品など、カテゴリを絞り込んで最安値だけをサッと確認できます。",
  },
  {
    icon: Star,
    title: "お気に入り登録でいつでもチェック",
    body: "気になる商品を☆登録しておくと、お気に入りタブからすぐ価格を確認できます（ログインすると次回以降も保持されます）。",
  },
  {
    icon: TrendingDown,
    title: "値下げ中の商品がひと目でわかる",
    body: "直近30日で最安値を更新した商品には「値下げ」バッジが付きます。",
  },
  {
    icon: ShoppingCart,
    title: "買い物リストごと、一番安い店を診断",
    body: "リストに商品を入れるだけで、まとめ買いに一番向いている店舗を教えてくれます。",
  },
];

const ROADMAP = [
  { done: true, label: "地図ビュー・最安値一覧・カテゴリ絞り込み" },
  { done: true, label: "お気に入り登録・値下げバッジ・買い物リスト診断" },
  { done: false, label: "単価（¥/100g等）表示" },
  { done: false, label: "対応エリア・対応店舗の拡大" },
];

export default function LandingPage() {
  return (
    <div style={{ fontFamily: "'Zen Kaku Gothic New', 'Hiragino Sans', sans-serif", background: "#f8fafc", color: "#0f172a", minHeight: "100%" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700;900&family=JetBrains+Mono:wght@400;600;700&display=swap');
        * { box-sizing: border-box; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        .cta:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(37,99,235,0.28); }
        .cta { transition: all 0.15s ease; }
        .feat-card:hover { border-color: #2563eb; transform: translateY(-2px); }
        .feat-card { transition: all 0.15s ease; }
      `}</style>

      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "18px 24px 0" }}>
        <div style={{ width: 26, height: 26, borderRadius: 8, background: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Store size={15} color="#fff" strokeWidth={2.4} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700 }}>近くのスーパー、最安値くらべ</span>
      </div>

      <div style={{ padding: "28px 24px 8px" }}>
        <h1 style={{ fontSize: 30, fontWeight: 900, lineHeight: 1.3, margin: "0 0 14px", letterSpacing: "-0.01em" }}>
          同じ牛乳が、<br />
          店によって<span style={{ color: "#dc2626" }}>値段が違う</span>。
        </h1>
        <p style={{ fontSize: 14, lineHeight: 1.8, color: "#475569", margin: "0 0 22px" }}>
          近くのスーパーの価格を自動で集めて比べる、実データ稼働中の節約ツールです。
          <br />
          どの店が安いか迷う時間を、なくします。
        </p>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <a
            href="/app.html"
            className="cta"
            style={{
              display: "flex", alignItems: "center", gap: 6, background: "#2563eb", color: "#fff",
              border: "none", borderRadius: 999, padding: "13px 22px", fontSize: 13.5, fontWeight: 700,
              boxShadow: "0 4px 12px rgba(37,99,235,0.24)", textDecoration: "none",
            }}
          >
            アプリを使ってみる
            <ArrowRight size={15} />
          </a>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 0, margin: "26px 24px 0", background: "#0f172a", borderRadius: 16, overflow: "hidden" }}>
        {[
          { value: "3", unit: "店舗", label: "比較対象" },
          { value: "3,300", unit: "件超", label: "登録商品" },
        ].map((s, i) => (
          <div key={s.label} style={{ flex: 1, textAlign: "center", padding: "16px 8px", borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.1)" : "none" }}>
            <div className="mono" style={{ color: "#f8fafc", fontSize: 19, fontWeight: 700 }}>
              {s.value}<span style={{ fontSize: 12, opacity: 0.7 }}>{s.unit}</span>
            </div>
            <div style={{ color: "#93c5fd", fontSize: 10, marginTop: 2, fontWeight: 700 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: "34px 24px 8px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.06em", marginBottom: 4 }}>できること</div>
        <h2 style={{ fontSize: 19, fontWeight: 900, margin: "0 0 18px" }}>「今、一番安い店」がすぐわかる</h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="feat-card" style={{ display: "flex", gap: 12, alignItems: "flex-start", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "14px 16px" }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={16} color="#2563eb" strokeWidth={2.2} />
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 3 }}>{f.title}</div>
                  <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>{f.body}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ padding: "30px 24px 8px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.06em", marginBottom: 4 }}>今の状況</div>
        <h2 style={{ fontSize: 19, fontWeight: 900, margin: "0 0 4px" }}>実データで動いている個人開発アプリです</h2>
        <p style={{ fontSize: 12.5, color: "#64748b", margin: "0 0 16px", lineHeight: 1.7 }}>
          個人の節約用に開発中で、実店舗の価格を毎日自動収集しています。手応えがあれば、対応エリアの拡大も検討しています。
        </p>

        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden" }}>
          {ROADMAP.map((r, i) => (
            <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderTop: i === 0 ? "none" : "1px solid #f1f5f9" }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: r.done ? "#2563eb" : "#f1f5f9" }}>
                {r.done ? <Check size={12} color="#fff" strokeWidth={3} /> : <Clock size={11} color="#94a3b8" />}
              </div>
              <span style={{ fontSize: 12.5, color: r.done ? "#0f172a" : "#94a3b8", fontWeight: r.done ? 600 : 400 }}>{r.label}</span>
              <span style={{ marginLeft: "auto", fontSize: 9.5, fontWeight: 700, color: r.done ? "#2563eb" : "#94a3b8" }}>
                {r.done ? "稼働中" : "未着手"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "30px 24px 36px" }}>
        <div style={{ background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)", borderRadius: 18, padding: "26px 22px", textAlign: "center", color: "#f8fafc" }}>
          <h2 style={{ fontSize: 18, fontWeight: 900, margin: "0 0 8px" }}>近くのスーパー、最安値くらべ</h2>
          <p style={{ fontSize: 12, opacity: 0.65, margin: "0 0 18px", lineHeight: 1.7 }}>
            まずは触ってみて、良かったところ・使いにくかったところを教えてください。
          </p>
          <a
            href="/app.html"
            className="cta"
            style={{
              background: "#2563eb", color: "#fff", border: "none", borderRadius: 999, padding: "12px 24px",
              fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none",
            }}
          >
            アプリを使う
            <ArrowRight size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: ブラウザ実機で確認**

```bash
npm run dev
```

`http://localhost:5173/index.html`を開き、表示崩れがないこと・「アプリを使ってみる」ボタンが`/app.html`に遷移することを確認する

- [ ] **Step 3: コミット**

```bash
git add src/pages/LandingPage.jsx
git commit -m "LPをクリーン・ミニマル配色に刷新し実データの数値・新機能訴求に更新"
```

---

### Task 16: LXC114への反映・実機確認

**Files:**
- なし（デプロイ作業のみ）

**Interfaces:**
- Consumes: 全タスクの成果物
- Produces: `http://192.168.11.114/`・`http://192.168.11.114/app.html`がLAN内から刷新後の内容で閲覧できる状態

- [ ] **Step 1: 本番ビルド**

```bash
cd "C:\Users\RuiRu\OneDrive\Desktop\claude-code\price-compare-app"
npm run build
```

Expected: `dist/`に`index.html`・`app.html`・`assets/`一式が生成される。エラーなし

- [ ] **Step 2: LXC114にデプロイ**

```bash
scp -r dist/* root@192.168.11.114:/var/www/price-compare-app/
```

Expected: 転送完了、エラーなし

- [ ] **Step 3: LAN内から実機確認**

ブラウザで以下を開き、Task 14・15で確認した内容（レスポンシブナビ・お気に入り・値下げバッジ・LP刷新）が本番相当の環境でも同様に動作することを確認する:
- `http://192.168.11.114/`（LP）
- `http://192.168.11.114/app.html`（アプリ本体）

- [ ] **Step 4: `.secretary`側のタスク・プロジェクト記録を更新**

`.secretary/projects/price-compare-app/project.md`の「タスク」に以下を追記する（Add-Contentではなくファイル全体編集のため直接編集）:
- 完了: フロントエンド全面刷新（お気に入り・値下げバッジ追加）
- 新規タスク: Googleログイン追加（Z側のOAuthクライアント作成待ち）
- 新規タスク: 単価表示（¥/100g等）の実装（今回見送り分）

`.secretary/todos/`の当日ファイルにある「price-compare-app: フロントエンドを...全面刷新する」タスクを完了として`## 完了`セクションに移動する
