import React from "react";
import {
  MapPin,
  List,
  Bell,
  LineChart as LineChartIcon,
  ShoppingCart,
  Sprout,
  ArrowRight,
  Check,
  Clock,
} from "lucide-react";

const FEATURES = [
  {
    icon: MapPin,
    title: "地図で、近くの店がひと目でわかる",
    body: "店舗のピンをタップするだけで、その店の価格一覧がすぐ開きます。",
  },
  {
    icon: List,
    title: "カテゴリ別の最安値一覧",
    body: "野菜・精肉・日用品など、カテゴリを絞り込んで最安値だけをサッと確認できます。",
  },
  {
    icon: Bell,
    title: "値下げしたら教えてくれる",
    body: "気になる商品を★登録しておくと、値下がりしたタイミングを見逃しません。",
  },
  {
    icon: LineChartIcon,
    title: "価格の推移が見える",
    body: "「そろそろ安くなりそう」を、過去14日間の値動きグラフから判断できます。",
  },
  {
    icon: ShoppingCart,
    title: "買い物リストごと、一番安い店を診断",
    body: "リストに商品を入れるだけで、まとめ買いに一番向いている店舗を教えてくれます。",
  },
];

const ROADMAP = [
  { done: true, label: "地図ビュー・最安値一覧・カテゴリ絞り込み" },
  { done: true, label: "値下げ通知・価格推移グラフ・買い物リスト診断" },
  { done: false, label: "実店舗サイトからの価格自動取得" },
  { done: false, label: "対応エリア・対応店舗の拡大" },
];

export default function LandingPage() {
  return (
    <div
      style={{
        fontFamily: "'Zen Kaku Gothic New', 'Hiragino Sans', sans-serif",
        background: "#F1F4EE",
        color: "#202B22",
        minHeight: "100%",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700;900&family=JetBrains+Mono:wght@400;600;700&display=swap');
        * { box-sizing: border-box; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        .cta:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(47,107,74,0.28); }
        .cta { transition: all 0.15s ease; }
        .feat-card:hover { border-color: #2F6B4A; transform: translateY(-2px); }
        .feat-card { transition: all 0.15s ease; }
        .tag-string { transform-origin: top center; animation: sway 3.2s ease-in-out infinite; }
        @keyframes sway { 0%,100% { transform: rotate(-2.5deg); } 50% { transform: rotate(2.5deg); } }
      `}</style>

      {/* ヘッダーバー */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "18px 24px 0" }}>
        <div style={{ width: 26, height: 26, borderRadius: 8, background: "#2F6B4A", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Sprout size={15} color="#F1F4EE" strokeWidth={2.4} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700 }}>ちかトク（仮）</span>
        <span
          style={{
            marginLeft: 4, fontSize: 9.5, fontWeight: 700, color: "#5B6B5A",
            background: "#E4E9DC", padding: "2px 8px", borderRadius: 999, letterSpacing: "0.03em",
          }}
        >
          個人開発・検証フェーズ
        </span>
      </div>

      {/* ヒーロー */}
      <div style={{ padding: "28px 24px 8px" }}>
        <h1 style={{ fontSize: 30, fontWeight: 900, lineHeight: 1.3, margin: "0 0 14px", letterSpacing: "-0.01em" }}>
          同じ牛乳が、<br />
          店によって<span style={{ color: "#B8502F" }}>80円</span>違う。
        </h1>
        <p style={{ fontSize: 14, lineHeight: 1.8, color: "#4A564A", margin: "0 0 22px" }}>
          近くのスーパーの価格を自動で集めて比べる、個人開発中の節約ツールです。
          <br />
          どの店が安いか迷う時間を、なくします。
        </p>

        {/* 値札ビジュアル（シグネチャー要素） */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 26 }}>
          <div className="tag-string" style={{ position: "relative" }}>
            <svg width="8" height="26" style={{ position: "absolute", top: -24, left: "50%", marginLeft: -4 }}>
              <line x1="4" y1="0" x2="4" y2="26" stroke="#B7C0AE" strokeWidth="2" />
            </svg>
            <div
              style={{
                position: "relative",
                width: 220,
                background: "#fff",
                border: "1px solid #D9DED2",
                borderRadius: "16px 16px 16px 44px",
                padding: "18px 20px 20px 26px",
                boxShadow: "0 8px 24px rgba(32,43,34,0.10)",
              }}
            >
              <div style={{ position: "absolute", left: 14, top: 14, width: 9, height: 9, borderRadius: "50%", background: "#F1F4EE", border: "1.5px solid #C9D0C3" }} />
              <div style={{ fontSize: 10.5, color: "#A5AE9F", fontWeight: 700, marginBottom: 6 }}>牛乳 1000ml</div>
              <div className="mono" style={{ fontSize: 13, color: "#B4BBAB", textDecoration: "line-through", marginBottom: 2 }}>¥238</div>
              <div className="mono" style={{ fontSize: 26, fontWeight: 900, color: "#B8502F", lineHeight: 1 }}>¥158</div>
              <div
                style={{
                  position: "absolute", top: -10, right: -10, background: "#E8A33D", color: "#fff",
                  fontSize: 11, fontWeight: 900, borderRadius: "50%", width: 46, height: 46,
                  display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 3px 8px rgba(232,163,61,0.4)",
                  transform: "rotate(8deg)",
                }}
              >
                -34%
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <button
            className="cta"
            style={{
              display: "flex", alignItems: "center", gap: 6, background: "#2F6B4A", color: "#fff",
              border: "none", borderRadius: 999, padding: "13px 22px", fontSize: 13.5, fontWeight: 700,
              boxShadow: "0 4px 12px rgba(47,107,74,0.24)",
            }}
          >
            使ってみて感想を聞かせてください
            <ArrowRight size={15} />
          </button>
        </div>
      </div>

      {/* 統計バー */}
      <div
        style={{
          display: "flex", justifyContent: "center", gap: 0, margin: "26px 24px 0",
          background: "#202B22", borderRadius: 16, overflow: "hidden",
        }}
      >
        {[
          { value: "20", unit: "店舗", label: "比較対象" },
          { value: "100", unit: "品目", label: "登録商品" },
          { value: "最大32", unit: "%", label: "お得になった例" },
        ].map((s, i) => (
          <div
            key={s.label}
            style={{
              flex: 1, textAlign: "center", padding: "16px 8px",
              borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.1)" : "none",
            }}
          >
            <div className="mono" style={{ color: "#F1F4EE", fontSize: 19, fontWeight: 700 }}>
              {s.value}<span style={{ fontSize: 12, opacity: 0.7 }}>{s.unit}</span>
            </div>
            <div style={{ color: "#9FB39C", fontSize: 10, marginTop: 2, fontWeight: 700 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <p style={{ textAlign: "center", fontSize: 10, color: "#A5AE9F", margin: "8px 24px 0" }}>
        ※ 現在はすべてダミーデータによる検証用の数値です
      </p>

      {/* 機能一覧 */}
      <div style={{ padding: "34px 24px 8px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#7A8578", letterSpacing: "0.06em", marginBottom: 4 }}>
          できること
        </div>
        <h2 style={{ fontSize: 19, fontWeight: 900, margin: "0 0 18px" }}>
          「今、一番安い店」がすぐわかる
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="feat-card"
                style={{
                  display: "flex", gap: 12, alignItems: "flex-start",
                  background: "#fff", border: "1px solid #D9DED2", borderRadius: 14, padding: "14px 16px",
                }}
              >
                <div style={{ width: 34, height: 34, borderRadius: 10, background: "#EEF2E9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={16} color="#2F6B4A" strokeWidth={2.2} />
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 3 }}>{f.title}</div>
                  <div style={{ fontSize: 12, color: "#6B7A6A", lineHeight: 1.6 }}>{f.body}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 開発状況（誠実な進捗表示） */}
      <div style={{ padding: "30px 24px 8px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#7A8578", letterSpacing: "0.06em", marginBottom: 4 }}>
          今の状況
        </div>
        <h2 style={{ fontSize: 19, fontWeight: 900, margin: "0 0 4px" }}>
          MVPを検証している段階です
        </h2>
        <p style={{ fontSize: 12.5, color: "#6B7A6A", margin: "0 0 16px", lineHeight: 1.7 }}>
          個人の節約用に開発中で、今はダミーデータで機能を試している段階です。手応えがあれば、実店舗のデータ対応や事業化も検討しています。
        </p>

        <div style={{ background: "#fff", border: "1px solid #D9DED2", borderRadius: 14, overflow: "hidden" }}>
          {ROADMAP.map((r, i) => (
            <div
              key={r.label}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
                borderTop: i === 0 ? "none" : "1px solid #F3F5EF",
              }}
            >
              <div
                style={{
                  width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: r.done ? "#2F6B4A" : "#EEF0E9",
                }}
              >
                {r.done ? <Check size={12} color="#fff" strokeWidth={3} /> : <Clock size={11} color="#A5AE9F" />}
              </div>
              <span style={{ fontSize: 12.5, color: r.done ? "#202B22" : "#8A9686", fontWeight: r.done ? 600 : 400 }}>
                {r.label}
              </span>
              <span style={{ marginLeft: "auto", fontSize: 9.5, fontWeight: 700, color: r.done ? "#2F6B4A" : "#A5AE9F" }}>
                {r.done ? "検証中" : "未着手"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* フッターCTA */}
      <div style={{ padding: "30px 24px 36px" }}>
        <div
          style={{
            background: "linear-gradient(180deg, #202B22 0%, #26332A 100%)",
            borderRadius: 18, padding: "26px 22px", textAlign: "center", color: "#F1F4EE",
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 900, margin: "0 0 8px" }}>
            近くのスーパー、最安値くらべ
          </h2>
          <p style={{ fontSize: 12, opacity: 0.65, margin: "0 0 18px", lineHeight: 1.7 }}>
            まずは触ってみて、良かったところ・使いにくかったところを教えてください。
          </p>
          <button
            className="cta"
            style={{
              background: "#2F6B4A", color: "#fff", border: "none", borderRadius: 999,
              padding: "12px 24px", fontSize: 13, fontWeight: 700, display: "inline-flex",
              alignItems: "center", gap: 6,
            }}
          >
            MVPを試す
            <ArrowRight size={14} />
          </button>
        </div>
        <p style={{ textAlign: "center", fontSize: 10, color: "#A5AE9F", marginTop: 14 }}>
          店舗名・価格・グラフの数値はすべて検証用のダミーデータです
        </p>
      </div>
    </div>
  );
}
