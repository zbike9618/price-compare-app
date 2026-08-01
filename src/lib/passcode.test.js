// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from "vitest";
import { isUnlockedFor, unlockPasscode, checkPasscode, fetchCurrentPasscode } from "./passcode.js";
import { supabase } from "./supabaseClient.js";

vi.mock("./supabaseClient.js", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe("checkPasscode", () => {
  it("正しいコードならtrueを返す", () => {
    expect(checkPasscode("TOKUCHIKA2026", "TOKUCHIKA2026")).toBe(true);
  });

  it("大文字小文字が違ってもtrueを返す", () => {
    expect(checkPasscode("tokuchika2026", "TOKUCHIKA2026")).toBe(true);
  });

  it("前後に空白があってもtrueを返す", () => {
    expect(checkPasscode("  TOKUCHIKA2026  ", "TOKUCHIKA2026")).toBe(true);
  });

  it("全角文字で入力されてもtrueを返す（NFKC正規化）", () => {
    expect(checkPasscode("ＴＯＫＵＣＨＩＫＡ２０２６", "TOKUCHIKA2026")).toBe(true);
  });

  it("間違ったコードならfalseを返す", () => {
    expect(checkPasscode("wrong-code", "TOKUCHIKA2026")).toBe(false);
  });

  it("空文字ならfalseを返す", () => {
    expect(checkPasscode("", "TOKUCHIKA2026")).toBe(false);
  });

  it("文字列以外が渡されてもfalseを返す（例外を投げない）", () => {
    expect(checkPasscode(undefined, "TOKUCHIKA2026")).toBe(false);
    expect(checkPasscode(null, "TOKUCHIKA2026")).toBe(false);
  });

  it("currentPasscodeがundefinedならfalseを返す（DB取得前の誤照合を防ぐ）", () => {
    expect(checkPasscode("TOKUCHIKA2026", undefined)).toBe(false);
  });

  it("両方とも空文字ならfalseを返す（空パスコード保存によるゲート無効化を防ぐ）", () => {
    expect(checkPasscode("", "")).toBe(false);
  });

  it("両方とも空白のみならfalseを返す", () => {
    expect(checkPasscode("   ", "   ")).toBe(false);
  });
});

describe("fetchCurrentPasscode", () => {
  it("app_settingsのpasscode列を返す", async () => {
    const single = vi.fn().mockResolvedValue({ data: { passcode: "ABC123" }, error: null });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    supabase.from.mockReturnValue({ select });

    const result = await fetchCurrentPasscode();

    expect(supabase.from).toHaveBeenCalledWith("app_settings");
    expect(select).toHaveBeenCalledWith("passcode");
    expect(eq).toHaveBeenCalledWith("id", 1);
    expect(result).toBe("ABC123");
  });

  it("Supabaseがエラーを返したら例外を投げる", async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: new Error("network error") });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    supabase.from.mockReturnValue({ select });

    await expect(fetchCurrentPasscode()).rejects.toThrow("network error");
  });
});

describe("isUnlockedFor / unlockPasscode", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("未設定ならfalseを返す", () => {
    expect(isUnlockedFor("TOKUCHIKA2026")).toBe(false);
  });

  it("unlockPasscode後、同じ現在パスコードに対してはtrueを返す", () => {
    unlockPasscode("TOKUCHIKA2026");
    expect(isUnlockedFor("TOKUCHIKA2026")).toBe(true);
  });

  it("管理画面でパスコードが変更された後は、旧パスコードで解除済みでもfalseを返す（再入力を要求）", () => {
    unlockPasscode("TOKUCHIKA2026");
    expect(isUnlockedFor("NEWCODE2026")).toBe(false);
  });

  it("localStorageアクセスが例外を投げる環境ではfalseを返す（fail-openしない）", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("localStorage is not available");
    });
    try {
      expect(isUnlockedFor("TOKUCHIKA2026")).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });
});
