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
