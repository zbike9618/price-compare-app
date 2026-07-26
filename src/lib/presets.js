const STORAGE_KEY = "priceCompareApp.customPresets";

// 定番セット（運営側が用意する固定プリセット）。商品名の部分一致で該当商品を集める
export const BUILTIN_PRESETS = [
  { name: "定番野菜セット", keywords: ["キャベツ", "にんじん", "玉ねぎ", "じゃがいも"] },
  { name: "朝ごはんセット", keywords: ["牛乳", "食パン", "卵", "ヨーグルト"] },
  { name: "自炊定番セット", keywords: ["豚肉", "醤油", "味噌", "豆腐"] },
];

export function loadCustomPresets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCustomPreset(name, janCodes) {
  const presets = loadCustomPresets();
  const preset = { id: crypto.randomUUID(), name, janCodes };
  const next = [...presets, preset];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function deleteCustomPreset(id) {
  const next = loadCustomPresets().filter((p) => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
