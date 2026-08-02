import { Home, ShoppingCart, Star } from "lucide-react";
import AuthForm from "./AuthForm.jsx";
import { ACCENT, ACCENT_LIGHT } from "../lib/theme.js";

const NAV_ITEMS = [
  { id: "home", label: "ホーム", icon: Home },
  { id: "cart", label: "比較", icon: ShoppingCart },
  { id: "favorites", label: "お気に入り", icon: Star },
];

export default function AppShell({ view, setView, children, showAuthForm, onCloseAuth }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <style>{`
        .app-sidebar { display: none; }
        .app-bottomnav { display: flex; }
        @media (min-width: 768px) {
          .app-sidebar { display: flex; }
          .app-bottomnav { display: none; }
        }
      `}</style>

      <nav
        className="app-sidebar"
        style={{
          flexDirection: "column", width: 96, borderRight: "1px solid #e2e8f0",
          background: "#fff", padding: "22px 8px", gap: 6, flexShrink: 0,
        }}
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = view === item.id;
          return (
            <button
              key={item.id}
              type="button"
              data-tour-id={item.id}
              onClick={() => setView(item.id)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "12px 4px",
                border: "none", borderRadius: 12, background: active ? ACCENT_LIGHT : "transparent",
                color: active ? ACCENT : "#64748b", fontSize: 12,
              }}
            >
              <Icon size={21} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ flex: 1, maxWidth: 760, width: "100%", margin: "0 auto", padding: "22px 16px 92px" }}>
          {children}
        </div>

        <nav
          className="app-bottomnav"
          style={{
            position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff",
            borderTop: "1px solid #e2e8f0", padding: "8px 4px", zIndex: 2500,
          }}
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                data-tour-id={item.id}
                onClick={() => setView(item.id)}
                style={{
                  flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "8px 4px",
                  border: "none", background: "transparent", color: active ? ACCENT : "#94a3b8", fontSize: 12,
                }}
              >
                <Icon size={22} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      {showAuthForm && <AuthForm onClose={onCloseAuth} />}
    </div>
  );
}
