# ワンタイムパスコード管理画面 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** app.htmlのパスコードをSupabase DBに保存する方式に変更し、localhost限定の管理画面(admin.html)から即時変更できるようにする。

**Architecture:** 新規`app_settings`テーブル（単一行）にパスコードを保存し、`PasscodeGate.jsx`は起動時にanonキーでこの値を取得して照合する。管理画面(`admin.html`)は別のViteエントリーポイントとしてビルドし、service role keyを埋め込んだ専用クライアント(`supabaseAdminClient.js`)でDBを直接更新する。管理画面のJSバンドル・HTMLはnginxで`127.0.0.1`限定にし、外部から一切アクセス・ダウンロードできないようにする。

**Tech Stack:** React 19 + Vite（マルチページ構成）、Supabase（PostgreSQL + PostgREST）、vitest + jsdom

## Global Constraints
- `app_settings`テーブルは`anon`/`authenticated`にSELECTのみ許可し、UPDATE/INSERT/DELETEポリシーは作成しない（書き込みはservice role keyでRLSをバイパスする専用クライアントのみ）
- 初期パスコード値は現行の`TOKUCHIKA2026`を投入し、既存の招待者フローを壊さない
- service role keyは**gitにコミットしない**。spec.mdは「埋め込む」とだけ書いているが、既存コードにservice role keyを直接ハードコードして保存するとgit履歴に平文で残ってしまうため、`.env.local`（Viteの標準機構、`.gitignore`の`*.local`パターンで既にignore対象）経由で読み込む方式にする。これはspecの意図（管理用バンドルにのみ埋め込み、公開バンドルには含めない）を壊さない、より安全な実装手段であり、controller自身が秘密値の取り扱いを行う
- `checkPasscode`の比較には`.normalize("NFKC")`を追加し、全角文字入力にも対応する
- パスコード取得に失敗した場合はフェイルクローズ（エラー表示のみ、ゲートを突破させない）
- nginxの`/etc/nginx/sites-enabled/price-compare-app`はgit管理外（サーバー上でのみ変更、変更内容は`.secretary/debugging/`等に記録する運用を踏襲）
- デプロイは既存パターンを踏襲: `cd price-compare-app && npm run build && scp -r dist/* root@192.168.11.114:/var/www/price-compare-app/`

---

### Task 1: `app_settings`テーブルのマイグレーション

**Files:**
- Create: `supabase/migrations/2026-08-01-add-app-settings-passcode.sql`

**Interfaces:**
- Consumes: なし
- Produces: `app_settings`テーブル（`id`固定値1、`passcode` text、`updated_at` timestamptz）。以降のタスクはこのテーブル名・カラム名を前提にする

- [ ] **Step 1: マイグレーションSQLを作成する**

`supabase/migrations/2026-08-01-add-app-settings-passcode.sql`を新規作成する:

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

- [ ] **Step 2: 本番DB(LXC114)に適用する**

既存パターン（`docs/superpowers/plans/2026-07-30-frontend-rebuild.md`等）に倣い、scpでファイルを転送してdocker exec経由でpsqlに流し込む:

Run:
```bash
scp "supabase/migrations/2026-08-01-add-app-settings-passcode.sql" root@192.168.11.114:/tmp/add-app-settings-passcode.sql
ssh root@192.168.11.114 "docker exec -i supabase-db psql -U postgres -d postgres < /tmp/add-app-settings-passcode.sql"
ssh root@192.168.11.114 "rm /tmp/add-app-settings-passcode.sql"
```
Expected: `CREATE TABLE`・`INSERT 0 1`・`ALTER TABLE`・`CREATE POLICY`がエラーなく出力される

- [ ] **Step 3: テーブル・ポリシー・データを確認する**

Run: `ssh root@192.168.11.114 "docker exec supabase-db psql -U postgres -d postgres -c 'select * from app_settings;'"`
Expected: `id=1, passcode=TOKUCHIKA2026`の1行が返る

Run: `ssh root@192.168.11.114 "docker exec supabase-db psql -U postgres -d postgres -c \"select policyname, roles from pg_policies where tablename='app_settings';\""`
Expected: `app_settings_anon_select`ポリシーが`{anon,authenticated}`ロールに対して存在する

- [ ] **Step 4: anonキー経由でSELECTできることを確認する（書き込みはできないことも確認）**

Run:
```bash
curl -s "https://tokuchika.gozakura.com/api/rest/v1/app_settings?select=passcode" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg1MDcyNzAyLCJleHAiOjE5NDI3NTI3MDJ9.Td8X4Gbl2mkslj0Kspaznme5RuNK8sqJawZGZrAavS8"
```
Expected: `[{"passcode":"TOKUCHIKA2026"}]`が返る（`src/lib/supabaseClient.js`の既存anonキーをそのまま使う）

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/2026-08-01-add-app-settings-passcode.sql
git commit -m "feat: app_settingsテーブルを追加しパスコードをDB管理に移行"
```

---

### Task 2: `passcode.js`をDB取得方式に変更

**Files:**
- Modify: `src/lib/passcode.js`
- Modify: `src/lib/passcode.test.js`

**Interfaces:**
- Consumes: `supabase`（`src/lib/supabaseClient.js`のexport、既存）、Task 1の`app_settings`テーブル
- Produces:
  - `export async function fetchCurrentPasscode(): Promise<string>`（`app_settings`テーブルの`passcode`列を返す。取得失敗時は例外を投げる）
  - `export function checkPasscode(input: string, currentPasscode: string): boolean`（**シグネチャ変更**: 第2引数が必須になる）
  - `export function isPasscodeUnlocked(): boolean`（変更なし）
  - `export function unlockPasscode(): void`（変更なし）
  - `PASSCODE`定数は削除する

- [ ] **Step 1: Write the failing test**

`src/lib/passcode.test.js`を以下の内容に置き換える（既存の`isPasscodeUnlocked`/`unlockPasscode`のテストはそのまま維持し、`checkPasscode`関連を新シグネチャに書き換え、`fetchCurrentPasscode`のテストを追加する）:

```javascript
// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from "vitest";
import { isPasscodeUnlocked, unlockPasscode, checkPasscode, fetchCurrentPasscode } from "./passcode.js";
import { supabase } from "./supabaseClient.js";

vi.mock("./supabaseClient.js", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe("checkPasscode", () => {
  it("正しいコードならtrueを返す", () => {
    expect(checkPasscode("TOKUCHIKA2026", "TOKUCHIKA2026")).toBe(true);
  });

  it("大文字小文字が違ってもtrueを返す", () => {
    expect(checkPasscode("tokuchika2026", "TOKUCHIKA2026")).toBe(true);
  });

  it("前後に空白があってもtrueを返す", () => {
    expect(checkPasscode("  TOKUCHIKA2026  ", "TOKUCHIKA2026")).toBe(true);
  });

  it("全角文字で入力されてもtrueを返す（NFKC正規化）", () => {
    expect(checkPasscode("ＴＯＫＵＣＨＩＫＡ２０２６", "TOKUCHIKA2026")).toBe(true);
  });

  it("間違ったコードならfalseを返す", () => {
    expect(checkPasscode("wrong-code", "TOKUCHIKA2026")).toBe(false);
  });

  it("空文字ならfalseを返す", () => {
    expect(checkPasscode("", "TOKUCHIKA2026")).toBe(false);
  });

  it("文字列以外が渡されてもfalseを返す（例外を投げない）", () => {
    expect(checkPasscode(undefined, "TOKUCHIKA2026")).toBe(false);
    expect(checkPasscode(null, "TOKUCHIKA2026")).toBe(false);
  });

  it("currentPasscodeがundefinedならfalseを返す（DB取得前の誤照合を防ぐ）", () => {
    expect(checkPasscode("TOKUCHIKA2026", undefined)).toBe(false);
  });
});

describe("fetchCurrentPasscode", () => {
  it("app_settingsのpasscode列を返す", async () => {
    const single = vi.fn().mockResolvedValue({ data: { passcode: "ABC123" }, error: null });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    supabase.from.mockReturnValue({ select });

    const result = await fetchCurrentPasscode();

    expect(supabase.from).toHaveBeenCalledWith("app_settings");
    expect(select).toHaveBeenCalledWith("passcode");
    expect(eq).toHaveBeenCalledWith("id", 1);
    expect(result).toBe("ABC123");
  });

  it("Supabaseがエラーを返したら例外を投げる", async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: new Error("network error") });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    supabase.from.mockReturnValue({ select });

    await expect(fetchCurrentPasscode()).rejects.toThrow("network error");
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

  it("localStorageアクセスが例外を投げる環境ではfalseを返す（fail-openしない）", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("localStorage is not available");
    });
    try {
      expect(isPasscodeUnlocked()).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/passcode.test.js`
Expected: FAIL（`fetchCurrentPasscode`が存在しない、`checkPasscode`のシグネチャ不一致等）

- [ ] **Step 3: Write minimal implementation**

`src/lib/passcode.js`を以下の内容に置き換える:

```javascript
import { supabase } from "./supabaseClient.js";

const PASSCODE_STORAGE_KEY = "priceCompareApp.passcodeUnlocked";

export function isPasscodeUnlocked() {
  try {
    return localStorage.getItem(PASSCODE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function unlockPasscode() {
  try {
    localStorage.setItem(PASSCODE_STORAGE_KEY, "true");
  } catch {
    // localStorageが使えない環境では何もしない
  }
}

export async function fetchCurrentPasscode() {
  const { data, error } = await supabase
    .from("app_settings")
    .select("passcode")
    .eq("id", 1)
    .single();

  if (error) throw error;
  return data.passcode;
}

export function checkPasscode(input, currentPasscode) {
  if (typeof input !== "string" || typeof currentPasscode !== "string") return false;
  return input.trim().normalize("NFKC").toLowerCase() === currentPasscode.trim().normalize("NFKC").toLowerCase();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/passcode.test.js`
Expected: PASS（全件）

- [ ] **Step 5: Commit**

```bash
git add src/lib/passcode.js src/lib/passcode.test.js
git commit -m "feat: パスコードをDBから取得する方式に変更しNFKC正規化を追加"
```

---

### Task 3: `PasscodeGate.jsx`にローディング/エラー状態を追加

**Files:**
- Modify: `src/components/PasscodeGate.jsx`

**Interfaces:**
- Consumes: `checkPasscode`, `unlockPasscode`, `fetchCurrentPasscode` from `src/lib/passcode.js`（Task 2）
- Produces: `export default function PasscodeGate({ onUnlock }: { onUnlock: () => void })`（propsのシグネチャは変更なし）

- [ ] **Step 1: `PasscodeGate.jsx`を書き換える**

`src/components/PasscodeGate.jsx`を以下の内容に置き換える（既存の配色・スタイルパターンを踏襲し、`useEffect`でマウント時に`fetchCurrentPasscode()`を呼ぶ）:

```jsx
import { useEffect, useState } from "react";
import { Lock, AlertCircle } from "lucide-react";
import { checkPasscode, unlockPasscode, fetchCurrentPasscode } from "../lib/passcode.js";

export default function PasscodeGate({ onUnlock }) {
  const [value, setValue] = useState("");
  const [showError, setShowError] = useState(false);
  const [currentPasscode, setCurrentPasscode] = useState(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchCurrentPasscode()
      .then((passcode) => {
        if (!cancelled) setCurrentPasscode(passcode);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (checkPasscode(value, currentPasscode)) {
      unlockPasscode();
      onUnlock();
    } else {
      setShowError(true);
    }
  };

  const cardStyle = {
    background: "#fff", borderRadius: 16, padding: 28, width: "100%", maxWidth: 340,
    display: "flex", flexDirection: "column", gap: 14, alignItems: "center",
  };
  const wrapperStyle = {
    position: "fixed", inset: 0, background: "#0f172a",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: 16, zIndex: 3000,
  };

  if (loadError) {
    return (
      <div style={wrapperStyle}>
        <div style={cardStyle}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <AlertCircle size={20} color="#dc2626" strokeWidth={2.2} />
          </div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a", textAlign: "center" }}>
            読み込みに失敗しました
          </h2>
          <p style={{ margin: 0, fontSize: 12.5, color: "#64748b", textAlign: "center", lineHeight: 1.6 }}>
            通信状況をご確認のうえ、再読み込みしてください。
          </p>
        </div>
      </div>
    );
  }

  if (currentPasscode === null) {
    return (
      <div style={wrapperStyle}>
        <div style={cardStyle}>
          <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={wrapperStyle}>
      <form onSubmit={handleSubmit} style={cardStyle}>
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

- [ ] **Step 2: 既存テストへの影響を確認する**

`PasscodeGate.jsx`は既存プロジェクトの他コンポーネント（`OnboardingTour.jsx`等）と同様に自動テスト対象外。`PriceCompareReal.jsx`は`PasscodeGate`を`{ onUnlock }`propsのみで呼び出しており、今回のシグネチャ変更はpropsに影響しないため`PriceCompareReal.jsx`の変更は不要。

Run: `npx vitest run`
Expected: 既存の全テストが変わらずPASSする（`passcode.test.js`はTask 2で更新済み）

- [ ] **Step 3: Commit**

```bash
git add src/components/PasscodeGate.jsx
git commit -m "feat: PasscodeGateにDB取得のローディング/エラー状態を追加"
```

---

### Task 4: 管理画面（admin.html）の新設

**Files:**
- Create: `src/lib/supabaseAdminClient.js`
- Create: `src/pages/AdminPasscode.jsx`
- Create: `src/main-admin.jsx`
- Create: `admin.html`
- Modify: `vite.config.js`
- Modify: `.env.local`（gitignore対象、controllerが直接作成する。実装者はこのファイルを作成しない）

**Interfaces:**
- Consumes: `app_settings`テーブル（Task 1）
- Produces: `admin.html`エントリーポイントでビルドされる管理画面。他タスクからは参照されない末端機能

- [ ] **Step 1: `src/lib/supabaseAdminClient.js`を新規作成する**

service role keyは`.env.local`（Viteが自動読み込みする、`.gitignore`の`*.local`パターンで既にgit管理外）から`import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY`として読み込む。**この`.env.local`ファイル自体は実装者は作成しない**（秘密値を含むため、controllerが別途直接作成する。実装者は下記コードだけを書けばよい）:

```javascript
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = `${window.location.origin}/api`;
const SUPABASE_SERVICE_ROLE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
```

このファイルは`AdminPasscode.jsx`以外からは絶対にimportしないこと（公開バンドルにservice role keyが混入するのを防ぐため）。

- [ ] **Step 2: `src/pages/AdminPasscode.jsx`を新規作成する**

既存の`PasscodeGate.jsx`と同じインラインstyle・配色（`#2563eb`アクセント）を踏襲する:

```jsx
import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { supabase } from "../lib/supabaseClient.js";
import { supabaseAdmin } from "../lib/supabaseAdminClient.js";

export default function AdminPasscode() {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    supabase
      .from("app_settings")
      .select("passcode")
      .eq("id", 1)
      .single()
      .then(({ data, error }) => {
        if (error) {
          setLoadError(true);
        } else {
          setValue(data.passcode);
        }
        setLoading(false);
      });
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const { error } = await supabaseAdmin
      .from("app_settings")
      .update({ passcode: value, updated_at: new Date().toISOString() })
      .eq("id", 1);
    setSaving(false);
    if (error) {
      setMessage({ type: "error", text: `保存に失敗しました: ${error.message}` });
    } else {
      setMessage({ type: "success", text: "保存しました" });
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <form
        onSubmit={handleSave}
        style={{
          background: "#fff", borderRadius: 16, padding: 28, width: "100%", maxWidth: 380,
          display: "flex", flexDirection: "column", gap: 14,
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Lock size={16} color="#2563eb" strokeWidth={2.2} />
          </div>
          <h1 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
            ワンタイムパスコード管理
          </h1>
        </div>

        {loading ? (
          <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>読み込み中...</p>
        ) : loadError ? (
          <p style={{ margin: 0, fontSize: 13, color: "#dc2626" }}>現在の値の取得に失敗しました</p>
        ) : (
          <>
            <label style={{ fontSize: 12.5, color: "#64748b", display: "flex", flexDirection: "column", gap: 6 }}>
              現在のパスコード
              <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                style={{
                  border: "1px solid #e2e8f0", borderRadius: 10,
                  padding: "10px 12px", fontSize: 14, boxSizing: "border-box",
                }}
              />
            </label>
            <button
              type="submit"
              disabled={saving}
              style={{
                border: "none", background: saving ? "#93c5fd" : "#2563eb", color: "#fff",
                borderRadius: 10, padding: "11px 0", fontSize: 13.5, fontWeight: 700,
                cursor: saving ? "default" : "pointer",
              }}
            >
              {saving ? "保存中..." : "保存"}
            </button>
            {message && (
              <p style={{ margin: 0, fontSize: 12, color: message.type === "error" ? "#dc2626" : "#16a34a" }}>
                {message.text}
              </p>
            )}
          </>
        )}
      </form>
    </div>
  );
}
```

- [ ] **Step 3: `src/main-admin.jsx`を新規作成する**

既存の`src/main-app.jsx`と同じ構成に合わせる（`AuthProvider`は不要、管理画面はSupabase Authを使わない）:

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AdminPasscode from './pages/AdminPasscode.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AdminPasscode />
  </StrictMode>,
)
```

- [ ] **Step 4: `admin.html`を新規作成する**

公開する意図が無いページのため`<meta name="robots" content="noindex, nofollow">`を入れ、OGP・manifestは付けない:

```html
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex, nofollow" />
    <title>パスコード管理</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main-admin.jsx"></script>
  </body>
</html>
```

- [ ] **Step 5: `vite.config.js`に`admin`エントリーを追加する**

`vite.config.js`の`rollupOptions.input`に以下を追加する（既存の`main`/`app`/`demoApp`と並べる）:

```javascript
        admin: resolve(__dirname, 'admin.html'),
```

変更後のファイル全体は以下の通り:

```javascript
import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app.html'),
        demoApp: resolve(__dirname, 'demo_app.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
    },
  },
})
```

- [ ] **Step 6: ビルドを確認する（この時点では`.env.local`が無いため、埋め込み値は`undefined`になるが、ビルド自体が通ることを確認する）**

Run: `npm run build`
Expected: エラーなく完了し、`dist/admin.html`と`dist/assets/admin-*.js`（または同等の`admin`を含むファイル名）が生成される

Run: `ls dist/assets | grep admin`
Expected: `admin`を含むJSファイルが1つ以上存在する（Task 5でnginxがこの命名パターンを使ってブロックするため、ファイル名に`admin`が含まれることを確認しておく）

- [ ] **Step 7: Commit**

```bash
git add src/lib/supabaseAdminClient.js src/pages/AdminPasscode.jsx src/main-admin.jsx admin.html vite.config.js
git commit -m "feat: パスコード管理画面(admin.html)を追加"
```

（`.env.local`はgitignore対象のためcommitしない。実装者はこのファイルを作成していないので、`git status`に含まれないはずであることを確認する）

---

### Task 5: `.env.local`作成・統合ビルド・nginx設定・デプロイ・実機確認

**Files:**
- Create: `.env.local`（controllerが直接作成、gitにはコミットしない）
- （サーバー側）Modify: `/etc/nginx/sites-enabled/price-compare-app`（LXC114上、git管理外）

**Interfaces:**
- Consumes: Task 1〜4の全成果物
- Produces: なし（最終確認タスク）

このタスクは秘密値（service role key）とサーバー本番設定を扱うため、**controller自身が実行する**（サブエージェントに委任しない）。

- [ ] **Step 1: service role keyを取得する**

Run: `ssh root@192.168.11.114 "grep SERVICE_ROLE_KEY /opt/supabase/docker/.env"`
Expected: `SERVICE_ROLE_KEY=<値>`の行が出力される（過去のセッション`2026-07-30-remove-generic-name.md`計画でも同じ手順が使われている）

- [ ] **Step 2: `.env.local`を作成する**

取得した値を使い、プロジェクトルートに`.env.local`を作成する:
```
VITE_SUPABASE_SERVICE_ROLE_KEY=<Step1で取得した値>
```

Run: `git status`
Expected: `.env.local`が「Untracked files」にも「Changes」にも出てこない（`.gitignore`の`*.local`で無視されていることを確認）

- [ ] **Step 3: 全テストを実行する**

Run: `npx vitest run`
Expected: 全テストPASS（Task 2で追加した`fetchCurrentPasscode`関連含む）

- [ ] **Step 4: ビルドする**

Run: `npm run build`
Expected: エラーなく完了。`dist/admin.html`に`import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY`の実際の値が埋め込まれていることを確認する:

Run: `grep -c "service_role" dist/assets/admin-*.js`
Expected: 1件以上ヒットする（service role keyのJWTペイロードに`"role":"service_role"`という文字列が含まれるため。0件ならService role keyが埋め込まれていない=`.env.local`が読み込まれていない可能性があるので原因調査する）

- [ ] **Step 5: LXC114へデプロイする**

Run: `scp -r dist/* root@192.168.11.114:/var/www/price-compare-app/`
Expected: 転送完了

- [ ] **Step 6: nginx設定を更新する**

現行の`/etc/nginx/sites-enabled/price-compare-app`を確認してから、`admin.html`と`admin-*.js`/`admin-*.css`を`127.0.0.1`限定にするlocationブロックを追加する:

Run: `ssh root@192.168.11.114 "cat /etc/nginx/sites-enabled/price-compare-app"`

現行設定に対し、`location /assets/`ブロックより前に以下2つのlocationブロックを追加する（nginxはlocationの優先度により、より具体的な`location = `と正規表現`location ~`が`location /assets/`より優先されるため順序自体は問題にならないが、可読性のため`server`ブロック内の`location /assets/`の直前に挿入する）:

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

サーバー上で直接編集する（例: `ssh root@192.168.11.114`してから`vi /etc/nginx/sites-enabled/price-compare-app`、またはローカルで編集した全文を`scp`で転送）。

- [ ] **Step 7: nginx設定を検証・再読み込みする**

Run: `ssh root@192.168.11.114 "nginx -t && systemctl reload nginx"`
Expected: `syntax is ok` / `test is successful`、reloadがエラーなく完了

- [ ] **Step 8: 外部からadmin.htmlにアクセスできないことを確認する**

Run: `curl -s -o /dev/null -w "%{http_code}" https://tokuchika.gozakura.com/admin.html`
Expected: `403`（外部からは拒否される）

- [ ] **Step 9: SSHポートフォワード経由でadmin.htmlにアクセスできることを確認する**

Run（バックグラウンドでポートフォワードを張る）: `ssh -f -N -L 8091:127.0.0.1:80 root@192.168.11.114`

Run: `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8091/admin.html`
Expected: `200`（ローカルホスト経由ではアクセス可能）

- [ ] **Step 10: 管理画面の実機確認（claude-in-chrome等）**

`http://127.0.0.1:8091/admin.html`をブラウザで開き、以下を確認する:
- 現在のパスコード（`TOKUCHIKA2026`）が入力欄にプリセットされている
- 値を一時的な検証用文字列（例: `TEST-VERIFY-123`）に変更して保存し、「保存しました」が表示される
- `https://tokuchika.gozakura.com/app.html?cb=<任意>`を別タブで開き、変更後の値（`TEST-VERIFY-123`）でパスコードゲートが解除できることを確認する（localStorageの解除フラグが残っている場合は`localStorage.clear()`してから確認する）
- 確認が終わったら管理画面で値を`TOKUCHIKA2026`に戻し、保存する（招待者が引き続き既存コードを使える状態に復元するため）

- [ ] **Step 11: ポートフォワードを閉じる**

Run: `pkill -f "8091:127.0.0.1:80"`

- [ ] **Step 12: `.secretary`側の記録を更新する**

`.secretary/projects/price-compare-app/project.md`の「進捗」に本タスクの実施内容を追記し、nginx設定の変更内容（Step 6のlocationブロック追加）を`.secretary/debugging/`または`project.md`のメモ欄に残す（サーバー上のnginx設定はgit管理外のため、再構築時に復元できるよう記録する）。「タスク」セクションから「共通パスコードを招待者に配布する」の完了定義に変更なし（値自体は変わっていないため）。

---

## Self-Review メモ（実行前チェック済み）
- spec.mdの①（DB移行）②（管理画面）③（nginx制限）すべてに対応するタスクがある（①=Task1-2、②=Task3-4、③=Task5）
- プレースホルダーなし。`.env.local`の実際の値はTask5でcontrollerが直接扱う（実装者には渡さない）ため、Task4の実装コードには具体的な秘密値を書いていない
- 型・関数名の一貫性: `fetchCurrentPasscode`/`checkPasscode(input, currentPasscode)`/`isPasscodeUnlocked`/`unlockPasscode`はTask2で定義した名前をTask3で一貫して使用。`app_settings`テーブル名・`passcode`列名はTask1で定義したものをTask2・Task4で一貫して使用
- specからの逸脱: service role keyの埋め込み方法を「ソースに直接ハードコード」から「`.env.local`経由」に変更（Global Constraints参照、secrets-in-git回避のための意図的な改善）
