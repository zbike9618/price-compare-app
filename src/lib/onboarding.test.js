// @vitest-environment jsdom
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { ONBOARDING_STEPS, hasSeenOnboarding, markOnboardingSeen, findVisibleTourTarget } from "./onboarding.js";

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

describe("findVisibleTourTarget", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("同じdata-tour-idの要素が複数あり片方がdisplay:noneのとき、表示されている方のDOMRectが返る", () => {
    document.body.innerHTML = `
      <div id="hidden" data-tour-id="list" style="display:none"></div>
      <div id="visible" data-tour-id="list"></div>
    `;
    const hiddenEl = document.getElementById("hidden");
    const visibleEl = document.getElementById("visible");

    vi.spyOn(hiddenEl, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, 0, 0)
    );
    vi.spyOn(visibleEl, "getBoundingClientRect").mockReturnValue(
      new DOMRect(10, 10, 100, 50)
    );

    const rect = findVisibleTourTarget("list");
    expect(rect).not.toBeNull();
    expect(rect.left).toBe(10);
    expect(rect.top).toBe(10);
    expect(rect.width).toBe(100);
    expect(rect.height).toBe(50);
  });

  it("該当するdata-tour-idの要素が1つもないときnullが返る", () => {
    document.body.innerHTML = `<div data-tour-id="other"></div>`;
    expect(findVisibleTourTarget("list")).toBeNull();
  });

  it("両方とも画面内に交差矩形を持つ場合、交差面積が大きい方が返る", () => {
    document.body.innerHTML = `
      <div id="small" data-tour-id="list"></div>
      <div id="large" data-tour-id="list"></div>
    `;
    const smallEl = document.getElementById("small");
    const largeEl = document.getElementById("large");

    vi.spyOn(smallEl, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, 20, 20)
    );
    vi.spyOn(largeEl, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, 200, 200)
    );

    const rect = findVisibleTourTarget("list");
    expect(rect.width).toBe(200);
    expect(rect.height).toBe(200);
  });

  it("要素が画面外にスクロールアウトしている場合は除外される", () => {
    document.body.innerHTML = `
      <div id="offscreen" data-tour-id="list"></div>
      <div id="onscreen" data-tour-id="list"></div>
    `;
    const offscreenEl = document.getElementById("offscreen");
    const onscreenEl = document.getElementById("onscreen");

    vi.spyOn(offscreenEl, "getBoundingClientRect").mockReturnValue(
      new DOMRect(-500, -500, 100, 50)
    );
    vi.spyOn(onscreenEl, "getBoundingClientRect").mockReturnValue(
      new DOMRect(10, 10, 100, 50)
    );

    const rect = findVisibleTourTarget("list");
    expect(rect.left).toBe(10);
  });
});
