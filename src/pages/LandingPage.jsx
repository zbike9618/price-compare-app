import {
  MapPin, List, Star, TrendingDown, ShoppingCart, Store, ArrowRight, Check, Clock,
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
    icon: Star,
    title: "お気に入り登録でいつでもチェック",
    body: "気になる商品を☆登録しておくと、お気に入りタブからすぐ価格を確認できます(ログインすると次回以降も保持されます)。",
  },
  {
    icon: TrendingDown,
    title: "値下げ中の商品がひと目でわかる",
    body: "直近30日で最安値を更新した商品には「値下げ」バッジが付きます。",
  },
  {
    icon: ShoppingCart,
    title: "買い物リストごと、一番安い店を診断",
    body: "リストに商品を入れるだけで、まとめ買いに一番向いている店舗を教えてくれます。",
  },
];

const ROADMAP = [
  { done: true, label: "地図ビュー・最安値一覧・カテゴリ絞り込み" },
  { done: true, label: "お気に入り登録・値下げバッジ・買い物リスト診断" },
  { done: false, label: "単価(¥/100g等)表示" },
  { done: false, label: "対応エリア・対応店舗の拡大" },
];

export default function LandingPage() {
  return (
    <div style={{ fontFamily: "'Zen Kaku Gothic New', 'Hiragino Sans', sans-serif", background: "#f8fafc", color: "#0f172a", minHeight: "100%" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700;900&family=JetBrains+Mono:wght@400;600;700&display=swap');
        * { box-sizing: border-box; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        .cta:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(37,99,235,0.28); }
        .cta { transition: all 0.15s ease; }
        .feat-card:hover { border-color: #2563eb; transform: translateY(-2px); }
        .feat-card { transition: all 0.15s ease; }
      `}</style>

      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "18px 24px 0" }}>
        <div style={{ width: 26, height: 26, borderRadius: 8, background: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Store size={15} color="#fff" strokeWidth={2.4} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700 }}>近くのスーパー、最安値くらべ</span>
      </div>

      <div style={{ padding: "28px 24px 8px" }}>
        <h1 style={{ fontSize: 30, fontWeight: 900, lineHeight: 1.3, margin: "0 0 14px", letterSpacing: "-0.01em" }}>
          同じ牛乳が、<br />
          店によって<span style={{ color: "#dc2626" }}>値段が違う</span>。
        </h1>
        <p style={{ fontSize: 14, lineHeight: 1.8, color: "#475569", margin: "0 0 22px" }}>
          近くのスーパーの価格を自動で集めて比べる、実データ稼働中の節約ツールです。
          <br />
          どの店が安いか迷う時間を、なくします。
        </p>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <a
            href="/app.html"
            className="cta"
            style={{
              display: "flex", alignItems: "center", gap: 6, background: "#2563eb", color: "#fff",
              border: "none", borderRadius: 999, padding: "13px 22px", fontSize: 13.5, fontWeight: 700,
              boxShadow: "0 4px 12px rgba(37,99,235,0.24)", textDecoration: "none",
            }}
          >
            アプリを使ってみる
            <ArrowRight size={15} />
          </a>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 0, margin: "26px 24px 0", background: "#0f172a", borderRadius: 16, overflow: "hidden" }}>
        {[
          { value: "3", unit: "店舗", label: "比較対象" },
          { value: "3,300", unit: "件超", label: "登録商品" },
        ].map((s, i) => (
          <div key={s.label} style={{ flex: 1, textAlign: "center", padding: "16px 8px", borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.1)" : "none" }}>
            <div className="mono" style={{ color: "#f8fafc", fontSize: 19, fontWeight: 700 }}>
              {s.value}<span style={{ fontSize: 12, opacity: 0.7 }}>{s.unit}</span>
            </div>
            <div style={{ color: "#93c5fd", fontSize: 10, marginTop: 2, fontWeight: 700 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: "34px 24px 8px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.06em", marginBottom: 4 }}>できること</div>
        <h2 style={{ fontSize: 19, fontWeight: 900, margin: "0 0 18px" }}>「今、一番安い店」がすぐわかる</h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="feat-card" style={{ display: "flex", gap: 12, alignItems: "flex-start", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "14px 16px" }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={16} color="#2563eb" strokeWidth={2.2} />
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 3 }}>{f.title}</div>
                  <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>{f.body}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ padding: "30px 24px 8px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.06em", marginBottom: 4 }}>今の状況</div>
        <h2 style={{ fontSize: 19, fontWeight: 900, margin: "0 0 4px" }}>実データで動いている個人開発アプリです</h2>
        <p style={{ fontSize: 12.5, color: "#64748b", margin: "0 0 16px", lineHeight: 1.7 }}>
          個人の節約用に開発中で、実店舗の価格を毎日自動収集しています。手応えがあれば、対応エリアの拡大も検討しています。
        </p>

        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden" }}>
          {ROADMAP.map((r, i) => (
            <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderTop: i === 0 ? "none" : "1px solid #f1f5f9" }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: r.done ? "#2563eb" : "#f1f5f9" }}>
                {r.done ? <Check size={12} color="#fff" strokeWidth={3} /> : <Clock size={11} color="#94a3b8" />}
              </div>
              <span style={{ fontSize: 12.5, color: r.done ? "#0f172a" : "#94a3b8", fontWeight: r.done ? 600 : 400 }}>{r.label}</span>
              <span style={{ marginLeft: "auto", fontSize: 9.5, fontWeight: 700, color: r.done ? "#2563eb" : "#94a3b8" }}>
                {r.done ? "稼働中" : "未着手"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "30px 24px 36px" }}>
        <div style={{ background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)", borderRadius: 18, padding: "26px 22px", textAlign: "center", color: "#f8fafc" }}>
          <h2 style={{ fontSize: 18, fontWeight: 900, margin: "0 0 8px" }}>近くのスーパー、最安値くらべ</h2>
          <p style={{ fontSize: 12, opacity: 0.65, margin: "0 0 18px", lineHeight: 1.7 }}>
            まずは触ってみて、良かったところ・使いにくかったところを教えてください。
          </p>
          <a
            href="/app.html"
            className="cta"
            style={{
              background: "#2563eb", color: "#fff", border: "none", borderRadius: 999, padding: "12px 24px",
              fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none",
            }}
          >
            アプリを使う
            <ArrowRight size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}
