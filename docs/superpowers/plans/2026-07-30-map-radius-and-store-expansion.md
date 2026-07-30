# 地図起点の範囲内比較 + 岡山エリア店舗拡大調査 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `price-compare-app`のアプリ体験を「地図で範囲（円）を指定→範囲内の店舗のみで価格比較」というフローに転換し、あわせて岡山エリア内での店舗拡大候補（両備まごころネットスーパー）の調査に着手する。

**Architecture:** 中心座標・半径をLocalStorageに永続化し、Haversine距離計算で「店舗が範囲内かどうか」を判定する。既存の`MapView`を円選択モード付きに拡張し、`PriceCompareReal.jsx`側で範囲内店舗の価格データのみに絞り込んだ`productsInRange`を全ての一覧・カート・プリセットロジックの入力にする。店舗拡大は自動化できない調査工程（利用規約確認・アクセス可否判断）を含むため、コード実装ではなく調査タスクとして扱う。

**Tech Stack:** 既存と同じ（Vite + React + lucide-react + プレーンCSS + Leaflet + `@supabase/supabase-js`）。新規依存追加なし。

## Global Constraints

- プロジェクトルート: `C:\Users\RuiRu\OneDrive\Desktop\claude-code\price-compare-app\`
- **全国展開はしない**。岡山エリア内での店舗拡大に限定する（Zの判断済み）
- 半径スライダーの範囲: 1km〜10km、デフォルト3km、刻み0.5km
- 地図の初期中心（現在地・保存済み範囲のいずれも無い場合）: 岡山駅周辺（緯度34.6551、経度133.9195）
- 中心座標・半径はLocalStorageに保存し、次回起動時も引き継ぐ
- 範囲設定が無い場合は起動時に地図タブ（円選択モード）を表示し、範囲設定がある場合は最安値一覧タブを表示する
- 範囲内店舗の判定は緯度経度が無い店舗を「範囲外」として扱う（判定不可能なため安全側に倒す）
- 既存のお気に入り・値下げバッジ・買い物リスト比較・プリセット機能のロジック自体（判定基準）は変更しない。入力となる商品データを「範囲内店舗の価格のみ」に絞り込むだけ
- このプロジェクトに自動UIテストの前例はなく、純粋関数（`geo.js`のHaversine距離計算）のみvitestで自動テストする方針。それ以外はビルド確認・ブラウザ実機確認（可能な場合）で検証する

---

### Task 1: `src/lib/geo.js`（Haversine距離計算・範囲設定の永続化）

**Files:**
- Create: `src/lib/geo.js`
- Create: `src/lib/geo.test.js`

**Interfaces:**
- Consumes: なし
- Produces: `export function haversineDistanceKm(lat1, lng1, lat2, lng2): number`。`export function loadRangeSetting(): { center: { lat: number, lng: number }, radiusKm: number } | null`。`export function saveRangeSetting(rangeSetting: { center: { lat: number, lng: number }, radiusKm: number }): void`。Task 2（MapView）・Task 3（PriceCompareReal）がこれらを使う

- [ ] **Step 1: 失敗するテストを書く**

```javascript
// src/lib/geo.test.js
import { describe, expect, it } from "vitest";
import { haversineDistanceKm } from "./geo.js";

describe("haversineDistanceKm", () => {
  it("同じ地点なら距離は0", () => {
    expect(haversineDistanceKm(34.6551, 133.9195, 34.6551, 133.9195)).toBeCloseTo(0, 5);
  });

  it("緯度1度分の距離はおよそ111kmになる", () => {
    const distance = haversineDistanceKm(34.6551, 133.9195, 35.6551, 133.9195);
    expect(distance).toBeGreaterThan(110);
    expect(distance).toBeLessThan(112);
  });

  it("岡山駅(34.6551,133.9195)から倉敷市堀南(34.5989,133.7639)まではおよそ15〜16km", () => {
    const distance = haversineDistanceKm(34.6551, 133.9195, 34.5989, 133.7639);
    expect(distance).toBeGreaterThan(13);
    expect(distance).toBeLessThan(18);
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認**

Run: `npx vitest run src/lib/geo.test.js`
Expected: FAIL（`geo.js`が存在しない）

- [ ] **Step 3: 実装を書く**

```javascript
// src/lib/geo.js
const EARTH_RADIUS_KM = 6371;

/**
 * 2地点間の距離をkm単位で計算する（Haversine公式）
 */
export function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

const RANGE_STORAGE_KEY = "priceCompareApp.rangeSetting";

export function loadRangeSetting() {
  try {
    const raw = localStorage.getItem(RANGE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      !parsed?.center ||
      typeof parsed.center.lat !== "number" ||
      typeof parsed.center.lng !== "number" ||
      typeof parsed.radiusKm !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveRangeSetting(rangeSetting) {
  localStorage.setItem(RANGE_STORAGE_KEY, JSON.stringify(rangeSetting));
}
```

- [ ] **Step 4: テストを実行し成功を確認**

Run: `npx vitest run src/lib/geo.test.js`
Expected: PASS（3件すべて）

- [ ] **Step 5: コミット**

```bash
git add src/lib/geo.js src/lib/geo.test.js
git commit -m "距離計算・範囲設定永続化のgeo.jsをTDDで実装"
```

---

### Task 2: `MapView.jsx`に円選択モード・半径スライダーを追加

**Files:**
- Modify: `src/pages/MapView.jsx`（全面書き換え）

**Interfaces:**
- Consumes: `haversineDistanceKm`（Task 1、実際にはこのコンポーネント内では使わず`inRangeStoreIds`propで結果のみ受け取る）
- Produces: `export default function MapView({ stores, rangeSetting, inRangeStoreIds, onConfirmRange })` — `rangeSetting`は`{ center: {lat,lng}, radiusKm } | null`、`inRangeStoreIds`は`Set<string> | null`（範囲内店舗idの集合、`rangeSetting`が`null`のときは`null`）、`onConfirmRange(center, radiusKm)`は円選択モードで「この範囲で決定」を押したときのコールバック。Task 3（PriceCompareReal）がこれを使う

- [ ] **Step 1: 実装**

```jsx
// src/pages/MapView.jsx
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const OKAYAMA_CITY_CENTER = { lat: 34.6551, lng: 133.9195 };
const DEFAULT_RADIUS_KM = 3;

export default function MapView({ stores, rangeSetting, inRangeStoreIds, onConfirmRange }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const circleRef = useRef(null);
  const clickHandlerRef = useRef(null);

  const [selecting, setSelecting] = useState(() => rangeSetting == null);
  const [draftCenter, setDraftCenter] = useState(() => rangeSetting?.center ?? null);
  const [draftRadiusKm, setDraftRadiusKm] = useState(() => rangeSetting?.radiusKm ?? DEFAULT_RADIUS_KM);
  const [geoError, setGeoError] = useState(null);

  const withCoords = stores.filter((s) => s.lat != null && s.lng != null);

  // 地図の初期化（初回のみ）
  useEffect(() => {
    if (!containerRef.current || mapRef.current || withCoords.length === 0) return;
    mapRef.current = L.map(containerRef.current);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(mapRef.current);

    const initialCenter = draftCenter ?? OKAYAMA_CITY_CENTER;
    mapRef.current.setView([initialCenter.lat, initialCenter.lng], 13);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withCoords.length > 0]);

  // マーカー・円・クリックハンドラの再描画
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];
    if (circleRef.current) {
      map.removeLayer(circleRef.current);
      circleRef.current = null;
    }
    if (clickHandlerRef.current) {
      map.off("click", clickHandlerRef.current);
      clickHandlerRef.current = null;
    }

    if (selecting) {
      const handler = (e) => setDraftCenter({ lat: e.latlng.lat, lng: e.latlng.lng });
      map.on("click", handler);
      clickHandlerRef.current = handler;

      if (draftCenter) {
        circleRef.current = L.circle([draftCenter.lat, draftCenter.lng], {
          radius: draftRadiusKm * 1000,
          color: "#2563eb",
          fillColor: "#2563eb",
          fillOpacity: 0.12,
        }).addTo(map);
        const centerMarker = L.circleMarker([draftCenter.lat, draftCenter.lng], {
          radius: 6,
          color: "#2563eb",
          fillColor: "#2563eb",
          fillOpacity: 1,
        }).addTo(map);
        markersRef.current.push(centerMarker);
      }

      markersRef.current.push(
        ...withCoords.map((s) => {
          const marker = L.marker([s.lat, s.lng]).addTo(map).bindPopup(s.name);
          marker.setOpacity(0.5);
          return marker;
        })
      );
    } else {
      markersRef.current = withCoords.map((s) => {
        const marker = L.marker([s.lat, s.lng]).addTo(map).bindPopup(s.name);
        if (inRangeStoreIds && !inRangeStoreIds.has(s.id)) marker.setOpacity(0.35);
        return marker;
      });

      if (rangeSetting) {
        circleRef.current = L.circle([rangeSetting.center.lat, rangeSetting.center.lng], {
          radius: rangeSetting.radiusKm * 1000,
          color: "#2563eb",
          fillColor: "#2563eb",
          fillOpacity: 0.08,
        }).addTo(map);
      }

      if (withCoords.length > 0) {
        const bounds = L.latLngBounds(withCoords.map((s) => [s.lat, s.lng]));
        map.fitBounds(bounds.pad(0.3));
      }
    }
  }, [selecting, draftCenter, draftRadiusKm, stores, inRangeStoreIds, rangeSetting]);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoError("この端末では現在地を取得できません");
      return;
    }
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const center = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setDraftCenter(center);
        mapRef.current?.setView([center.lat, center.lng], 14);
      },
      () => setGeoError("現在地を取得できませんでした。地図をタップして選んでください")
    );
  };

  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", position: "relative" }}>
      {withCoords.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
          座標データのある店舗がありません
        </div>
      ) : (
        <>
          <div ref={containerRef} style={{ height: 420, width: "100%" }} />

          {selecting ? (
            <div
              style={{
                position: "absolute", top: 14, right: 14, background: "#fff", borderRadius: 10,
                padding: 12, width: 190, boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
              }}
            >
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>
                比較範囲: <b style={{ color: "#0f172a" }}>{draftRadiusKm.toFixed(1)}km</b>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                step="0.5"
                value={draftRadiusKm}
                onChange={(e) => setDraftRadiusKm(Number(e.target.value))}
                style={{ width: "100%" }}
              />
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                style={{
                  display: "block", width: "100%", textAlign: "left", border: "none", background: "transparent",
                  color: "#2563eb", fontSize: 11, margin: "8px 0", padding: 0, cursor: "pointer",
                }}
              >
                📍 現在地を使う
              </button>
              {geoError && <div style={{ fontSize: 10, color: "#dc2626", marginBottom: 8 }}>{geoError}</div>}
              <button
                type="button"
                disabled={!draftCenter}
                onClick={() => onConfirmRange(draftCenter, draftRadiusKm)}
                style={{
                  width: "100%", padding: 8, background: draftCenter ? "#2563eb" : "#cbd5e1", color: "#fff",
                  border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700,
                  cursor: draftCenter ? "pointer" : "not-allowed",
                }}
              >
                この範囲で決定
              </button>
              {!draftCenter && (
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 6 }}>
                  地図をタップするか現在地を使ってください
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraftCenter(rangeSetting?.center ?? null);
                setDraftRadiusKm(rangeSetting?.radiusKm ?? DEFAULT_RADIUS_KM);
                setSelecting(true);
              }}
              style={{
                position: "absolute", top: 14, right: 14, background: "#fff", border: "1px solid #e2e8f0",
                borderRadius: 999, padding: "8px 14px", fontSize: 12, fontWeight: 700, color: "#2563eb",
                boxShadow: "0 2px 6px rgba(0,0,0,0.08)", cursor: "pointer",
              }}
            >
              範囲を変更
            </button>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: ビルド確認（この時点ではまだ`PriceCompareReal.jsx`が旧propsで`MapView`を呼んでいるためビルドエラーは無視してよい。構文エラーのみ確認する）**

```bash
npx oxlint src/pages/MapView.jsx
```

Expected: 構文エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/pages/MapView.jsx
git commit -m "MapViewに円選択モード・半径スライダー・現在地ボタンを追加"
```

---

### Task 3: `PriceCompareReal.jsx`に範囲フィルタリングを統合

**Files:**
- Modify: `src/pages/PriceCompareReal.jsx`（全面書き換え）

**Interfaces:**
- Consumes: `haversineDistanceKm`・`loadRangeSetting`・`saveRangeSetting`（Task 1）、`MapView`（Task 2）
- Produces: `export default function PriceCompareReal()` — 既存と同じ（`main-app.jsx`から呼ばれる、propsなし）

- [ ] **Step 1: 実装**

`products`（Supabaseから取得した全店舗の価格データ）はそのまま保持しつつ、`rangeSetting`（LocalStorageから読み込む中心座標・半径）をもとに`storesInRangeIds`・`productsInRange`を新たに導出する。以降のカテゴリ集計・一覧表示・カート・プリセットのロジックは全て`productsInRange`を入力にする（判定ロジック自体は変更しない）。

```jsx
// src/pages/PriceCompareReal.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { useAuth } from "../lib/AuthContext.jsx";
import { useFavorites } from "../lib/useFavorites.js";
import { isRecentPriceDrop } from "../lib/discount.js";
import { productKey } from "../lib/cartKeys.js";
import { haversineDistanceKm, loadRangeSetting, saveRangeSetting } from "../lib/geo.js";
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
  const [rangeSetting, setRangeSetting] = useState(() => loadRangeSetting());
  const [view, setView] = useState(() => (loadRangeSetting() ? "list" : "map"));
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
    setView("list");
  };

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
          sectionedProducts={sectionedProducts}
          cartKeys={cartKeys}
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
  );
}
```

- [ ] **Step 2: ブラウザ実機で確認**

```bash
npm run dev
```

以下を実機で確認する:
- LocalStorageに範囲設定が無い状態（devtoolsで`localStorage.removeItem("priceCompareApp.rangeSetting")`してからリロード）でアプリを開くと、地図タブが円選択モードで表示される
- 現在地ボタン・地図クリックの両方で中心地点を指定できる
- 半径スライダーを動かすと円の大きさが変わる
- 「この範囲で決定」を押すと最安値一覧タブに自動遷移し、範囲内店舗の商品だけが表示される
- リロードしても同じ範囲設定が引き継がれ、円選択モードがスキップされること
- 地図タブの「範囲を変更」ボタンで再度円選択モードに入れること、その際に範囲外の店舗ピンが薄く表示されること
- お気に入り・値下げバッジ・買い物リスト比較・プリセットが引き続き正常に機能すること（回帰確認）

- [ ] **Step 3: コミット**

```bash
git add src/pages/PriceCompareReal.jsx
git commit -m "PriceCompareRealに範囲内店舗フィルタリングを統合し地図起点フローに対応"
```

---

### Task 4: 岡山エリア店舗拡大候補「両備まごころネットスーパー」の調査

**Files:**
- Create: なし（コード変更はこのタスクの対象外。調査結果は`.secretary/projects/price-compare-app/project.md`に記録する）

**Interfaces:**
- Consumes: なし
- Produces: 「両備まごころネットスーパーをスクレイピング対象に追加できるか」の調査結果。Zの判断を仰いだ上で、次の実装計画（新規アダプタ実装）に進むかどうかが決まる

**背景**: 両備まごころネットスーパーは楽天の「楽天全国スーパー」プラットフォーム上で運営されている。既存の2種類のアダプタ（AEON専用の`scraper/lib/aeon.js`、旧ASP共通の`scraper/lib/legacyPlatform.js`）とは異なる新規プラットフォームのため、対応可否の調査から始める必要がある。過去の3店舗導入時と同様、利用規約確認・JANコード（または商品識別子）取得可否の最終確認はZとブラウザで一緒に行う必要があり、完全自動化できない。

- [ ] **Step 1: 実際の店舗URLを特定する**

Web検索で「両備まごころネットスーパー」の実際のURL（楽天市場内の店舗ページ、または専用ドメイン）を特定する。プレスリリース等では「楽天全国スーパー」内のサービスと案内されているため、実際にブラウザ相当のアクセス（`WebFetch`）で店舗トップページ・商品一覧ページに到達できるURLを確認する。

- [ ] **Step 2: robots.txtとサイト利用規約を確認する**

特定したドメインの`robots.txt`（例: `https://<ドメイン>/robots.txt`）を`WebFetch`で取得し、商品一覧・商品詳細ページへのクローラーアクセスが禁止されていないか確認する。あわせて利用規約ページ（多くの場合フッターにリンクがある）を`WebFetch`で取得し、スクレイピング・クローラー行為を禁止する条項が無いか確認する。

- [ ] **Step 3: 商品一覧・価格・商品識別子へのアクセス可否を確認する**

`WebFetch`で商品検索結果ページ・商品詳細ページの構造を確認し、以下を判定する:
- ログイン不要で商品名・価格が閲覧できるか
- JANコードに相当する商品識別子（画面表示・URL・HTML内のjavascriptリンク等）が取得可能か（過去の3店舗導入時、マルイ宅配便はJavaScriptリンクの引数に、イオンネットスーパーは画面表示にJANコードが埋め込まれていた前例がある）

`WebFetch`でのアクセスがログイン必須で先に進めない、またはJavaScript描画に依存していてページ内容が取得できない場合は、この時点で調査を打ち切り、Zにブラウザでの直接確認を依頼する（Step 4へ）。

- [ ] **Step 4: 調査結果をZに報告し、次の対応を確認する**

`AskUserQuestion`で以下を確認する:
- 調査の結果、スクレイピング対象として追加を進めてよいか（利用規約上問題なし・商品識別子取得可能と判断できた場合）
- Zによるブラウザでの追加確認が必要か（ログイン必須・JavaScript描画等で自動調査が届かなかった場合）
- 別の候補（おかやまコープ等）を先に調査するか

- [ ] **Step 5: 調査結果を`.secretary/projects/price-compare-app/project.md`に記録する**

「タスク」セクションの店舗拡大関連の記述、または新しい進捗ログとして、調査結果（robots.txt・利用規約の確認結果、商品識別子取得可否、Zとの合意事項）を記録する。次の実装計画（アダプタ実装）に進むかどうかもあわせて記載する。

---

### Task 5: LXC114デプロイ・secretary記録更新

**Files:**
- なし（デプロイ作業のみ）

**Interfaces:**
- Consumes: Task 1〜3の成果物
- Produces: `http://192.168.11.114/app.html`が地図起点フローで正しく動作する状態

- [ ] **Step 1: テスト・本番ビルド**

```bash
npm test
npm run build
```

Expected: テスト全件pass、`dist/`一式が生成されエラーなし

- [ ] **Step 2: LXC114にデプロイ**

```bash
scp -r dist/* root@192.168.11.114:/var/www/price-compare-app/
```

- [ ] **Step 3: LAN内から実機で最終確認**

`http://192.168.11.114/app.html`をブラウザで開き、Task 3のStep 2で確認した内容（地図起点フロー・範囲フィルタリング・回帰項目）が本番相当の環境でも同様に動作することを確認する

- [ ] **Step 4: `.secretary`側の記録を更新する**

`.secretary/projects/price-compare-app/project.md`に新しい進捗ログ（地図起点の範囲内比較機能の実装内容、Task 4の店舗調査結果）を追記する。`.secretary/todos/YYYY-MM-DD.md`（実施日の日次ファイル）で該当タスクを完了として`## 完了`セクションに移動し、`完了: YYYY-MM-DD`を付記する。
