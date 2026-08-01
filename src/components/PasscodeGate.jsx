import { useEffect, useState } from "react";
import { Lock, AlertCircle } from "lucide-react";
import { checkPasscode, unlockPasscode, fetchCurrentPasscode, isUnlockedFor } from "../lib/passcode.js";
import { ACCENT, ACCENT_LIGHT } from "../lib/theme.js";

export default function PasscodeGate({ onUnlock }) {
  const [value, setValue] = useState("");
  const [showError, setShowError] = useState(false);
  const [currentPasscode, setCurrentPasscode] = useState(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchCurrentPasscode()
      .then((passcode) => {
        if (cancelled) return;
        // この端末が以前解除したパスコードと現在のパスコードが一致する場合のみ、
        // 再入力なしで通す。管理画面でパスコードが変更されていれば再入力を求める
        if (isUnlockedFor(passcode)) {
          onUnlock();
          return;
        }
        setCurrentPasscode(passcode);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (checkPasscode(value, currentPasscode)) {
      unlockPasscode(value);
      onUnlock();
    } else {
      setShowError(true);
    }
  };

  const cardStyle = {
    background: "#fff", borderRadius: 20, padding: 32, width: "100%", maxWidth: 360,
    display: "flex", flexDirection: "column", gap: 16, alignItems: "center",
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
          <div style={{ width: 50, height: 50, borderRadius: 14, background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <AlertCircle size={23} color="#dc2626" strokeWidth={2.2} />
          </div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0f172a", textAlign: "center" }}>
            うまく読み込めませんでした
          </h2>
          <p style={{ margin: 0, fontSize: 14, color: "#64748b", textAlign: "center", lineHeight: 1.7 }}>
            通信状況をご確認のうえ、もう一度読み込んでみてください。
          </p>
        </div>
      </div>
    );
  }

  if (currentPasscode === null) {
    return (
      <div style={wrapperStyle}>
        <div style={cardStyle}>
          <p style={{ margin: 0, fontSize: 15, color: "#64748b" }}>読み込み中です…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={wrapperStyle}>
      <form onSubmit={handleSubmit} style={cardStyle}>
        <div style={{ width: 50, height: 50, borderRadius: 14, background: ACCENT_LIGHT, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Lock size={23} color={ACCENT} strokeWidth={2.2} />
        </div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0f172a", textAlign: "center" }}>
          招待コードを入力してください
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: "#64748b", textAlign: "center", lineHeight: 1.7 }}>
          このアプリは今、招待された方だけがご利用いただけます。
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
            width: "100%", border: "1px solid #e2e8f0", borderRadius: 12,
            padding: "13px 14px", fontSize: 16, textAlign: "center", boxSizing: "border-box",
          }}
          autoFocus
        />
        {showError && (
          <p style={{ margin: 0, fontSize: 14, color: "#dc2626" }}>コードが違うようです。もう一度確認してください</p>
        )}
        <button
          type="submit"
          style={{
            width: "100%", border: "none", background: ACCENT, color: "#fff",
            borderRadius: 12, padding: "14px 0", fontSize: 16, fontWeight: 700, cursor: "pointer",
          }}
        >
          進む
        </button>
      </form>
    </div>
  );
}
