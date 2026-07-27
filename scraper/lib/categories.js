// 検索キーワードとカテゴリの対応表
// カテゴリページ巡回(mgcd等)はゲストセッションで空を返すため使わず、
// カテゴリを網羅する複数キーワードでの検索を積み重ねる方式で対応する
export const KEYWORD_CATEGORY = {
  // 野菜
  キャベツ: "野菜",
  にんじん: "野菜",
  大根: "野菜",
  玉ねぎ: "野菜",
  じゃがいも: "野菜",
  トマト: "野菜",
  きゅうり: "野菜",
  ほうれん草: "野菜",
  // 果物
  りんご: "果物",
  バナナ: "果物",
  みかん: "果物",
  いちご: "果物",
  // 乳製品
  牛乳: "乳製品",
  ヨーグルト: "乳製品",
  チーズ: "乳製品",
  バター: "乳製品",
  // 精肉
  豚肉: "精肉",
  鶏肉: "精肉",
  牛肉: "精肉",
  ひき肉: "精肉",
  // 魚介
  鮭: "魚介",
  さば: "魚介",
  まぐろ: "魚介",
  えび: "魚介",
  // パン類
  食パン: "パン類",
  ロールパン: "パン類",
  // 麺類
  うどん: "麺類",
  パスタ: "麺類",
  // 調味料
  醤油: "調味料",
  味噌: "調味料",
  砂糖: "調味料",
  食用油: "調味料",
  // 日配食品
  卵: "日配食品",
  豆腐: "日配食品",
  納豆: "日配食品",
  // 日用品
  ティッシュ: "日用品",
};

export const SEED_KEYWORDS = Object.keys(KEYWORD_CATEGORY);

// AEON(イオンネットスーパー)自身のカテゴリ分類ページのURL。
// キーワード検索は無関係な商品が混入しやすいが、カテゴリページはAEON側が既に分類済みのため精度が高い。
// requireMatch指定があるキーワードは、複数食材が同じカテゴリに同居しているため
// 取得後に商品名でさらに絞り込む（例:「たまねぎ・にんじん」カテゴリからは商品名に該当語を含むものだけ採用）。
// url: null のキーワード（いちご・卵・さば）は対応するカテゴリが無く、従来のキーワード検索にフォールバックする
const AEON_BASE = "https://shop.aeon.com/netsuper/01050000041900/catalog/category/view/s";
export const AEON_CATEGORIES = {
  キャベツ: { url: `${AEON_BASE}/1102/id/4605379`, requireMatch: ["キャベツ", "きゃべつ"] },
  にんじん: { url: `${AEON_BASE}/1106/id/4610699`, requireMatch: ["にんじん", "ニンジン", "人参"] },
  大根: { url: `${AEON_BASE}/110401/id/4608459`, requireMatch: ["大根"] },
  玉ねぎ: { url: `${AEON_BASE}/1106/id/4610699`, requireMatch: ["玉ねぎ", "たまねぎ", "タマネギ", "玉葱"] },
  じゃがいも: { url: `${AEON_BASE}/110501/id/4609299` },
  トマト: { url: `${AEON_BASE}/110102/id/4606779` },
  きゅうり: { url: `${AEON_BASE}/110301/id/4607059` },
  ほうれん草: { url: `${AEON_BASE}/110402/id/4608739`, requireMatch: ["ほうれん草"] },
  りんご: { url: `${AEON_BASE}/1203/id/4616579` },
  バナナ: { url: `${AEON_BASE}/1202/id/4616299` },
  みかん: { url: `${AEON_BASE}/120401/id/4618259` },
  いちご: { url: null },
  牛乳: { url: `${AEON_BASE}/1702/id/4693938` },
  ヨーグルト: { url: `${AEON_BASE}/1801/id/4697298` },
  チーズ: { url: `${AEON_BASE}/1705/id/4694778` },
  バター: { url: `${AEON_BASE}/1706/id/4695058`, requireMatch: ["バター"] },
  豚肉: { url: `${AEON_BASE}/1411/id/4631148` },
  鶏肉: { url: `${AEON_BASE}/1412/id/4636748` },
  牛肉: { url: `${AEON_BASE}/1410/id/4630868` },
  ひき肉: { url: `${AEON_BASE}/1413/id/4637028` },
  鮭: { url: `${AEON_BASE}/1307/id/4619668`, requireMatch: ["鮭"] },
  さば: { url: null },
  まぐろ: { url: `${AEON_BASE}/130501/id/4620508` },
  えび: { url: `${AEON_BASE}/130901/id/4623868`, requireMatch: ["えび"] },
  食パン: { url: `${AEON_BASE}/1902/id/4675388`, requireMatch: ["食パン"] },
  ロールパン: { url: `${AEON_BASE}/1902/id/4675388`, requireMatch: ["ロールパン"] },
  うどん: { url: `${AEON_BASE}/1g01/id/4710749`, requireMatch: ["うどん"] },
  パスタ: { url: `${AEON_BASE}/1g03/id/4711309`, requireMatch: ["パスタ", "スパゲティ", "スパゲッティ"] },
  醤油: { url: `${AEON_BASE}/1j02/id/4682738` },
  味噌: { url: `${AEON_BASE}/1j01/id/4682458` },
  砂糖: { url: `${AEON_BASE}/1j03/id/4683018`, requireMatch: ["砂糖"] },
  食用油: { url: `${AEON_BASE}/1j1201/id/4692818` },
  卵: { url: null },
  豆腐: { url: `${AEON_BASE}/1c01/id/4705709` },
  納豆: { url: `${AEON_BASE}/1c02/id/4705989` },
  ティッシュ: { url: `${AEON_BASE}/8a02/id/4820971` },
};

export function matchesRequiredKeyword(keyword, productName) {
  const required = AEON_CATEGORIES[keyword]?.requireMatch;
  if (!required) return true;
  return required.some((w) => productName.includes(w));
}

// 検索結果に紛れ込む無関係な加工食品・菓子を除外するための語リスト。
// 例: 「みかん」検索で「みかん味のガム」がヒットしてしまい、物の名前グルーピングの精度を落とすのを防ぐ
const NOISE_WORDS = [
  "ガム", "ゼリー", "キャンディ", "飴", "あめ", "グミ", "アイス", "ジュース", "ドリンク",
  "シロップ", "ソース", "ドレッシング", "味", "菓子", "クッキー", "チョコ", "スナック",
  "ふりかけ", "サワー", "チューハイ", "ビール", "日本酒", "梅酒", "リキュール", "カクテル",
  "ジャム", "ようかん", "まんじゅう", "饅頭", "せんべい", "おかき", "ポップコーン",
  "ゼロカロリー", "kcal", "サプリ", "入浴剤", "芳香剤", "洗剤",
  "えびせん", "サンダー", "ハーゲンダッツ", "パイ", "ケーキ", "プリン", "たい焼き",
  "ポテトチップ", "柿の種", "うまい棒",
  "マッコリ", "豆乳", "Smoothie", "シェイク", "青汁", "チップ",
];

// 検索キーワードと無関係な非食品ブランド名（検索エンジン側が返す誤ヒット）。
// 例: 「バナナ」検索で「ラスタバナナ」ブランドのスマホアクセサリがヒットする
const UNRELATED_BRAND_WORDS = [
  "ラスタバナナ", "プラレール", "コンバット", "肝油",
];

// パン・穀物や調味料自体を指すキーワードは、その語自体が主役の加工食品なので除外フィルタの対象外にする
const NOISE_FILTER_EXEMPT_KEYWORDS = new Set([
  "食パン", "ロールパン", "うどん", "パスタ",
  "醤油", "味噌", "砂糖", "食用油",
  "ティッシュ",
]);

// ペットフード・離乳食は「鮭」「まぐろ」等の検索結果に大量混入するが人間の食品比較としては無関係なため、
// キーワードによらず常に除外する
const PET_AND_BABY_FOOD_WORDS = [
  "ペット用", "ペットフード", "キャットフード", "ドッグフード", "ちゅーる", "ちゅ～る", "ちゅ~る",
  "ヶ月頃",
];

export function isNoiseProduct(keyword, productName) {
  if (PET_AND_BABY_FOOD_WORDS.some((w) => productName.includes(w))) return true;
  if (UNRELATED_BRAND_WORDS.some((w) => productName.includes(w))) return true;
  if (NOISE_FILTER_EXEMPT_KEYWORDS.has(keyword)) return false;
  return NOISE_WORDS.some((w) => productName.includes(w));
}
