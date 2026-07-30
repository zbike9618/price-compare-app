const STORAGE_KEY = "priceCompareApp.customPresets";

// 定番セット（運営側が用意する固定プリセット）。商品名の部分一致で該当商品を集める
// 2026-07-30: generic_name廃止に伴いキーワード一致→最安値選択方式に変更したところ、
// 「キャベツ」→お菓子「キャベツ太郎」等、不適切な商品を選んでしまう問題が判明したため
// 一時撤廃（Z判断）。マッチング精度の改善方法が決まるまで空のままにする。
// 詳細: .secretary/projects/price-compare-app/project.md のタスク参照
export const BUILTIN_PRESETS = [];

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
