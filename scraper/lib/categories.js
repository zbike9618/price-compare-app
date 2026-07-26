// 検索キーワードとカテゴリの対応表（スクレイピング対象キーワード拡張時はここに追記する）
export const KEYWORD_CATEGORY = {
  牛乳: "乳製品",
  卵: "卵",
  食パン: "パン",
  豚肉: "精肉",
  キャベツ: "野菜",
};

export const SEED_KEYWORDS = Object.keys(KEYWORD_CATEGORY);
