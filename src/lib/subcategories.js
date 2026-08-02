// src/lib/subcategories.js
// 中カテゴリー表示用のアイコンマップ。
// 中カテゴリの値そのものはDBの products.subcategory 列（AI/Claudeによる商品分類の結果）を使う。
// ここでは表示上のアイコンだけを、頻出する中カテゴリ（各カテゴリで概ね8件以上）に限定して割り当て、
// マップに無い中カテゴリは呼び出し側で大カテゴリのデフォルトアイコンにフォールバックする
// （全組み合わせが数百種類あり自由記述に近いため、全件への個別アイコン付与はしない）。
import {
  Leaf, Carrot, Sprout, Circle, CircleDot, Cherry, LeafyGreen, Salad,
  Apple, Banana, Citrus,
  Ham, Drumstick, Beef, UtensilsCrossed,
  Fish, FishSymbol, FishingRod, FishingHook,
  Egg, Square, Package, Layers,
  Milk, Droplet, Droplets, Triangle, CupSoda,
  Sandwich, Croissant,
  Soup,
  Candy, FlaskConical, FlaskRound, Sparkle, Sparkles,
  PillBottle, Box, SprayCan, Bath,
  Wine, GlassWater,
  Baby, IceCreamCone, Cookie, Popcorn,
} from "lucide-react";

export const OTHER_SUBCATEGORY = "その他";

export const SUBCATEGORY_ICONS = {
  野菜: {
    キャベツ: Leaf, にんじん: Carrot, 大根: Sprout, 玉ねぎ: Circle,
    じゃがいも: CircleDot, トマト: Cherry, きゅうり: LeafyGreen, ほうれん草: Salad,
  },
  果物: { りんご: Apple, バナナ: Banana, みかん: Citrus },
  精肉: {
    豚肉: Ham, 鶏肉: Drumstick, 牛肉: Beef, ひき肉: UtensilsCrossed,
    ホルモン: Circle, サラダチキン: Salad,
  },
  魚介: { 鮭: Fish, さば: FishSymbol, まぐろ: FishingRod, えび: FishingHook },
  日配食品: {
    卵: Egg, 豆腐: Square, 惣菜: UtensilsCrossed, パスタ: Soup, 納豆: Package,
    漬物: Layers, チーズ: Triangle, バター: Square, 練り物: CircleDot,
    菓子パン: Croissant, "調味料・素": Droplet, "たれ・ソース": Droplets,
    高野豆腐: Square, 牛乳: Milk, 麺類: Soup, ヨーグルト: Droplets,
  },
  乳製品: { チーズ: Triangle, ヨーグルト: Droplets, 牛乳: Milk, バター: Square, 乳飲料: CupSoda },
  パン類: { 食パン: Sandwich, ロールパン: Croissant, 菓子パン: Croissant, 惣菜パン: Sandwich },
  麺類: { うどん: Soup, パスタ: UtensilsCrossed, ラーメン: Soup },
  調味料: {
    醤油: Droplet, 味噌: Circle, 砂糖: Candy, 食用油: Droplets,
    パスタソース: FlaskConical, カレー: Soup, 料理の素: FlaskRound, 酢: GlassWater,
    "ジャム・ペースト": Layers, たれ: CupSoda, 合わせ調味料: FlaskConical,
    香辛料: Sparkle, ふりかけ: Sparkles, 塩: CircleDot, ケチャップ: Cherry,
    シーズニング: Sparkle, "マヨネーズ・ドレッシング": Egg,
    うどんつゆ: Soup, "めんつゆ・たれ": Soup,
  },
  日用品: { ティッシュ: Package, ウェットティッシュ: SprayCan, スキンケア: Sparkles, 入浴剤: Bath },
  デザート: { アイス: IceCreamCone, デザート: Cookie },
  ベビーフード: { 離乳食: Baby },
  菓子: { スナック菓子: Popcorn, スナック: Popcorn },
  健康食品: { サプリメント: PillBottle },
  加工食品: { 缶詰: Box },
  惣菜: { 魚: Fish },
  飲料: { ワイン: Wine, ジュース: GlassWater },
};

/**
 * 中カテゴリ表示用のアイコンを返す。個別マップに無ければfallbackIconを返す。
 */
export function getSubcategoryIcon(category, label, fallbackIcon) {
  return SUBCATEGORY_ICONS[category]?.[label] ?? fallbackIcon;
}
