import { describe, expect, it } from "vitest";
import { buildChartSeries } from "./priceHistoryChart.js";

describe("buildChartSeries", () => {
  it("複数店舗の履歴を日付順にマージする", () => {
    const result = buildChartSeries([
      {
        storeName: "A店",
        history: [
          { price: 100, scrapedAt: "2026-07-21T00:00:00Z" },
          { price: 120, scrapedAt: "2026-07-20T00:00:00Z" },
        ],
      },
      {
        storeName: "B店",
        history: [
          { price: 90, scrapedAt: "2026-07-21T00:00:00Z" },
          { price: 90, scrapedAt: "2026-07-20T00:00:00Z" },
        ],
      },
    ]);

    expect(result.storeNames).toEqual(["A店", "B店"]);
    expect(result.data).toEqual([
      { date: "07/20", "A店": 120, "B店": 90 },
      { date: "07/21", "A店": 100, "B店": 90 },
    ]);
  });

  it("店舗ごとに欠測日があってもその店舗のキーが無いだけで済む", () => {
    const result = buildChartSeries([
      { storeName: "A店", history: [{ price: 100, scrapedAt: "2026-07-21T00:00:00Z" }] },
      { storeName: "B店", history: [{ price: 90, scrapedAt: "2026-07-20T00:00:00Z" }] },
    ]);

    expect(result.data).toEqual([
      { date: "07/20", "B店": 90 },
      { date: "07/21", "A店": 100 },
    ]);
  });

  it("同じ日に複数回スクレイピングされていても新しい方(先頭)を採用する", () => {
    const result = buildChartSeries([
      {
        storeName: "A店",
        history: [
          { price: 95, scrapedAt: "2026-07-21T18:00:00Z" },
          { price: 100, scrapedAt: "2026-07-21T06:00:00Z" },
        ],
      },
    ]);
    expect(result.data).toEqual([{ date: "07/21", "A店": 95 }]);
  });

  it("店舗が無ければ空データ", () => {
    expect(buildChartSeries([])).toEqual({ data: [], storeNames: [] });
  });
});
