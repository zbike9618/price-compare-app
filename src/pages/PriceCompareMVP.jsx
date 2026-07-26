import React, { useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import {
  MapPin,
  List,
  ArrowDownRight,
  Store,
  Sprout,
  Search,
  TrendingDown,
  Leaf,
  Milk,
  Beef,
  Apple,
  Wheat,
  Coffee,
  Package,
  Fish,
  Navigation,
  Trophy,
  Star,
  Bell,
  ChevronDown,
  ArrowUpDown,
  ShoppingCart,
  Crown,
  X,
  Check,
} from "lucide-react";

// ---------------------------------------------------------------------------
// シード付き擬似乱数（再レンダーのたびに値が変わらないようにするため）
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260726);

// ---------------------------------------------------------------------------
// ダミー店舗データ（20店舗・実在の店舗名ではありません）
// ---------------------------------------------------------------------------
const STORE_NAMES = [
  "グリーンマート中央店", "フレッシュ市場 東店", "マルシェ本町", "わかば商店", "ひまわりストア",
  "さくら青果店", "コスモス市場", "のぞみスーパー", "あおぞらマート", "すこやか食品館",
  "きらり商店街店", "たんぽぽストア", "みのりマーケット", "かがやき青果", "そよかぜマート",
  "あさひ食品", "つばさストア", "ゆめみ市場", "はなまるマート", "りんどう青果店",
];
const STORE_COLORS = ["#2F6B4A", "#B8502F", "#3E6E8E", "#8A6C3F", "#6B4E71", "#4F7A5B", "#A15A3C", "#5B6B5A"];

const GRID_COLS = 5;
const GRID_ROWS = 4;
const MAP_W = 420;
const MAP_H = 340;
const HISTORY_DAYS = 14;

const STORES = STORE_NAMES.map((name, i) => {
  const col = i % GRID_COLS;
  const row = Math.floor(i / GRID_COLS);
  const cellW = MAP_W / GRID_COLS;
  const cellH = MAP_H / GRID_ROWS;
  const jitterX = (rng() - 0.5) * (cellW * 0.5);
  const jitterY = (rng() - 0.5) * (cellH * 0.5);
  return {
    id: `s${i + 1}`,
    name,
    short: name.slice(0, 4),
    x: Math.round(col * cellW + cellW / 2 + jitterX),
    y: Math.round(row * cellH + cellH / 2 + jitterY),
    color: STORE_COLORS[i % STORE_COLORS.length],
  };
});

// ---------------------------------------------------------------------------
// ダミー商品データ（8カテゴリ・計100品目・14日分の価格推移つき）
// ---------------------------------------------------------------------------
const CATEGORY_DEFS = [
  { name: "野菜", icon: Leaf, base: [60, 220], items: ["キャベツ", "レタス", "玉ねぎ", "にんじん", "じゃがいも", "トマト", "きゅうり", "ピーマン", "なす", "ほうれん草", "大根", "ブロッコリー"] },
  { name: "果物", icon: Apple, base: [100, 400], items: ["りんご", "バナナ", "みかん", "いちご", "ぶどう", "もも", "なし", "キウイ", "メロン", "パイナップル", "グレープフルーツ", "さくらんぼ"] },
  { name: "乳製品", icon: Milk, base: [80, 380], items: ["牛乳", "ヨーグルト", "チーズ", "バター", "生クリーム", "カフェオレ", "プリン", "アイスクリーム", "練乳", "クリームチーズ", "低脂肪乳", "ヨーグルトドリンク"] },
  { name: "精肉", icon: Beef, base: [180, 700], items: ["豚こま切れ肉", "鶏むね肉", "鶏もも肉", "牛切り落とし", "合いびき肉", "ベーコン", "ウインナー", "ハム", "豚バラ肉", "牛ロース肉", "鶏ささみ", "手羽先"] },
  { name: "魚介", icon: Fish, base: [180, 780], items: ["鮭切り身", "まぐろ刺身", "さば", "いわし", "えび", "いか", "たこ", "ほたて", "あじ", "ぶり", "うなぎ蒲焼", "ちくわ"] },
  { name: "パン・穀物", icon: Wheat, base: [90, 380], items: ["食パン", "ロールパン", "うどん", "そば", "パスタ", "白米", "玄米", "もち", "シリアル", "クロワッサン", "ベーグル", "そうめん"] },
  { name: "調味料・飲料", icon: Coffee, base: [70, 320], items: ["醤油", "味噌", "砂糖", "塩", "食用油", "ケチャップ", "マヨネーズ", "お茶", "コーヒー", "オレンジジュース", "炭酸水", "豆乳"] },
  { name: "日用品・その他", icon: Package, base: [60, 420], items: ["ティッシュ", "トイレットペーパー", "洗剤", "卵", "豆腐", "納豆", "冷凍餃子", "アイスコーヒー", "レトルトカレー", "カップ麺", "お菓子", "パン粉", "冷凍うどん", "スポーツドリンク", "乾燥わかめ", "オリーブオイル"] },
];

function jan(seedIndex) {
  return `49012${String(340000 + seedIndex).padStart(6, "0")}`;
}

let _pid = 0;
const PRODUCTS = CATEGORY_DEFS.flatMap((cat) =>
  cat.items.map((name) => {
    _pid += 1;
    const [lo, hi] = cat.base;
    const basePrice = Math.round((lo + rng() * (hi - lo)) / 10) * 10;

    const storeHistory = {};
    const prices = {};
    STORES.forEach((s) => {
      const startVariance = 0.82 + rng() * 0.36;
      let value = basePrice * startVariance;
      const hist = [];
      for (let d = 0; d < HISTORY_DAYS; d++) {
        if (d > 0) value = value * (0.965 + rng() * 0.07); // 日々の小さな変動
        hist.push(Math.max(20, Math.round(value)));
      }
      storeHistory[s.id] = hist;
      prices[s.id] = hist[HISTORY_DAYS - 1];
    });

    return {
      id: String(_pid).padStart(4, "0"),
      name,
      cat: cat.name,
      icon: cat.icon,
      jan: jan(_pid),
      storeHistory,
      prices,
    };
  })
);

function yen(n) {
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

// カテゴリごとの参考重量/容量（g・ml換算、目安値）。日用品など換算になじまないものは null。
const REF_WEIGHT = {
  "野菜": 300,
  "果物": 250,
  "乳製品": 400,
  "精肉": 300,
  "魚介": 250,
  "パン・穀物": 400,
  "調味料・飲料": 500,
  "日用品・その他": null,
};

function unitPrice(product, price) {
  const ref = REF_WEIGHT[product.cat];
  if (!ref) return null;
  return Math.round((price / ref) * 100);
}

function stats(product) {
  const entries = STORES.map((s) => [s.id, product.prices[s.id]]);
  entries.sort((a, b) => a[1] - b[1]);
  const min = entries[0];
  const max = entries[entries.length - 1];
  const avg = entries.reduce((sum, e) => sum + e[1], 0) / entries.length;
  return { minStoreId: min[0], minPrice: min[1], maxPrice: max[1], avgPrice: avg };
}

function dayAggregate(product, dayIndex) {
  const vals = STORES.map((s) => product.storeHistory[s.id][dayIndex]);
  const min = Math.min(...vals);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return { min, avg };
}

function priceDrop(product) {
  const today = dayAggregate(product, HISTORY_DAYS - 1);
  const yesterday = dayAggregate(product, HISTORY_DAYS - 2);
  return { dropped: today.min < yesterday.min, from: yesterday.min, to: today.min };
}

function chartData(product) {
  return Array.from({ length: HISTORY_DAYS }, (_, i) => {
    const agg = dayAggregate(product, i);
    return {
      label: i === HISTORY_DAYS - 1 ? "今日" : `${HISTORY_DAYS - 1 - i}日前`,
      最安値: agg.min,
      平均: Math.round(agg.avg),
    };
  });
}

// ---------------------------------------------------------------------------
// 全体集計（ヘッダー用）
// ---------------------------------------------------------------------------
const STORE_TOTALS = STORES.map((s) => ({
  id: s.id,
  total: PRODUCTS.reduce((sum, p) => sum + p.prices[s.id], 0),
}));
const AVG_STORE_TOTAL = STORE_TOTALS.reduce((sum, t) => sum + t.total, 0) / STORE_TOTALS.length;
const CHEAPEST_TOTAL = PRODUCTS.reduce((sum, p) => sum + stats(p).minPrice, 0);
const SAVINGS_PCT = Math.round(((AVG_STORE_TOTAL - CHEAPEST_TOTAL) / AVG_STORE_TOTAL) * 100);

const WIN_COUNTS = {};
STORES.forEach((s) => (WIN_COUNTS[s.id] = 0));
PRODUCTS.forEach((p) => (WIN_COUNTS[stats(p).minStoreId] += 1));
const LEADER_ID = Object.entries(WIN_COUNTS).sort((a, b) => b[1] - a[1])[0][0];
const LEADER_STORE = STORES.find((s) => s.id === LEADER_ID);

const SORT_OPTIONS = [
  { id: "priceAsc", label: "最安値が安い順" },
  { id: "priceDesc", label: "最安値が高い順" },
  { id: "name", label: "商品名順" },
  { id: "cat", label: "カテゴリ順" },
];

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------
export default function PriceCompareMVP() {
  const [view, setView] = useState("cart");
  const [selectedStoreId, setSelectedStoreId] = useState(null);
  const [query, setQuery] = useState("");
  const [storeQuery, setStoreQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(null);
  const [favorites, setFavorites] = useState(() => new Set());
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sortBy, setSortBy] = useState("priceAsc");
  const [expandedId, setExpandedId] = useState(null);
  const [cart, setCart] = useState(() => new Set());
  const [cartSearch, setCartSearch] = useState("");

  const selectedStore = STORES.find((s) => s.id === selectedStoreId) || null;

  const toggleCart = (id) => {
    setCart((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const cartProducts = useMemo(() => PRODUCTS.filter((p) => cart.has(p.id)), [cart]);

  const cartSearchResults = useMemo(() => {
    if (!cartSearch.trim()) return [];
    return PRODUCTS.filter((p) => p.name.includes(cartSearch) || p.cat.includes(cartSearch)).slice(0, 8);
  }, [cartSearch]);

  const cartStoreTotals = useMemo(() => {
    if (cartProducts.length === 0) return [];
    const totals = STORES.map((s) => ({
      ...s,
      total: cartProducts.reduce((sum, p) => sum + p.prices[s.id], 0),
    }));
    totals.sort((a, b) => a.total - b.total);
    return totals;
  }, [cartProducts]);

  const toggleFavorite = (id) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const categoryCounts = useMemo(() => {
    const counts = {};
    CATEGORY_DEFS.forEach((c) => (counts[c.name] = 0));
    PRODUCTS.forEach((p) => (counts[p.cat] += 1));
    return counts;
  }, []);

  const droppedFavorites = useMemo(
    () =>
      PRODUCTS.filter((p) => favorites.has(p.id))
        .map((p) => ({ product: p, drop: priceDrop(p) }))
        .filter((x) => x.drop.dropped),
    [favorites]
  );

  const filteredProducts = useMemo(() => {
    let list = PRODUCTS.filter(
      (p) =>
        (p.name.includes(query) || p.cat.includes(query)) &&
        (activeCategory === null || p.cat === activeCategory) &&
        (!favoritesOnly || favorites.has(p.id))
    );
    list = [...list].sort((a, b) => {
      if (sortBy === "priceAsc") return stats(a).minPrice - stats(b).minPrice;
      if (sortBy === "priceDesc") return stats(b).minPrice - stats(a).minPrice;
      if (sortBy === "name") return a.name.localeCompare(b.name, "ja");
      if (sortBy === "cat") return a.cat.localeCompare(b.cat, "ja") || a.name.localeCompare(b.name, "ja");
      return 0;
    });
    return list;
  }, [query, activeCategory, favoritesOnly, favorites, sortBy]);

  const storeProducts = useMemo(
    () => PRODUCTS.filter((p) => p.name.includes(storeQuery) || p.cat.includes(storeQuery)),
    [storeQuery]
  );

  return (
    <div
      style={{
        fontFamily: "'Zen Kaku Gothic New', 'Hiragino Sans', sans-serif",
        background: "#F1F4EE",
        minHeight: "100%",
        color: "#202B22",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700;900&family=JetBrains+Mono:wght@400;600;700&display=swap');
        * { box-sizing: border-box; }
        .price-num { font-family: 'JetBrains Mono', monospace; }
        button { font-family: inherit; cursor: pointer; }
        select { font-family: inherit; }
        .pin { transition: transform 0.15s ease; transform-box: fill-box; transform-origin: center; }
        .pin:hover { transform: scale(1.15); }
        .row:hover { background: #FAFBF8; }
        input:focus, select:focus { outline: none; }
        .tab-btn:hover { border-color: #2F6B4A; }
        .star-btn:hover { transform: scale(1.15); }
        .chev { transition: transform 0.15s ease; }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-thumb { background: #D9DED2; border-radius: 8px; }

        /* --- タブレット以上のレイアウト --- */
        @media (min-width: 700px) {
          .app-root {
            max-width: 760px;
            margin: 0 auto;
            box-shadow: 0 0 0 1px #D9DED2, 0 24px 60px rgba(32,43,34,0.10);
          }
          .view-pad { padding-left: 32px !important; padding-right: 32px !important; }
          .stat-cards { padding-left: 32px !important; padding-right: 32px !important; }
          .header-pad { padding-left: 32px !important; padding-right: 32px !important; }
          .tabs-pad { padding-left: 32px !important; padding-right: 32px !important; }
          .map-layout { display: grid; grid-template-columns: 1.2fr 1fr; gap: 20px; align-items: start; }
          .map-layout .map-col p { margin-top: 9px; }
          .map-side { margin-top: 0 !important; position: sticky; top: 16px; }
          .cart-layout { display: grid; grid-template-columns: 1fr 1.1fr; gap: 16px; align-items: start; }
        }
      `}</style>

      <div className="app-root">

      {/* ヘッダー */}
      <div
        className="header-pad"
        style={{
          padding: "22px 20px 0",
          background: "linear-gradient(180deg, #202B22 0%, #26332A 100%)",
          color: "#F1F4EE",
          borderRadius: "0 0 22px 22px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <div style={{ width: 26, height: 26, borderRadius: 8, background: "#2F6B4A", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Sprout size={15} color="#F1F4EE" strokeWidth={2.4} />
          </div>
          <span style={{ fontSize: 11, letterSpacing: "0.1em", opacity: 0.6, fontWeight: 700 }}>
            ダミーデータ・{STORES.length}店舗 × {PRODUCTS.length}品目
          </span>
        </div>
        <h1 style={{ margin: 0, fontSize: 23, fontWeight: 900, letterSpacing: "-0.01em" }}>
          近くのスーパー、最安値くらべ
        </h1>
        <p style={{ margin: "4px 0 18px", fontSize: 12.5, opacity: 0.65 }}>
          買い物リストを入れるだけで、一番安い店がわかります
        </p>

        <div className="stat-cards" style={{ display: "flex", gap: 10, paddingBottom: 20 }}>
          <div style={{ flex: 1, background: "rgba(232,163,61,0.12)", border: "1px solid rgba(232,163,61,0.35)", borderRadius: 14, padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
              <TrendingDown size={13} color="#E8A33D" />
              <span style={{ fontSize: 10.5, color: "#E8A33D", fontWeight: 700 }}>賢く選ぶと</span>
            </div>
            <div style={{ fontSize: 19, fontWeight: 900, fontFamily: "'JetBrains Mono', monospace" }}>
              {SAVINGS_PCT}<span style={{ fontSize: 12 }}>%お得</span>
            </div>
          </div>
          <div style={{ flex: 1, background: "rgba(241,244,238,0.06)", border: "1px solid rgba(241,244,238,0.14)", borderRadius: 14, padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
              <Trophy size={13} color="#9FB39C" />
              <span style={{ fontSize: 10.5, color: "#9FB39C", fontWeight: 700 }}>最安1位の多い店</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {LEADER_STORE.short}
              <span style={{ fontSize: 11, opacity: 0.55, marginLeft: 6, fontFamily: "'JetBrains Mono', monospace" }}>
                {WIN_COUNTS[LEADER_ID]}/{PRODUCTS.length}品目
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ビュー切替 */}
      <div className="tabs-pad" style={{ display: "flex", gap: 8, padding: "16px 20px 4px", flexWrap: "wrap" }}>
        <ViewTab active={view === "cart"} onClick={() => setView("cart")} icon={<ShoppingCart size={15} />} label={`買い物リスト比較${cart.size ? `（${cart.size}）` : ""}`} badge="人気" />
        <ViewTab active={view === "list"} onClick={() => setView("list")} icon={<List size={15} />} label="最安値一覧" />
        <ViewTab active={view === "map"} onClick={() => setView("map")} icon={<MapPin size={15} />} label="地図ビュー" />
      </div>

      {/* 地図ビュー */}
      {view === "map" && (
        <div className="view-pad" style={{ padding: 20 }}>
          <div className="map-layout">
          <div className="map-col">
          <div style={{ position: "relative", background: "#E4E9DC", borderRadius: 16, overflow: "hidden", border: "1px solid #D9DED2", boxShadow: "0 1px 3px rgba(32,43,34,0.06)" }}>
            <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} style={{ width: "100%", display: "block" }}>
              <defs>
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#DBE1D2" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect x="0" y="0" width={MAP_W} height={MAP_H} fill="#E4E9DC" />
              <rect x="0" y="0" width={MAP_W} height={MAP_H} fill="url(#grid)" />
              <line x1="0" y1="90" x2="420" y2="90" stroke="#CBD3C0" strokeWidth="7" strokeLinecap="round" />
              <line x1="0" y1="220" x2="420" y2="220" stroke="#CBD3C0" strokeWidth="7" strokeLinecap="round" />
              <line x1="90" y1="0" x2="90" y2="340" stroke="#CBD3C0" strokeWidth="7" strokeLinecap="round" />
              <line x1="260" y1="0" x2="260" y2="340" stroke="#CBD3C0" strokeWidth="7" strokeLinecap="round" />
              <path d="M 0 260 Q 100 240 180 275 T 420 250" fill="none" stroke="#B8CCD8" strokeWidth="10" strokeLinecap="round" opacity="0.5" />

              {STORES.map((s) => (
                <g key={s.id} transform={`translate(${s.x}, ${s.y})`} onClick={() => setSelectedStoreId(s.id)} style={{ cursor: "pointer" }}>
                  <g className="pin">
                    {selectedStoreId === s.id && (
                      <circle r="20" fill={s.color} opacity="0.18">
                        <animate attributeName="r" values="16;22;16" dur="1.8s" repeatCount="indefinite" />
                      </circle>
                    )}
                    <circle r="11" fill={s.color} opacity={selectedStoreId === s.id ? 1 : 0.88} stroke="#fff" strokeWidth="2" />
                    <foreignObject x="-5.5" y="-5.5" width="11" height="11">
                      <Store size={11} color="#fff" strokeWidth={2.6} />
                    </foreignObject>
                  </g>
                </g>
              ))}
            </svg>
          </div>

          <p style={{ fontSize: 11.5, color: "#8A9686", marginTop: 9, marginBottom: 0, display: "flex", alignItems: "center", gap: 5 }}>
            <Navigation size={11} />
            ピンをタップすると、その店舗の価格一覧（{PRODUCTS.length}品目）が表示されます
          </p>
          </div>

          <div className="map-side">
          {selectedStore ? (
            <div style={{ marginTop: 16, background: "#fff", borderRadius: 16, border: "1px solid #D9DED2", overflow: "hidden", boxShadow: "0 1px 3px rgba(32,43,34,0.05)" }}>
              <div style={{ padding: "14px 16px", background: selectedStore.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Store size={16} />
                  <strong style={{ fontSize: 14 }}>{selectedStore.name}</strong>
                </div>
              </div>
              <div style={{ padding: "8px 12px", borderBottom: "1px solid #EEF0E9" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#F6F7F3", borderRadius: 10, padding: "7px 10px" }}>
                  <Search size={13} color="#A5AE9F" />
                  <input
                    value={storeQuery}
                    onChange={(e) => setStoreQuery(e.target.value)}
                    placeholder="この店舗の商品を検索"
                    style={{ border: "none", fontSize: 12.5, flex: 1, background: "transparent" }}
                  />
                </div>
              </div>
              <div style={{ maxHeight: 380, overflowY: "auto" }}>
                {storeProducts.map((p, i) => {
                  const price = p.prices[selectedStore.id];
                  const isCheapest = stats(p).minStoreId === selectedStore.id;
                  const Icon = p.icon;
                  return (
                    <div key={p.id} className="row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderTop: i === 0 ? "none" : "1px solid #EEF0E9" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                        <Icon size={13} color="#8A9686" strokeWidth={2} />
                        {p.name}
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span className="price-num" style={{ fontSize: 13.5, fontWeight: 700 }}>{yen(price)}</span>
                        {isCheapest && (
                          <span style={{ fontSize: 9.5, fontWeight: 700, color: "#B8502F", background: "#FBEAE4", padding: "2px 6px", borderRadius: 999 }}>最安</span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 16, padding: "28px 16px", textAlign: "center", color: "#8A9686", fontSize: 13, background: "#fff", borderRadius: 16, border: "1px dashed #D9DED2" }}>
              <MapPin size={20} color="#C4CDBE" style={{ marginBottom: 6 }} />
              <div>地図上のピンをタップして店舗を選んでください</div>
            </div>
          )}
          </div>
          </div>
        </div>
      )}

      {/* 一覧ビュー */}
      {view === "list" && (
        <div className="view-pad" style={{ padding: 20 }}>
          {/* 値下げ通知バナー */}
          {favorites.size > 0 ? (
            <div
              style={{
                marginBottom: 14,
                borderRadius: 14,
                padding: "12px 14px",
                background: droppedFavorites.length > 0 ? "#FFF6E9" : "#F6F7F3",
                border: `1px solid ${droppedFavorites.length > 0 ? "#F0D9AE" : "#E4E7DE"}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: droppedFavorites.length > 0 ? 8 : 0 }}>
                <Bell size={14} color={droppedFavorites.length > 0 ? "#B8791F" : "#8A9686"} />
                <span style={{ fontSize: 12, fontWeight: 700, color: droppedFavorites.length > 0 ? "#B8791F" : "#8A9686" }}>
                  {droppedFavorites.length > 0
                    ? `お気に入り${droppedFavorites.length}品目が値下がりしています`
                    : `お気に入り${favorites.size}品目・本日の値下がりはありません`}
                </span>
              </div>
              {droppedFavorites.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {droppedFavorites.slice(0, 5).map(({ product, drop }) => (
                    <div key={product.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                      <span>{product.name}</span>
                      <span className="price-num">
                        <span style={{ color: "#A5AE9F", textDecoration: "line-through" }}>{yen(drop.from)}</span>
                        {" → "}
                        <span style={{ color: "#B8502F", fontWeight: 700 }}>{yen(drop.to)}</span>
                      </span>
                    </div>
                  ))}
                  {droppedFavorites.length > 5 && (
                    <div style={{ fontSize: 11, color: "#A5872F" }}>他 {droppedFavorites.length - 5} 品目</div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div style={{ marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11.5, color: "#A5AE9F", display: "flex", alignItems: "center", gap: 5 }}>
                <Star size={12} />
                商品の★をタップしてお気に入り登録すると、値下げ通知が届きます
              </span>
              {/* テスト用: 値下がり中の商品を自動でお気に入り登録するボタン（検証用途のため通常は非表示）
              <button
                onClick={() => {
                  const dropped = PRODUCTS.filter((p) => priceDrop(p).dropped).slice(0, 3).map((p) => p.id);
                  setFavorites(new Set(dropped));
                }}
                style={{
                  fontSize: 11, fontWeight: 700, color: "#B8791F", background: "#FFF6E9",
                  border: "1px solid #F0D9AE", borderRadius: 999, padding: "5px 10px", flexShrink: 0,
                }}
              >
                値下げ通知をテストする
              </button>
              */}
            </div>
          )}

          {/* 検索バー */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid #D9DED2", borderRadius: 12, padding: "9px 12px", marginBottom: 10 }}>
            <Search size={15} color="#A5AE9F" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`商品名・カテゴリで検索（全${PRODUCTS.length}品目）`}
              style={{ border: "none", fontSize: 13.5, flex: 1, background: "transparent", color: "#202B22" }}
            />
          </div>

          {/* カテゴリ別トグルフィルター */}
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 10, marginLeft: -20, marginRight: -20, paddingLeft: 20, paddingRight: 20 }}>
            <CategoryPill active={activeCategory === null} onClick={() => setActiveCategory(null)} label="すべて" count={PRODUCTS.length} />
            {CATEGORY_DEFS.map((c) => {
              const Icon = c.icon;
              return (
                <CategoryPill
                  key={c.name}
                  active={activeCategory === c.name}
                  onClick={() => setActiveCategory(activeCategory === c.name ? null : c.name)}
                  label={c.name}
                  count={categoryCounts[c.name]}
                  icon={<Icon size={12} />}
                />
              );
            })}
          </div>

          {/* 並び替え・お気に入り絞り込み */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12, marginTop: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", border: "1px solid #D9DED2", borderRadius: 10, padding: "6px 10px" }}>
              <ArrowUpDown size={12} color="#7A8578" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{ border: "none", background: "transparent", fontSize: 12, color: "#202B22", fontWeight: 600 }}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => setFavoritesOnly((v) => !v)}
              style={{
                display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 10,
                border: favoritesOnly ? "1px solid #E8A33D" : "1px solid #D9DED2",
                background: favoritesOnly ? "#FFF6E9" : "#fff",
                color: favoritesOnly ? "#B8791F" : "#7A8578",
                fontSize: 12, fontWeight: 700,
              }}
            >
              <Star size={12} fill={favoritesOnly ? "#E8A33D" : "none"} color={favoritesOnly ? "#E8A33D" : "#A5AE9F"} />
              お気に入りのみ（{favorites.size}）
            </button>
          </div>

          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #D9DED2", overflow: "hidden", boxShadow: "0 1px 3px rgba(32,43,34,0.05)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "40px 40px 1.3fr 1fr 1fr 24px", padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "#7A8578", borderBottom: "1px solid #EEF0E9", background: "#FAFBF8" }}>
              <span />
              <span />
              <span>商品</span>
              <span style={{ textAlign: "right" }}>最安値</span>
              <span style={{ textAlign: "right" }}>価格帯</span>
              <span />
            </div>
            {filteredProducts.length === 0 && (
              <div style={{ padding: "24px 16px", textAlign: "center", color: "#A5AE9F", fontSize: 12.5 }}>
                条件に一致する商品はありません
              </div>
            )}
            <div style={{ maxHeight: 640, overflowY: "auto" }}>
              {filteredProducts.map((p, i) => {
                const st = stats(p);
                const minStore = STORES.find((s) => s.id === st.minStoreId);
                const Icon = p.icon;
                const isFav = favorites.has(p.id);
                const inCart = cart.has(p.id);
                const isExpanded = expandedId === p.id;
                const drop = priceDrop(p);
                const uPrice = unitPrice(p, st.minPrice);
                return (
                  <div key={p.id}>
                    <div
                      className="row"
                      onClick={() => setExpandedId(isExpanded ? null : p.id)}
                      style={{ display: "grid", gridTemplateColumns: "40px 40px 1.3fr 1fr 1fr 24px", alignItems: "center", padding: "8px 12px", borderTop: i === 0 ? "none" : "1px solid #F3F5EF", cursor: "pointer" }}
                    >
                      <button
                        className="star-btn"
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(p.id); }}
                        style={{
                          background: isFav ? "#FFF6E9" : "transparent", border: "none", borderRadius: 10,
                          width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "transform 0.15s ease",
                        }}
                        aria-label="お気に入り登録"
                      >
                        <Star size={20} fill={isFav ? "#E8A33D" : "none"} color={isFav ? "#E8A33D" : "#B7C0AE"} strokeWidth={2} />
                      </button>
                      <button
                        className="star-btn"
                        onClick={(e) => { e.stopPropagation(); toggleCart(p.id); }}
                        style={{
                          background: inCart ? "#EAF2EC" : "transparent", border: "none", borderRadius: 10,
                          width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "transform 0.15s ease",
                        }}
                        aria-label="買い物リストに追加"
                      >
                        <ShoppingCart size={19} color={inCart ? "#2F6B4A" : "#B7C0AE"} fill={inCart ? "#DCEBE0" : "none"} strokeWidth={2} />
                      </button>
                      <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 9, background: "#EEF2E9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Icon size={15} color="#5B6B5A" strokeWidth={2} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14.5, fontWeight: 500, display: "flex", alignItems: "center", gap: 5 }}>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                            {drop.dropped && (
                              <span style={{ fontSize: 9, fontWeight: 700, color: "#B8502F", background: "#FBEAE4", padding: "1px 6px", borderRadius: 999, flexShrink: 0 }}>
                                値下げ
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 10, color: "#A5AE9F" }}>{p.cat}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div className="price-num" style={{ fontSize: 15, fontWeight: 700, color: "#B8502F" }}>{yen(st.minPrice)}</div>
                        <div style={{ fontSize: 10, color: "#A5AE9F", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {minStore.short}
                          {uPrice !== null && <span style={{ marginLeft: 4 }}>・目安{yen(uPrice)}/100g</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div className="price-num" style={{ fontSize: 11, color: "#7A8578" }}>{yen(st.minPrice)}〜{yen(st.maxPrice)}</div>
                      </div>
                      <ChevronDown size={16} color="#A5AE9F" className="chev" style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0)", justifySelf: "end" }} />
                    </div>

                    {isExpanded && (
                      <div style={{ padding: "4px 16px 16px", background: "#FAFBF8", borderTop: "1px solid #F3F5EF" }}>
                        <div style={{ fontSize: 10.5, color: "#7A8578", fontWeight: 700, margin: "8px 0 4px" }}>
                          過去{HISTORY_DAYS}日間の価格推移（{STORES.length}店舗中の最安値・平均）
                        </div>
                        <ResponsiveContainer width="100%" height={140}>
                          <LineChart data={chartData(p)} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                            <CartesianGrid stroke="#EAEDE5" vertical={false} />
                            <XAxis dataKey="label" tick={{ fontSize: 9.5, fill: "#A5AE9F" }} interval={2} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 9.5, fill: "#A5AE9F" }} axisLine={false} tickLine={false} width={44} />
                            <Tooltip
                              contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #D9DED2" }}
                              formatter={(value) => yen(value)}
                            />
                            <Line type="monotone" dataKey="平均" stroke="#A5AE9F" strokeWidth={1.5} dot={false} />
                            <Line type="monotone" dataKey="最安値" stroke="#B8502F" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 合計比較 */}
          <div style={{ marginTop: 16, background: "#202B22", color: "#F1F4EE", borderRadius: 16, padding: "16px 18px" }}>
            <div style={{ fontSize: 11, opacity: 0.65, marginBottom: 10, fontWeight: 700, letterSpacing: "0.04em" }}>
              全{PRODUCTS.length}品目 合計金額シミュレーション（{STORES.length}店舗中）
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
              <span style={{ opacity: 0.85 }}>{STORES.length}店舗の平均で揃えた場合</span>
              <span className="price-num" style={{ fontWeight: 700 }}>{yen(AVG_STORE_TOTAL)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14, fontWeight: 700, borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: 10, marginTop: 8 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#E8A33D" }}>
                <ArrowDownRight size={16} />
                品目ごとに最安値を選んだ場合
              </span>
              <span className="price-num" style={{ color: "#E8A33D" }}>{yen(CHEAPEST_TOTAL)}</span>
            </div>
          </div>
        </div>
      )}

      {/* 買い物リスト比較ビュー（メイン機能） */}
      {view === "cart" && (
        <div className="view-pad" style={{ padding: 20 }}>
          <div className="cart-layout">
            <div>
              {/* 商品を検索して直接追加 */}
              <div style={{ background: "#fff", border: "1px solid #D9DED2", borderRadius: 14, padding: "9px 12px", marginBottom: cartSearchResults.length ? 0 : 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Search size={15} color="#A5AE9F" />
                  <input
                    value={cartSearch}
                    onChange={(e) => setCartSearch(e.target.value)}
                    placeholder="商品名で検索してリストに追加"
                    style={{ border: "none", fontSize: 13.5, flex: 1, background: "transparent", color: "#202B22" }}
                  />
                </div>
              </div>
              {cartSearchResults.length > 0 && (
                <div style={{ background: "#fff", border: "1px solid #D9DED2", borderTop: "none", borderRadius: "0 0 14px 14px", overflow: "hidden", marginBottom: 14 }}>
                  {cartSearchResults.map((p) => {
                    const Icon = p.icon;
                    const inCart = cart.has(p.id);
                    const st = stats(p);
                    return (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", borderTop: "1px solid #F3F5EF" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                          <Icon size={13} color="#8A9686" strokeWidth={2} />
                          {p.name}
                          <span className="price-num" style={{ fontSize: 11, color: "#A5AE9F" }}>目安{yen(st.minPrice)}</span>
                        </span>
                        <button
                          onClick={() => toggleCart(p.id)}
                          style={{
                            display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700,
                            border: "none", borderRadius: 999, padding: "5px 10px",
                            background: inCart ? "#EAF2EC" : "#2F6B4A",
                            color: inCart ? "#2F6B4A" : "#fff",
                          }}
                        >
                          {inCart ? <Check size={12} /> : <ShoppingCart size={12} />}
                          {inCart ? "追加済み" : "追加"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {cartProducts.length === 0 ? (
                <div style={{ padding: "28px 16px", textAlign: "center", color: "#8A9686", fontSize: 13, background: "#fff", borderRadius: 16, border: "1px dashed #D9DED2" }}>
                  <ShoppingCart size={20} color="#C4CDBE" style={{ marginBottom: 6 }} />
                  <div>上の検索欄から商品を追加すると、一番安い店をすぐ診断します</div>
                </div>
              ) : (
                <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #D9DED2", overflow: "hidden", boxShadow: "0 1px 3px rgba(32,43,34,0.05)" }}>
                  <div style={{ padding: "10px 16px", fontSize: 11, fontWeight: 700, color: "#7A8578", borderBottom: "1px solid #EEF0E9", background: "#FAFBF8" }}>
                    リストの中身（{cartProducts.length}品目）
                  </div>
                  {cartProducts.map((p, i) => {
                    const Icon = p.icon;
                    return (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 16px", borderTop: i === 0 ? "none" : "1px solid #F3F5EF" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                          <Icon size={13} color="#8A9686" strokeWidth={2} />
                          {p.name}
                        </span>
                        <button
                          onClick={() => toggleCart(p.id)}
                          style={{ background: "none", border: "none", padding: 4, display: "flex", color: "#A5AE9F" }}
                          aria-label="リストから削除"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {cartProducts.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#5B6B5A", marginBottom: 8 }}>
                  このリストなら、どの店舗が一番安いか
                </div>
                <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #D9DED2", overflow: "hidden", boxShadow: "0 1px 3px rgba(32,43,34,0.05)" }}>
                  {cartStoreTotals.map((s, i) => {
                    const diff = s.total - cartStoreTotals[0].total;
                    return (
                      <div
                        key={s.id}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "12px 16px", borderTop: i === 0 ? "none" : "1px solid #F3F5EF",
                          background: i === 0 ? "#FFF6E9" : "transparent",
                        }}
                      >
                        <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <span
                            style={{
                              width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              background: i === 0 ? "#E8A33D" : "#EEF0E9",
                              color: i === 0 ? "#fff" : "#7A8578",
                              fontSize: 10.5, fontWeight: 700,
                            }}
                          >
                            {i === 0 ? <Crown size={12} /> : i + 1}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: i === 0 ? 700 : 500 }}>{s.name}</span>
                        </span>
                        <span style={{ textAlign: "right" }}>
                          <div className="price-num" style={{ fontSize: 14, fontWeight: 700, color: i === 0 ? "#B8791F" : "#202B22" }}>
                            {yen(s.total)}
                          </div>
                          {i > 0 && <div className="price-num" style={{ fontSize: 10, color: "#B8502F" }}>+{yen(diff)}</div>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ textAlign: "center", padding: "4px 20px 24px", fontSize: 10.5, color: "#A5AE9F" }}>
        店舗名・商品名・価格・価格推移はすべてダミーデータです
      </div>
      </div>
    </div>
  );
}

function ViewTab({ active, onClick, icon, label, badge }) {
  return (
    <button
      className="tab-btn"
      onClick={onClick}
      style={{
        position: "relative",
        display: "flex", alignItems: "center", gap: 6, padding: "9px 15px", borderRadius: 999,
        border: active ? "1px solid #2F6B4A" : "1px solid #D9DED2",
        background: active ? "#2F6B4A" : "#fff",
        color: active ? "#fff" : "#5B6B5A",
        fontSize: 13, fontWeight: 700, transition: "all 0.15s ease",
      }}
    >
      {icon}
      {label}
      {badge && (
        <span
          style={{
            fontSize: 8.5, fontWeight: 900, color: "#fff", background: "#E8A33D",
            padding: "1px 5px", borderRadius: 999, position: "absolute", top: -6, right: -6,
            boxShadow: "0 1px 3px rgba(232,163,61,0.5)",
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function CategoryPill({ active, onClick, label, count, icon }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 999,
        border: active ? "1px solid #2F6B4A" : "1px solid #D9DED2",
        background: active ? "#2F6B4A" : "#fff",
        color: active ? "#fff" : "#5B6B5A",
        fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0,
        transition: "all 0.15s ease",
      }}
    >
      {icon}
      {label}
      <span style={{ fontSize: 10, opacity: active ? 0.85 : 0.55, fontFamily: "'JetBrains Mono', monospace" }}>
        {count}
      </span>
    </button>
  );
}
