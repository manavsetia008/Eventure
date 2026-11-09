const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n) => String(n).padStart(2, "0");

// Server times are naive local ISO strings ("2026-10-17T10:00"); JS reads them as local time.
export const parse = (iso) => (iso ? new Date(iso) : null);

export function fmtDay(iso) {
  const d = parse(iso);
  return d ? `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}` : "";
}
export function fmtTime(iso) {
  const d = parse(iso);
  return d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : "";
}
export function fmtDate(iso) {
  return iso ? `${fmtDay(iso)}, ${fmtTime(iso)}` : "Date to be confirmed";
}
export function fmtRange(start, end) {
  if (!start) return "Date to be confirmed";
  if (!end) return fmtDate(start);
  if (fmtDay(start) === fmtDay(end)) return `${fmtDay(start)}, ${fmtTime(start)} to ${fmtTime(end)}`;
  return `${fmtDate(start)} to ${fmtDate(end)}`;
}
export function timeLeft(iso) {
  const d = parse(iso);
  if (!d) return "";
  const hours = (d - new Date()) / 36e5;
  if (hours < 0) return "overdue";
  if (hours < 1) return "under 1 h left";
  if (hours < 48) return `${Math.floor(hours)} h left`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} days left`;
  const weeks = Math.floor(days / 7);
  const remDays = days % 7;
  return remDays ? `${weeks} wk ${remDays} d left` : `${weeks} wk left`;
}
export function fmtMinutes(m) {
  if (m == null) return "";
  if (m < 60) return `${m} min`;
  const totalH = Math.floor(m / 60);
  if (totalH < 24) {
    const r = m % 60;
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
export const toInput = (iso) => (iso ? iso.slice(0, 16) : "");
export const CATEGORIES = ["hackathon", "workshop", "conference", "seminar", "contest", "fest", "other"];
export const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : "");
