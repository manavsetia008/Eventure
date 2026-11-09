const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n) => String(n).padStart(2, "0");

// Server times are naive local ISO strings ("2026-10-17T10:00"); JS reads them as local time.
export const parse = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
};

export function fmtDay(iso) {
  const d = parse(iso);
  return d ? `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}` : "";
}

export function fmtTime(iso) {
  const d = parse(iso);
  return d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : "";
}

export function fmtDate(iso) {
  return iso && parse(iso) ? `${fmtDay(iso)}, ${fmtTime(iso)}` : "Date to be confirmed";
}

export function fmtRange(start, end) {
  if (!start || !parse(start)) return "Date to be confirmed";
  if (!end || !parse(end)) return fmtDate(start);
  if (fmtDay(start) === fmtDay(end)) return `${fmtDay(start)}, ${fmtTime(start)} to ${fmtTime(end)}`;
  return `${fmtDate(start)} to ${fmtDate(end)}`;
}

export function timeLeft(iso) {
  const d = parse(iso);
  if (!d) return "";
  const diffMs = d.getTime() - Date.now();
  if (diffMs < 0) return "overdue";
  const hours = diffMs / 36e5;
  if (hours < 1) return "under 1 h left";
  if (hours < 48) return `${Math.round(hours)} h left`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} days left`;
  const weeks = Math.floor(days / 7);
  const remDays = days % 7;
  return remDays ? `${weeks} wk ${remDays} d left` : `${weeks} wk left`;
}

export function timeAgo(dateString) {
  if (!dateString) return "";
  const d = parse(dateString);
  if (!d) return "";
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffSec < 0) return "just now";
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return fmtDate(dateString);
}

export function fmtMinutes(m) {
  if (m == null || isNaN(m)) return "";
  const num = Math.round(Number(m));
  if (num < 0) return "0 min";
  if (num < 60) return `${num} min`;
  const totalH = Math.floor(num / 60);
  if (totalH < 24) {
    const r = num % 60;
    return r ? `${totalH} h ${r} min` : `${totalH} h`;
  }
  const days = Math.floor(totalH / 24);
  const remH = totalH % 24;
  if (days < 7) return remH ? `${days} d ${remH} h` : `${days} d`;
  const weeks = Math.floor(days / 7);
  const remD = days % 7;
  return remD ? `${weeks} wk ${remD} d` : `${weeks} wk`;
}

export function fmtDuration(minutes) {
  // Like fmtMinutes but capped at reasonable travel (max ~12 h shown for travel display)
  if (minutes == null) return "";
  if (minutes > 720) return "> 12 h"; // sanity cap for travel display
  return fmtMinutes(minutes);
}

export const toInput = (iso) => (iso ? String(iso).slice(0, 16) : "");
export const CATEGORIES = ["hackathon", "workshop", "conference", "seminar", "contest", "fest", "other"];
export const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : "");

export const blank = (v) => (v === "" || v === undefined ? null : v);

export function clubAvatar(name) {
  return name ? name.trim()[0].toUpperCase() : "?";
}

export function urlBase64ToUint8Array(b64) {
  if (!b64) return new Uint8Array();
  const padded = (b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
