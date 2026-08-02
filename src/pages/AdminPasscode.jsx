import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { supabase } from "../lib/supabaseClient.js";
import { useAuth } from "../lib/AuthContext.jsx";

function LoginForm() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: signInError } = await signIn(email, password);
    setSubmitting(false);
    if (signInError) setError("ログインに失敗しました。メールアドレスとパスワードを確認してください");
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <label style={{ fontSize: 12.5, color: "#64748b", display: "flex", flexDirection: "column", gap: 6 }}>
        メールアドレス
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px", fontSize: 14, boxSizing: "border-box" }}
        />
      </label>
      <label style={{ fontSize: 12.5, color: "#64748b", display: "flex", flexDirection: "column", gap: 6 }}>
        パスワード
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px", fontSize: 14, boxSizing: "border-box" }}
        />
      </label>
      <button
        type="submit"
        disabled={submitting}
        style={{
          border: "none", background: submitting ? "#93c5fd" : "#2563eb", color: "#fff",
          borderRadius: 10, padding: "11px 0", fontSize: 13.5, fontWeight: 700,
          cursor: submitting ? "default" : "pointer",
        }}
      >
        {submitting ? "ログイン中..." : "ログイン"}
      </button>
      {error && <p style={{ margin: 0, fontSize: 12, color: "#dc2626" }}>{error}</p>}
    </form>
  );
}

function PasscodeForm() {
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
    const trimmed = value.trim();
    if (!trimmed) return;
    setMessage(null);
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .update({ passcode: trimmed, updated_at: new Date().toISOString() })
      .eq("id", 1);
    setSaving(false);
    if (error) {
      setMessage({ type: "error", text: `保存に失敗しました: ${error.message}` });
    } else {
      setValue(trimmed);
      setMessage({ type: "success", text: "保存しました" });
    }
  };

  if (loading) return <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>読み込み中...</p>;
  if (loadError) return <p style={{ margin: 0, fontSize: 13, color: "#dc2626" }}>現在の値の取得に失敗しました</p>;

  return (
    <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <label style={{ fontSize: 12.5, color: "#64748b", display: "flex", flexDirection: "column", gap: 6 }}>
        現在のパスコード
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px", fontSize: 14, boxSizing: "border-box" }}
        />
      </label>
      <button
        type="submit"
        disabled={saving || !value.trim()}
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
    </form>
  );
}

export default function AdminPasscode() {
  const { isLoggedIn, authLoading, signOut } = useAuth();

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div
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

        {authLoading ? (
          <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>読み込み中...</p>
        ) : !isLoggedIn ? (
          <LoginForm />
        ) : (
          <>
            <PasscodeForm />
            <button
              type="button"
              onClick={signOut}
              style={{ border: "none", background: "transparent", color: "#64748b", fontSize: 12.5, padding: 0, textAlign: "left" }}
            >
              ログアウト
            </button>
          </>
        )}
      </div>
    </div>
  );
}
