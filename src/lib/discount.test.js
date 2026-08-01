// src/lib/discount.test.js
import { describe, expect, it } from "vitest";
import { computeStoreDiscountRates, isRecentPriceDrop, thirtyDayLowPrice } from "./discount.js";

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

describe("thirtyDayLowPrice", () => {
  it("履歴の中の最安値を返す", () => {
    const historyDesc = [
      { price: 160, scrapedAt: "2026-07-30T00:00:00Z" },
      { price: 180, scrapedAt: "2026-07-25T00:00:00Z" },
      { price: 140, scrapedAt: "2026-07-15T00:00:00Z" },
    ];
    expect(thirtyDayLowPrice(historyDesc)).toBe(140);
  });

  it("履歴が空ならnull", () => {
    expect(thirtyDayLowPrice([])).toBeNull();
    expect(thirtyDayLowPrice(undefined)).toBeNull();
  });
});

describe("computeStoreDiscountRates", () => {
  const drop = [
    { price: 100, scrapedAt: "2026-07-30T00:00:00Z" },
    { price: 150, scrapedAt: "2026-07-20T00:00:00Z" },
  ];
  const noDrop = [
    { price: 150, scrapedAt: "2026-07-30T00:00:00Z" },
    { price: 150, scrapedAt: "2026-07-20T00:00:00Z" },
  ];

  it("値下げ商品の割合が高い店舗順に並べる", () => {
    const historyByPair = new Map([
      ["storeA:p1", drop],
      ["storeA:p2", drop],
      ["storeA:p3", noDrop],
      ["storeA:p4", noDrop],
      ["storeB:p1", drop],
      ["storeB:p2", noDrop],
      ["storeB:p3", noDrop],
      ["storeB:p4", noDrop],
    ]);
    const result = computeStoreDiscountRates(historyByPair);
    expect(result[0]).toEqual({ storeId: "storeA", total: 4, discounted: 2, rate: 0.5 });
    expect(result[1]).toEqual({ storeId: "storeB", total: 4, discounted: 1, rate: 0.25 });
  });

  it("storeIdsで絞り込める", () => {
    const historyByPair = new Map([
      ["storeA:p1", drop],
      ["storeB:p1", drop],
    ]);
    const result = computeStoreDiscountRates(historyByPair, new Set(["storeA"]));
    expect(result).toEqual([{ storeId: "storeA", total: 1, discounted: 1, rate: 1 }]);
  });

  it("値下げが無い店舗はrate 0で含まれる", () => {
    const historyByPair = new Map([["storeA:p1", noDrop]]);
    expect(computeStoreDiscountRates(historyByPair)).toEqual([
      { storeId: "storeA", total: 1, discounted: 0, rate: 0 },
    ]);
  });

  it("空のMapなら空配列", () => {
    expect(computeStoreDiscountRates(new Map())).toEqual([]);
  });
});
