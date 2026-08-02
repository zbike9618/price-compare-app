import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { useAuth } from "../lib/AuthContext.jsx";
import { useFavorites } from "../lib/useFavorites.js";
import { computeDiscountInfo, computeStoreDiscountRates, isPriceDrop, isRecentPriceDrop, thirtyDayLowPrice } from "../lib/discount.js";
import { productKey } from "../lib/cartKeys.js";
import { haversineDistanceKm, loadRangeSetting, saveRangeSetting } from "../lib/geo.js";
import { BUILTIN_PRESETS, loadCustomPresets, saveCustomPreset, deleteCustomPreset } from "../lib/presets.js";
import { hasSeenOnboarding } from "../lib/onboarding.js";
import { dismissDrops, dropSignature, isDropDismissed } from "../lib/notifications.js";
import { getMonthlySavings } from "../lib/savings.js";
import { Bell, X } from "lucide-react";
import AppShell from "../components/AppShell.jsx";
import OnboardingTour from "../components/OnboardingTour.jsx";
import PasscodeGate from "../components/PasscodeGate.jsx";
import ListView from "./ListView.jsx";
import ShoppingListCompare from "./ShoppingListCompare.jsx";
import MapView from "./MapView.jsx";
import FavoritesView from "./FavoritesView.jsx";
import HomeView from "./HomeView.jsx";
import { ACCENT } from "../lib/theme.js";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export default function PriceCompareReal() {
  const { user, signOut } = useAuth();
  const { favoriteIds, toggleFavorite } = useFavorites(user);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stores, setStores] = useState([]);
  const [products, setProducts] = useState([]);
  const [historyByPair, setHistoryByPair] = useState(() => new Map());
  const [rangeSetting, setRangeSetting] = useState(() => loadRangeSetting());
  const [view, setView] = useState("home");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("priceAsc");
  const [activeCategory, setActiveCategory] = useState(null);
  const [cart, setCart] = useState(() => new Set());
  const [cartSearch, setCartSearch] = useState("");
  const [customPresets, setCustomPresets] = useState(() => loadCustomPresets());
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => !hasSeenOnboarding());
  const [passcodeUnlocked, setPasscodeUnlocked] = useState(false);
  const [dismissedVersion, setDismissedVersion] = useState(0);
  const [discountOnly, setDiscountOnly] = useState(false);
  const [storeFilter, setStoreFilter] = useState(null);
  const [geoPromptDismissed, setGeoPromptDismissed] = useState(false);
  const [geoRequesting, setGeoRequesting] = useState(false);
  const [geoError, setGeoError] = useState(null);

  // 説明もなくいきなりブラウザの位置情報許可ダイアログを出すと不安になるため、
  // Zの明示的な「許可する」操作を経てから navigator.geolocation を呼ぶ
  const requestCurrentLocation = () => {
    setGeoError(null);
    if (!window.isSecureContext || !navigator.geolocation) {
      setGeoError("この端末・接続では現在地を取得できません。地図タブから範囲を手動で選んでください");
      return;
    }
    setGeoRequesting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { center: { lat: pos.coords.latitude, lng: pos.coords.longitude }, radiusKm: 3 };
        saveRangeSetting(next);
        setRangeSetting(next);
        setGeoRequesting(false);
      },
      () => {
        setGeoRequesting(false);
        setGeoError("現在地を取得できませんでした。地図タブから範囲を手動で選んでください");
      }
    );
  };

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
            min30: thirtyDayLowPrice(historyDesc),
            discount: computeDiscountInfo(historyDesc),
            isNewLow: isRecentPriceDrop(historyDesc),
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
      if (isPriceDrop(historyDesc)) discounted.add(productId);
    }
    return discounted;
  }, [historyByPair, storesInRangeIds]);

  const topDiscountStore = useMemo(() => {
    const rates = computeStoreDiscountRates(historyByPair, storesInRangeIds);
    const top = rates[0];
    if (!top || top.discounted === 0) return null;
    const name = stores.find((s) => s.id === top.storeId)?.name ?? "不明な店舗";
    return { storeId: top.storeId, name, rate: top.rate, discounted: top.discounted, total: top.total };
  }, [historyByPair, storesInRangeIds, stores]);

  const productHistoryById = useMemo(() => {
    const storeNameById = new Map(stores.map((s) => [s.id, s.name]));
    const byProduct = new Map();
    for (const [key, historyDesc] of historyByPair) {
      const [storeId, productId] = key.split(":");
      if (storesInRangeIds && !storesInRangeIds.has(storeId)) continue;
      if (!byProduct.has(productId)) byProduct.set(productId, []);
      byProduct.get(productId).push({
        storeId,
        storeName: storeNameById.get(storeId) ?? "不明な店舗",
        history: historyDesc,
      });
    }
    return byProduct;
  }, [historyByPair, storesInRangeIds, stores]);

  const favoritePriceDrops = useMemo(() => {
    return productsInRange.filter(
      (p) =>
        favoriteIds.has(p.id) &&
        discountedProductIds.has(p.id) &&
        !isDropDismissed(p.id, p.prices[0].price)
    );
    // dismissedVersionは既読状態(localStorage)の変化を再評価させるためだけの依存
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productsInRange, favoriteIds, discountedProductIds, dismissedVersion]);

  const handleDismissPriceDrops = () => {
    dismissDrops(favoritePriceDrops.map((p) => dropSignature(p.id, p.prices[0].price)));
    setDismissedVersion((v) => v + 1);
  };

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
      if (sortBy === "discountDesc") return (b.prices[0].discount?.pct ?? -1) - (a.prices[0].discount?.pct ?? -1);
      if (sortBy === "name") return a.name.localeCompare(b.name, "ja");
      return 0;
    });

    // 値引き率順のときはカテゴリを跨いで純粋に値引き率が高い順に並べたいため、セクション分割せず1つのリストにする
    if (sortBy === "discountDesc") {
      return list.length > 0 ? [{ category: "__all__", items: list }] : [];
    }

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
      .sort((a, b) => {
        const aComplete = a.foundCount === cartEntries.length;
        const bComplete = b.foundCount === cartEntries.length;
        if (aComplete !== bComplete) return aComplete ? -1 : 1;
        return a.total - b.total;
      });
  }, [stores, cartEntries]);

  const handleConfirmRange = (center, radiusKm) => {
    const next = { center, radiusKm };
    saveRangeSetting(next);
    setRangeSetting(next);
    setActiveCategory(null);
    setView("list");
  };

  if (!passcodeUnlocked) {
    return <PasscodeGate onUnlock={() => setPasscodeUnlocked(true)} />;
  }

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: "64px 24px" }}>
        <style>{`
          @keyframes price-compare-spin { to { transform: rotate(360deg); } }
        `}</style>
        <div
          style={{
            width: 36, height: 36, borderRadius: "50%",
            border: "3px solid #e2e8f0", borderTopColor: ACCENT,
            animation: "price-compare-spin 0.8s linear infinite",
          }}
        />
        <p style={{ margin: 0, color: "#64748b", fontSize: 15 }}>読み込み中です…</p>
      </div>
    );
  }
  if (error) return <p style={{ padding: 24, color: "#dc2626", fontSize: 15 }}>データがうまく読み込めませんでした: {error}</p>;

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
      onCloseAuth={() => setShowAuthForm(false)}
    >
      {favoritePriceDrops.length > 0 && (
        <div
          style={{
            display: "flex", alignItems: "flex-start", gap: 10, background: "#fef3c7",
            border: "1px solid #f59e0b", borderRadius: 12, padding: "12px 15px", marginBottom: 14,
          }}
        >
          <Bell size={19} color="#b45309" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1, fontSize: 14.5, color: "#92400e" }}>
            お気に入りの{favoritePriceDrops.length}件が安くなっています：
            {favoritePriceDrops.map((p) => p.name).join("・")}
          </div>
          <button
            type="button"
            onClick={handleDismissPriceDrops}
            aria-label="通知を閉じる"
            style={{ border: "none", background: "transparent", padding: 0, color: "#92400e", flexShrink: 0 }}
          >
            <X size={17} />
          </button>
        </div>
      )}

      {view !== "map" && view !== "home" && (
        <button
          type="button"
          onClick={() => setView("map")}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
            border: "1px solid #e2e8f0", borderRadius: 12, padding: "11px 15px", marginBottom: 14,
            background: "#fff", fontSize: 14, color: "#334155", cursor: "pointer",
          }}
        >
          <span>
            {rangeSetting
              ? `半径${rangeSetting.radiusKm.toFixed(1)}km・対象${inRangeStoreCount}店舗`
              : "範囲は未設定です：すべてのお店を表示中"}
          </span>
          <span style={{ color: ACCENT, fontWeight: 700 }}>範囲を設定</span>
        </button>
      )}

      {view === "home" && (
        <HomeView
          onNavigate={setView}
          monthlySavings={getMonthlySavings()}
          topDiscountStore={topDiscountStore}
          onViewStore={(storeId, storeName) => {
            setStoreFilter({ storeId, storeName });
            setDiscountOnly(true);
            setSortBy("discountDesc");
            setView("list");
          }}
          onViewDiscountRanking={() => {
            setStoreFilter(null);
            setDiscountOnly(true);
            setSortBy("discountDesc");
            setView("list");
          }}
          onViewAllProducts={() => {
            setStoreFilter(null);
            setDiscountOnly(false);
            setSortBy("priceAsc");
            setView("list");
          }}
          isLoggedIn={!!user}
          onRequestAuth={() => setShowAuthForm(true)}
          onSignOut={signOut}
          onRequestOnboarding={() => setShowOnboarding(true)}
          showGeoPrompt={!rangeSetting && !geoPromptDismissed}
          geoRequesting={geoRequesting}
          geoError={geoError}
          onAllowGeo={requestCurrentLocation}
          onDismissGeoPrompt={() => setGeoPromptDismissed(true)}
        />
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
          productHistoryById={productHistoryById}
          rangeHint={rangeHint}
          discountOnly={discountOnly}
          setDiscountOnly={setDiscountOnly}
          storeFilter={storeFilter}
          setStoreFilter={setStoreFilter}
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
        <>
          <div
            style={{
              display: "flex", flexDirection: "column", gap: 3, border: "1px solid #e2e8f0", borderRadius: 12,
              padding: "11px 15px", marginBottom: 14, background: "#fff", fontSize: 14, color: "#334155",
            }}
          >
            <span style={{ fontWeight: 700 }}>
              {rangeSetting
                ? `現在地の周辺 半径${rangeSetting.radiusKm.toFixed(1)}km・${inRangeStoreCount}店舗を表示中`
                : "周辺のお店をすべて表示しています（範囲は未設定です）"}
            </span>
            <span style={{ color: "#94a3b8" }}>
              ピンをタップするとお店の名前が見られます{rangeSetting ? "。薄いピンは範囲の外のお店です" : ""}
            </span>
          </div>
          <MapView
            stores={stores}
            rangeSetting={rangeSetting}
            inRangeStoreIds={storesInRangeIds}
            onConfirmRange={handleConfirmRange}
          />
        </>
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
