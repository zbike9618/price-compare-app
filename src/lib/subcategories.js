// src/lib/subcategories.js
// 中カテゴリー（例: 野菜 → キャベツ・にんじん・大根...）を商品名から推定する。
// スクレイパー側の検索キーワード分類(scraper/lib/categories.js)と対応する語をそのまま流用し、
// DBスキーマは変更せず商品名の部分一致だけで判定する簡易版。
// 参考: Zからのヒアリング（スーパーの陳列導線に合わせたい、カテゴリが多すぎてわかりにくい）

export const OTHER_SUBCATEGORY = "その他";

export const SUBCATEGORIES = {
  野菜: [
    { label: "キャベツ", keywords: ["キャベツ", "きゃべつ"] },
    { label: "にんじん", keywords: ["にんじん", "ニンジン", "人参"] },
    { label: "大根", keywords: ["大根"] },
    { label: "玉ねぎ", keywords: ["玉ねぎ", "たまねぎ", "タマネギ", "玉葱"] },
    { label: "じゃがいも", keywords: ["じゃがいも", "ジャガイモ"] },
    { label: "トマト", keywords: ["トマト", "とまと"] },
    { label: "きゅうり", keywords: ["きゅうり", "キュウリ"] },
    { label: "ほうれん草", keywords: ["ほうれん草"] },
  ],
  果物: [
    { label: "りんご", keywords: ["りんご", "リンゴ"] },
    { label: "バナナ", keywords: ["バナナ"] },
    { label: "みかん", keywords: ["みかん", "ミカン"] },
    { label: "いちご", keywords: ["いちご", "イチゴ"] },
  ],
  精肉: [
    { label: "豚肉", keywords: ["豚肉"] },
    { label: "鶏肉", keywords: ["鶏肉", "とり肉"] },
    { label: "牛肉", keywords: ["牛肉"] },
    { label: "ひき肉", keywords: ["ひき肉", "挽肉", "ミンチ"] },
  ],
  魚介: [
    { label: "鮭", keywords: ["鮭", "サーモン"] },
    { label: "さば", keywords: ["さば", "サバ"] },
    { label: "まぐろ", keywords: ["まぐろ", "マグロ"] },
    { label: "えび", keywords: ["えび", "エビ"] },
  ],
  日配食品: [
    { label: "卵", keywords: ["卵", "たまご"] },
    { label: "豆腐", keywords: ["豆腐"] },
    { label: "納豆", keywords: ["納豆"] },
  ],
  乳製品: [
    { label: "牛乳", keywords: ["牛乳"] },
    { label: "ヨーグルト", keywords: ["ヨーグルト"] },
    { label: "チーズ", keywords: ["チーズ"] },
    { label: "バター", keywords: ["バター"] },
  ],
  パン類: [
    { label: "食パン", keywords: ["食パン"] },
    { label: "ロールパン", keywords: ["ロールパン"] },
  ],
  麺類: [
    { label: "うどん", keywords: ["うどん"] },
    { label: "パスタ", keywords: ["パスタ", "スパゲティ", "スパゲッティ"] },
  ],
  調味料: [
    { label: "醤油", keywords: ["醤油", "しょうゆ"] },
    { label: "味噌", keywords: ["味噌", "みそ"] },
    { label: "砂糖", keywords: ["砂糖"] },
    { label: "食用油", keywords: ["食用油", "サラダ油"] },
  ],
  日用品: [
    { label: "ティッシュ", keywords: ["ティッシュ"] },
  ],
};

/**
 * 商品名から中カテゴリーのラベルを推定する。どの中カテゴリーにも一致しなければnull（呼び出し側で「その他」扱い）。
 */
export function getSubcategoryLabel(category, productName) {
  const defs = SUBCATEGORIES[category];
  if (!defs) return null;
  const found = defs.find((d) => d.keywords.some((kw) => productName.includes(kw)));
  return found ? found.label : null;
}
