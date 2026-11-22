import { useMemo } from "react";

const INDIA = {
  lat: 22.9734,
  lng: 78.6569,
  bbox: [68.0, 6.0, 97.5, 37.5],
};

function validPoint(lat, lng) {
  if (lat == null || lng == null || lat === "" || lng === "") return false;
  const latitude = Number(lat);
  const longitude = Number(lng);
  return Number.isFinite(latitude) && Number.isFinite(longitude) &&
    latitude >= -90 && latitude <= 90 &&
    longitude >= -180 && longitude <= 180;
}

// OpenStreetMap's own embeddable map. No JavaScript map SDK, API token,
// tile provider configuration or third-party key is required.
export default function MapView({ college }) {
  const hasCollegeLocation = validPoint(college?.lat, college?.lng);
  const latitude = hasCollegeLocation ? Number(college.lat) : INDIA.lat;
  const longitude = hasCollegeLocation ? Number(college.lng) : INDIA.lng;

  const embedUrl = useMemo(() => {
    if (!hasCollegeLocation) {
      const [west, south, east, north] = INDIA.bbox;
      return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent([west, south, east, north].join(","))}&layer=mapnik`;
    }

    const pad = 0.18;
    const west = Math.max(-180, longitude - pad);
    const east = Math.min(180, longitude + pad);
    const south = Math.max(-85, latitude - pad);
    const north = Math.min(85, latitude + pad);
    const bbox = [west, south, east, north].join(",");
    const marker = `${latitude},${longitude}`;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(marker)}`;
  }, [hasCollegeLocation, latitude, longitude]);

  const fullMapUrl = hasCollegeLocation
    ? `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=12/${latitude}/${longitude}`
    : `https://www.openstreetmap.org/#map=5/${INDIA.lat}/${INDIA.lng}`;

  return (
    <div className="map" role="region" aria-label="OpenStreetMap">
      <iframe
        key={embedUrl}
        className="map-embed"
        src={embedUrl}
        title={hasCollegeLocation ? `Map around ${college?.name || "your college"}` : "Map of India"}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
      <a
        className="map-open-link"
        href={fullMapUrl}
        target="_blank"
        rel="noreferrer"
      >
        Open full map ↗
      </a>
    </div>
  );
}
