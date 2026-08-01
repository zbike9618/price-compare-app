import { describe, expect, it } from "vitest";
import { getSubcategoryLabel } from "./subcategories.js";

describe("getSubcategoryLabel", () => {
  it("商品名にキーワードが含まれていればラベルを返す", () => {
    expect(getSubcategoryLabel("野菜", "群馬県 などの国内産 キャベツ 1個")).toBe("キャベツ");
    expect(getSubcategoryLabel("野菜", "秋田県 などの国内産 こまちのとまと 600g 1袋")).toBe("トマト");
    expect(getSubcategoryLabel("野菜", "佐賀県 などの国内産 たまねぎ（バラ）1個")).toBe("玉ねぎ");
  });

  it("どの中カテゴリーにも一致しなければnullを返す（呼び出し側で「その他」扱い）", () => {
    expect(getSubcategoryLabel("野菜", "カゴメハニーマスタード和えソース 1袋")).toBeNull();
  });

  it("定義の無いカテゴリーならnullを返す", () => {
    expect(getSubcategoryLabel("未定義カテゴリ", "何かの商品")).toBeNull();
  });
});
