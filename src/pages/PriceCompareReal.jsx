import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Store, ShoppingCart, List, MapPin, X, Crown, Bookmark, Trash2 } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { BUILTIN_PRESETS, loadCustomPresets, saveCustomPreset, deleteCustomPreset } from "../lib/presets.js";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const SUPABASE_URL = "http://192.168.11.114:8000";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg1MDcyNzAyLCJleHAiOjE5NDI3NTI3MDJ9.Td8X4Gbl2mkslj0Kspaznme5RuNK8sqJawZGZrAavS8";

async function supabaseGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`fetch failed: ${path} (${res.status})`);
  return res.json();
}

function yen(n) {
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

const SORT_OPTIONS = [
  { id: "priceAsc", label: "最安値が安い順" },
  { id: "priceDesc", label: "最安値が高い順" },
  { id: "name", label: "商品名順" },
];

export default function PriceCompareReal() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stores, setStores] = useState([]);
  const [products, setProducts] = useState([]); // { id, name, janCode, category, prices: [{storeId, storeName, price}] }
  const [view, setView] = useState("cart"); // "cart" | "list" | "map"
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("priceAsc");
  const [activeCategory, setActiveCategory] = useState(null);
  const [cart, setCart] = useState(() => new Set());
  const [cartSearch, setCartSearch] = useState("");
  const [customPresets, setCustomPresets] = useState(() => loadCustomPresets());

  useEffect(() => {
    (async () => {
      try {
        const [storesData, productsData, priceHistoryData] = await Promise.all([
          supabaseGet("stores?select=id,name,lat,lng&is_active=eq.true"),
          supabaseGet("products?select=id,name,jan_code,category"),
          supabaseGet("price_history?select=store_id,product_id,price,scraped_at&order=scraped_at.desc"),
        ]);

        const storeNameById = new Map(storesData.map((s) => [s.id, s.name]));

        // scraped_atの降順で取得済みなので、(store_id, product_id)ごとに最初に出てきたものが最新価格
        const latestKey = new Set();
        const priceByProduct = new Map();
        for (const ph of priceHistoryData) {
          const key = `${ph.store_id}:${ph.product_id}`;
          if (latestKey.has(key)) continue;
          latestKey.add(key);
          if (!priceByProduct.has(ph.product_id)) priceByProduct.set(ph.product_id, []);
          priceByProduct.get(ph.product_id).push({
            storeId: ph.store_id,
            storeName: storeNameById.get(ph.store_id) ?? "不明な店舗",
            price: ph.price,
          });
        }

        const merged = productsData
          .map((p) => ({
            id: p.id,
            name: p.name,
            janCode: p.jan_code,
            category: p.category,
            prices: (priceByProduct.get(p.id) ?? []).sort((a, b) => a.price - b.price),
          }))
          .filter((p) => p.prices.length > 0);

        setStores(storesData);
        setProducts(merged);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, "ja"));
  }, [products]);

  const filteredProducts = useMemo(() => {
    let list = products.filter(
      (p) => p.name.includes(query) && (activeCategory === null || p.category === activeCategory)
    );
    list = [...list].sort((a, b) => {
      const aMin = a.prices[0]?.price ?? Infinity;
      const bMin = b.prices[0]?.price ?? Infinity;
      if (sortBy === "priceAsc") return aMin - bMin;
      if (sortBy === "priceDesc") return bMin - aMin;
      if (sortBy === "name") return a.name.localeCompare(b.name, "ja");
      return 0;
    });
    return list;
  }, [products, query, activeCategory, sortBy]);

  const toggleCart = (id) => {
    setCart((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const cartProducts = useMemo(() => products.filter((p) => cart.has(p.id)), [products, cart]);

  const builtinPresets = useMemo(() => {
    return BUILTIN_PRESETS.map((preset) => {
      const matched = preset.keywords
        .map((kw) => products.find((p) => p.name.includes(kw)))
        .filter(Boolean);
      return { ...preset, productIds: matched.map((p) => p.id) };
    }).filter((preset) => preset.productIds.length > 0);
  }, [products]);

  const applyPresetIds = (ids) => {
    setCart((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const applyCustomPreset = (preset) => {
    const ids = products.filter((p) => preset.janCodes.includes(p.janCode)).map((p) => p.id);
    applyPresetIds(ids);
  };

  const handleSaveCurrentAsPreset = (name) => {
    const janCodes = cartProducts.map((p) => p.janCode);
    setCustomPresets(saveCustomPreset(name, janCodes));
  };

  const handleDeleteCustomPreset = (id) => {
    setCustomPresets(deleteCustomPreset(id));
  };

  const cartSearchResults = useMemo(() => {
    if (!cartSearch.trim()) return [];
    return products.filter((p) => p.name.includes(cartSearch) && !cart.has(p.id)).slice(0, 8);
  }, [products, cartSearch, cart]);

  const cartStoreTotals = useMemo(() => {
    if (cartProducts.length === 0) return [];
    return stores
      .map((s) => {
        let total = 0;
        let foundCount = 0;
        for (const p of cartProducts) {
          const priceAtStore = p.prices.find((pr) => pr.storeId === s.id);
          if (priceAtStore) {
            total += priceAtStore.price;
            foundCount += 1;
          }
        }
        return { ...s, total, foundCount };
      })
      .filter((s) => s.foundCount > 0)
      .sort((a, b) => a.total - b.total);
  }, [stores, cartProducts]);

  return (
    <div
      style={{
        fontFamily: "'Zen Kaku Gothic New', 'Hiragino Sans', sans-serif",
        background: "#F1F4EE",
        minHeight: "100vh",
        color: "#202B22",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700;900&family=JetBrains+Mono:wght@400;600;700&display=swap');
        * { box-sizing: border-box; }
        .price-num { font-family: 'JetBrains Mono', monospace; }
        button, select { font-family: inherit; cursor: pointer; }
        input:focus, select:focus { outline: none; }
        .tab-btn:hover { border-color: #2F6B4A; }
        .cat-btn:hover { border-color: #2F6B4A; }
      `}</style>

      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ padding: "22px 20px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: 8,
                background: "#2F6B4A",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Store size={15} color="#fff" />
            </div>
            <span style={{ fontWeight: 700, fontSize: 15 }}>近くのスーパー、最安値くらべ</span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "#5A6357" }}>
            実データ版（{stores.map((s) => s.name).join("・") || "店舗データなし"}）
          </p>
        </div>

        <div style={{ padding: "0 20px 20px" }}>
          {loading && <p>読み込み中...</p>}
          {error && <p style={{ color: "#B8502F" }}>データの取得に失敗しました: {error}</p>}

          {!loading && !error && (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <TabButton active={view === "cart"} onClick={() => setView("cart")} icon={<ShoppingCart size={14} />} label="買い物リスト比較" />
                <TabButton active={view === "list"} onClick={() => setView("list")} icon={<List size={14} />} label="最安値一覧" />
                <TabButton active={view === "map"} onClick={() => setView("map")} icon={<MapPin size={14} />} label="地図ビュー" />
              </div>

              {view === "cart" && (
                <CartView
                  cartProducts={cartProducts}
                  cartSearch={cartSearch}
                  setCartSearch={setCartSearch}
                  cartSearchResults={cartSearchResults}
                  toggleCart={toggleCart}
                  cartStoreTotals={cartStoreTotals}
                  builtinPresets={builtinPresets}
                  customPresets={customPresets}
                  onApplyPresetIds={applyPresetIds}
                  onApplyCustomPreset={applyCustomPreset}
                  onSavePreset={handleSaveCurrentAsPreset}
                  onDeletePreset={handleDeleteCustomPreset}
                />
              )}

              {view === "list" && (
                <ListView
                  query={query}
                  setQuery={setQuery}
                  sortBy={sortBy}
                  setSortBy={setSortBy}
                  categories={categories}
                  activeCategory={activeCategory}
                  setActiveCategory={setActiveCategory}
                  filteredProducts={filteredProducts}
                  cart={cart}
                  toggleCart={toggleCart}
                />
              )}

              {view === "map" && <MapView stores={stores} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }) {
  return (
    <button
      type="button"
      className="tab-btn"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 14px",
        borderRadius: 999,
        border: active ? "1px solid #2F6B4A" : "1px solid #D9DED2",
        background: active ? "#2F6B4A" : "#fff",
        color: active ? "#fff" : "#202B22",
        fontSize: 13,
      }}
    >
      {icon} {label}
    </button>
  );
}

function MapView({ stores }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    const withCoords = stores.filter((s) => s.lat != null && s.lng != null);
    if (!containerRef.current || withCoords.length === 0) return;

    if (!mapRef.current) {
      mapRef.current = L.map(containerRef.current);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(mapRef.current);
    }

    const map = mapRef.current;
    const markers = withCoords.map((s) => L.marker([s.lat, s.lng]).addTo(map).bindPopup(s.name));
    const bounds = L.latLngBounds(withCoords.map((s) => [s.lat, s.lng]));
    map.fitBounds(bounds.pad(0.3));

    return () => {
      markers.forEach((m) => map.removeLayer(m));
    };
  }, [stores]);

  const withCoords = stores.filter((s) => s.lat != null && s.lng != null);

  return (
    <div style={{ background: "#fff", border: "1px solid #D9DED2", borderRadius: 14, overflow: "hidden" }}>
      {withCoords.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "#8A9285", fontSize: 13 }}>
          座標データのある店舗がありません
        </div>
      ) : (
        <div ref={containerRef} style={{ height: 420, width: "100%" }} />
      )}
    </div>
  );
}

function CartView({
  cartProducts,
  cartSearch,
  setCartSearch,
  cartSearchResults,
  toggleCart,
  cartStoreTotals,
  builtinPresets,
  customPresets,
  onApplyPresetIds,
  onApplyCustomPreset,
  onSavePreset,
  onDeletePreset,
}) {
  const [presetNameInput, setPresetNameInput] = useState("");
  const [showSaveForm, setShowSaveForm] = useState(false);

  return (
    <>
      {(builtinPresets.length > 0 || customPresets.length > 0) && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 11, color: "#8A9285", margin: "0 0 6px" }}>プリセットから追加</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {builtinPresets.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => onApplyPresetIds(preset.productIds)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "5px 12px",
                  borderRadius: 999,
                  border: "1px solid #D9DED2",
                  background: "#fff",
                  fontSize: 12,
                }}
              >
                <Bookmark size={12} /> {preset.name}
              </button>
            ))}
            {customPresets.map((preset) => (
              <span
                key={preset.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "5px 6px 5px 12px",
                  borderRadius: 999,
                  border: "1px solid #2F6B4A",
                  background: "#fff",
                  fontSize: 12,
                }}
              >
                <button
                  type="button"
                  onClick={() => onApplyCustomPreset(preset)}
                  style={{ border: "none", background: "transparent", padding: 0, color: "#2F6B4A" }}
                >
                  {preset.name}
                </button>
                <button
                  type="button"
                  onClick={() => onDeletePreset(preset.id)}
                  style={{ border: "none", background: "transparent", padding: 2, color: "#8A9285" }}
                  aria-label="プリセットを削除"
                >
                  <Trash2 size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div
        style={{
          position: "relative",
          marginBottom: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "#fff",
            border: "1px solid #D9DED2",
            borderRadius: 10,
            padding: "8px 12px",
          }}
        >
          <Search size={16} color="#8A9285" />
          <input
            value={cartSearch}
            onChange={(e) => setCartSearch(e.target.value)}
            placeholder="商品名で検索してリストに追加"
            style={{ border: "none", flex: 1, fontSize: 14, background: "transparent" }}
          />
        </div>
        {cartSearchResults.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              right: 0,
              background: "#fff",
              border: "1px solid #D9DED2",
              borderRadius: 10,
              overflow: "hidden",
              zIndex: 10,
            }}
          >
            {cartSearchResults.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  toggleCart(p.id);
                  setCartSearch("");
                }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  border: "none",
                  background: "#fff",
                  fontSize: 13,
                  borderTop: "1px solid #EEF0E9",
                }}
              >
                {p.name}
                <span style={{ color: "#8A9285", marginLeft: 8 }}>最安 {yen(p.prices[0].price)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {cartProducts.length === 0 ? (
        <div
          style={{
            background: "#fff",
            border: "1px solid #D9DED2",
            borderRadius: 14,
            padding: "32px 16px",
            textAlign: "center",
            color: "#8A9285",
            fontSize: 13,
          }}
        >
          上の検索欄から商品を追加すると、一番安い店をすぐ診断します
        </div>
      ) : (
        <>
          <div style={{ background: "#fff", border: "1px solid #D9DED2", borderRadius: 14, overflow: "hidden", marginBottom: 12 }}>
            {cartProducts.map((p, i) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 14px",
                  borderTop: i === 0 ? "none" : "1px solid #EEF0E9",
                }}
              >
                <span style={{ fontSize: 13 }}>{p.name}</span>
                <button
                  type="button"
                  onClick={() => toggleCart(p.id)}
                  style={{ border: "none", background: "transparent", color: "#8A9285" }}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>

          {showSaveForm ? (
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              <input
                value={presetNameInput}
                onChange={(e) => setPresetNameInput(e.target.value)}
                placeholder="プリセット名（例: いつもの買い物）"
                style={{
                  flex: 1,
                  border: "1px solid #D9DED2",
                  borderRadius: 10,
                  padding: "8px 12px",
                  fontSize: 13,
                }}
              />
              <button
                type="button"
                onClick={() => {
                  if (!presetNameInput.trim()) return;
                  onSavePreset(presetNameInput.trim());
                  setPresetNameInput("");
                  setShowSaveForm(false);
                }}
                style={{
                  border: "1px solid #2F6B4A",
                  borderRadius: 10,
                  padding: "0 14px",
                  background: "#2F6B4A",
                  color: "#fff",
                  fontSize: 13,
                }}
              >
                保存
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowSaveForm(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                border: "1px solid #D9DED2",
                borderRadius: 10,
                padding: "8px 12px",
                background: "#fff",
                fontSize: 13,
                marginBottom: 12,
              }}
            >
              <Bookmark size={14} /> このリストをプリセット保存
            </button>
          )}

          <div style={{ background: "#202B22", borderRadius: 16, overflow: "hidden" }}>
            {cartStoreTotals.map((s, i) => (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "14px 16px",
                  borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.1)",
                  color: "#fff",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {i === 0 && <Crown size={16} color="#E8A33D" />}
                  <div>
                    <div style={{ fontSize: 13 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: "#A9B3A3" }}>{s.foundCount}/{cartProducts.length}品目が対象</div>
                  </div>
                </div>
                <div className="price-num" style={{ fontSize: 18, fontWeight: 700 }}>
                  {yen(s.total)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function ListView({
  query,
  setQuery,
  sortBy,
  setSortBy,
  categories,
  activeCategory,
  setActiveCategory,
  filteredProducts,
  cart,
  toggleCart,
}) {
  return (
    <>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "#fff",
            border: "1px solid #D9DED2",
            borderRadius: 10,
            padding: "8px 12px",
          }}
        >
          <Search size={16} color="#8A9285" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="商品名で検索"
            style={{ border: "none", flex: 1, fontSize: 14, background: "transparent" }}
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          style={{
            border: "1px solid #D9DED2",
            borderRadius: 10,
            padding: "0 10px",
            fontSize: 13,
            background: "#fff",
          }}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        <button
          type="button"
          className="cat-btn"
          onClick={() => setActiveCategory(null)}
          style={{
            padding: "5px 12px",
            borderRadius: 999,
            border: activeCategory === null ? "1px solid #2F6B4A" : "1px solid #D9DED2",
            background: activeCategory === null ? "#2F6B4A" : "#fff",
            color: activeCategory === null ? "#fff" : "#202B22",
            fontSize: 12,
          }}
        >
          すべて
        </button>
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            className="cat-btn"
            onClick={() => setActiveCategory(c)}
            style={{
              padding: "5px 12px",
              borderRadius: 999,
              border: activeCategory === c ? "1px solid #2F6B4A" : "1px solid #D9DED2",
              background: activeCategory === c ? "#2F6B4A" : "#fff",
              color: activeCategory === c ? "#fff" : "#202B22",
              fontSize: 12,
            }}
          >
            {c}
          </button>
        ))}
      </div>

      <p style={{ fontSize: 12, color: "#8A9285", margin: "0 0 8px" }}>{filteredProducts.length}件表示</p>

      <div style={{ background: "#fff", border: "1px solid #D9DED2", borderRadius: 14, overflow: "hidden" }}>
        {filteredProducts.map((p, i) => {
          const cheapest = p.prices[0];
          const others = p.prices.slice(1);
          return (
            <div
              key={p.id}
              style={{
                padding: "12px 16px",
                borderTop: i === 0 ? "none" : "1px solid #EEF0E9",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: "#8A9285" }}>
                    最安: {cheapest.storeName}
                    {others.length > 0 && (
                      <span> ・ 他{others.map((o) => `${o.storeName} ${yen(o.price)}`).join("、")}</span>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div className="price-num" style={{ fontSize: 16, fontWeight: 700 }}>
                    {yen(cheapest.price)}
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleCart(p.id)}
                    style={{
                      border: "1px solid #2F6B4A",
                      borderRadius: 8,
                      padding: "4px 8px",
                      background: cart.has(p.id) ? "#2F6B4A" : "#fff",
                      color: cart.has(p.id) ? "#fff" : "#2F6B4A",
                      fontSize: 11,
                    }}
                  >
                    {cart.has(p.id) ? "追加済み" : "追加"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {filteredProducts.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: "#8A9285", fontSize: 13 }}>
            該当する商品がありません
          </div>
        )}
      </div>
    </>
  );
}
