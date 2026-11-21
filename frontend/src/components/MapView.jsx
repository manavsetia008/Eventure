import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

// Keyless OpenStreetMap raster tiles. The previous CARTO endpoints now display
// an "API KEY REQUIRED" overlay unless an account key is supplied.
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>';

function currentTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

export default function MapView({ college, events, onOpen }) {
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const tiles = useRef(null);

  useEffect(() => {
    map.current = L.map(el.current, {
      scrollWheelZoom: false,
      preferCanvas: true,
    }).setView([28.6139, 77.209], 10);

    // Standard OSM tiles require no API token. Keep the visible attribution and
    // let the browser honour the tile server's cache headers.
    tiles.current = L.tileLayer(TILE_URL, {
      attribution: ATTRIBUTION,
      minZoom: 3,
      maxZoom: 19,
      crossOrigin: true,
    }).addTo(map.current);

    layer.current = L.layerGroup().addTo(map.current);

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
      tiles.current = null;
      layer.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map.current || !layer.current) return;
    layer.current.clearLayers();
    const points = [];

    if (college && college.lat != null && college.lng != null) {
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

    (events || [])
      .filter((event) => Number.isFinite(Number(event.lat)) && Number.isFinite(Number(event.lng)))
      .forEach((event) => {
        const marker = L.circleMarker([Number(event.lat), Number(event.lng)], {
          radius: 8,
          className: "map-marker map-marker-event",
          weight: 2,
          fillOpacity: 0.9,
        });
        marker.bindTooltip(event.title || "Event");
        marker.on("click", () => onOpen(event.id));
        marker.addTo(layer.current);
        points.push([Number(event.lat), Number(event.lng)]);
      });

    if (points.length > 1) {
      map.current.fitBounds(points, { padding: [30, 30], maxZoom: 13 });
    } else if (points.length === 1) {
      map.current.setView(points[0], 12);
    }
  }, [college, events, onOpen]);

  return <div ref={el} className="map" role="region" aria-label="OpenStreetMap showing event locations" />;
}
