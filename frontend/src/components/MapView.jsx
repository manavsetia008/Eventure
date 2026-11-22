import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";

// Use a public Esri basemap first, with OSM as an automatic no-key fallback.
// The OSM standard tile host is best-effort and can throttle clients; no API key
// or browser credential is required for either layer.
const TILE_PROVIDERS = [
  {
    name: "Esri World Street Map",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    attribution:
      'Sources: <a href="https://www.esri.com/" target="_blank" rel="noreferrer">Esri</a>, HERE, Garmin, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), MapmyIndia, TomTom.',
    maxZoom: 18,
  },
  {
    name: "OpenStreetMap",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>',
    maxZoom: 19,
  },
];

const INDIA_CENTER = [22.9734, 78.6569];

function validCoordinatePair(lat, lng) {
  if (lat == null || lng == null || lat === "" || lng === "") return false;
  const latitude = Number(lat);
  const longitude = Number(lng);
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export default function MapView({ college, events, onOpen }) {
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const tiles = useRef(null);
  const providerIndex = useRef(0);
  const tileErrorCount = useRef(0);
  const tileLoadCount = useRef(0);
  const fallbackTimer = useRef(null);
  const disposed = useRef(false);
  const [tileStatus, setTileStatus] = useState("loading");
  const [providerName, setProviderName] = useState(TILE_PROVIDERS[0].name);

  useEffect(() => {
    disposed.current = false;
    const instance = L.map(el.current, {
      scrollWheelZoom: false,
      preferCanvas: true,
      zoomControl: true,
    }).setView(INDIA_CENTER, 5);
    map.current = instance;
    layer.current = L.layerGroup().addTo(instance);

    const mountProvider = (index) => {
      if (disposed.current || !map.current) return;
      if (fallbackTimer.current) {
        window.clearTimeout(fallbackTimer.current);
        fallbackTimer.current = null;
      }
      if (tiles.current) {
        tiles.current.off();
        map.current.removeLayer(tiles.current);
      }

      providerIndex.current = index;
      tileErrorCount.current = 0;
      tileLoadCount.current = 0;
      const provider = TILE_PROVIDERS[index];
      setProviderName(provider.name);
      setTileStatus("loading");

      const tileLayer = L.tileLayer(provider.url, {
        attribution: provider.attribution,
        minZoom: 2,
        maxZoom: 18,
        maxNativeZoom: provider.maxZoom,
        keepBuffer: 2,
        updateWhenIdle: true,
      });

      tileLayer.on("tileload", () => {
        if (disposed.current || providerIndex.current !== index) return;
        tileLoadCount.current += 1;
        setTileStatus("loaded");
      });

      tileLayer.on("tileerror", () => {
        if (disposed.current || providerIndex.current !== index) return;
        tileErrorCount.current += 1;
        if (tileErrorCount.current >= 2) {
          if (index + 1 < TILE_PROVIDERS.length) {
            mountProvider(index + 1);
          } else {
            setTileStatus("error");
          }
        }
      });

      tiles.current = tileLayer.addTo(map.current);

      // Some tile gateways fail silently or stall without dispatching tileerror.
      fallbackTimer.current = window.setTimeout(() => {
        if (
          !disposed.current &&
          providerIndex.current === index &&
          tileLoadCount.current === 0
        ) {
          if (index + 1 < TILE_PROVIDERS.length) {
            mountProvider(index + 1);
          } else {
            setTileStatus("error");
          }
        }
      }, 9000);
    };

    mountProvider(0);
    const resizeTimer = window.setTimeout(() => instance.invalidateSize(), 150);

    return () => {
      disposed.current = true;
      window.clearTimeout(resizeTimer);
      if (fallbackTimer.current) window.clearTimeout(fallbackTimer.current);
      fallbackTimer.current = null;
      instance.remove();
      map.current = null;
      tiles.current = null;
      layer.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map.current || !layer.current) return;
    layer.current.clearLayers();
    const points = [];

    if (validCoordinatePair(college?.lat, college?.lng)) {
      const point = [Number(college.lat), Number(college.lng)];
      L.circleMarker(point, {
        radius: 9,
        className: "map-marker map-marker-college",
        weight: 2,
        fillOpacity: 1,
      })
        .bindTooltip("Your college")
        .addTo(layer.current);
      points.push(point);
    }

    (events || [])
      .filter((event) => validCoordinatePair(event?.lat, event?.lng))
      .forEach((event) => {
        const point = [Number(event.lat), Number(event.lng)];
        const marker = L.circleMarker(point, {
          radius: 8,
          className: "map-marker map-marker-event",
          weight: 2,
          fillOpacity: 0.9,
        });
        marker.bindTooltip(event.title || "Event");
        marker.on("click", () => onOpen(event.id));
        marker.addTo(layer.current);
        points.push(point);
      });

    if (points.length > 1) {
      map.current.fitBounds(points, { padding: [30, 30], maxZoom: 13 });
    } else if (points.length === 1) {
      map.current.setView(points[0], 12);
    } else {
      // Imported listings often omit coordinates. Keep the map useful and
      // centred on India instead of treating null coordinates as (0, 0).
      map.current.setView(INDIA_CENTER, 5);
    }
  }, [college, events, onOpen]);

  return (
    <div ref={el} className="map" role="region" aria-label="Eventure map">
      {tileStatus !== "loaded" && (
        <div className={`map-state ${tileStatus === "error" ? "map-state-error" : ""}`} role="status">
          {tileStatus === "loading"
            ? `Loading ${providerName} map…`
            : "Map tiles could not be loaded. Check your connection and refresh."}
        </div>
      )}
      {tileStatus === "loaded" && (
        <span className="map-provider-label">{providerName}</span>
      )}
    </div>
  );
}
