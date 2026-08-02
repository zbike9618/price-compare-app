import { useEffect, useState } from "react";
import {
  Search, Carrot, Apple, Milk, Beef, Fish, Croissant, Soup, Droplet, Egg, Package, TrendingDown,
  Percent, ChevronLeft, HelpCircle, Candy, Pill, Snowflake, Baby, CupSoda, UtensilsCrossed,
  HeartPulse, PenLine, Plug, Wheat, IceCreamCone, Sprout, ToyBrick, Sparkles,
} from "lucide-react";
import ProductRow from "../components/ProductRow.jsx";
import { productKey } from "../lib/cartKeys.js";
import { getSubcategoryIcon, OTHER_SUBCATEGORY } from "../lib/subcategories.js";
import { ACCENT } from "../lib/theme.js";

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
  // ここから下はGeminiが分類の過程で新設したカテゴリ（アイコン未設定だとPackageアイコンに
  // フォールバックしてしまうため、見つかったものには順次アイコンを割り当てる）
  菓子: { icon: Candy, color: "#db2777" },
  医薬品: { icon: Pill, color: "#dc2626" },
  冷凍食品: { icon: Snowflake, color: "#0ea5e9" },
  ベビーフード: { icon: Baby, color: "#f472b6" },
  飲料: { icon: CupSoda, color: "#0891b2" },
  加工食品: { icon: UtensilsCrossed, color: "#a16207" },
  健康食品: { icon: HeartPulse, color: "#16a34a" },
  文房具: { icon: PenLine, color: "#6366f1" },
  家電: { icon: Plug, color: "#64748b" },
  "乾物・シリアル": { icon: Wheat, color: "#ca8a04" },
  惣菜: { icon: UtensilsCrossed, color: "#ea580c" },
  デザート: { icon: IceCreamCone, color: "#ec4899" },
  園芸用品: { icon: Sprout, color: "#16a34a" },
  玩具: { icon: ToyBrick, color: "#f59e0b" },
  化粧品: { icon: Sparkles, color: "#d946ef" },
};
const DEFAULT_CATEGORY_STYLE = { icon: Package, color: "#64748b" };

// スーパーの店舗内導線（入口→レジ）に合わせた表示順
const CATEGORY_ORDER = ["野菜", "果物", "精肉", "魚介", "日配食品", "乳製品", "パン類", "麺類", "調味料", "日用品"];

const INITIAL_VISIBLE_COUNT = 20;
const SHOW_MORE_STEP = 30;

const SORT_OPTIONS = [
  { id: "priceAsc", label: "安い順" },
  { id: "priceDesc", label: "高い順" },
  { id: "discountDesc", label: "値引き率順" },
  { id: "name", label: "名前順" },
];

function sortByStoreLayout(categories) {
  return [...categories].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b, "ja");
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

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
  productHistoryById,
  rangeHint,
  discountOnly,
  setDiscountOnly,
  storeFilter,
  setStoreFilter,
}) {
  const [expanded, setExpanded] = useState(() => new Set());
  const [visibleCounts, setVisibleCounts] = useState(() => new Map());
  const [activeSubcategory, setActiveSubcategory] = useState(null);

  // 検索・カテゴリ絞り込みが変わったら各セクションの表示件数をリセットする
  useEffect(() => {
    setVisibleCounts(new Map());
  }, [query, activeCategory, activeSubcategory, discountOnly, storeFilter]);

  useEffect(() => {
    setActiveSubcategory(null);
  }, [activeCategory]);

  const discountedCount = sectionedProducts.reduce(
    (sum, section) => sum + section.items.filter((p) => discountedProductIds.has(p.id)).length,
    0
  );

  const categorySection = sectionedProducts.find((s) => s.category === activeCategory);
  const categoryProducts = categorySection?.items ?? [];

  const subcategoryStats = (() => {
    const counts = new Map();
    let otherCount = 0;
    for (const p of categoryProducts) {
      const label = p.subcategory;
      if (label && label !== OTHER_SUBCATEGORY) counts.set(label, (counts.get(label) ?? 0) + 1);
      else otherCount += 1;
    }
    return { counts, otherCount };
  })();

  const showSubcategoryGrid =
    activeCategory !== null && activeSubcategory === null && !discountOnly && !storeFilter && query.trim() === "" && subcategoryStats.counts.size > 0;

  const isBrowsingList =
    discountOnly ||
    !!storeFilter ||
    query.trim() !== "" ||
    activeSubcategory !== null ||
    (activeCategory !== null && subcategoryStats.counts.size === 0);

  const visibleSections = (() => {
    let sections = sectionedProducts;
    if (storeFilter) {
      // その店舗が扱っている商品だけに絞り込み、店舗の価格が先頭（=最安値として表示）に来るよう並べ替える
      sections = sections
        .map((s) => ({
          ...s,
          items: s.items
            .filter((p) => p.prices.some((pr) => pr.storeId === storeFilter.storeId))
            .map((p) => ({
              ...p,
              prices: [
                p.prices.find((pr) => pr.storeId === storeFilter.storeId),
                ...p.prices.filter((pr) => pr.storeId !== storeFilter.storeId),
              ],
            })),
        }))
        .filter((s) => s.items.length > 0);
    }
    if (discountOnly) {
      // 店舗で絞り込み中は「その店舗で」値引き中かどうかで判定する（先頭に並べ替え済みのprices[0]を見る）
      sections = sections
        .map((s) => ({
          ...s,
          items: s.items.filter((p) => (storeFilter ? p.prices[0].discount != null : discountedProductIds.has(p.id))),
        }))
        .filter((s) => s.items.length > 0);
    }
    if (activeSubcategory !== null) {
      sections = sections
        .map((s) => ({
          ...s,
          items: s.items.filter((p) => {
            const label = p.subcategory;
            return activeSubcategory === OTHER_SUBCATEGORY
              ? !label || label === OTHER_SUBCATEGORY
              : label === activeSubcategory;
          }),
        }))
        .filter((s) => s.items.length > 0);
    }
    if (storeFilter && sortBy === "discountDesc") {
      // 店舗で絞り込み中は、その店舗の値引き率で並べ直す（全体最安値店基準のソートのままだと表示価格とズレるため）
      sections = sections.map((s) => ({
        ...s,
        items: [...s.items].sort((a, b) => (b.prices[0].discount?.pct ?? -1) - (a.prices[0].discount?.pct ?? -1)),
      }));
    }
    return sections;
  })();

  const goBack = () => {
    if (activeSubcategory !== null) {
      setActiveSubcategory(null);
    } else if (activeCategory !== null) {
      setActiveCategory(null);
    } else {
      setDiscountOnly(false);
      setStoreFilter(null);
      setQuery("");
    }
  };

  const showMore = (category) => {
    setVisibleCounts((prev) => {
      const next = new Map(prev);
      next.set(category, (prev.get(category) ?? INITIAL_VISIBLE_COUNT) + SHOW_MORE_STEP);
      return next;
    });
  };

  const toggleExpanded = (productId) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const showHome = activeCategory === null && !discountOnly && !storeFilter && query.trim() === "";

  return (
    <>

      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        {!showHome && (
          <button
            type="button"
            onClick={goBack}
            aria-label="戻る"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              width: 46, border: "1px solid #e2e8f0", borderRadius: 12, background: "#fff", color: "#334155",
            }}
          >
            <ChevronLeft size={22} />
          </button>
        )}
        <div
          style={{
            flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8, background: "#fff",
            border: "1px solid #e2e8f0", borderRadius: 12, padding: "12px 16px",
          }}
        >
          <Search size={19} color="#94a3b8" style={{ flexShrink: 0 }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="商品名で検索"
            style={{ border: "none", flex: 1, minWidth: 0, fontSize: 16, background: "transparent" }}
          />
        </div>
        {isBrowsingList && (
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              flexShrink: 0, border: "1px solid #e2e8f0", borderRadius: 12, padding: "0 8px",
              fontSize: 14, background: "#fff",
            }}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        )}
      </div>

      {showHome && (
        <>
          <p style={{ fontSize: 15, fontWeight: 700, color: "#64748b", margin: "0 0 12px" }}>何をお探しですか？</p>
          <div
            style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(112px, 1fr))",
              gap: 12, marginBottom: 18,
            }}
          >
            {discountedCount > 0 && (
              <CategoryCard
                label="値下げ中"
                Icon={TrendingDown}
                color="#dc2626"
                count={discountedCount}
                onClick={() => setDiscountOnly(true)}
              />
            )}
            {sortByStoreLayout(categories).map((c) => {
              const style = CATEGORY_STYLE[c] ?? DEFAULT_CATEGORY_STYLE;
              return (
                <CategoryCard
                  key={c}
                  label={c}
                  Icon={style.icon}
                  color={style.color}
                  count={categoryCounts.get(c) ?? 0}
                  onClick={() => setActiveCategory(c)}
                />
              );
            })}
          </div>
        </>
      )}

      {showSubcategoryGrid && (
        <>
          <p style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 15, fontWeight: 700, color: "#334155", margin: "0 0 12px" }}>
            {(() => {
              const Icon = (CATEGORY_STYLE[activeCategory] ?? DEFAULT_CATEGORY_STYLE).icon;
              return <Icon size={18} color={(CATEGORY_STYLE[activeCategory] ?? DEFAULT_CATEGORY_STYLE).color} />;
            })()}
            {activeCategory}の中から選んでください
          </p>
          <div
            style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(112px, 1fr))",
              gap: 12, marginBottom: 18,
            }}
          >
            {[...subcategoryStats.counts.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([label, count]) => {
                const categoryStyle = CATEGORY_STYLE[activeCategory] ?? DEFAULT_CATEGORY_STYLE;
                const Icon = getSubcategoryIcon(activeCategory, label, categoryStyle.icon);
                return (
                  <CategoryCard
                    key={label}
                    label={label}
                    Icon={Icon}
                    color={categoryStyle.color}
                    count={count}
                    onClick={() => setActiveSubcategory(label)}
                  />
                );
              })}
            {subcategoryStats.otherCount > 0 && (
              <CategoryCard
                label={OTHER_SUBCATEGORY}
                Icon={HelpCircle}
                color="#64748b"
                count={subcategoryStats.otherCount}
                onClick={() => setActiveSubcategory(OTHER_SUBCATEGORY)}
              />
            )}
          </div>
        </>
      )}

      {isBrowsingList && activeCategory && (
        <p style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 15, fontWeight: 700, color: "#334155", margin: "0 0 12px" }}>
          {(() => {
            const Icon = (CATEGORY_STYLE[activeCategory] ?? DEFAULT_CATEGORY_STYLE).icon;
            return <Icon size={17} color={(CATEGORY_STYLE[activeCategory] ?? DEFAULT_CATEGORY_STYLE).color} />;
          })()}
          {activeCategory}
          {activeSubcategory && <span style={{ color: "#94a3b8", fontWeight: 400 }}>／{activeSubcategory}</span>}
        </p>
      )}
      {isBrowsingList && discountOnly && (
        <p style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 15, fontWeight: 700, color: "#dc2626", margin: "0 0 12px" }}>
          <TrendingDown size={17} color="#dc2626" /> 値下げ中
        </p>
      )}
      {isBrowsingList && storeFilter && (
        <p style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 15, fontWeight: 700, color: "#991b1b", margin: "0 0 12px" }}>
          <Percent size={17} color="#dc2626" /> {storeFilter.storeName}の商品一覧
        </p>
      )}

      {isBrowsingList && visibleSections.map((section) => {
        const sectionStyle = CATEGORY_STYLE[section.category] ?? DEFAULT_CATEGORY_STYLE;
        const SectionIcon = sectionStyle.icon;
        const visibleCount = visibleCounts.get(section.category) ?? INITIAL_VISIBLE_COUNT;
        const visibleItems = section.items.slice(0, visibleCount);
        const remaining = section.items.length - visibleItems.length;
        return (
          <div key={section.category} style={{ marginBottom: 18 }}>
            {!activeCategory && !discountOnly && (
              <p style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 14, fontWeight: 700, color: "#64748b", margin: "0 0 8px" }}>
                <SectionIcon size={15} color={sectionStyle.color} />
                {section.category} <span style={{ fontWeight: 400, color: "#94a3b8" }}>（{section.items.length}）</span>
              </p>
            )}
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, overflow: "hidden" }}>
              {visibleItems.map((product) => {
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
                    storeHistories={productHistoryById.get(product.id)}
                  />
                );
              })}
              {remaining > 0 && (
                <button
                  type="button"
                  onClick={() => showMore(section.category)}
                  style={{
                    display: "block", width: "100%", padding: 13, border: "none",
                    borderTop: "1px solid #e2e8f0", background: "#f8fafc", color: ACCENT,
                    fontSize: 14, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  もっと見る（あと{remaining}件）
                </button>
              )}
            </div>
          </div>
        );
      })}

      {isBrowsingList && visibleSections.length === 0 && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 28, textAlign: "center", color: "#94a3b8", fontSize: 15 }}>
          {rangeHint ?? (discountOnly ? "値下げ中の商品が見つかりませんでした" : "見つかりませんでした。別のキーワードで探してみてください")}
        </div>
      )}
    </>
  );
}

function CategoryCard({ label, Icon, color, count, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 9,
        padding: "22px 10px", borderRadius: 18, position: "relative",
        border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer",
      }}
    >
      {typeof count === "number" && (
        <span
          style={{
            position: "absolute", top: 7, right: 7, fontSize: 11, fontWeight: 700, padding: "2px 7px",
            borderRadius: 999, background: "#f1f5f9", color: "#94a3b8",
          }}
        >
          {count}
        </span>
      )}
      <Icon size={34} color={color} strokeWidth={1.7} />
      <span style={{ fontSize: 14, fontWeight: 700, color: "#334155" }}>{label}</span>
    </button>
  );
}
