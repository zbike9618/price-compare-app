import { describe, expect, it } from "vitest";
import { haversineDistanceKm } from "./geo.js";

describe("haversineDistanceKm", () => {
  it("同じ地点なら距離は0", () => {
    expect(haversineDistanceKm(34.6551, 133.9195, 34.6551, 133.9195)).toBeCloseTo(0, 5);
  });

  it("緯度1度分の距離はおよそ111kmになる", () => {
    const distance = haversineDistanceKm(34.6551, 133.9195, 35.6551, 133.9195);
    expect(distance).toBeGreaterThan(110);
    expect(distance).toBeLessThan(112);
  });

  it("岡山駅(34.6551,133.9195)から倉敷市堀南(34.5989,133.7639)まではおよそ15〜16km", () => {
    const distance = haversineDistanceKm(34.6551, 133.9195, 34.5989, 133.7639);
    expect(distance).toBeGreaterThan(13);
    expect(distance).toBeLessThan(18);
  });
});
