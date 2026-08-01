// 共通の固定パスコード。Zが変更したい場合はこの値を書き換えるだけでよい
export const PASSCODE = "TOKUCHIKA2026";

const PASSCODE_STORAGE_KEY = "priceCompareApp.passcodeUnlocked";

export function isPasscodeUnlocked() {
  try {
    return localStorage.getItem(PASSCODE_STORAGE_KEY) === "true";
  } catch {
    return true;
  }
}

export function unlockPasscode() {
  try {
    localStorage.setItem(PASSCODE_STORAGE_KEY, "true");
  } catch {
    // localStorageが使えない環境では何もしない
  }
}

export function checkPasscode(input) {
  if (typeof input !== "string") return false;
  return input.trim().toLowerCase() === PASSCODE.toLowerCase();
}
