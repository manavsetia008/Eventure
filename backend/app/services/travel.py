"""Travel-time estimates. Uses Google Distance Matrix when a key is set, otherwise a distance-based estimate."""
import logging
from functools import lru_cache
from math import asin, cos, radians, sin, sqrt

import requests

AVG_SPEED_KMH = 25.0   # city traffic, mix of metro, cab and bus
ROAD_FACTOR = 1.3      # straight line -> road distance
MIN_TRAVEL_MIN = 10


def haversine_km(lat1, lon1, lat2, lon2):
    r = 6371.0
    p1, p2 = radians(lat1), radians(lat2)
    dphi, dlmb = radians(lat2 - lat1), radians(lon2 - lon1)
    a = sin(dphi / 2) ** 2 + cos(p1) * cos(p2) * sin(dlmb / 2) ** 2
    return 2 * r * asin(sqrt(a))


def _have(*vals):
    return all(v is not None for v in vals)


def estimate_minutes_offline(lat1, lng1, lat2, lng2):
    km = haversine_km(lat1, lng1, lat2, lng2) * ROAD_FACTOR
    return max(MIN_TRAVEL_MIN, int(round(km / AVG_SPEED_KMH * 60)) + 10)


@lru_cache(maxsize=512)
def _maps_minutes(lat1, lng1, lat2, lng2, api_key):
    try:
        resp = requests.get(
            "https://maps.googleapis.com/maps/api/distancematrix/json",
            params={"origins": f"{lat1},{lng1}", "destinations": f"{lat2},{lng2}", "mode": "driving", "key": api_key},
            timeout=5,
        )
        element = resp.json()["rows"][0]["elements"][0]
        if element.get("status") == "OK":
            return int(round(element["duration"]["value"] / 60))
    except Exception as exc:  # network, quota, bad key: fall back quietly
        logging.warning("Distance Matrix failed, using estimate: %s", exc)
    return None


def estimate_minutes(lat1, lng1, lat2, lng2, api_key=None):
    """Minutes to travel between two points, or None if either point is unknown."""
    if not _have(lat1, lng1, lat2, lng2):
        return None
    if abs(lat1 - lat2) < 1e-4 and abs(lng1 - lng2) < 1e-4:
        return 0
    if api_key:
        minutes = _maps_minutes(round(lat1, 4), round(lng1, 4), round(lat2, 4), round(lng2, 4), api_key)
        if minutes is not None:
            return minutes
    return estimate_minutes_offline(lat1, lng1, lat2, lng2)


NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"


@lru_cache(maxsize=256)
def _nominatim(place):
    """Free OpenStreetMap lookup. Fine for a few requests a minute; see their usage policy before scaling up."""
    try:
        resp = requests.get(
            NOMINATIM_URL,
            params={"q": place, "format": "jsonv2", "limit": 1},
            headers={"User-Agent": "Eventure/1.0 (student event planner)"},
            timeout=6,
        )
        data = resp.json()
        if data:
            return float(data[0]["lat"]), float(data[0]["lon"])
    except Exception as exc:
        logging.warning("OpenStreetMap geocoding failed: %s", exc)
    return None


def geocode(place, api_key=None, allow_osm=True):
    """(lat, lng) for a venue name, or None. Uses Google when a key is set, otherwise OpenStreetMap."""
    place = (place or "").strip()
    if not place:
        return None
    if api_key:
        try:
            resp = requests.get(
                "https://maps.googleapis.com/maps/api/geocode/json",
                params={"address": place, "key": api_key},
                timeout=5,
            )
            results = resp.json().get("results") or []
            if results:
                loc = results[0]["geometry"]["location"]
                return loc["lat"], loc["lng"]
        except Exception as exc:
            logging.warning("Google geocoding failed: %s", exc)
    return _nominatim(place) if allow_osm else None
