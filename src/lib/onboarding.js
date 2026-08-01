export const ONBOARDING_STEPS = [
  {
    id: "welcome",
    targetId: null,
    title: "とくちかへようこそ",
    description: "お近くのスーパーの値段を比べて、賢くお買い物できるアプリです。使い方を順番にご案内しますね。",
  },
  {
    id: "map",
    targetId: "map",
    title: "①地図で自分の範囲を選ぶ",
    description: "まずは地図をタップして、お住まいの範囲（半径1〜10km）を選びましょう。その範囲に入っているお店だけで値段を比べられます。",
  },
  {
    id: "list",
    targetId: "list",
    title: "②カテゴリから商品をさがす",
    description: "「最安値」タブでは、カテゴリ→サブカテゴリ→商品の順にタップして絞り込めます。それぞれの商品で、今いちばん安い店とねだんが分かります。",
  },
  {
    id: "discount",
    targetId: "list",
    title: "③値下げやお買い得に気づける",
    description: "値段が下がった商品には赤い「〇%引き」の印がつきます。商品をタップして開くと、直近30日の値段の動きをグラフでも見られます。",
  },
  {
    id: "cart",
    targetId: "cart",
    title: "④買い物リストでまとめて比較する",
    description: "買いたい商品を「追加」しておくと、「比較」タブでお店ごとの合計金額が安い順に並びます。どこでまとめ買いすればお得か一目で分かります。",
  },
  {
    id: "favorites",
    targetId: "favorites",
    title: "⑤お気に入り登録で値下げをお知らせ",
    description: "気になる商品を★で保存しておくと、値下げがあったときに気づけます（ログインが必要です）。",
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
