const EARTH_RADIUS_KM = 6371;

/**
 * 2地点間の距離をkm単位で計算する（Haversine公式）
 */
export function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

const RANGE_STORAGE_KEY = "priceCompareApp.rangeSetting";

export function loadRangeSetting() {
  try {
    const raw = localStorage.getItem(RANGE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      !parsed?.center ||
      typeof parsed.center.lat !== "number" ||
      typeof parsed.center.lng !== "number" ||
      typeof parsed.radiusKm !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveRangeSetting(rangeSetting) {
  localStorage.setItem(RANGE_STORAGE_KEY, JSON.stringify(rangeSetting));
}
