import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export default function MapView({ stores }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    const withCoords = stores.filter((s) => s.lat != null && s.lng != null);
    if (!containerRef.current || withCoords.length === 0) return;

    if (!mapRef.current) {
      mapRef.current = L.map(containerRef.current);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(mapRef.current);
    }

    const map = mapRef.current;
    const markers = withCoords.map((s) => L.marker([s.lat, s.lng]).addTo(map).bindPopup(s.name));
    const bounds = L.latLngBounds(withCoords.map((s) => [s.lat, s.lng]));
    map.fitBounds(bounds.pad(0.3));

    return () => {
      markers.forEach((m) => map.removeLayer(m));
    };
  }, [stores]);

  const withCoords = stores.filter((s) => s.lat != null && s.lng != null);

  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden" }}>
      {withCoords.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
          座標データのある店舗がありません
        </div>
      ) : (
        <div ref={containerRef} style={{ height: 420, width: "100%" }} />
      )}
    </div>
  );
}
