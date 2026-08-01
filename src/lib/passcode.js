import { supabase } from "./supabaseClient.js";

const PASSCODE_STORAGE_KEY = "priceCompareApp.passcodeUnlocked";

export function isPasscodeUnlocked() {
  try {
    return localStorage.getItem(PASSCODE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function unlockPasscode() {
  try {
    localStorage.setItem(PASSCODE_STORAGE_KEY, "true");
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
