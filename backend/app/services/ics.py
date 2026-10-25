"""Minimal iCalendar (.ics) writer so Google Calendar / Apple Calendar can subscribe to a timeline."""
from datetime import datetime, timedelta, timezone


def _fmt(dt):
    return dt.strftime("%Y%m%dT%H%M%S")


def _esc(text):
    return (text or "").replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\r", "").replace("\n", "\\n")


def _fold(line):
    out, raw = [], line.encode("utf-8")
    while len(raw) > 74:
        cut = 74
        while cut > 0 and (raw[cut] & 0xC0) == 0x80:  # do not split a UTF-8 character
            cut -= 1
        out.append(raw[:cut].decode("utf-8"))
        raw = b" " + raw[cut:]
    out.append(raw.decode("utf-8"))
    return "\r\n".join(out)


def build_ics(entries, calendar_name="Eventure"):
    """entries: [{"uid", "title", "start", "end"|None, "location", "description", "alarm_minutes"|None}]"""
    stamp = _fmt(datetime.now(timezone.utc)) + "Z"
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Eventure//Timeline//EN", "CALSCALE:GREGORIAN",
             f"X-WR-CALNAME:{_esc(calendar_name)}"]
    for e in entries:
        if not e.get("start"):
            continue
        end = e.get("end") or (e["start"] + timedelta(hours=1))
        lines += ["BEGIN:VEVENT", f"UID:{e['uid']}@eventure", f"DTSTAMP:{stamp}",
                  f"DTSTART:{_fmt(e['start'])}", f"DTEND:{_fmt(end)}", f"SUMMARY:{_esc(e['title'])}"]
        if e.get("location"):
            lines.append(f"LOCATION:{_esc(e['location'])}")
        if e.get("description"):
            lines.append(f"DESCRIPTION:{_esc(e['description'])}")
        if e.get("alarm_minutes"):
            lines += ["BEGIN:VALARM", "ACTION:DISPLAY", f"DESCRIPTION:{_esc(e['title'])}",
                      f"TRIGGER:-PT{int(e['alarm_minutes'])}M", "END:VALARM"]
        lines.append("END:VEVENT")
    lines.append("END:VCALENDAR")
    return "\r\n".join(_fold(l) for l in lines) + "\r\n"
