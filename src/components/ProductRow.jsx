import { ChevronDown, ChevronRight, Star, TrendingDown, AlertTriangle } from "lucide-react";
import { yen } from "../lib/format.js";
import { formatRelativeTime, isStalePrice } from "../lib/freshness.js";

export default function ProductRow({
  product,
  categoryStyle,
  isOpen,
  onToggleExpand,
  isInCart,
  onToggleCart,
  isFavorite,
  onToggleFavorite,
  isDiscounted,
}) {
  const Icon = categoryStyle.icon;
  const cheapest = product.prices[0];
  const others = product.prices.slice(1);

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
          {others.length > 0 ? (
            isOpen ? (
              <ChevronDown size={14} color="#94a3b8" style={{ flexShrink: 0 }} />
            ) : (
              <ChevronRight size={14} color="#94a3b8" style={{ flexShrink: 0 }} />
            )
          ) : (
            <span style={{ width: 14, flexShrink: 0 }} />
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
                {product.name}
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
              {others.length > 0 ? `${product.prices.length}店舗で比較可能` : "1店舗のみ"}
            </div>
          </div>
        </button>

        <div className="price-num" style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#16a34a" }}>{yen(cheapest.price)}</div>
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

      {isOpen && others.length > 0 && (
        <div style={{ background: "#f8fafc", padding: "8px 16px 10px 34px", fontSize: 11, color: "#94a3b8" }}>
          {[cheapest, ...others].map((o, i) => (
            <div key={o.storeId} style={{ display: "flex", alignItems: "center", gap: 4, marginTop: i === 0 ? 0 : 4 }}>
              <span>{o.storeName} {yen(o.price)}</span>
              <span style={{ color: isStalePrice(o.scrapedAt) ? "#d97706" : "#cbd5e1" }}>
                （{formatRelativeTime(o.scrapedAt)}）
              </span>
              {isStalePrice(o.scrapedAt) && <AlertTriangle size={11} color="#d97706" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
