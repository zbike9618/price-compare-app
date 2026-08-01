// src/lib/savings.js
// 買い物リスト比較で「いくら得するか」を即わかるようにする節約額表示機能
// 参考: docs/superpowers/specs/2026-08-01-price-compare-app-brainstorm-summary.md セクションE-1

const SAVINGS_STORAGE_KEY = "priceCompareApp.monthlySavings";

/**
 * 全品揃う店舗のうち最安店と次点店の差額から節約メッセージを組み立てる。
 * 全品揃う店舗が2件未満、または差額が0円以下なら null（表示しない）。
 * @param {Array<{ id: string, name: string, total: number, foundCount: number }>} cartStoreTotals foundCount降順→total昇順でソート済みの店舗別合計
 * @param {number} totalItemCount カートの品目数
 * @returns {{ cheapestName: string, comparedName: string, diff: number } | null}
 */
export function computeSavingsMessage(cartStoreTotals, totalItemCount) {
  if (!totalItemCount) return null;
  const complete = cartStoreTotals.filter((s) => s.foundCount === totalItemCount);
  if (complete.length < 2) return null;
  const [cheapest, second] = complete;
  const diff = second.total - cheapest.total;
  if (diff <= 0) return null;
  return { cheapestName: cheapest.name, comparedName: second.name, diff };
}

/**
 * 複数店舗に分けて買い回った場合の得失を計算する（E-5 買い回り最適化の最小版）。
 * 各品目を「その品目が一番安い店」で買った場合の合計と、1店舗で全品揃えたときの最安合計を比べる。
 * 移動コスト（車/徒歩/ネット注文の判断）は考慮しない、価格差のみの目安値。
 * @param {Array<{ representativePrice: number }>} cartEntries カート内の各品目（representativePriceはその品目の全店舗中の最安値）
 * @param {Array<{ total: number, foundCount: number }>} cartStoreTotals foundCount降順→total昇順でソート済みの店舗別合計
 * @param {number} totalItemCount カートの品目数
 * @returns {{ singleStoreTotal: number, multiStoreTotal: number, diff: number } | null}
 */
export function computeMultiStoreSavings(cartEntries, cartStoreTotals, totalItemCount) {
  if (!totalItemCount || cartEntries.length === 0) return null;
  const bestSingleStore = cartStoreTotals.find((s) => s.foundCount === totalItemCount);
  if (!bestSingleStore) return null;
  const multiStoreTotal = cartEntries.reduce((sum, e) => sum + e.representativePrice, 0);
  const diff = bestSingleStore.total - multiStoreTotal;
  if (diff <= 0) return null;
  return { singleStoreTotal: bestSingleStore.total, multiStoreTotal, diff };
}

function currentMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * 今月の累計節約額（円）をlocalStorageから取得する。
 */
export function getMonthlySavings(date = new Date()) {
  try {
    const raw = localStorage.getItem(SAVINGS_STORAGE_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    const value = parsed?.[currentMonthKey(date)];
    return typeof value === "number" ? value : 0;
  } catch {
    return 0;
  }
}

/**
 * 今月の累計節約額にdiffを加算して保存する。
 * @returns {number} 加算後の今月累計額
 */
export function recordSavings(diff, date = new Date()) {
  const monthlyBefore = getMonthlySavings(date);
  if (!diff || diff <= 0) return monthlyBefore;
  try {
    const raw = localStorage.getItem(SAVINGS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const key = currentMonthKey(date);
    const next = (typeof parsed[key] === "number" ? parsed[key] : 0) + diff;
    parsed[key] = next;
    localStorage.setItem(SAVINGS_STORAGE_KEY, JSON.stringify(parsed));
    return next;
  } catch {
    return monthlyBefore;
  }
}
