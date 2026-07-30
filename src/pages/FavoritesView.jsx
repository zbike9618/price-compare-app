import { Star, LogIn } from "lucide-react";
import { productKey } from "../lib/cartKeys.js";
import { yen } from "../lib/format.js";

export default function FavoritesView({ products, favoriteIds, isLoggedIn, onOpenAuth, onToggleFavorite, onAddProductToCart, cartKeys }) {
  const favoriteProducts = products.filter((p) => favoriteIds.has(p.id));

  if (!isLoggedIn && favoriteProducts.length === 0) {
    return (
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "32px 16px", textAlign: "center" }}>
        <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 12px" }}>
          お気に入りはログインすると保存され、次回訪問時も見られます
        </p>
        <button
          type="button"
          onClick={onOpenAuth}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6, border: "none", borderRadius: 999,
            padding: "10px 18px", background: "#2563eb", color: "#fff", fontSize: 13, fontWeight: 700,
          }}
        >
          <LogIn size={14} /> ログイン・新規登録
        </button>
      </div>
    );
  }

  if (favoriteProducts.length === 0) {
    return (
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "32px 16px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
        最安値一覧の☆マークからお気に入りを登録してください
      </div>
    );
  }

  return (
    <>
      {!isLoggedIn && (
        <button
          type="button"
          onClick={onOpenAuth}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%",
            border: "1px solid #bfdbfe", borderRadius: 10, padding: "10px 14px", marginBottom: 12,
            background: "#eff6ff", color: "#2563eb", fontSize: 12, fontWeight: 700,
          }}
        >
          <LogIn size={14} /> ログインすると保存されます
        </button>
      )}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden" }}>
        {favoriteProducts.map((p, i) => {
          const cheapest = p.prices[0];
          const isInCart = cartKeys.has(productKey(p.id));
          return (
            <div
              key={p.id}
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: "12px 16px",
                borderTop: i === 0 ? "none" : "1px solid #f1f5f9",
              }}
            >
              <button
                type="button"
                onClick={() => onToggleFavorite(p.id)}
                aria-label="お気に入り解除"
                style={{ border: "none", background: "transparent", padding: 0, flexShrink: 0 }}
              >
                <Star size={16} color="#f59e0b" fill="#f59e0b" />
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>{cheapest.storeName} {yen(cheapest.price)}</div>
              </div>
              <button
                type="button"
                onClick={() => onAddProductToCart(p.id)}
                style={{
                  border: "1px solid #2563eb", borderRadius: 8, padding: "4px 8px", flexShrink: 0,
                  background: isInCart ? "#2563eb" : "#fff", color: isInCart ? "#fff" : "#2563eb", fontSize: 11,
                }}
              >
                {isInCart ? "追加済み" : "追加"}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
