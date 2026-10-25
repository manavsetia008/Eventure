import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

export default function MapView({ college, events, onOpen }) {
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);

  useEffect(() => {
    map.current = L.map(el.current).setView([28.6139, 77.209], 10);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 18,
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => {
      map.current.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map.current) return;
    layer.current.clearLayers();
    const points = [];
    if (college && college.lat != null) {
      L.circleMarker([college.lat, college.lng], { radius: 9, color: "#2e2963", fillColor: "#2e2963", fillOpacity: 1 })
        .bindTooltip("Your college")
        .addTo(layer.current);
      points.push([college.lat, college.lng]);
    }
    events
      .filter((e) => e.lat != null && e.lng != null)
      .forEach((e) => {
        const marker = L.circleMarker([e.lat, e.lng], { radius: 8, color: "#e8492d", fillColor: "#e8492d", fillOpacity: 0.85 });
        marker.bindTooltip(e.title);
        marker.on("click", () => onOpen(e.id));
        marker.addTo(layer.current);
        points.push([e.lat, e.lng]);
      });
    if (points.length > 1) map.current.fitBounds(points, { padding: [30, 30], maxZoom: 13 });
    else if (points.length === 1) map.current.setView(points[0], 12);
  }, [college, events, onOpen]);

  return <div ref={el} className="map" role="region" aria-label="Map of events" />;
}
