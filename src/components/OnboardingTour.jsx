import { useEffect, useState } from "react";
import { X, ArrowRight, ArrowLeft } from "lucide-react";
import { ONBOARDING_STEPS, markOnboardingSeen, findVisibleTourTarget } from "../lib/onboarding.js";

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
      const rect = findVisibleTourTarget(current.targetId);
      setTargetRect(rect);
    };
    measure();
    window.addEventListener("resize", measure);
    // captureフェーズで登録することで、ネストしたスクロールコンテナのスクロールも拾う
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
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

  // ツアー型で対象要素が見つからない場合は、モーダル型相当の見た目にフォールバックする
  // （Leafletの上に何も表示されない・無言でツアーが消えるのを防ぐ）
  if (mode === "modal" || (mode === "tour" && !targetRect)) {
    return (
      <div
        style={{
          position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: 16,
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

  // ここに到達する時点で mode === "tour" かつ targetRect は必ず存在する
  // （targetRectがnullの場合は上のフォールバック分岐でモーダル型として描画済み）

  const pad = 8;
  const holeStyle = {
    position: "fixed",
    top: targetRect.top - pad,
    left: targetRect.left - pad,
    width: targetRect.width + pad * 2,
    height: targetRect.height + pad * 2,
    borderRadius: 12,
    boxShadow: "0 0 0 9999px rgba(15,23,42,0.65)",
    zIndex: 2000,
    pointerEvents: "none",
  };

  // 吹き出しは対象要素の右側（サイドバー時）または上側（下部ナビ時）に出す。
  // 画面幅が狭い(下部ナビ表示時)は対象が画面下部にあるとみなし、吹き出しを対象の上に出す
  const showAbove = targetRect.top > window.innerHeight / 2;
  const tooltipStyle = {
    position: "fixed",
    zIndex: 2001,
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
