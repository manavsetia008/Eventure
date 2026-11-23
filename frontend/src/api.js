const BASE = import.meta.env.VITE_API_URL || "/api";
const KEY = "eventure_token";

export const getToken = () => localStorage.getItem(KEY);
export const setToken = (t) => (t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY));

async function request(path, { method = "GET", body, form } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  } catch {
    throw new Error("Could not reach Eventure. Check your connection and try again.");
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    // Reverse proxies (including Vite's local /api proxy) may return an HTML
    // error page when the Flask server is stopped or unreachable.
    data = null;
  }
  if (!res.ok) {
    if (res.status === 401 && token) {
      setToken(null);
      window.dispatchEvent(new Event("eventure:logout"));
    }

    let message = data?.error;
    if (!message) {
      const localDevelopment =
        typeof window !== "undefined" &&
        ["localhost", "127.0.0.1"].includes(window.location.hostname);
      if (localDevelopment && [500, 502, 503, 504].includes(res.status)) {
        message =
          `Local API request failed (HTTP ${res.status}). Start the Flask backend on port 5000 (run "python run.py" from the backend folder), then retry.`;
      } else {
        message = `Eventure API returned HTTP ${res.status} without a JSON error message.`;
      }
    }

    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  get: (p) => request(p),
  post: (p, body) => request(p, { method: "POST", body: body ?? {} }),
  put: (p, body) => request(p, { method: "PUT", body }),
  patch: (p, body) => request(p, { method: "PATCH", body }),
  del: (p, body) => request(p, { method: "DELETE", body }),
  upload: (p, form) => request(p, { method: "POST", form }),
};

export function calendarFeedUrl() {
  const base = BASE.startsWith("http") ? BASE : `${window.location.origin}${BASE}`;
  return `${base}/calendar.ics?token=${getToken()}`;
}

export async function translateText(text, targetLang = "hi-IN") {
  return api.post("/translate", { text, target_language_code: targetLang });
}

export async function textToSpeech(text, targetLang = "hi-IN", speaker = "aditya") {
  return api.post("/tts", { text, target_language_code: targetLang, speaker });
}
