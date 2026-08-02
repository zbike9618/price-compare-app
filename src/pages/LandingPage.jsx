import {
  MapPin, List, Star, TrendingDown, ShoppingCart, Store, ArrowRight, ArrowDown, Check, Clock, MessageSquare,
  PiggyBank, History, Bell, Search,
} from "lucide-react";
import { FEEDBACK_FORM_URL, isFeedbackFormReady } from "../lib/feedbackForm.js";
import { ACCENT, ACCENT_LIGHT } from "../lib/theme.js";

const HOW_TO_USE_STEPS = [
  {
    icon: MapPin,
    title: "① 地図で近くのお店をチェック",
    body: "まず、おうちの近くでお買い物する範囲を選んでください。あとはその中のお店だけで比べてくれます。",
  },
  {
    icon: Search,
    title: "② 気になる商品をリストに追加",
    body: "カテゴリのボタンから商品を探して、買い物リストにポンポン追加していくだけです。検索でもすぐ見つかりますよ。",
  },
  {
    icon: PiggyBank,
    title: "③ 一番お得なお店がひと目でわかる",
    body: "リストができたら、お店ごとの合計金額と「いくらお得か」を自動で教えてくれます。",
  },
];

const FEATURES = [
  {
    icon: MapPin,
    title: "地図で、近くのお店がひと目でわかる",
    body: "おうちの近くのお店が地図でパッと見えます。ピンをタップすればお店の名前も見られて、範囲の外のお店は薄く表示されるので迷いません。",
  },
  {
    icon: List,
    title: "カテゴリ別に最安値がわかる",
    body: "野菜・お肉・日用品など、カテゴリのボタンを押すだけで、その中の最安値をサッと確認できます。",
  },
  {
    icon: PiggyBank,
    title: "「いくらお得か」がその場でわかる",
    body: "買い物リストを比べると「A店が一番安い！B店より312円お得」とすぐ表示。今月これまでにお得になった合計金額も見られます。",
  },
  {
    icon: History,
    title: "30日間で一番安かった値段もチェックできる",
    body: "今の値段が直近30日の一番安い値段より高いときは、その値段もあわせて教えてくれます。買い時かどうかの目安になります。",
  },
  {
    icon: Star,
    title: "お気に入り登録でいつでもチェック",
    body: "気になる商品を☆で登録しておくと、お気に入りタブからすぐ値段を見られます（ログインすると次に来たときも残っています）。",
  },
  {
    icon: Bell,
    title: "お気に入りの値下げをお知らせ",
    body: "☆登録した商品が安くなったら、アプリを開いたときにお知らせします。",
  },
  {
    icon: TrendingDown,
    title: "値下げ中の商品がひと目でわかる",
    body: "直近30日で一番安い値段を更新した商品には「値下げ」の目印が付きます。",
  },
  {
    icon: ShoppingCart,
    title: "買い物リストごと、一番安いお店を診断",
    body: "リストに商品を入れるだけで、まとめ買いに一番向いているお店を教えてくれます。",
  },
];

const ROADMAP = [
  { done: true, label: "地図・最安値一覧・カテゴリ絞り込み" },
  { done: true, label: "お気に入り登録・値下げのお知らせ・買い物リスト診断" },
  { done: true, label: "岡山エリアのお店を拡大（5店舗）" },
  { done: true, label: "毎日自動で価格情報を更新" },
  { done: false, label: "単価（¥/100gなど）の表示" },
];

const PRICING_PLANS = [
  {
    name: "無料プラン",
    price: "¥0",
    period: "今はずっと無料",
    features: ["全店舗の最安値比較", "買い物リストのお店診断", "お気に入り・値下げのお知らせ", "30日間の価格推移グラフ"],
    highlighted: true,
    ctaLabel: "今すぐ使う",
    ctaHref: "/app.html",
  },
  {
    name: "有料プラン",
    price: "準備中",
    period: "対応エリア拡大のご要望が増えてきたら",
    features: ["対応エリア・お店の追加リクエスト", "広告非表示", "優先サポート"],
    highlighted: false,
    ctaLabel: "準備中",
    ctaHref: null,
  },
];

export default function LandingPage() {
  return (
    <div style={{ fontFamily: "'Zen Kaku Gothic New', 'Hiragino Sans', sans-serif", background: "#FDFBF7", color: "#0f172a", minHeight: "100%" }}>
      <style>{`
        * { box-sizing: border-box; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        .cta:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(242,120,75,0.28); }
        .cta { transition: all 0.15s ease; }
        .feat-card:hover { border-color: ${ACCENT}; transform: translateY(-2px); }
        .feat-card { transition: all 0.15s ease; }
      `}</style>

      <header
        style={{
          position: "sticky", top: 0, zIndex: 10, background: "#FDFBF7", borderBottom: "1px solid #e2e8f0",
          display: "flex", alignItems: "center", gap: 8, padding: "14px 20px",
        }}
      >
        <div style={{ width: 28, height: 28, borderRadius: 8, background: ACCENT, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Store size={15} color="#fff" strokeWidth={2.4} />
        </div>
        <span style={{ fontSize: 15, fontWeight: 900, whiteSpace: "nowrap" }}>トクちか</span>
        <a
          href="/app.html"
          style={{
            marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4, background: "transparent", color: ACCENT,
            border: `1px solid ${ACCENT}55`, borderRadius: 999, padding: "7px 14px", fontSize: 13, fontWeight: 700, textDecoration: "none",
            flexShrink: 0,
          }}
        >
          使ってみる
        </a>
      </header>

      <div style={{ padding: "30px 24px 8px" }}>
        <div
          style={{
            display: "inline-block", fontSize: 12, fontWeight: 700, color: ACCENT, background: ACCENT_LIGHT,
            borderRadius: 999, padding: "4px 12px", marginBottom: 14,
          }}
        >
          価格.comのスーパー版
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.5, margin: "0 0 20px", letterSpacing: "-0.01em", wordBreak: "keep-all", overflowWrap: "break-word" }}>
          「行ったのに、他のお店の方が<span style={{ color: "#dc2626" }}>安かった</span>」を、なくします。
        </h1>

        <div
          style={{
            display: "flex", alignItems: "center", gap: 14, background: "#fff",
            border: "1px solid #e2e8f0", borderRadius: 16, padding: "16px 18px", marginBottom: 24,
          }}
        >
          <div style={{ width: 42, height: 42, borderRadius: 12, background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <TrendingDown size={20} color="#dc2626" strokeWidth={2.2} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 2 }}>同じ「フジ 本仕込み食パン」でも</div>
            <div style={{ fontSize: 17, fontWeight: 900, lineHeight: 1.5 }}>
              お店によって最大<span className="mono" style={{ color: "#dc2626" }}>64円（43%）</span>も違います
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <a
            href="#how-to-use"
            className="cta"
            style={{
              display: "flex", alignItems: "center", gap: 6, background: "#fff", color: ACCENT,
              border: `2px solid ${ACCENT}`, borderRadius: 999, padding: "14px 24px", fontSize: 15, fontWeight: 700,
              textDecoration: "none",
            }}
          >
            使い方を見る（30秒）
            <ArrowDown size={17} />
          </a>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 0, margin: "28px 24px 0", background: "#2E2521", borderRadius: 18, overflow: "hidden" }}>
        {[
          { value: "5", unit: "店舗", label: "比較対象" },
          { value: "4,045", unit: "件超", label: "登録商品" },
        ].map((s, i) => (
          <div key={s.label} style={{ flex: 1, textAlign: "center", padding: "18px 8px", borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.1)" : "none" }}>
            <div className="mono" style={{ color: "#f8fafc", fontSize: 21, fontWeight: 700 }}>
              {s.value}<span style={{ fontSize: 13, opacity: 0.7 }}>{s.unit}</span>
            </div>
            <div style={{ color: "#FFCBB6", fontSize: 12, marginTop: 3, fontWeight: 700 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div id="how-to-use" style={{ padding: "36px 24px 8px", scrollMarginTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", letterSpacing: "0.06em", marginBottom: 6 }}>使い方</div>
        <h2 style={{ fontSize: 21, fontWeight: 900, margin: "0 0 20px" }}>3つのステップで、一番お得なお店がわかります</h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {HOW_TO_USE_STEPS.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.title} style={{ display: "flex", gap: 14, alignItems: "flex-start", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: "16px 18px" }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: ACCENT_LIGHT, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={19} color={ACCENT} strokeWidth={2.2} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{s.title}</div>
                  <div style={{ fontSize: 14, color: "#64748b", lineHeight: 1.7 }}>{s.body}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ padding: "36px 24px 8px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", letterSpacing: "0.06em", marginBottom: 6 }}>できること</div>
        <h2 style={{ fontSize: 21, fontWeight: 900, margin: "0 0 20px" }}>「今、一番安いお店」がすぐわかります</h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="feat-card" style={{ display: "flex", gap: 14, alignItems: "flex-start", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: "16px 18px" }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: ACCENT_LIGHT, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={19} color={ACCENT} strokeWidth={2.2} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{f.title}</div>
                  <div style={{ fontSize: 14, color: "#64748b", lineHeight: 1.7 }}>{f.body}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ padding: "32px 24px 8px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", letterSpacing: "0.06em", marginBottom: 6 }}>今の状況</div>
        <h2 style={{ fontSize: 21, fontWeight: 900, margin: "0 0 6px" }}>実際のお店の値段で動いている、個人開発のアプリです</h2>
        <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 18px", lineHeight: 1.8 }}>
          個人の節約のために作っていて、実店舗の値段を自動で集めています。使ってみて良さそうなら、対応エリアも広げていく予定です。
        </p>

        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, overflow: "hidden" }}>
          {ROADMAP.map((r, i) => (
            <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderTop: i === 0 ? "none" : "1px solid #f1f5f9" }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: r.done ? ACCENT : "#f1f5f9" }}>
                {r.done ? <Check size={13} color="#fff" strokeWidth={3} /> : <Clock size={12} color="#94a3b8" />}
              </div>
              <span style={{ fontSize: 14, color: r.done ? "#0f172a" : "#94a3b8", fontWeight: r.done ? 600 : 400 }}>{r.label}</span>
              <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: r.done ? ACCENT : "#94a3b8" }}>
                {r.done ? "できます" : "準備中"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "32px 24px 8px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", letterSpacing: "0.06em", marginBottom: 6 }}>料金プラン</div>
        <h2 style={{ fontSize: 21, fontWeight: 900, margin: "0 0 20px" }}>今はどちらも実質、無料で使えます</h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {PRICING_PLANS.map((plan) => (
            <div
              key={plan.name}
              style={{
                background: plan.highlighted ? "#2E2521" : "#fff",
                color: plan.highlighted ? "#f8fafc" : "#0f172a",
                border: `1px solid ${plan.highlighted ? "#2E2521" : "#e2e8f0"}`,
                borderRadius: 16, padding: "20px 20px",
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 17, fontWeight: 900 }}>{plan.name}</span>
                <span className="mono" style={{ fontSize: 20, fontWeight: 700 }}>{plan.price}</span>
              </div>
              <div style={{ fontSize: 13, color: plan.highlighted ? "#FFCBB6" : "#64748b", marginBottom: 14 }}>{plan.period}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
                {plan.features.map((f) => (
                  <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, lineHeight: 1.6 }}>
                    <Check size={15} color={plan.highlighted ? "#FFCBB6" : ACCENT} strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 3 }} />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              {plan.ctaHref ? (
                <a
                  href={plan.ctaHref}
                  className="cta"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6, background: ACCENT, color: "#fff",
                    border: "none", borderRadius: 999, padding: "10px 20px", fontSize: 14, fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  {plan.ctaLabel}
                  <ArrowRight size={15} />
                </a>
              ) : (
                <span
                  style={{
                    display: "inline-flex", alignItems: "center", background: "rgba(255,255,255,0.1)", color: "#FFCBB6",
                    borderRadius: 999, padding: "10px 20px", fontSize: 14, fontWeight: 700,
                  }}
                >
                  {plan.ctaLabel}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {isFeedbackFormReady() && (
        <div style={{ padding: "32px 24px 8px" }}>
          <div
            style={{
              background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16,
              padding: "22px 20px", display: "flex", flexDirection: "column",
              alignItems: "center", textAlign: "center", gap: 12,
            }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 12, background: ACCENT_LIGHT, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MessageSquare size={19} color={ACCENT} strokeWidth={2.2} />
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 900, margin: 0 }}>ご感想・ご意見をお聞かせください</h2>
            <p style={{ fontSize: 14, color: "#64748b", margin: 0, lineHeight: 1.8 }}>
              使ってみた感想や「こうだったらいいのに」と思ったことを、ぜひ教えてください。
            </p>
            <a
              href={FEEDBACK_FORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="cta"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, background: ACCENT, color: "#fff",
                border: "none", borderRadius: 999, padding: "12px 22px", fontSize: 15, fontWeight: 700,
                textDecoration: "none", marginTop: 4,
              }}
            >
              感想を送る
              <ArrowRight size={16} />
            </a>
          </div>
        </div>
      )}

      <div style={{ padding: "32px 24px 40px" }}>
        <div style={{ background: "linear-gradient(180deg, #2E2521 0%, #4A3A30 100%)", borderRadius: 20, padding: "28px 24px", textAlign: "center", color: "#f8fafc" }}>
          <h2 style={{ fontSize: 20, fontWeight: 900, margin: "0 0 10px" }}>使い方はもうバッチリですね</h2>
          <p style={{ fontSize: 14, opacity: 0.7, margin: "0 0 20px", lineHeight: 1.8 }}>
            さっそく使ってみて、良かったところ・使いにくかったところをぜひ教えてください。
          </p>
          <a
            href="/app.html"
            className="cta"
            style={{
              background: ACCENT, color: "#fff", border: "none", borderRadius: 999, padding: "14px 26px",
              fontSize: 15, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none",
            }}
          >
            アプリを使ってみる
            <ArrowRight size={16} />
          </a>
        </div>
      </div>
    </div>
  );
}
