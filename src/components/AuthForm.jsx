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
