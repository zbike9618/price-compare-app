// src/lib/discount.js

/**
 * 直近30日分の価格履歴（新しい順）から、直近の価格が「値下げによる30日最安値更新」かどうかを判定する。
 * @param {Array<{ price: number, scrapedAt: string }>} historyDesc scrapedAt降順（最新が先頭）で並んだ、直近30日分の価格履歴
 * @returns {boolean}
 */
export function isRecentPriceDrop(historyDesc) {
  if (!historyDesc || historyDesc.length < 2) return false;
  const [latest, previous] = historyDesc;
  if (latest.price >= previous.price) return false;
  const minPrice = Math.min(...historyDesc.map((h) => h.price));
  return latest.price === minPrice;
}

/**
 * 直近30日分の価格履歴から底値（最安値）を返す。底値カレンダー機能の最小版。
 * @param {Array<{ price: number, scrapedAt: string }>} historyDesc scrapedAt降順で並んだ、直近30日分の価格履歴
 * @returns {number | null}
 */
export function thirtyDayLowPrice(historyDesc) {
  if (!historyDesc || historyDesc.length === 0) return null;
  return Math.min(...historyDesc.map((h) => h.price));
}

/**
 * 店舗ごとの「値引き率」を算出する。店舗の割引率データはDBに無いため、
 * 代わりに「その店が扱う商品のうち、直近値下げした商品の割合」を値引き率の目安とする。
 * @param {Map<string, Array<{ price: number, scrapedAt: string }>>} historyByPair "storeId:productId"をキーとした価格履歴Map
 * @param {Set<string> | null} [storeIds] 対象を絞り込む店舗IDの集合。nullish なら全店舗を対象にする
 * @returns {Array<{ storeId: string, total: number, discounted: number, rate: number }>} rate降順
 */
export function computeStoreDiscountRates(historyByPair, storeIds) {
  const totalByStore = new Map();
  const discountedByStore = new Map();

  for (const [key, historyDesc] of historyByPair) {
    const [storeId] = key.split(":");
    if (storeIds && !storeIds.has(storeId)) continue;
    totalByStore.set(storeId, (totalByStore.get(storeId) ?? 0) + 1);
    if (isRecentPriceDrop(historyDesc)) {
      discountedByStore.set(storeId, (discountedByStore.get(storeId) ?? 0) + 1);
    }
  }

  const result = [];
  for (const [storeId, total] of totalByStore) {
    const discounted = discountedByStore.get(storeId) ?? 0;
    result.push({ storeId, total, discounted, rate: discounted / total });
  }
  return result.sort((a, b) => b.rate - a.rate);
}
