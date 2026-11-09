import { describe, expect, it } from "vitest";
import {
  blank,
  cap,
  clubAvatar,
  fmtDate,
  fmtDay,
  fmtDuration,
  fmtMinutes,
  fmtRange,
  fmtTime,
  parse,
  timeAgo,
  timeLeft,
  toInput,
  urlBase64ToUint8Array,
} from "./utils";

describe("Frontend utils - Date & Parsing", () => {
  it("parse handles valid and invalid date inputs", () => {
    expect(parse(null)).toBeNull();
    expect(parse("")).toBeNull();
    expect(parse("invalid-date")).toBeNull();
    const d = parse("2026-10-17T10:30");
    expect(d).toBeInstanceOf(Date);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(9); // October is 9
    expect(d.getDate()).toBe(17);
    expect(d.getHours()).toBe(10);
    expect(d.getMinutes()).toBe(30);
  });

  it("fmtDay and fmtTime format date and time accurately", () => {
    expect(fmtDay(null)).toBe("");
    expect(fmtDay("invalid")).toBe("");
    expect(fmtTime(null)).toBe("");
    expect(fmtTime("invalid")).toBe("");

    const iso = "2026-10-17T09:05";
    expect(fmtDay(iso)).toBe("Sat 17 Oct");
    expect(fmtTime(iso)).toBe("09:05");
  });

  it("fmtDate formats date and time with fallback", () => {
    expect(fmtDate(null)).toBe("Date to be confirmed");
    expect(fmtDate("")).toBe("Date to be confirmed");
    expect(fmtDate("2026-10-17T14:00")).toBe("Sat 17 Oct, 14:00");
  });

  it("fmtRange formats single-day vs multi-day ranges", () => {
    expect(fmtRange(null, null)).toBe("Date to be confirmed");
    expect(fmtRange("2026-10-17T10:00", null)).toBe("Sat 17 Oct, 10:00");

    // Same day
    const sameDay = fmtRange("2026-10-17T10:00", "2026-10-17T18:00");
    expect(sameDay).toBe("Sat 17 Oct, 10:00 to 18:00");

    // Multi day
    const multiDay = fmtRange("2026-10-17T10:00", "2026-10-18T18:00");
    expect(multiDay).toBe("Sat 17 Oct, 10:00 to Sun 18 Oct, 18:00");
  });

  it("toInput trims ISO string to 16 characters for datetime-local", () => {
    expect(toInput(null)).toBe("");
    expect(toInput("2026-10-17T10:30:00.000Z")).toBe("2026-10-17T10:30");
  });
});

describe("Frontend utils - Relative Time & Duration", () => {
  it("timeLeft calculates remaining relative duration", () => {
    expect(timeLeft(null)).toBe("");
    expect(timeLeft("invalid")).toBe("");

    const now = Date.now();
    const pastIso = new Date(now - 3600 * 1000).toISOString();
    expect(timeLeft(pastIso)).toBe("overdue");

    const under1h = new Date(now + 1800 * 1000).toISOString();
    expect(timeLeft(under1h)).toBe("under 1 h left");

    const in5h = new Date(now + 5 * 3600 * 1000).toISOString();
    expect(timeLeft(in5h)).toBe("5 h left");

    // Math.floor(72h / 24) = 3 days; exact boundary
    const in3d = new Date(now + 3.5 * 24 * 3600 * 1000).toISOString();
    expect(timeLeft(in3d)).toBe("3 days left");

    const in2w = new Date(now + 14 * 24 * 3600 * 1000 + 60000).toISOString();
    expect(timeLeft(in2w)).toBe("2 wk left");

    const in2w3d = new Date(now + 17 * 24 * 3600 * 1000 + 60000).toISOString();
    expect(timeLeft(in2w3d)).toBe("2 wk 3 d left");
  });

  it("timeAgo formats elapsed relative time", () => {
    expect(timeAgo(null)).toBe("");
    expect(timeAgo("")).toBe("");
    expect(timeAgo("invalid")).toBe("");

    const now = Date.now();
    expect(timeAgo(new Date(now - 10 * 1000).toISOString())).toBe("just now");
    expect(timeAgo(new Date(now - 5 * 60 * 1000).toISOString())).toBe("5m ago");
    expect(timeAgo(new Date(now - 3 * 3600 * 1000).toISOString())).toBe("3h ago");
    expect(timeAgo(new Date(now - 2 * 24 * 3600 * 1000).toISOString())).toBe("2d ago");
  });

  it("fmtMinutes and fmtDuration format minutes accurately", () => {
    expect(fmtMinutes(null)).toBe("");
    expect(fmtMinutes(undefined)).toBe("");
    expect(fmtMinutes(0)).toBe("0 min");
    expect(fmtMinutes(45)).toBe("45 min");
    expect(fmtMinutes(60)).toBe("1 h");
    expect(fmtMinutes(90)).toBe("1 h 30 min");
    expect(fmtMinutes(1440)).toBe("1 d");
    expect(fmtMinutes(1500)).toBe("1 d 1 h");
    expect(fmtMinutes(10080)).toBe("1 wk");
    expect(fmtMinutes(11520)).toBe("1 wk 1 d");

    expect(fmtDuration(null)).toBe("");
    expect(fmtDuration(45)).toBe("45 min");
    expect(fmtDuration(800)).toBe("> 12 h");
  });
});

describe("Frontend utils - Strings & Helpers", () => {
  it("blank normalizes empty string and undefined to null", () => {
    expect(blank("")).toBeNull();
    expect(blank(undefined)).toBeNull();
    expect(blank("hello")).toBe("hello");
    expect(blank(0)).toBe(0);
    expect(blank(false)).toBe(false);
  });

  it("cap capitalizes string", () => {
    expect(cap("")).toBe("");
    expect(cap(null)).toBe("");
    expect(cap("hackathon")).toBe("Hackathon");
  });

  it("clubAvatar returns first character uppercase or fallback", () => {
    expect(clubAvatar("")).toBe("?");
    expect(clubAvatar(null)).toBe("?");
    expect(clubAvatar("  coding club  ")).toBe("C");
    expect(clubAvatar("robotics")).toBe("R");
  });

  it("urlBase64ToUint8Array decodes base64 string", () => {
    expect(urlBase64ToUint8Array("").length).toBe(0);
    // Base64 for "hello" is "aGVsbG8="
    const arr = urlBase64ToUint8Array("aGVsbG8=");
    const text = String.fromCharCode(...arr);
    expect(text).toBe("hello");
  });
});
