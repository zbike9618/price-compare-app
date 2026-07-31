const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export function formatRelativeTime(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  if (diffMs < 0) return "たった今";

  const minutes = Math.floor(diffMs / (60 * 1000));
  if (minutes < 1) return "たった今";
  if (minutes < 60) return `${minutes}分前`;

  const hours = Math.floor(diffMs / HOUR_MS);
  if (hours < 24) return `${hours}時間前`;

  const days = Math.floor(diffMs / DAY_MS);
  return `${days}日前`;
}

export function isStalePrice(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  return diffMs >= DAY_MS;
}
