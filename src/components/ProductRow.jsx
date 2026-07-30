import { ChevronDown, ChevronRight, Star, TrendingDown } from "lucide-react";
import { productKey } from "../lib/cartKeys.js";
import { yen } from "../lib/format.js";

export default function ProductRow({
  item,
  categoryStyle,
  isOpen,
  onToggleExpand,
  isInCart,
  onToggleCart,
  isFavorite,
  onToggleFavorite,
  isDiscounted,
  cartKeys,
  onToggleProductCart,
}) {
  const Icon = categoryStyle.icon;

  return (
    <div style={{ borderTop: "1px solid #f1f5f9" }}>
      <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: 8 }}>
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-label="お気に入り"
          style={{ border: "none", background: "transparent", padding: 0, flexShrink: 0 }}
        >
          <Star size={16} color={isFavorite ? "#f59e0b" : "#cbd5e1"} fill={isFavorite ? "#f59e0b" : "none"} />
        </button>

        <button
          type="button"
          onClick={onToggleExpand}
          style={{
            flex: 1, display: "flex", alignItems: "center", gap: 8, border: "none",
            background: "transparent", textAlign: "left", padding: 0, minWidth: 0,
          }}
        >
          {isOpen ? (
            <ChevronDown size={14} color="#94a3b8" style={{ flexShrink: 0 }} />
          ) : (
            <ChevronRight size={14} color="#94a3b8" style={{ flexShrink: 0 }} />
          )}
          <div
            style={{
              width: 28, height: 28, borderRadius: 8, background: `${categoryStyle.color}1A`,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
          >
            <Icon size={14} color={categoryStyle.color} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {item.genericName}
              </span>
              {isDiscounted && (
                <span
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 2, background: "#fee2e2", color: "#dc2626",
                    fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 5, flexShrink: 0,
                  }}
                >
                  <TrendingDown size={10} /> 値下げ
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>
              {item.products.length}商品・{item.products.length > 1 ? "複数店舗で比較可能" : "1店舗のみ"}
            </div>
          </div>
        </button>

        <div className="price-num" style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#16a34a" }}>{yen(item.cheapestPrice)}〜</div>
        </div>

        <button
          type="button"
          onClick={onToggleCart}
          style={{
            border: "1px solid #2563eb", borderRadius: 8, padding: "4px 8px", flexShrink: 0,
            background: isInCart ? "#2563eb" : "#fff", color: isInCart ? "#fff" : "#2563eb", fontSize: 11,
          }}
        >
          {isInCart ? "追加済み" : "追加"}
        </button>
      </div>

      {isOpen && (
        <div style={{ background: "#f8fafc", padding: "4px 16px 10px 34px" }}>
          {item.products.map((p) => {
            const cheapest = p.prices[0];
            const others = p.prices.slice(1);
            const productInCart = cartKeys.has(productKey(p.id));
            return (
              <div
                key={p.id}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px solid #e2e8f0" }}
              >
                <div>
                  <div style={{ fontSize: 13 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>
                    {cheapest.storeName} {yen(cheapest.price)}
                    {others.length > 0 && (
                      <span> ・ 他{others.map((o) => `${o.storeName} ${yen(o.price)}`).join("、")}</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleProductCart(p.id)}
                  style={{
                    border: "1px solid #2563eb", borderRadius: 8, padding: "3px 8px", flexShrink: 0, marginLeft: 8,
                    background: productInCart ? "#2563eb" : "#fff", color: productInCart ? "#fff" : "#2563eb", fontSize: 11,
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
}
