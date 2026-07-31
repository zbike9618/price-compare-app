// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";
import { ONBOARDING_STEPS, hasSeenOnboarding, markOnboardingSeen } from "./onboarding.js";

describe("ONBOARDING_STEPS", () => {
  it("4ステップ、list→cart→map→favoritesの順で定義されている", () => {
    expect(ONBOARDING_STEPS.map((s) => s.id)).toEqual(["list", "cart", "map", "favorites"]);
  });

  it("各ステップがtitle・description・targetIdを持つ", () => {
    for (const step of ONBOARDING_STEPS) {
      expect(step.targetId).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
    }
  });
});

describe("hasSeenOnboarding / markOnboardingSeen", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("未設定ならfalseを返す", () => {
    expect(hasSeenOnboarding()).toBe(false);
  });

  it("markOnboardingSeen後はtrueを返す", () => {
    markOnboardingSeen();
    expect(hasSeenOnboarding()).toBe(true);
  });
});
