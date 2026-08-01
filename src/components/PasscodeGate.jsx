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
