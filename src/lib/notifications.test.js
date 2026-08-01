// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { dismissDrops, dropSignature, isDropDismissed } from "./notifications.js";

describe("dropSignature", () => {
  it("商品IDと価格を組み合わせた識別子を作る", () => {
    expect(dropSignature("p1", 150)).toBe("p1:150");
  });
});

describe("isDropDismissed / dismissDrops", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("未既読ならfalse", () => {
    expect(isDropDismissed("p1", 150)).toBe(false);
  });

  it("dismissDrops後はtrue", () => {
    dismissDrops([dropSignature("p1", 150), dropSignature("p2", 200)]);
    expect(isDropDismissed("p1", 150)).toBe(true);
    expect(isDropDismissed("p2", 200)).toBe(true);
    expect(isDropDismissed("p3", 100)).toBe(false);
  });

  it("同じ商品でも価格が変わればまた未既読になる", () => {
    dismissDrops([dropSignature("p1", 150)]);
    expect(isDropDismissed("p1", 140)).toBe(false);
  });
});
