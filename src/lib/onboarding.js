export const ONBOARDING_STEPS = [
  {
    id: "list",
    targetId: "list",
    title: "最安値一覧",
    description: "カテゴリごとに、今いちばん安い商品と店を一覧で見られます。商品名で検索や並べ替えもできます。",
  },
  {
    id: "cart",
    targetId: "cart",
    title: "買い物リスト比較",
    description: "欲しい商品を選ぶだけで、店舗ごとの合計金額を安い順にランキング表示します。",
  },
  {
    id: "map",
    targetId: "map",
    title: "地図で範囲を選ぶ",
    description: "地図をタップして範囲（半径1〜10km）を指定すると、その中に入る店舗だけで比較できます。",
  },
  {
    id: "favorites",
    targetId: "favorites",
    title: "お気に入り",
    description: "気になる商品を保存しておけば、値下げがあったときにバッジで気づけます（ログインが必要です）。",
  },
];

const ONBOARDING_STORAGE_KEY = "priceCompareApp.onboardingSeen";

export function hasSeenOnboarding() {
  try {
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) === "true";
  } catch {
    return true;
  }
}

export function markOnboardingSeen() {
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
  } catch {
    // localStorageが使えない環境では何もしない
  }
}

// 同じdata-tour-idを持つ複数要素の中から、実際に画面上で見えている要素のDOMRectを返す。
// 判定は「ビューポートとの交差面積が最大」の候補を採用する方式（方針B）。
// 交差面積が0（画面外・display:noneで矩形が0など）の候補は自動的に除外される。
// checkVisibility に対応しているブラウザでは、CSSで不可視にされている要素（visibility:hidden等）も先に除外する（方針Aの併用）。
export function findVisibleTourTarget(targetId) {
  const candidates = document.querySelectorAll(`[data-tour-id="${targetId}"]`);

  let best = null;
  let bestArea = 0;

  for (const el of candidates) {
    if (typeof el.checkVisibility === "function") {
      try {
        if (!el.checkVisibility({ checkVisibilityCSS: true })) continue;
      } catch {
        // checkVisibilityが例外を投げる環境では無視して面積判定に委ねる
      }
    }

    const rect = el.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const intersectWidth = Math.max(0, Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0));
    const intersectHeight = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));
    const area = intersectWidth * intersectHeight;

    if (area > bestArea) {
      bestArea = area;
      best = rect;
    }
  }

  return best;
}
