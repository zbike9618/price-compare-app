// src/pages/HomeView.jsx
import { List, ShoppingCart, MapPin, Star } from "lucide-react";
import { yen } from "../lib/format.js";
import { ACCENT } from "../lib/theme.js";

const CARDS = [
  { id: "list", label: "最安値を見る", icon: List },
  { id: "cart", label: "買い物リストで比較", icon: ShoppingCart },
  { id: "map", label: "地図で探す", icon: MapPin },
  { id: "favorites", label: "お気に入り", icon: Star },
];

export default function HomeView({ onNavigate, monthlySavings }) {
  return (
    <div>
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => onNavigate(card.id)}
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
