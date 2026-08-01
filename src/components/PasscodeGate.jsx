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
