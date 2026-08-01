// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { computeMultiStoreSavings, computeSavingsMessage, getMonthlySavings, recordSavings } from "./savings.js";

describe("computeSavingsMessage", () => {
  it("全品揃う店舗が2件以上あれば最安と次点の差額を返す", () => {
    const totals = [
      { id: "a", name: "A店", total: 1000, foundCount: 3 },
      { id: "b", name: "B店", total: 1312, foundCount: 3 },
      { id: "c", name: "C店", total: 900, foundCount: 2 },
    ];
    expect(computeSavingsMessage(totals, 3)).toEqual({
      cheapestName: "A店",
      comparedName: "B店",
      diff: 312,
    });
  });

  it("全品揃う店舗が1件以下ならnull", () => {
    const totals = [
      { id: "a", name: "A店", total: 1000, foundCount: 3 },
      { id: "c", name: "C店", total: 900, foundCount: 2 },
    ];
    expect(computeSavingsMessage(totals, 3)).toBeNull();
  });

  it("差額が0円ならnull", () => {
    const totals = [
      { id: "a", name: "A店", total: 1000, foundCount: 3 },
      { id: "b", name: "B店", total: 1000, foundCount: 3 },
    ];
    expect(computeSavingsMessage(totals, 3)).toBeNull();
  });

  it("品目数が0ならnull", () => {
    expect(computeSavingsMessage([], 0)).toBeNull();
  });
});

describe("computeMultiStoreSavings", () => {
  it("複数店舗に分けた方が安ければ差額を返す", () => {
    const cartEntries = [{ representativePrice: 100 }, { representativePrice: 200 }];
    const cartStoreTotals = [
      { total: 350, foundCount: 2 },
      { total: 400, foundCount: 2 },
    ];
    expect(computeMultiStoreSavings(cartEntries, cartStoreTotals, 2)).toEqual({
      singleStoreTotal: 350,
      multiStoreTotal: 300,
      diff: 50,
    });
  });

  it("1店舗で全品揃う方が安いか同額ならnull", () => {
    const cartEntries = [{ representativePrice: 100 }, { representativePrice: 200 }];
    const cartStoreTotals = [{ total: 300, foundCount: 2 }];
    expect(computeMultiStoreSavings(cartEntries, cartStoreTotals, 2)).toBeNull();
  });

  it("全品揃う店舗が無ければnull", () => {
    const cartEntries = [{ representativePrice: 100 }];
    const cartStoreTotals = [{ total: 90, foundCount: 0 }];
    expect(computeMultiStoreSavings(cartEntries, cartStoreTotals, 1)).toBeNull();
  });

  it("カートが空ならnull", () => {
    expect(computeMultiStoreSavings([], [], 0)).toBeNull();
  });
});

describe("recordSavings / getMonthlySavings", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("初回は0円", () => {
    expect(getMonthlySavings(new Date("2026-08-01"))).toBe(0);
  });

  it("記録した額が今月の累計に加算される", () => {
    const date = new Date("2026-08-01");
    recordSavings(312, date);
    recordSavings(150, date);
    expect(getMonthlySavings(date)).toBe(462);
  });

  it("0円以下は加算しない", () => {
    const date = new Date("2026-08-01");
    recordSavings(0, date);
    recordSavings(-100, date);
    expect(getMonthlySavings(date)).toBe(0);
  });

  it("月が変わると別集計になる", () => {
    recordSavings(300, new Date("2026-07-31"));
    recordSavings(100, new Date("2026-08-01"));
    expect(getMonthlySavings(new Date("2026-07-31"))).toBe(300);
    expect(getMonthlySavings(new Date("2026-08-01"))).toBe(100);
  });
});
