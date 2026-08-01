import { Star, LogIn } from "lucide-react";
import { productKey } from "../lib/cartKeys.js";
import { yen } from "../lib/format.js";
import { ACCENT, ACCENT_LIGHT } from "../lib/theme.js";

export default function FavoritesView({ products, favoriteIds, isLoggedIn, onOpenAuth, onToggleFavorite, onAddProductToCart, cartKeys }) {
  const favoriteProducts = products.filter((p) => favoriteIds.has(p.id));

  if (!isLoggedIn && favoriteProducts.length === 0) {
    return (
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: "36px 18px", textAlign: "center" }}>
        <p style={{ fontSize: 15, color: "#64748b", margin: "0 0 14px" }}>
          お気に入りはログインすると保存され、次に来たときも見られます
        </p>
        <button
          type="button"
          onClick={onOpenAuth}
          style={{
            display: "inline-flex", alignItems: "center", gap: 7, border: "none", borderRadius: 999,
            padding: "12px 20px", background: ACCENT, color: "#fff", fontSize: 15, fontWeight: 700,
          }}
        >
          <LogIn size={16} /> ログイン・新規登録
        </button>
      </div>
    );
  }

  if (favoriteProducts.length === 0) {
    return (
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: "36px 18px", textAlign: "center", color: "#94a3b8", fontSize: 15 }}>
        最安値一覧の☆マークを押すと、お気に入りに登録できます
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
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%",
            border: `1px solid ${ACCENT}55`, borderRadius: 12, padding: "12px 16px", marginBottom: 14,
            background: ACCENT_LIGHT, color: ACCENT, fontSize: 14, fontWeight: 700,
          }}
        >
          <LogIn size={16} /> ログインすると保存されます
        </button>
      )}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, overflow: "hidden" }}>
        {favoriteProducts.map((p, i) => {
          const cheapest = p.prices[0];
          const isInCart = cartKeys.has(productKey(p.id));
          return (
            <div
              key={p.id}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "14px 18px",
                borderTop: i === 0 ? "none" : "1px solid #f1f5f9",
              }}
            >
              <button
                type="button"
                onClick={() => onToggleFavorite(p.id)}
                aria-label="お気に入り解除"
                style={{ border: "none", background: "transparent", padding: 0, flexShrink: 0 }}
              >
                <Star size={19} color="#f59e0b" fill="#f59e0b" />
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                <div style={{ fontSize: 13, color: "#94a3b8" }}>{cheapest.storeName} {yen(cheapest.price)}</div>
              </div>
              <button
                type="button"
                onClick={() => onAddProductToCart(p.id)}
                style={{
                  border: `1px solid ${ACCENT}`, borderRadius: 10, padding: "6px 12px", flexShrink: 0,
                  background: isInCart ? ACCENT : "#fff", color: isInCart ? "#fff" : ACCENT, fontSize: 13,
                }}
              >
                {isInCart ? "追加ずみ" : "追加"}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
