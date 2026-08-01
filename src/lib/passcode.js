import { supabase } from "./supabaseClient.js";

const PASSCODE_STORAGE_KEY = "priceCompareApp.unlockedPasscode";

/**
 * 渡された現在のパスコードに対して、この端末が解除済みかどうかを判定する。
 * 解除時に使った値そのものを保存しているため、管理画面でパスコードが変更されると
 * 保存済みの値と一致しなくなり、再入力が必要になる。
 */
export function isUnlockedFor(currentPasscode) {
  try {
    const stored = localStorage.getItem(PASSCODE_STORAGE_KEY);
    return checkPasscode(stored, currentPasscode);
  } catch {
    return false;
  }
}

export function unlockPasscode(passcodeValue) {
  try {
    localStorage.setItem(PASSCODE_STORAGE_KEY, passcodeValue);
  } catch {
    // localStorageが使えない環境では何もしない
  }
}

export async function fetchCurrentPasscode() {
  const { data, error } = await supabase
    .from("app_settings")
    .select("passcode")
    .eq("id", 1)
    .single();

  if (error) throw error;
  return data.passcode;
}

export function checkPasscode(input, currentPasscode) {
  if (typeof input !== "string" || typeof currentPasscode !== "string") return false;
  const a = input.trim().normalize("NFKC").toLowerCase();
  const b = currentPasscode.trim().normalize("NFKC").toLowerCase();
  if (!a || !b) return false;
  return a === b;
}
