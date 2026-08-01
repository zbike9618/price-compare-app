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
