// src/lib/discount.test.js
import { describe, expect, it } from "vitest";
import { isRecentPriceDrop } from "./discount.js";

describe("isRecentPriceDrop", () => {
  it("直近の価格が過去30日の最安値を更新していればtrue", () => {
    const historyDesc = [
      { price: 150, scrapedAt: "2026-07-30T00:00:00Z" },
      { price: 180, scrapedAt: "2026-07-20T00:00:00Z" },
      { price: 170, scrapedAt: "2026-07-10T00:00:00Z" },
    ];
    expect(isRecentPriceDrop(historyDesc)).toBe(true);
  });

  it("直近の価格が前回と同じか値上がりしていればfalse", () => {
    const historyDesc = [
      { price: 180, scrapedAt: "2026-07-30T00:00:00Z" },
      { price: 150, scrapedAt: "2026-07-20T00:00:00Z" },
    ];
    expect(isRecentPriceDrop(historyDesc)).toBe(false);
  });

  it("直近の価格は下がったが過去30日の最安値ではない場合はfalse", () => {
    const historyDesc = [
      { price: 160, scrapedAt: "2026-07-30T00:00:00Z" },
      { price: 180, scrapedAt: "2026-07-25T00:00:00Z" },
      { price: 140, scrapedAt: "2026-07-15T00:00:00Z" },
    ];
    expect(isRecentPriceDrop(historyDesc)).toBe(false);
  });

  it("履歴が1件以下ならfalse", () => {
    expect(isRecentPriceDrop([{ price: 150, scrapedAt: "2026-07-30T00:00:00Z" }])).toBe(false);
    expect(isRecentPriceDrop([])).toBe(false);
  });
});
