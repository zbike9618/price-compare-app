const STORAGE_KEY = "priceCompareApp.cart";

export function loadCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function saveCart(cart) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...cart]));
  } catch {
    // localStorageが使えない環境(プライベートブラウジング等)では永続化を諦める
  }
}
