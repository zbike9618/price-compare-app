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
