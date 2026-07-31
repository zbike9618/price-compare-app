import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { useAuth } from "../lib/AuthContext.jsx";
import { useFavorites } from "../lib/useFavorites.js";
import { isRecentPriceDrop } from "../lib/discount.js";
import { productKey } from "../lib/cartKeys.js";
import { haversineDistanceKm, loadRangeSetting, saveRangeSetting } from "../lib/geo.js";
import { BUILTIN_PRESETS, loadCustomPresets, saveCustomPreset, deleteCustomPreset } from "../lib/presets.js";
import { hasSeenOnboarding } from "../lib/onboarding.js";
import AppShell from "../components/AppShell.jsx";
import OnboardingTour from "../components/OnboardingTour.jsx";
import ListView from "./ListView.jsx";
import ShoppingListCompare from "./ShoppingListCompare.jsx";
import MapView from "./MapView.jsx";
import FavoritesView from "./FavoritesView.jsx";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export default function PriceCompareReal() {
  const { user } = useAuth();
  const { favoriteIds, toggleFavorite } = useFavorites(user);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stores, setStores] = useState([]);
  const [products, setProducts] = useState([]);
  const [historyByPair, setHistoryByPair] = useState(() => new Map());
  const [rangeSetting, setRangeSetting] = useState(() => loadRangeSetting());
  const [view, setView] = useState(() => (loadRangeSetting() ? "list" : "map"));
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("priceAsc");
  const [activeCategory, setActiveCategory] = useState(null);
  const [cart, setCart] = useState(() => new Set());
  const [cartSearch, setCartSearch] = useState("");
  const [customPresets, setCustomPresets] = useState(() => loadCustomPresets());
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => !hasSeenOnboarding());

  useEffect(() => {
    (async () => {
      try {
        const sinceIso = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();

        const [{ data: storesData, error: storesError }, { data: productsData, error: productsError }, { data: priceHistoryData, error: priceHistoryError }] =
          await Promise.all([
            supabase.from("stores").select("id,name,lat,lng").eq("is_active", true),
            supabase.from("products").select("id,name,jan_code,category"),
            supabase
              .from("price_history")
              .select("store_id,product_id,price,scraped_at")
              .gte("scraped_at", sinceIso)
              .order("scraped_at", { ascending: false }),
          ]);

        if (storesError) throw storesError;
        if (productsError) throw productsError;
        if (priceHistoryError) throw priceHistoryError;

        const storeNameById = new Map(storesData.map((s) => [s.id, s.name]));

        // scraped_atの降順で取得済みなので、(store_id, product_id)ごとに先頭からの並びがそのまま新しい順の履歴になる
        const historyByPair = new Map();
        for (const ph of priceHistoryData) {
          const key = `${ph.store_id}:${ph.product_id}`;
          if (!historyByPair.has(key)) historyByPair.set(key, []);
          historyByPair.get(key).push({ price: ph.price, scrapedAt: ph.scraped_at });
        }

        const priceByProduct = new Map();
        for (const [key, historyDesc] of historyByPair) {
          const [storeId, productId] = key.split(":");
          const latest = historyDesc[0];
          if (!priceByProduct.has(productId)) priceByProduct.set(productId, []);
          priceByProduct.get(productId).push({
            storeId,
            storeName: storeNameById.get(storeId) ?? "不明な店舗",
            price: latest.price,
            scrapedAt: latest.scrapedAt,
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
        setHistoryByPair(historyByPair);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const storesInRangeIds = useMemo(() => {
    if (!rangeSetting) return null;
    return new Set(
      stores
        .filter((s) => s.lat != null && s.lng != null)
        .filter(
          (s) =>
            haversineDistanceKm(rangeSetting.center.lat, rangeSetting.center.lng, s.lat, s.lng) <=
            rangeSetting.radiusKm
        )
        .map((s) => s.id)
    );
  }, [stores, rangeSetting]);

  const productsInRange = useMemo(() => {
    if (!storesInRangeIds) return products;
    return products
      .map((p) => ({ ...p, prices: p.prices.filter((pr) => storesInRangeIds.has(pr.storeId)) }))
      .filter((p) => p.prices.length > 0);
  }, [products, storesInRangeIds]);

  const discountedProductIds = useMemo(() => {
    const discounted = new Set();
    for (const [key, historyDesc] of historyByPair) {
      const [storeId, productId] = key.split(":");
      if (storesInRangeIds && !storesInRangeIds.has(storeId)) continue;
      if (isRecentPriceDrop(historyDesc)) discounted.add(productId);
    }
    return discounted;
  }, [historyByPair, storesInRangeIds]);

  const productById = useMemo(() => new Map(productsInRange.map((p) => [p.id, p])), [productsInRange]);

  const categories = useMemo(() => {
    const set = new Set(productsInRange.map((p) => p.category).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, "ja"));
  }, [productsInRange]);

  const categoryCounts = useMemo(() => {
    const counts = new Map();
    for (const p of productsInRange) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    return counts;
  }, [productsInRange]);

  const sectionedProducts = useMemo(() => {
    let list = productsInRange.filter(
      (p) => p.name.includes(query) && (activeCategory === null || p.category === activeCategory)
    );
    list = [...list].sort((a, b) => {
      if (sortBy === "priceAsc") return a.prices[0].price - b.prices[0].price;
      if (sortBy === "priceDesc") return b.prices[0].price - a.prices[0].price;
      if (sortBy === "name") return a.name.localeCompare(b.name, "ja");
      return 0;
    });

    const groups = new Map();
    for (const p of list) {
      if (!groups.has(p.category)) groups.set(p.category, []);
      groups.get(p.category).push(p);
    }
    return categories.filter((c) => groups.has(c)).map((c) => ({ category: c, items: groups.get(c) }));
  }, [productsInRange, query, activeCategory, sortBy, categories]);

  const toggleCartKey = (key) => {
    setCart((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const cartEntries = useMemo(() => {
    return [...cart]
      .map((key) => {
        const id = key.slice(2);
        const product = productById.get(id);
        if (!product) return null;
        return {
          key,
          label: product.name,
          priceAtStore: (storeId) => product.prices.find((pr) => pr.storeId === storeId)?.price ?? null,
          representativePrice: product.prices[0].price,
        };
      })
      .filter(Boolean);
  }, [cart, productById]);

  const builtinPresets = useMemo(() => {
    return BUILTIN_PRESETS.map((preset) => {
      const keys = preset.keywords
        .map((kw) => {
          const matches = productsInRange.filter((p) => p.name.includes(kw));
          if (matches.length === 0) return null;
          const cheapest = matches.reduce((min, p) => (p.prices[0].price < min.prices[0].price ? p : min));
          return productKey(cheapest.id);
        })
        .filter(Boolean);
      return { ...preset, keys };
    }).filter((preset) => preset.keys.length > 0);
  }, [productsInRange]);

  const applyKeys = (keys) => {
    setCart((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => next.add(k));
      return next;
    });
  };

  const applyCustomPreset = (preset) => {
    const ids = productsInRange.filter((p) => preset.janCodes.includes(p.janCode)).map((p) => productKey(p.id));
    applyKeys(ids);
  };

  const handleSaveCurrentAsPreset = (name) => {
    const janCodes = cartEntries
      .map((entry) => productById.get(entry.key.slice(2))?.janCode)
      .filter(Boolean);
    setCustomPresets(saveCustomPreset(name, janCodes));
  };

  const handleDeleteCustomPreset = (id) => {
    setCustomPresets(deleteCustomPreset(id));
  };

  const cartKeys = useMemo(() => new Set(cartEntries.map((e) => e.key)), [cartEntries]);

  const cartSearchResults = useMemo(() => {
    if (!cartSearch.trim()) return [];
    return productsInRange
      .filter((p) => p.name.includes(cartSearch) && !cartKeys.has(productKey(p.id)))
      .slice(0, 8);
  }, [productsInRange, cartSearch, cartKeys]);

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

  const handleConfirmRange = (center, radiusKm) => {
    const next = { center, radiusKm };
    saveRangeSetting(next);
    setRangeSetting(next);
    setActiveCategory(null);
    setView("list");
  };

  if (loading) return <p style={{ padding: 24 }}>読み込み中...</p>;
  if (error) return <p style={{ padding: 24, color: "#dc2626" }}>データの取得に失敗しました: {error}</p>;

  const inRangeStoreCount = storesInRangeIds ? storesInRangeIds.size : stores.length;
  const rangeHint =
    rangeSetting && storesInRangeIds && storesInRangeIds.size === 0
      ? "範囲内に店舗がありません。範囲を広げてください"
      : null;

  return (
    <>
    <AppShell
      view={view}
      setView={setView}
      showAuthForm={showAuthForm}
      onRequestAuth={() => setShowAuthForm(true)}
      onCloseAuth={() => setShowAuthForm(false)}
      onRequestOnboarding={() => setShowOnboarding(true)}
    >
      {view !== "map" && (
        <button
          type="button"
          onClick={() => setView("map")}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
            border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 12px", marginBottom: 12,
            background: "#fff", fontSize: 12, color: "#334155", cursor: "pointer",
          }}
        >
          <span>
            {rangeSetting
              ? `半径${rangeSetting.radiusKm.toFixed(1)}km・対象${inRangeStoreCount}店舗`
              : "範囲未設定：全店舗を対象に表示中"}
          </span>
          <span style={{ color: "#2563eb", fontWeight: 700 }}>範囲を設定</span>
        </button>
      )}

      {view === "list" && (
        <ListView
          query={query}
          setQuery={setQuery}
          sortBy={sortBy}
          setSortBy={setSortBy}
          categories={categories}
          categoryCounts={categoryCounts}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          sectionedProducts={sectionedProducts}
          cartKeys={cartKeys}
          onToggleProductCart={(id) => toggleCartKey(productKey(id))}
          favoriteIds={favoriteIds}
          onToggleFavorite={toggleFavorite}
          discountedProductIds={discountedProductIds}
          rangeHint={rangeHint}
        />
      )}

      {view === "cart" && (
        <ShoppingListCompare
          cartEntries={cartEntries}
          cartSearch={cartSearch}
          setCartSearch={setCartSearch}
          cartSearchResults={cartSearchResults}
          onAddProduct={(id) => {
            toggleCartKey(productKey(id));
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

      {view === "map" && (
        <MapView
          stores={stores}
          rangeSetting={rangeSetting}
          inRangeStoreIds={storesInRangeIds}
          onConfirmRange={handleConfirmRange}
        />
      )}

      {view === "favorites" && (
        <FavoritesView
          products={productsInRange}
          favoriteIds={favoriteIds}
          isLoggedIn={!!user}
          onOpenAuth={() => setShowAuthForm(true)}
          onToggleFavorite={toggleFavorite}
          onAddProductToCart={(id) => toggleCartKey(productKey(id))}
          cartKeys={cartKeys}
        />
      )}
    </AppShell>
    {showOnboarding && <OnboardingTour onClose={() => setShowOnboarding(false)} />}
    </>
  );
}
