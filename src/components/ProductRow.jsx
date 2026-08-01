import { ChevronDown, ChevronRight, Star, TrendingDown, AlertTriangle } from "lucide-react";
import { yen } from "../lib/format.js";
import { formatRelativeTime, isStalePrice } from "../lib/freshness.js";
import { ACCENT } from "../lib/theme.js";

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
      <div style={{ padding: "13px 18px", display: "flex", alignItems: "center", gap: 10 }}>
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-label="お気に入り"
          style={{ border: "none", background: "transparent", padding: 0, flexShrink: 0 }}
        >
          <Star size={19} color={isFavorite ? "#f59e0b" : "#cbd5e1"} fill={isFavorite ? "#f59e0b" : "none"} />
        </button>

        <button
          type="button"
          onClick={onToggleExpand}
          style={{
            flex: 1, display: "flex", alignItems: "center", gap: 10, border: "none",
            background: "transparent", textAlign: "left", padding: 0, minWidth: 0,
          }}
        >
          {others.length > 0 ? (
            isOpen ? (
              <ChevronDown size={17} color="#94a3b8" style={{ flexShrink: 0 }} />
            ) : (
              <ChevronRight size={17} color="#94a3b8" style={{ flexShrink: 0 }} />
            )
          ) : (
            <span style={{ width: 17, flexShrink: 0 }} />
          )}
          <div
            style={{
              width: 34, height: 34, borderRadius: 10, background: `${categoryStyle.color}1A`,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
          >
            <Icon size={17} color={categoryStyle.color} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ fontSize: 15, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {product.name}
              </span>
              {isDiscounted && (
                <span
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 3, background: "#fee2e2", color: "#dc2626",
                    fontSize: 12, fontWeight: 700, padding: "3px 7px", borderRadius: 6, flexShrink: 0,
                  }}
                >
                  <TrendingDown size={12} /> 値下げ
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, color: "#94a3b8" }}>
              {others.length > 0 ? `${product.prices.length}店舗で比べられます` : "1店舗のみ"}
            </div>
          </div>
        </button>

        <div className="price-num" style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#16a34a" }}>{yen(cheapest.price)}</div>
        </div>

        <button
          type="button"
          onClick={onToggleCart}
          style={{
            border: `1px solid ${ACCENT}`, borderRadius: 10, padding: "6px 12px", flexShrink: 0,
            background: isInCart ? ACCENT : "#fff", color: isInCart ? "#fff" : ACCENT, fontSize: 13,
          }}
        >
          {isInCart ? "追加ずみ" : "追加"}
        </button>
      </div>

      {isOpen && others.length > 0 && (
        <div style={{ background: "#f8fafc", padding: "10px 18px 12px 43px", fontSize: 13, color: "#94a3b8" }}>
          {[cheapest, ...others].map((o, i) => (
            <div key={o.storeId} style={{ display: "flex", alignItems: "center", gap: 5, marginTop: i === 0 ? 0 : 5 }}>
              <span>{o.storeName} {yen(o.price)}</span>
              <span style={{ color: isStalePrice(o.scrapedAt) ? "#d97706" : "#cbd5e1" }}>
                （{formatRelativeTime(o.scrapedAt)}）
              </span>
              {isStalePrice(o.scrapedAt) && <AlertTriangle size={13} color="#d97706" />}
              {o.min30 != null && o.min30 < o.price && (
                <span style={{ color: "#16a34a" }}>30日でいちばん安いのは {yen(o.min30)}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
