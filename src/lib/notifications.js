// src/lib/notifications.js
// お気に入り商品の値下がりを知らせるアプリ内通知（プッシュ通知基盤を持たないため、
// 起動時にお気に入り×値下げ検知の交差を表示する簡易版）。
// 参考: docs/superpowers/specs/2026-08-01-price-compare-app-brainstorm-summary.md セクションE-3

const STORAGE_KEY = "priceCompareApp.dismissedPriceDrops";

/**
 * 商品ID・現在価格から通知の識別子を作る。同じ商品でも価格が変わればまた通知対象になる。
 */
export function dropSignature(productId, price) {
  return `${productId}:${price}`;
}

function loadDismissed() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveDismissed(set) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
}

export function isDropDismissed(productId, price) {
  return loadDismissed().has(dropSignature(productId, price));
}

/**
 * 渡された識別子群をまとめて既読にする。
 */
export function dismissDrops(signatures) {
  const set = loadDismissed();
  signatures.forEach((s) => set.add(s));
  saveDismissed(set);
}
