// src/lib/discount.js

/**
 * 価格履歴を「日付ごとの最新レコード」に間引く。同日に複数回スクレイピングが実行された場合、
 * 直近2件の単純比較だと同日の実行同士を比較してしまい値下げを検出できなくなるため、
 * 値下げ判定は必ずこの関数を通した「日付ごとの代表値」で行う。
 * @param {Array<{ price: number, scrapedAt: string }>} historyDesc scrapedAt降順で並んだ価格履歴
 * @returns {Array<{ price: number, scrapedAt: string }>} 日付降順・各日付の最新1件のみ
 */
function latestPerDay(historyDesc) {
  if (!historyDesc) return [];
  const seenDates = new Set();
  const result = [];
  for (const h of historyDesc) {
    const date = h.scrapedAt.slice(0, 10);
    if (seenDates.has(date)) continue;
    seenDates.add(date);
    result.push(h);
  }
  return result;
}

/**
 * 直近の価格が、その前のスクレイピング日より安いかどうかを判定する（シンプルな値下げ判定）。
 * 同日の複数回実行は同じ日の1レコードとして扱う（詳細はlatestPerDay参照）。
 * @param {Array<{ price: number, scrapedAt: string }>} historyDesc scrapedAt降順（最新が先頭）で並んだ、直近30日分の価格履歴
 * @returns {boolean}
 */
export function isPriceDrop(historyDesc) {
  const byDay = latestPerDay(historyDesc);
  if (byDay.length < 2) return false;
  const [latest, previous] = byDay;
  return latest.price < previous.price;
}

/**
 * 直近30日分の価格履歴（新しい順）から、直近の価格が「値下げによる30日最安値の更新」かどうかを判定する。
 * isPriceDropより厳しい条件（別バッジ「30日で最安値更新」用）。
 * @param {Array<{ price: number, scrapedAt: string }>} historyDesc scrapedAt降順（最新が先頭）で並んだ、直近30日分の価格履歴
 * @returns {boolean}
 */
export function isRecentPriceDrop(historyDesc) {
  if (!isPriceDrop(historyDesc)) return false;
  const minPrice = Math.min(...historyDesc.map((h) => h.price));
  return historyDesc[0].price === minPrice;
}

/**
 * 値下げ幅（金額・割合）を算出する。isPriceDropがtrueの場合のみ値を返し、
 * それ以外（値下げでない）はnullを返す。
 * @param {Array<{ price: number, scrapedAt: string }>} historyDesc scrapedAt降順で並んだ、直近30日分の価格履歴
 * @returns {{ diff: number, pct: number } | null}
 */
export function computeDiscountInfo(historyDesc) {
  if (!isPriceDrop(historyDesc)) return null;
  const [latest, previous] = latestPerDay(historyDesc);
  const diff = previous.price - latest.price;
  const pct = Math.round((diff / previous.price) * 100);
  return { diff, pct };
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
