import { describe, expect, it } from "vitest";
import { Package } from "lucide-react";
import { getSubcategoryIcon } from "./subcategories.js";

describe("getSubcategoryIcon", () => {
  it("マップに登録済みの中カテゴリならそのアイコンを返す", () => {
    expect(getSubcategoryIcon("野菜", "キャベツ", Package)).not.toBe(Package);
  });

  it("マップに無い中カテゴリならfallbackIconを返す", () => {
    expect(getSubcategoryIcon("野菜", "存在しない中カテゴリ", Package)).toBe(Package);
  });

  it("定義の無いカテゴリーならfallbackIconを返す", () => {
    expect(getSubcategoryIcon("未定義カテゴリ", "何か", Package)).toBe(Package);
  });
});
