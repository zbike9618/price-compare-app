export function yen(n) {
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}
