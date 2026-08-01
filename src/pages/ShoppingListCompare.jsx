import { useEffect, useRef, useState } from "react";
import { Search, Bookmark, Trash2, X, Crown, PiggyBank } from "lucide-react";
import { yen } from "../lib/format.js";
import { computeMultiStoreSavings, computeSavingsMessage, getMonthlySavings, recordSavings } from "../lib/savings.js";
import { ACCENT } from "../lib/theme.js";

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
  const [monthlySavings, setMonthlySavings] = useState(() => getMonthlySavings());
  const lastRecordedRef = useRef(null);

  const savingsMessage = computeSavingsMessage(cartStoreTotals, cartEntries.length);
  const multiStoreSavings = computeMultiStoreSavings(cartEntries, cartStoreTotals, cartEntries.length);

  useEffect(() => {
    if (!savingsMessage) return;
    const signature = `${savingsMessage.cheapestName}:${savingsMessage.comparedName}:${savingsMessage.diff}`;
    if (lastRecordedRef.current === signature) return;
    lastRecordedRef.current = signature;
    setMonthlySavings(recordSavings(savingsMessage.diff));
  }, [savingsMessage]);

  return (
    <>
      {(builtinPresets.length > 0 || customPresets.length > 0) && (
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 8px" }}>いつものリストから追加</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {builtinPresets.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => onApplyPresetKeys(preset.keys)}
                style={{
                  display: "flex", alignItems: "center", gap: 5, padding: "8px 15px", borderRadius: 999,
                  border: "1px solid #e2e8f0", background: "#fff", fontSize: 14,
                }}
              >
                <Bookmark size={14} /> {preset.name}
              </button>
            ))}
            {customPresets.map((preset) => (
              <span
                key={preset.id}
                style={{
                  display: "flex", alignItems: "center", gap: 5, padding: "7px 8px 7px 15px", borderRadius: 999,
                  border: `1px solid ${ACCENT}`, background: "#fff", fontSize: 14,
                }}
              >
                <button
                  type="button"
                  onClick={() => onApplyCustomPreset(preset)}
                  style={{ border: "none", background: "transparent", padding: 0, color: ACCENT }}
                >
                  {preset.name}
                </button>
                <button
                  type="button"
                  onClick={() => onDeletePreset(preset.id)}
                  style={{ border: "none", background: "transparent", padding: 2, color: "#94a3b8" }}
                  aria-label="プリセットを削除"
                >
                  <Trash2 size={14} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ position: "relative", marginBottom: 14 }}>
        <div
          style={{
            display: "flex", alignItems: "center", gap: 8, background: "#fff",
            border: "1px solid #e2e8f0", borderRadius: 12, padding: "12px 16px",
          }}
        >
          <Search size={19} color="#94a3b8" />
          <input
            value={cartSearch}
            onChange={(e) => setCartSearch(e.target.value)}
            placeholder="商品名で検索してリストに追加（例: 牛乳）"
            style={{ border: "none", flex: 1, fontSize: 16, background: "transparent" }}
          />
        </div>
        {cartSearchResults.length > 0 && (
          <div
            style={{
              position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#fff",
              border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", zIndex: 10,
            }}
          >
            {cartSearchResults.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onAddProduct(p.id)}
                style={{
                  display: "block", width: "100%", textAlign: "left", padding: "12px 16px",
                  border: "none", background: "#fff", fontSize: 15, borderTop: "1px solid #f1f5f9",
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
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: "36px 18px", textAlign: "center", color: "#94a3b8", fontSize: 15 }}>
          上の検索欄から商品名を入れてみてください。追加するとすぐ、一番安いお店をお教えします
        </div>
      ) : (
        <>
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, overflow: "hidden", marginBottom: 14 }}>
            {cartEntries.map((entry, i) => (
              <div
                key={entry.key}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "13px 16px", borderTop: i === 0 ? "none" : "1px solid #f1f5f9",
                }}
              >
                <span style={{ fontSize: 15 }}>{entry.label}</span>
                <button type="button" onClick={() => onRemoveEntry(entry.key)} style={{ border: "none", background: "transparent", color: "#94a3b8" }}>
                  <X size={17} />
                </button>
              </div>
            ))}
          </div>

          {showSaveForm ? (
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <input
                value={presetNameInput}
                onChange={(e) => setPresetNameInput(e.target.value)}
                placeholder="リストの名前（例: いつものお買い物）"
                style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 12, padding: "11px 16px", fontSize: 15 }}
              />
              <button
                type="button"
                onClick={() => {
                  if (!presetNameInput.trim()) return;
                  onSavePreset(presetNameInput.trim());
                  setPresetNameInput("");
                  setShowSaveForm(false);
                }}
                style={{ border: `1px solid ${ACCENT}`, borderRadius: 12, padding: "0 18px", background: ACCENT, color: "#fff", fontSize: 15 }}
              >
                保存
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowSaveForm(true)}
              style={{
                display: "flex", alignItems: "center", gap: 7, border: "1px solid #e2e8f0", borderRadius: 12,
                padding: "11px 16px", background: "#fff", fontSize: 15, marginBottom: 14,
              }}
            >
              <Bookmark size={16} /> このリストを名前をつけて保存
            </button>
          )}

          {savingsMessage && (
            <div
              style={{
                display: "flex", alignItems: "center", gap: 10, background: "#ecfdf5",
                border: "1px solid #4ade80", borderRadius: 12, padding: "13px 16px", marginBottom: 14,
              }}
            >
              <PiggyBank size={21} color="#16a34a" />
              <span style={{ fontSize: 15, color: "#15803d" }}>
                <strong>{savingsMessage.cheapestName}</strong>が一番安いです！{savingsMessage.comparedName}より{" "}
                <strong>{yen(savingsMessage.diff)}</strong>お得ですよ
                {monthlySavings > 0 && (
                  <span style={{ color: "#94a3b8" }}>（今月ここまでの節約額: {yen(monthlySavings)}）</span>
                )}
              </span>
            </div>
          )}

          <div style={{ background: "#0f172a", borderRadius: 18, overflow: "hidden" }}>
            {cartStoreTotals.map((s, i) => {
              const isComplete = s.foundCount === cartEntries.length;
              return (
                <div
                  key={s.id}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 18px",
                    borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.1)", color: "#fff",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    {i === 0 && <Crown size={19} color="#f59e0b" />}
                    <div>
                      <div style={{ fontSize: 15 }}>{s.name}</div>
                      <div
                        style={{
                          fontSize: 12.5, fontWeight: isComplete ? 400 : 700,
                          color: isComplete ? "#4ade80" : "#fb923c",
                        }}
                      >
                        {isComplete ? "全部そろうお店です" : `${s.foundCount}/${cartEntries.length}品目だけあります`}
                      </div>
                    </div>
                  </div>
                  <div className="price-num" style={{ fontSize: 20, fontWeight: 700 }}>{yen(s.total)}</div>
                </div>
              );
            })}
          </div>

          {multiStoreSavings && (
            <div
              style={{
                marginTop: 12, fontSize: 13, color: "#64748b", background: "#f8fafc",
                border: "1px solid #e2e8f0", borderRadius: 12, padding: "10px 14px",
              }}
            >
              品目ごとに一番安いお店で買い回ると、合計は{yen(multiStoreSavings.multiStoreTotal)}（1つのお店でそろえるより{yen(multiStoreSavings.diff)}安くなります）。移動の手間や交通費は含んでいません
            </div>
          )}
        </>
      )}
    </>
  );
}
