// src/pages/HomeView.jsx
import { List, ShoppingCart, MapPin, Star, TrendingDown, Percent, LogIn, LogOut, HelpCircle, Navigation } from "lucide-react";
import { yen } from "../lib/format.js";
import { ACCENT } from "../lib/theme.js";

export default function HomeView({
  onNavigate,
  monthlySavings,
  topDiscountStore,
  onViewStore,
  onViewDiscountRanking,
  onViewAllProducts,
  isLoggedIn,
  onRequestAuth,
  onSignOut,
  onRequestOnboarding,
  showGeoPrompt,
  geoRequesting,
  geoError,
  onAllowGeo,
  onDismissGeoPrompt,
}) {
  const cards = [
    { id: "discountRanking", label: "値引き率が高い順で見る", icon: TrendingDown, onClick: onViewDiscountRanking, tourId: null },
    { id: "allProducts", label: "商品一覧を見る", icon: List, onClick: onViewAllProducts, tourId: "list" },
    { id: "cart", label: "買い物リストで比較", icon: ShoppingCart, onClick: () => onNavigate("cart"), tourId: "cart" },
    { id: "map", label: "地図で探す", icon: MapPin, onClick: () => onNavigate("map"), tourId: "map" },
    { id: "favorites", label: "お気に入り", icon: Star, onClick: () => onNavigate("favorites"), tourId: "favorites" },
    {
      id: "auth",
      label: isLoggedIn ? "ログアウト" : "ログイン",
      icon: isLoggedIn ? LogOut : LogIn,
      onClick: isLoggedIn ? onSignOut : onRequestAuth,
      tourId: null,
    },
    { id: "help", label: "使い方", icon: HelpCircle, onClick: onRequestOnboarding, tourId: null },
  ];

  return (
    <div>
      {showGeoPrompt && (
        <div
          style={{
            display: "flex", alignItems: "flex-start", gap: 12, background: "#fff",
            border: "1px solid #e2e8f0", borderRadius: 16, padding: "16px 18px", marginBottom: 14,
          }}
        >
          <div
            style={{
              width: 40, height: 40, borderRadius: 12, background: "#eff6ff",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
          >
            <Navigation size={19} color="#2563eb" strokeWidth={2.2} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>近くのお店を自動で選びますか？</div>
            <div style={{ fontSize: 13.5, color: "#64748b", lineHeight: 1.7, marginBottom: 12 }}>
              位置情報を使うと、地図で範囲を選ぶ手間なく近くのお店の値段をすぐ比べられます。あとから地図タブでいつでも変更できます。
            </div>
            {geoError && (
              <div style={{ fontSize: 13, color: "#dc2626", marginBottom: 10 }}>{geoError}</div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={onAllowGeo}
                disabled={geoRequesting}
                style={{
                  border: "none", borderRadius: 10, padding: "9px 16px", background: ACCENT, color: "#fff",
                  fontSize: 14, fontWeight: 700, opacity: geoRequesting ? 0.6 : 1,
                }}
              >
                {geoRequesting ? "取得中…" : "位置情報を許可する"}
              </button>
              <button
                type="button"
                onClick={onDismissGeoPrompt}
                style={{ border: "none", background: "transparent", color: "#64748b", fontSize: 14, padding: "9px 4px" }}
              >
                あとで
              </button>
            </div>
          </div>
        </div>
      )}

      {monthlySavings > 0 && (
        <div
          style={{
            background: "#ecfdf5", border: "1px solid #4ade80", borderRadius: 12,
            padding: "13px 16px", marginBottom: 14, fontSize: 15, color: "#15803d",
          }}
        >
          今月の節約額 <strong>{yen(monthlySavings)}</strong>
        </div>
      )}

      {topDiscountStore && (
        <button
          type="button"
          onClick={() => onViewStore(topDiscountStore.storeId, topDiscountStore.name)}
          style={{
            display: "flex", alignItems: "center", gap: 12, background: "#fef2f2", width: "100%",
            border: "1px solid #fca5a5", borderRadius: 16, padding: "14px 18px", marginBottom: 14, textAlign: "left",
          }}
        >
          <div
            style={{
              width: 42, height: 42, borderRadius: 12, background: "#fee2e2",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
          >
            <Percent size={20} color="#dc2626" strokeWidth={2.2} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#991b1b" }}>
              今いちばんお得なのは<strong>{topDiscountStore.name}</strong>さんです
            </div>
            <div style={{ fontSize: 14, color: "#b91c1c" }}>
              {topDiscountStore.discounted}/{topDiscountStore.total}品目、約{Math.round(topDiscountStore.rate * 100)}%が値下げ中です（タップでこの店舗の値引き商品一覧を見る）
            </div>
          </div>
        </button>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              type="button"
              data-tour-id={card.tourId ?? undefined}
              onClick={card.onClick}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 10, aspectRatio: "1 / 1", border: "1px solid #e2e8f0", borderRadius: 16,
                background: "#fff", color: "#1e293b", fontSize: 15, fontWeight: 700,
              }}
            >
              <Icon size={30} color={ACCENT} />
              {card.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
