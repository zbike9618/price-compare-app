import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { useAuth } from "../lib/AuthContext.jsx";
import { useFavorites } from "../lib/useFavorites.js";
import { isRecentPriceDrop } from "../lib/discount.js";
import { genericKey, productKey } from "../lib/cartKeys.js";
import { BUILTIN_PRESETS, loadCustomPresets, saveCustomPreset, deleteCustomPreset } from "../lib/presets.js";
import AppShell from "../components/AppShell.jsx";
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
  const [discountedProductIds, setDiscountedProductIds] = useState(() => new Set());
  const [view, setView] = useState("list");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("priceAsc");
  const [activeCategory, setActiveCategory] = useState(null);
  const [cart, setCart] = useState(() => new Set());
  const [cartSearch, setCartSearch] = useState("");
  const [customPresets, setCustomPresets] = useState(() => loadCustomPresets());
  const [showAuthForm, setShowAuthForm] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const sinceIso = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();

        const [{ data: storesData, error: storesError }, { data: productsData, error: productsError }, { data: priceHistoryData, error: priceHistoryError }] =
          await Promise.all([
            supabase.from("stores").select("id,name,lat,lng").eq("is_active", true),
            supabase.from("products").select("id,name,jan_code,category,generic_name"),
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
        const discounted = new Set();
        for (const [key, historyDesc] of historyByPair) {
          const [storeId, productId] = key.split(":");
          const latest = historyDesc[0];
          if (!priceByProduct.has(productId)) priceByProduct.set(productId, []);
          priceByProduct.get(productId).push({
            storeId,
            storeName: storeNameById.get(storeId) ?? "不明な店舗",
            price: latest.price,
          });
          if (isRecentPriceDrop(historyDesc)) discounted.add(productId);
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
        setDiscountedProductIds(discounted);
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

  const genericItems = useMemo(() => {
    const groups = new Map();
    for (const p of products) {
      if (!groups.has(p.genericName)) groups.set(p.genericName, []);
      groups.get(p.genericName).push(p);
    }
    return [...groups.entries()].map(([genericName, items]) => {
      const sortedItems = [...items].sort((a, b) => a.prices[0].price - b.prices[0].price);
      const cheapestProduct = sortedItems[0];
      const allPrices = items.flatMap((p) => p.prices.map((pr) => pr.price));
      return {
        genericName,
        category: cheapestProduct.category,
        products: sortedItems,
        cheapestPrice: cheapestProduct.prices[0].price,
        highestPrice: Math.max(...allPrices),
        cheapestStoreName: cheapestProduct.prices[0].storeName,
        cheapestProductName: cheapestProduct.name,
      };
    });
  }, [products]);

  const genericItemByName = useMemo(() => new Map(genericItems.map((g) => [g.genericName, g])), [genericItems]);

  const categoryCounts = useMemo(() => {
    const counts = new Map();
    for (const g of genericItems) counts.set(g.category, (counts.get(g.category) ?? 0) + 1);
    return counts;
  }, [genericItems]);

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

  const sectionedGenericItems = useMemo(() => {
    const groups = new Map();
    for (const g of filteredGenericItems) {
      if (!groups.has(g.category)) groups.set(g.category, []);
      groups.get(g.category).push(g);
    }
    return categories.filter((c) => groups.has(c)).map((c) => ({ category: c, items: groups.get(c) }));
  }, [filteredGenericItems, categories]);

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

  if (loading) return <p style={{ padding: 24 }}>読み込み中...</p>;
  if (error) return <p style={{ padding: 24, color: "#dc2626" }}>データの取得に失敗しました: {error}</p>;

  return (
    <AppShell
      view={view}
      setView={setView}
      showAuthForm={showAuthForm}
      onRequestAuth={() => setShowAuthForm(true)}
      onCloseAuth={() => setShowAuthForm(false)}
    >
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
          sectionedGenericItems={sectionedGenericItems}
          cartKeys={cartKeys}
          onToggleGeneric={(genericName) => toggleCartKey(genericKey(genericName))}
          onToggleProductCart={(id) => toggleCartKey(productKey(id))}
          favoriteIds={favoriteIds}
          onToggleFavorite={toggleFavorite}
          discountedProductIds={discountedProductIds}
        />
      )}

      {view === "cart" && (
        <ShoppingListCompare
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

      {view === "map" && <MapView stores={stores} />}

      {view === "favorites" && (
        <FavoritesView
          products={products}
          favoriteIds={favoriteIds}
          isLoggedIn={!!user}
          onOpenAuth={() => setShowAuthForm(true)}
          onToggleFavorite={toggleFavorite}
          onAddProductToCart={(id) => toggleCartKey(productKey(id))}
          cartKeys={cartKeys}
        />
      )}
    </AppShell>
  );
}
