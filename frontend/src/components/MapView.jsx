import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

export default function MapView({ college, events, onOpen }) {
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);

  useEffect(() => {
    map.current = L.map(el.current).setView([28.6139, 77.209], 10);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 18,
      subdomains: "abcd",
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
      L.circleMarker([college.lat, college.lng], {
        radius: 9,
        color: "#0f172a",
        fillColor: "#1e1b4b",
        fillOpacity: 1,
        weight: 2,
      })
        .bindTooltip("Your college")
        .addTo(layer.current);
      points.push([college.lat, college.lng]);
    }
    events
      .filter((e) => e.lat != null && e.lng != null)
      .forEach((e) => {
        const marker = L.circleMarker([e.lat, e.lng], {
          radius: 8,
          color: "#dc2626",
          fillColor: "#ef4444",
          fillOpacity: 0.9,
          weight: 2,
        });
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
