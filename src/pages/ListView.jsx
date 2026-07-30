import { useState } from "react";
import {
  Search, Carrot, Apple, Milk, Beef, Fish, Croissant, Soup, Droplet, Egg, Package,
} from "lucide-react";
import ProductRow from "../components/ProductRow.jsx";
import { productKey } from "../lib/cartKeys.js";

const CATEGORY_STYLE = {
  野菜: { icon: Carrot, color: "#16a34a" },
  果物: { icon: Apple, color: "#dc2626" },
  乳製品: { icon: Milk, color: "#2563eb" },
  精肉: { icon: Beef, color: "#92400e" },
  魚介: { icon: Fish, color: "#0891b2" },
  パン類: { icon: Croissant, color: "#ca8a04" },
  麺類: { icon: Soup, color: "#d97706" },
  調味料: { icon: Droplet, color: "#78716c" },
  日配食品: { icon: Egg, color: "#ca8a04" },
  日用品: { icon: Package, color: "#64748b" },
};
const DEFAULT_CATEGORY_STYLE = { icon: Package, color: "#64748b" };

const SORT_OPTIONS = [
  { id: "priceAsc", label: "最安値が安い順" },
  { id: "priceDesc", label: "最安値が高い順" },
  { id: "name", label: "名前順" },
];

export default function ListView({
  query,
  setQuery,
  sortBy,
  setSortBy,
  categories,
  categoryCounts,
  activeCategory,
  setActiveCategory,
  sectionedProducts,
  cartKeys,
  onToggleProductCart,
  favoriteIds,
  onToggleFavorite,
  discountedProductIds,
}) {
  const [expanded, setExpanded] = useState(() => new Set());

  const toggleExpanded = (productId) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  return (
    <>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div
          style={{
            flex: 1, display: "flex", alignItems: "center", gap: 6, background: "#fff",
            border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 12px",
          }}
        >
          <Search size={16} color="#94a3b8" />
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
          style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "0 10px", fontSize: 13, background: "#fff" }}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        <button
          type="button"
          onClick={() => setActiveCategory(null)}
          style={{
            display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 999,
            border: activeCategory === null ? "1px solid #2563eb" : "1px solid #e2e8f0",
            background: activeCategory === null ? "#2563eb" : "#fff",
            color: activeCategory === null ? "#fff" : "#0f172a", fontSize: 12,
          }}
        >
          すべて
        </button>
        {categories.map((c) => {
          const style = CATEGORY_STYLE[c] ?? DEFAULT_CATEGORY_STYLE;
          const Icon = style.icon;
          const active = activeCategory === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setActiveCategory(c)}
              style={{
                display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 999,
                border: active ? "1px solid #2563eb" : "1px solid #e2e8f0",
                background: active ? "#2563eb" : "#fff", color: active ? "#fff" : "#0f172a", fontSize: 12,
              }}
            >
              <Icon size={12} color={active ? "#fff" : style.color} />
              {c}
              <span
                style={{
                  fontSize: 10, padding: "1px 6px", borderRadius: 999,
                  background: active ? "rgba(255,255,255,0.25)" : "#f1f5f9",
                  color: active ? "#fff" : "#64748b",
                }}
              >
                {categoryCounts.get(c) ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {sectionedProducts.map((section) => {
        const sectionStyle = CATEGORY_STYLE[section.category] ?? DEFAULT_CATEGORY_STYLE;
        const SectionIcon = sectionStyle.icon;
        return (
          <div key={section.category} style={{ marginBottom: 16 }}>
            <p style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#64748b", margin: "0 0 6px" }}>
              <SectionIcon size={13} color={sectionStyle.color} />
              {section.category} <span style={{ fontWeight: 400, color: "#94a3b8" }}>（{section.items.length}）</span>
            </p>
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden" }}>
              {section.items.map((product) => {
                const isInCart = cartKeys.has(productKey(product.id));
                const isFavorite = favoriteIds.has(product.id);
                const isDiscounted = discountedProductIds.has(product.id);
                return (
                  <ProductRow
                    key={product.id}
                    product={product}
                    categoryStyle={CATEGORY_STYLE[product.category] ?? DEFAULT_CATEGORY_STYLE}
                    isOpen={expanded.has(product.id)}
                    onToggleExpand={() => toggleExpanded(product.id)}
                    isInCart={isInCart}
                    onToggleCart={() => onToggleProductCart(product.id)}
                    isFavorite={isFavorite}
                    onToggleFavorite={() => onToggleFavorite(product.id)}
                    isDiscounted={isDiscounted}
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      {sectionedProducts.length === 0 && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
          該当する商品がありません
        </div>
      )}
    </>
  );
}
