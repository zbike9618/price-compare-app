// src/lib/subcategories.js
// 中カテゴリー（例: 野菜 → キャベツ・にんじん・大根...）を商品名から推定する。
// スクレイパー側の検索キーワード分類(scraper/lib/categories.js)と対応する語をそのまま流用し、
// DBスキーマは変更せず商品名の部分一致だけで判定する簡易版。
// 参考: Zからのヒアリング（スーパーの陳列導線に合わせたい、カテゴリが多すぎてわかりにくい）
import {
  Leaf, Carrot, Sprout, Circle, CircleDot, Cherry, LeafyGreen, Salad,
  Apple, Banana, Citrus, Grape,
  Ham, Drumstick, Beef, UtensilsCrossed,
  Fish, FishSymbol, FishingRod, FishingHook,
  Egg, Square, Package,
  Milk, Droplets, Triangle,
  Sandwich, Croissant,
  Soup,
  Droplet, Candy,
} from "lucide-react";

export const OTHER_SUBCATEGORY = "その他";

export const SUBCATEGORIES = {
  野菜: [
    { label: "キャベツ", keywords: ["キャベツ", "きゃべつ"], icon: Leaf },
    { label: "にんじん", keywords: ["にんじん", "ニンジン", "人参"], icon: Carrot },
    { label: "大根", keywords: ["大根"], icon: Sprout },
    { label: "玉ねぎ", keywords: ["玉ねぎ", "たまねぎ", "タマネギ", "玉葱"], icon: Circle },
    { label: "じゃがいも", keywords: ["じゃがいも", "ジャガイモ"], icon: CircleDot },
    { label: "トマト", keywords: ["トマト", "とまと"], icon: Cherry },
    { label: "きゅうり", keywords: ["きゅうり", "キュウリ"], icon: LeafyGreen },
    { label: "ほうれん草", keywords: ["ほうれん草"], icon: Salad },
  ],
  果物: [
    { label: "りんご", keywords: ["りんご", "リンゴ"], icon: Apple },
    { label: "バナナ", keywords: ["バナナ"], icon: Banana },
    { label: "みかん", keywords: ["みかん", "ミカン"], icon: Citrus },
    { label: "いちご", keywords: ["いちご", "イチゴ"], icon: Grape },
  ],
  精肉: [
    { label: "豚肉", keywords: ["豚肉"], icon: Ham },
    { label: "鶏肉", keywords: ["鶏肉", "とり肉"], icon: Drumstick },
    { label: "牛肉", keywords: ["牛肉"], icon: Beef },
    { label: "ひき肉", keywords: ["ひき肉", "挽肉", "ミンチ"], icon: UtensilsCrossed },
  ],
  魚介: [
    { label: "鮭", keywords: ["鮭", "サーモン"], icon: Fish },
    { label: "さば", keywords: ["さば", "サバ"], icon: FishSymbol },
    { label: "まぐろ", keywords: ["まぐろ", "マグロ"], icon: FishingRod },
    { label: "えび", keywords: ["えび", "エビ"], icon: FishingHook },
  ],
  日配食品: [
    { label: "卵", keywords: ["卵", "たまご"], icon: Egg },
    { label: "豆腐", keywords: ["豆腐"], icon: Square },
    { label: "納豆", keywords: ["納豆"], icon: Package },
  ],
  乳製品: [
    { label: "牛乳", keywords: ["牛乳"], icon: Milk },
    { label: "ヨーグルト", keywords: ["ヨーグルト"], icon: Droplets },
    { label: "チーズ", keywords: ["チーズ"], icon: Triangle },
    { label: "バター", keywords: ["バター"], icon: Square },
  ],
  パン類: [
    { label: "食パン", keywords: ["食パン"], icon: Sandwich },
    { label: "ロールパン", keywords: ["ロールパン"], icon: Croissant },
  ],
  麺類: [
    { label: "うどん", keywords: ["うどん"], icon: Soup },
    { label: "パスタ", keywords: ["パスタ", "スパゲティ", "スパゲッティ"], icon: UtensilsCrossed },
  ],
  調味料: [
    { label: "醤油", keywords: ["醤油", "しょうゆ"], icon: Droplet },
    { label: "味噌", keywords: ["味噌", "みそ"], icon: Circle },
    { label: "砂糖", keywords: ["砂糖"], icon: Candy },
    { label: "食用油", keywords: ["食用油", "サラダ油"], icon: Droplets },
  ],
  日用品: [
    { label: "ティッシュ", keywords: ["ティッシュ"], icon: Package },
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
