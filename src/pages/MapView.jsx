import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { ACCENT } from "../lib/theme.js";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const OKAYAMA_CITY_CENTER = { lat: 34.6551, lng: 133.9195 };
const DEFAULT_RADIUS_KM = 3;

export default function MapView({ stores, rangeSetting, inRangeStoreIds, onConfirmRange }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const circleRef = useRef(null);
  const clickHandlerRef = useRef(null);

  const [selecting, setSelecting] = useState(() => rangeSetting == null);
  const [draftCenter, setDraftCenter] = useState(() => rangeSetting?.center ?? null);
  const [draftRadiusKm, setDraftRadiusKm] = useState(() => rangeSetting?.radiusKm ?? DEFAULT_RADIUS_KM);
  const [geoError, setGeoError] = useState(null);

  const withCoords = stores.filter((s) => s.lat != null && s.lng != null);

  // 地図の初期化（初回のみ）
  useEffect(() => {
    if (!containerRef.current || mapRef.current || withCoords.length === 0) return;
    mapRef.current = L.map(containerRef.current);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(mapRef.current);

    const initialCenter = draftCenter ?? OKAYAMA_CITY_CENTER;
    mapRef.current.setView([initialCenter.lat, initialCenter.lng], 13);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withCoords.length > 0]);

  // マーカー・円・クリックハンドラの再描画
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];
    if (circleRef.current) {
      map.removeLayer(circleRef.current);
      circleRef.current = null;
    }
    if (clickHandlerRef.current) {
      map.off("click", clickHandlerRef.current);
      clickHandlerRef.current = null;
    }

    if (selecting) {
      const handler = (e) => setDraftCenter({ lat: e.latlng.lat, lng: e.latlng.lng });
      map.on("click", handler);
      clickHandlerRef.current = handler;

      if (draftCenter) {
        circleRef.current = L.circle([draftCenter.lat, draftCenter.lng], {
          radius: draftRadiusKm * 1000,
          color: ACCENT,
          fillColor: ACCENT,
          fillOpacity: 0.12,
        }).addTo(map);
        const centerMarker = L.circleMarker([draftCenter.lat, draftCenter.lng], {
          radius: 6,
          color: ACCENT,
          fillColor: ACCENT,
          fillOpacity: 1,
        }).addTo(map);
        markersRef.current.push(centerMarker);
      }

      markersRef.current.push(
        ...withCoords.map((s) => {
          const marker = L.marker([s.lat, s.lng]).addTo(map).bindPopup(s.name);
          marker.setOpacity(0.5);
          return marker;
        })
      );
    } else {
      markersRef.current = withCoords.map((s) => {
        const marker = L.marker([s.lat, s.lng]).addTo(map).bindPopup(s.name);
        if (inRangeStoreIds && !inRangeStoreIds.has(s.id)) marker.setOpacity(0.35);
        return marker;
      });

      if (rangeSetting) {
        circleRef.current = L.circle([rangeSetting.center.lat, rangeSetting.center.lng], {
          radius: rangeSetting.radiusKm * 1000,
          color: ACCENT,
          fillColor: ACCENT,
          fillOpacity: 0.08,
        }).addTo(map);
        // 範囲設定がある場合は円を基準にズームする（全店舗基準だと遠方の店舗に引っ張られ円がほぼ見えなくなるため）
        map.fitBounds(circleRef.current.getBounds().pad(0.3));
      } else if (withCoords.length > 0) {
        const bounds = L.latLngBounds(withCoords.map((s) => [s.lat, s.lng]));
        map.fitBounds(bounds.pad(0.3));
      }
    }
  }, [selecting, draftCenter, draftRadiusKm, stores, inRangeStoreIds, rangeSetting]);

  const handleUseCurrentLocation = () => {
    if (!window.isSecureContext) {
      setGeoError("現在地取得にはHTTPS接続が必要です。https://tokuchika.gozakura.com からアクセスしてください");
      return;
    }
    if (!navigator.geolocation) {
      setGeoError("この端末では現在地を取得できません");
      return;
    }
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const center = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setDraftCenter(center);
        mapRef.current?.setView([center.lat, center.lng], 14);
      },
      () => setGeoError("現在地を取得できませんでした。地図をタップして選んでください")
    );
  };

  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", position: "relative" }}>
      {withCoords.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
          座標データのある店舗がありません
        </div>
      ) : (
        <>
          <div ref={containerRef} style={{ height: 420, width: "100%" }} />

          {selecting ? (
            <div
              style={{
                position: "absolute", top: 14, right: 14, zIndex: 1000, background: "#fff", borderRadius: 14,
                padding: 16, width: 210, boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
              }}
            >
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}>
                比べる範囲: <b style={{ color: "#0f172a" }}>{draftRadiusKm.toFixed(1)}km</b>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                step="0.5"
                value={draftRadiusKm}
                onChange={(e) => setDraftRadiusKm(Number(e.target.value))}
                style={{ width: "100%" }}
              />
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                style={{
                  display: "block", width: "100%", textAlign: "left", border: "none", background: "transparent",
                  color: ACCENT, fontSize: 13, margin: "10px 0", padding: 0, cursor: "pointer",
                }}
              >
                📍 今いる場所を使う
              </button>
              {geoError && <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 10 }}>{geoError}</div>}
              <button
                type="button"
                disabled={!draftCenter}
                onClick={() => onConfirmRange(draftCenter, draftRadiusKm)}
                style={{
                  width: "100%", padding: 11, background: draftCenter ? ACCENT : "#cbd5e1", color: "#fff",
                  border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700,
                  cursor: draftCenter ? "pointer" : "not-allowed",
                }}
              >
                この範囲に決める
              </button>
              {!draftCenter && (
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 8 }}>
                  地図をタップするか、「今いる場所を使う」を押してください
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraftCenter(rangeSetting?.center ?? null);
                setDraftRadiusKm(rangeSetting?.radiusKm ?? DEFAULT_RADIUS_KM);
                setSelecting(true);
              }}
              style={{
                position: "absolute", top: 14, right: 14, zIndex: 1000, background: "#fff", border: "1px solid #e2e8f0",
                borderRadius: 999, padding: "10px 16px", fontSize: 14, fontWeight: 700, color: ACCENT,
                boxShadow: "0 2px 6px rgba(0,0,0,0.08)", cursor: "pointer",
              }}
            >
              範囲を変える
            </button>
          )}
        </>
      )}
    </div>
  );
}
