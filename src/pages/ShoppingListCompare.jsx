import { useState } from "react";
import { Search, Bookmark, Trash2, X, Crown } from "lucide-react";
import { yen } from "../lib/format.js";

export default function ShoppingListCompare({
  cartEntries,
  cartSearch,
  setCartSearch,
  cartSearchResults,
  onAddProduct,
  onRemoveEntry,
  cartStoreTotals,
  builtinPresets,
  customPresets,
  onApplyPresetKeys,
  onApplyCustomPreset,
  onSavePreset,
  onDeletePreset,
}) {
  const [presetNameInput, setPresetNameInput] = useState("");
  const [showSaveForm, setShowSaveForm] = useState(false);

  return (
    <>
      {(builtinPresets.length > 0 || customPresets.length > 0) && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 11, color: "#94a3b8", margin: "0 0 6px" }}>プリセットから追加</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {builtinPresets.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => onApplyPresetKeys(preset.keys)}
                style={{
                  display: "flex", alignItems: "center", gap: 4, padding: "5px 12px", borderRadius: 999,
                  border: "1px solid #e2e8f0", background: "#fff", fontSize: 12,
                }}
              >
                <Bookmark size={12} /> {preset.name}
              </button>
            ))}
            {customPresets.map((preset) => (
              <span
                key={preset.id}
                style={{
                  display: "flex", alignItems: "center", gap: 4, padding: "5px 6px 5px 12px", borderRadius: 999,
                  border: "1px solid #2563eb", background: "#fff", fontSize: 12,
                }}
              >
                <button
                  type="button"
                  onClick={() => onApplyCustomPreset(preset)}
                  style={{ border: "none", background: "transparent", padding: 0, color: "#2563eb" }}
                >
                  {preset.name}
                </button>
                <button
                  type="button"
                  onClick={() => onDeletePreset(preset.id)}
                  style={{ border: "none", background: "transparent", padding: 2, color: "#94a3b8" }}
                  aria-label="プリセットを削除"
                >
                  <Trash2 size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ position: "relative", marginBottom: 12 }}>
        <div
          style={{
            display: "flex", alignItems: "center", gap: 6, background: "#fff",
            border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 12px",
          }}
        >
          <Search size={16} color="#94a3b8" />
          <input
            value={cartSearch}
            onChange={(e) => setCartSearch(e.target.value)}
            placeholder="商品名で検索してリストに追加（例: 牛乳）"
            style={{ border: "none", flex: 1, fontSize: 14, background: "transparent" }}
          />
        </div>
        {cartSearchResults.length > 0 && (
          <div
            style={{
              position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#fff",
              border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", zIndex: 10,
            }}
          >
            {cartSearchResults.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onAddProduct(p.id)}
                style={{
                  display: "block", width: "100%", textAlign: "left", padding: "10px 12px",
                  border: "none", background: "#fff", fontSize: 13, borderTop: "1px solid #f1f5f9",
                }}
              >
                {p.name}
                <span style={{ color: "#94a3b8", marginLeft: 8 }}>
                  最安 {yen(p.prices[0].price)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {cartEntries.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "32px 16px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
          上の検索欄から商品名を追加すると、一番安い店をすぐ診断します
        </div>
      ) : (
        <>
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", marginBottom: 12 }}>
            {cartEntries.map((entry, i) => (
              <div
                key={entry.key}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 14px", borderTop: i === 0 ? "none" : "1px solid #f1f5f9",
                }}
              >
                <span style={{ fontSize: 13 }}>{entry.label}</span>
                <button type="button" onClick={() => onRemoveEntry(entry.key)} style={{ border: "none", background: "transparent", color: "#94a3b8" }}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>

          {showSaveForm ? (
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              <input
                value={presetNameInput}
                onChange={(e) => setPresetNameInput(e.target.value)}
                placeholder="プリセット名（例: いつもの買い物）"
                style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 12px", fontSize: 13 }}
              />
              <button
                type="button"
                onClick={() => {
                  if (!presetNameInput.trim()) return;
                  onSavePreset(presetNameInput.trim());
                  setPresetNameInput("");
                  setShowSaveForm(false);
                }}
                style={{ border: "1px solid #2563eb", borderRadius: 10, padding: "0 14px", background: "#2563eb", color: "#fff", fontSize: 13 }}
              >
                保存
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowSaveForm(true)}
              style={{
                display: "flex", alignItems: "center", gap: 6, border: "1px solid #e2e8f0", borderRadius: 10,
                padding: "8px 12px", background: "#fff", fontSize: 13, marginBottom: 12,
              }}
            >
              <Bookmark size={14} /> このリストをプリセット保存
            </button>
          )}

          <div style={{ background: "#0f172a", borderRadius: 16, overflow: "hidden" }}>
            {cartStoreTotals.map((s, i) => (
              <div
                key={s.id}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px",
                  borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.1)", color: "#fff",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {i === 0 && <Crown size={16} color="#f59e0b" />}
                  <div>
                    <div style={{ fontSize: 13 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{s.foundCount}/{cartEntries.length}品目が対象</div>
                  </div>
                </div>
                <div className="price-num" style={{ fontSize: 18, fontWeight: 700 }}>{yen(s.total)}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
