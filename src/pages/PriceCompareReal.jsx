import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Store, ShoppingCart, List, MapPin, X, Crown, Bookmark, Trash2, ChevronDown, ChevronRight } from "lucide-react";
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
  { id: "name", label: "名前順" },
];

// カート項目のキー種別: "g:<genericName>"（物の名前・最安自動選択） / "p:<productId>"（特定商品指定）
const genericKey = (genericName) => `g:${genericName}`;
const productKey = (id) => `p:${id}`;

export default function PriceCompareReal() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stores, setStores] = useState([]);
  const [products, setProducts] = useState([]); // { id, name, janCode, category, genericName, prices: [{storeId, storeName, price}] }
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
          supabaseGet("products?select=id,name,jan_code,category,generic_name"),
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
            genericName: p.generic_name || p.name,
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

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, "ja"));
  }, [products]);

  // 「物の名前」（generic_name）単位でグルーピング。例: 牛乳 → [おはよー牛乳, 森永牧場の大地, ...]
  const genericItems = useMemo(() => {
    const groups = new Map();
    for (const p of products) {
      if (!groups.has(p.genericName)) groups.set(p.genericName, []);
      groups.get(p.genericName).push(p);
    }
    return [...groups.entries()].map(([genericName, items]) => {
      const sortedItems = [...items].sort((a, b) => a.prices[0].price - b.prices[0].price);
      const cheapestProduct = sortedItems[0];
      return {
        genericName,
        category: cheapestProduct.category,
        products: sortedItems,
        cheapestPrice: cheapestProduct.prices[0].price,
        cheapestStoreName: cheapestProduct.prices[0].storeName,
        cheapestProductName: cheapestProduct.name,
      };
    });
  }, [products]);

  const genericItemByName = useMemo(() => new Map(genericItems.map((g) => [g.genericName, g])), [genericItems]);

  const filteredGenericItems = useMemo(() => {
    let list = genericItems.filter(
      (g) =>
        (g.genericName.includes(query) || g.products.some((p) => p.name.includes(query))) &&
        (activeCategory === null || g.category === activeCategory)
    );
    list = [...list].sort((a, b) => {
      if (sortBy === "priceAsc") return a.cheapestPrice - b.cheapestPrice;
      if (sortBy === "priceDesc") return b.cheapestPrice - a.cheapestPrice;
      if (sortBy === "name") return a.genericName.localeCompare(b.genericName, "ja");
      return 0;
    });
    return list;
  }, [genericItems, query, activeCategory, sortBy]);

  const toggleCartKey = (key) => {
    setCart((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // カート内の各エントリを解決: 「物の名前」指定なら店舗ごとに最安の商品を都度選ぶ、特定商品指定ならその商品固定
  const cartEntries = useMemo(() => {
    return [...cart]
      .map((key) => {
        if (key.startsWith("g:")) {
          const genericName = key.slice(2);
          const group = genericItemByName.get(genericName);
          if (!group) return null;
          return {
            key,
            label: `${genericName}（最安: ${group.cheapestProductName}）`,
            priceAtStore: (storeId) => {
              const prices = group.products
                .map((p) => p.prices.find((pr) => pr.storeId === storeId))
                .filter(Boolean);
              if (prices.length === 0) return null;
              return Math.min(...prices.map((pr) => pr.price));
            },
            representativePrice: group.cheapestPrice,
          };
        }
        if (key.startsWith("p:")) {
          const id = key.slice(2);
          const product = productById.get(id);
          if (!product) return null;
          return {
            key,
            label: product.name,
            priceAtStore: (storeId) => product.prices.find((pr) => pr.storeId === storeId)?.price ?? null,
            representativePrice: product.prices[0].price,
          };
        }
        return null;
      })
      .filter(Boolean);
  }, [cart, genericItemByName, productById]);

  const builtinPresets = useMemo(() => {
    return BUILTIN_PRESETS.map((preset) => {
      const matched = preset.keywords
        .map((kw) => genericItems.find((g) => g.genericName.includes(kw)) || products.find((p) => p.name.includes(kw)))
        .filter(Boolean);
      return {
        ...preset,
        keys: matched.map((m) => (m.genericName !== undefined && m.products ? genericKey(m.genericName) : productKey(m.id))),
      };
    }).filter((preset) => preset.keys.length > 0);
  }, [genericItems, products]);

  const applyKeys = (keys) => {
    setCart((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => next.add(k));
      return next;
    });
  };

  const applyCustomPreset = (preset) => {
    const ids = products.filter((p) => preset.janCodes.includes(p.janCode)).map((p) => productKey(p.id));
    applyKeys(ids);
  };

  const handleSaveCurrentAsPreset = (name) => {
    // 「物の名前」指定分は代表商品(最安)のJANコードを保存する
    const janCodes = cartEntries
      .map((entry) => {
        if (entry.key.startsWith("p:")) return productById.get(entry.key.slice(2))?.janCode;
        const genericName = entry.key.slice(2);
        return genericItemByName.get(genericName)?.products[0]?.janCode;
      })
      .filter(Boolean);
    setCustomPresets(saveCustomPreset(name, janCodes));
  };

  const handleDeleteCustomPreset = (id) => {
    setCustomPresets(deleteCustomPreset(id));
  };

  const cartKeys = useMemo(() => new Set(cartEntries.map((e) => e.key)), [cartEntries]);

  const cartSearchResults = useMemo(() => {
    if (!cartSearch.trim()) return [];
    return genericItems
      .filter((g) => g.genericName.includes(cartSearch) && !cartKeys.has(genericKey(g.genericName)))
      .slice(0, 8);
  }, [genericItems, cartSearch, cartKeys]);

  const cartStoreTotals = useMemo(() => {
    if (cartEntries.length === 0) return [];
    return stores
      .map((s) => {
        let total = 0;
        let foundCount = 0;
        for (const entry of cartEntries) {
          const price = entry.priceAtStore(s.id);
          if (price != null) {
            total += price;
            foundCount += 1;
          }
        }
        return { ...s, total, foundCount };
      })
      .filter((s) => s.foundCount > 0)
      .sort((a, b) => a.total - b.total);
  }, [stores, cartEntries]);

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
                  cartEntries={cartEntries}
                  cartSearch={cartSearch}
                  setCartSearch={setCartSearch}
                  cartSearchResults={cartSearchResults}
                  onAddGeneric={(genericName) => {
                    toggleCartKey(genericKey(genericName));
                    setCartSearch("");
                  }}
                  onRemoveEntry={(key) => toggleCartKey(key)}
                  cartStoreTotals={cartStoreTotals}
                  builtinPresets={builtinPresets}
                  customPresets={customPresets}
                  onApplyPresetKeys={applyKeys}
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
                  filteredGenericItems={filteredGenericItems}
                  cartKeys={cartKeys}
                  onToggleGeneric={(genericName) => toggleCartKey(genericKey(genericName))}
                  onToggleProduct={(id) => toggleCartKey(productKey(id))}
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
  cartEntries,
  cartSearch,
  setCartSearch,
  cartSearchResults,
  onAddGeneric,
  onRemoveEntry,
  cartStoreTotals,
  builtinPresets,
  customPresets,
  onApplyPresetKeys,
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
                onClick={() => onApplyPresetKeys(preset.keys)}
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
            placeholder="物の名前で検索してリストに追加（例: 牛乳）"
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
            {cartSearchResults.map((g) => (
              <button
                key={g.genericName}
                type="button"
                onClick={() => onAddGeneric(g.genericName)}
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
                {g.genericName}
                <span style={{ color: "#8A9285", marginLeft: 8 }}>
                  最安 {yen(g.cheapestPrice)}（{g.cheapestProductName}）
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {cartEntries.length === 0 ? (
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
          上の検索欄から物の名前を追加すると、一番安い店をすぐ診断します
        </div>
      ) : (
        <>
          <div style={{ background: "#fff", border: "1px solid #D9DED2", borderRadius: 14, overflow: "hidden", marginBottom: 12 }}>
            {cartEntries.map((entry, i) => (
              <div
                key={entry.key}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 14px",
                  borderTop: i === 0 ? "none" : "1px solid #EEF0E9",
                }}
              >
                <span style={{ fontSize: 13 }}>{entry.label}</span>
                <button
                  type="button"
                  onClick={() => onRemoveEntry(entry.key)}
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
                    <div style={{ fontSize: 11, color: "#A9B3A3" }}>{s.foundCount}/{cartEntries.length}品目が対象</div>
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
  filteredGenericItems,
  cartKeys,
  onToggleGeneric,
  onToggleProduct,
}) {
  const [expanded, setExpanded] = useState(() => new Set());

  const toggleExpanded = (genericName) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(genericName)) next.delete(genericName);
      else next.add(genericName);
      return next;
    });
  };

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
            placeholder="物の名前・商品名で検索"
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

      <p style={{ fontSize: 12, color: "#8A9285", margin: "0 0 8px" }}>{filteredGenericItems.length}件表示</p>

      <div style={{ background: "#fff", border: "1px solid #D9DED2", borderRadius: 14, overflow: "hidden" }}>
        {filteredGenericItems.map((g, i) => {
          const isOpen = expanded.has(g.genericName);
          const isInCart = cartKeys.has(genericKey(g.genericName));
          return (
            <div key={g.genericName} style={{ borderTop: i === 0 ? "none" : "1px solid #EEF0E9" }}>
              <div
                style={{
                  padding: "12px 16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <button
                  type="button"
                  onClick={() => toggleExpanded(g.genericName)}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 6,
                    border: "none",
                    background: "transparent",
                    textAlign: "left",
                    padding: 0,
                  }}
                >
                  {isOpen ? (
                    <ChevronDown size={16} color="#8A9285" style={{ marginTop: 2, flexShrink: 0 }} />
                  ) : (
                    <ChevronRight size={16} color="#8A9285" style={{ marginTop: 2, flexShrink: 0 }} />
                  )}
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{g.genericName}</div>
                    <div style={{ fontSize: 11, color: "#8A9285" }}>
                      最安: {g.cheapestProductName}（{g.cheapestStoreName}） ・ 他{g.products.length - 1}商品
                    </div>
                  </div>
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div className="price-num" style={{ fontSize: 16, fontWeight: 700 }}>
                    {yen(g.cheapestPrice)}
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleGeneric(g.genericName)}
                    style={{
                      border: "1px solid #2F6B4A",
                      borderRadius: 8,
                      padding: "4px 8px",
                      background: isInCart ? "#2F6B4A" : "#fff",
                      color: isInCart ? "#fff" : "#2F6B4A",
                      fontSize: 11,
                    }}
                  >
                    {isInCart ? "追加済み" : "追加"}
                  </button>
                </div>
              </div>

              {isOpen && (
                <div style={{ background: "#F7F9F5", padding: "4px 16px 10px 34px" }}>
                  {g.products.map((p) => {
                    const cheapest = p.prices[0];
                    const others = p.prices.slice(1);
                    const productInCart = cartKeys.has(productKey(p.id));
                    return (
                      <div
                        key={p.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "8px 0",
                          borderTop: "1px solid #E4E9DE",
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 13 }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: "#8A9285" }}>
                            {cheapest.storeName} {yen(cheapest.price)}
                            {others.length > 0 && (
                              <span> ・ 他{others.map((o) => `${o.storeName} ${yen(o.price)}`).join("、")}</span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onToggleProduct(p.id)}
                          style={{
                            border: "1px solid #2F6B4A",
                            borderRadius: 8,
                            padding: "3px 8px",
                            background: productInCart ? "#2F6B4A" : "#fff",
                            color: productInCart ? "#fff" : "#2F6B4A",
                            fontSize: 11,
                            flexShrink: 0,
                            marginLeft: 8,
                          }}
                        >
                          {productInCart ? "指定済み" : "これを指定"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {filteredGenericItems.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: "#8A9285", fontSize: 13 }}>
            該当する商品がありません
          </div>
        )}
      </div>
    </>
  );
}
