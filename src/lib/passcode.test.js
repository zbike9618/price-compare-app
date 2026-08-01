// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from "vitest";
import { PASSCODE, isPasscodeUnlocked, unlockPasscode, checkPasscode } from "./passcode.js";

describe("checkPasscode", () => {
  it("正しいコードならtrueを返す", () => {
    expect(checkPasscode(PASSCODE)).toBe(true);
  });

  it("大文字小文字が違ってもtrueを返す", () => {
    expect(checkPasscode(PASSCODE.toLowerCase())).toBe(true);
  });

  it("前後に空白があってもtrueを返す", () => {
    expect(checkPasscode(`  ${PASSCODE}  `)).toBe(true);
  });

  it("間違ったコードならfalseを返す", () => {
    expect(checkPasscode("wrong-code")).toBe(false);
  });

  it("空文字ならfalseを返す", () => {
    expect(checkPasscode("")).toBe(false);
  });

  it("文字列以外が渡されてもfalseを返す（例外を投げない）", () => {
    expect(checkPasscode(undefined)).toBe(false);
    expect(checkPasscode(null)).toBe(false);
  });
});

describe("isPasscodeUnlocked / unlockPasscode", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("未設定ならfalseを返す", () => {
    expect(isPasscodeUnlocked()).toBe(false);
  });

  it("unlockPasscode後はtrueを返す", () => {
    unlockPasscode();
    expect(isPasscodeUnlocked()).toBe(true);
  });

  it("localStorageアクセスが例外を投げる環境ではfalseを返す（fail-openしない）", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("localStorage is not available");
    });
    try {
      expect(isPasscodeUnlocked()).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });
});
