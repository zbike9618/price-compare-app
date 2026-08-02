import { useEffect, useState } from "react";
import { X, ArrowRight, ArrowLeft } from "lucide-react";
import { ONBOARDING_STEPS, markOnboardingSeen, findVisibleTourTarget } from "../lib/onboarding.js";
import { ACCENT } from "../lib/theme.js";

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

    // 対象がホーム画面の下の方（スクロールしないと見えない位置）にある場合、
    // 下部ナビ/サイドバー内の固定要素ではなく、スクロール対象になりうる要素を画面中央までスクロールする
    if (current.targetId) {
      const candidates = document.querySelectorAll(`[data-tour-id="${current.targetId}"]`);
      const scrollTarget = [...candidates].find((el) => !el.closest("nav"));
      scrollTarget?.scrollIntoView({ behavior: "smooth", block: "center" });
    }

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
      style={{ border: "none", background: "transparent", color: "#FFCBB6", fontSize: 14, cursor: "pointer", padding: 0, textDecoration: "underline" }}
    >
      {mode === "tour" ? "一覧形式で見る" : "画面上で見る"}
    </button>
  );

  const dots = (
    <div style={{ display: "flex", gap: 7 }}>
      {ONBOARDING_STEPS.map((s, i) => (
        <span
          key={s.id}
          style={{
            width: 7, height: 7, borderRadius: "50%",
            background: i === step ? ACCENT : "#cbd5e1",
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
        <div style={{ background: "#fff", borderRadius: 18, padding: 26, width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span style={{ fontSize: 14, color: "#94a3b8", fontWeight: 700 }}>
              使い方（{step + 1}/{ONBOARDING_STEPS.length}）
            </span>
            <button type="button" onClick={finish} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#94a3b8" }}>
              <X size={20} />
            </button>
          </div>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#0f172a" }}>{current.title}</h3>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.8, color: "#475569" }}>{current.description}</p>
          {dots}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
            {current.targetId ? (
              <button
                type="button"
                onClick={() => setMode("tour")}
                style={{ border: "none", background: "transparent", color: ACCENT, fontSize: 14, cursor: "pointer", padding: 0, textDecoration: "underline" }}
              >
                画面上で見る
              </button>
            ) : (
              <span />
            )}
            <div style={{ display: "flex", gap: 9 }}>
              {step > 0 && (
                <button
                  type="button"
                  onClick={goBack}
                  style={{ display: "flex", alignItems: "center", gap: 5, border: "1px solid #e2e8f0", background: "#fff", borderRadius: 10, padding: "10px 15px", fontSize: 15, cursor: "pointer", color: "#334155" }}
                >
                  <ArrowLeft size={16} /> 戻る
                </button>
              )}
              <button
                type="button"
                onClick={goNext}
                style={{ display: "flex", alignItems: "center", gap: 5, border: "none", background: ACCENT, color: "#fff", borderRadius: 10, padding: "10px 17px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}
              >
                {isLast ? "はじめる" : "次へ"} {!isLast && <ArrowRight size={16} />}
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
    // 下部ナビ(zIndex:2500, AppShell.jsx)より下のレイヤーにすることで、
    // ハイライトの暗転がナビバーの上に覆いかぶさらないようにする
    zIndex: 100,
    pointerEvents: "none",
  };

  // 吹き出しは対象要素の右側（サイドバー時）または上側（下部ナビ時）に出す。
  // 画面幅が狭い(下部ナビ表示時)は対象が画面下部にあるとみなし、吹き出しを対象の上に出す
  const showAbove = targetRect.top > window.innerHeight / 2;
  const tooltipStyle = {
    position: "fixed",
    zIndex: 3000,
    background: "#2E2521",
    color: "#fff",
    borderRadius: 14,
    padding: 18,
    width: 280,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    ...(showAbove
      ? { left: Math.max(12, Math.min(targetRect.left, window.innerWidth - 292)), bottom: window.innerHeight - targetRect.top + 12 }
      : { left: Math.min(targetRect.right + 12, window.innerWidth - 292), top: Math.max(12, targetRect.top) }),
  };

  return (
    <>
      <div style={holeStyle} />
      <div style={tooltipStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <span style={{ fontSize: 13, color: "#FFCBB6", fontWeight: 700 }}>
            使い方（{step + 1}/{ONBOARDING_STEPS.length}）
          </span>
          <button type="button" onClick={finish} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#FFCBB6" }}>
            <X size={18} />
          </button>
        </div>
        <h4 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{current.title}</h4>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.8, color: "#cbd5e1" }}>{current.description}</p>
        {dots}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
          {modeToggleLink}
          <div style={{ display: "flex", gap: 9 }}>
            {step > 0 && (
              <button
                type="button"
                onClick={goBack}
                style={{ border: "1px solid #475569", background: "transparent", color: "#e2e8f0", borderRadius: 10, padding: "8px 12px", fontSize: 14, cursor: "pointer" }}
              >
                戻る
              </button>
            )}
            <button
              type="button"
              onClick={goNext}
              style={{ border: "none", background: ACCENT, color: "#fff", borderRadius: 10, padding: "8px 14px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
            >
              {isLast ? "はじめる" : "次へ"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
