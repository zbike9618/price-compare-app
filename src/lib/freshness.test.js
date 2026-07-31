import { describe, expect, it } from "vitest";
import { formatRelativeTime, isStalePrice } from "./freshness.js";

describe("formatRelativeTime", () => {
  it("30分前なら「30分前」", () => {
    const iso = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    expect(formatRelativeTime(iso)).toBe("30分前");
  });

  it("5時間前なら「5時間前」", () => {
    const iso = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(iso)).toBe("5時間前");
  });

  it("3日前なら「3日前」", () => {
    const iso = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(iso)).toBe("3日前");
  });

  it("30秒前なら「たった今」", () => {
    const iso = new Date(Date.now() - 30 * 1000).toISOString();
    expect(formatRelativeTime(iso)).toBe("たった今");
  });
});

describe("isStalePrice", () => {
  it("23時間前はfalse", () => {
    const iso = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString();
    expect(isStalePrice(iso)).toBe(false);
  });

  it("25時間前はtrue", () => {
    const iso = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    expect(isStalePrice(iso)).toBe(true);
  });
});
