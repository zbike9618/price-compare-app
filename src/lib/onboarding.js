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
