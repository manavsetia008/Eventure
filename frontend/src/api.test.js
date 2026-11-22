import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, calendarFeedUrl, getToken, setToken } from "./api";

describe("Frontend API client", () => {
  const store = {};

  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);
    vi.stubGlobal("localStorage", {
      getItem: (k) => store[k] || null,
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    });
    vi.stubGlobal("window", {
      location: { origin: "http://localhost:5173" },
      dispatchEvent: vi.fn(),
    });
  });

  it("manages JWT auth tokens in localStorage", () => {
    expect(getToken()).toBeNull();
    setToken("test-jwt-token");
    expect(getToken()).toBe("test-jwt-token");
    setToken(null);
    expect(getToken()).toBeNull();
  });

  it("builds calendar feed URL correctly", () => {
    setToken("abc123token");
    const url = calendarFeedUrl();
    expect(url).toContain("/calendar.ics?token=abc123token");
  });

  it("sends Authorization header when token is present", async () => {
    setToken("bearer-123");
    let capturedHeaders = null;
    vi.stubGlobal("fetch", vi.fn(async (url, init) => {
      capturedHeaders = init.headers;
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      };
    }));

    const res = await api.get("/timeline");
    expect(res.success).toBe(true);
    expect(capturedHeaders.Authorization).toBe("Bearer bearer-123");
  });

  it("handles 401 unauthorized by clearing token and triggering logout event", async () => {
    setToken("expired-token");
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: "Session expired" }),
    })));

    await expect(api.get("/timeline")).rejects.toThrow("Session expired");
    expect(getToken()).toBeNull();
    expect(window.dispatchEvent).toHaveBeenCalled();
  });

  it("throws clear network error when fetch fails completely", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("Network unreachable");
    }));

    await expect(api.get("/timeline")).rejects.toThrow("Could not reach Eventure. Check your connection and try again.");
  });

  it("handles JSON post and file upload payloads correctly", async () => {
    let capturedMethod = "";
    let capturedBody = null;
    vi.stubGlobal("fetch", vi.fn(async (url, init) => {
      capturedMethod = init.method;
      capturedBody = init.body;
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 42 }),
      };
    }));

    // JSON Post
    await api.post("/events", { title: "Hackathon" });
    expect(capturedMethod).toBe("POST");
    expect(JSON.parse(capturedBody)).toEqual({ title: "Hackathon" });

    // File Upload
    const fakeForm = { dummy: "form-data" };
    await api.upload("/extract", fakeForm);
    expect(capturedBody).toBe(fakeForm);
  });
  it("explains when the local Flask API is not running behind the Vite proxy", async () => {
    vi.stubGlobal("window", {
      location: { origin: "http://localhost:5173", hostname: "localhost" },
      dispatchEvent: vi.fn(),
    });
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false,
      status: 502,
      json: async () => { throw new Error("Unexpected token <"); },
    })));

    await expect(api.get("/auth/me")).rejects.toThrow(
      'Local API request failed (HTTP 502). Start the Flask backend on port 5000 (run "python run.py" from the backend folder), then retry.'
    );
  });

  it("uses the backend's JSON error message when one is available", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: "Invalid preference value" }),
    })));

    await expect(api.patch("/auth/me", { threshold_keep: 55 })).rejects.toThrow(
      "Invalid preference value"
    );
  });

});
