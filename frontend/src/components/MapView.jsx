import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

const TILES = {
  light: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
};

const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

function currentTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

export default function MapView({ college, events, onOpen }) {
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const tiles = useRef(null);

  useEffect(() => {
    map.current = L.map(el.current, { scrollWheelZoom: false }).setView([28.6139, 77.209], 10);

    const applyTiles = (theme) => {
      if (!map.current) return;
      if (tiles.current) map.current.removeLayer(tiles.current);
      tiles.current = L.tileLayer(TILES[theme], {
        attribution: ATTRIBUTION,
        maxZoom: 18,
        subdomains: "abcd",
      }).addTo(map.current);
    };

    applyTiles(currentTheme());
    layer.current = L.layerGroup().addTo(map.current);

    // Swap the basemap when the app theme changes so marker contrast stays correct.
    const observer = new MutationObserver(() => applyTiles(currentTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    return () => {
      observer.disconnect();
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
        className: "map-marker map-marker-college",
        weight: 2,
        fillOpacity: 1,
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
          className: "map-marker map-marker-event",
          weight: 2,
          fillOpacity: 0.9,
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
