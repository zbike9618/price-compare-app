import { useEffect, useMemo, useState } from "react";
import { Search, Store, ShoppingCart, List, X, Crown } from "lucide-react";

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
  const [products, setProducts] = useState([]); // { id, name, janCode, prices: [{storeId, storeName, price}] }
  const [view, setView] = useState("cart"); // "cart" | "list"
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("priceAsc");
  const [cart, setCart] = useState(() => new Set());
  const [cartSearch, setCartSearch] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [storesData, productsData, priceHistoryData] = await Promise.all([
          supabaseGet("stores?select=id,name&is_active=eq.true"),
          supabaseGet("products?select=id,name,jan_code"),
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

  const filteredProducts = useMemo(() => {
    let list = products.filter((p) => p.name.includes(query));
    list = [...list].sort((a, b) => {
      const aMin = a.prices[0]?.price ?? Infinity;
      const bMin = b.prices[0]?.price ?? Infinity;
      if (sortBy === "priceAsc") return aMin - bMin;
      if (sortBy === "priceDesc") return bMin - aMin;
      if (sortBy === "name") return a.name.localeCompare(b.name, "ja");
      return 0;
    });
    return list;
  }, [products, query, sortBy]);

  const toggleCart = (id) => {
    setCart((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const cartProducts = useMemo(() => products.filter((p) => cart.has(p.id)), [products, cart]);

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
                <button
                  type="button"
                  className="tab-btn"
                  onClick={() => setView("cart")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 14px",
                    borderRadius: 999,
                    border: view === "cart" ? "1px solid #2F6B4A" : "1px solid #D9DED2",
                    background: view === "cart" ? "#2F6B4A" : "#fff",
                    color: view === "cart" ? "#fff" : "#202B22",
                    fontSize: 13,
                  }}
                >
                  <ShoppingCart size={14} /> 買い物リスト比較
                </button>
                <button
                  type="button"
                  className="tab-btn"
                  onClick={() => setView("list")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 14px",
                    borderRadius: 999,
                    border: view === "list" ? "1px solid #2F6B4A" : "1px solid #D9DED2",
                    background: view === "list" ? "#2F6B4A" : "#fff",
                    color: view === "list" ? "#fff" : "#202B22",
                    fontSize: 13,
                  }}
                >
                  <List size={14} /> 最安値一覧
                </button>
              </div>

              {view === "cart" && (
                <CartView
                  cartProducts={cartProducts}
                  cartSearch={cartSearch}
                  setCartSearch={setCartSearch}
                  cartSearchResults={cartSearchResults}
                  toggleCart={toggleCart}
                  cartStoreTotals={cartStoreTotals}
                />
              )}

              {view === "list" && (
                <ListView
                  query={query}
                  setQuery={setQuery}
                  sortBy={sortBy}
                  setSortBy={setSortBy}
                  filteredProducts={filteredProducts}
                  cart={cart}
                  toggleCart={toggleCart}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CartView({ cartProducts, cartSearch, setCartSearch, cartSearchResults, toggleCart, cartStoreTotals }) {
  return (
    <>
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

function ListView({ query, setQuery, sortBy, setSortBy, filteredProducts, cart, toggleCart }) {
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
