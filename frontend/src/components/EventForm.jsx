import { useState } from "react";
import { api } from "../api";
import { CATEGORIES, cap } from "../utils";

export const BLANK = {
  title: "", platform: "", category: "other", venue_name: "", lat: "", lng: "", start_at: "", end_at: "",
  registration_deadline: "", url: "", description: "", stages: [], status: "registered", is_public: false,
};

const blank = (v) => (v === "" || v === undefined ? null : v);

/** One form for adding and editing events. mode is "add" (stages and your status) or "edit" (details only). */
export default function EventForm({ initial, mode, notice, saving, error, submitLabel, onSubmit, onBack }) {
  const [form, setForm] = useState(initial);
  const [localError, setLocalError] = useState("");
  const [lookup, setLookup] = useState({ busy: false, msg: "" });

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const setStage = (i, k, v) => setForm({ ...form, stages: form.stages.map((s, j) => (j === i ? { ...s, [k]: v } : s)) });

  // Changing the venue invalidates the old map position; look it up again or type it in.
  const setVenue = (e) => setForm({ ...form, venue_name: e.target.value, lat: "", lng: "" });

  async function findLocation() {
    setLookup({ busy: true, msg: "" });
    try {
      const r = await api.post("/geocode", { venue: form.venue_name });
      setForm((f) => ({ ...f, lat: String(r.lat), lng: String(r.lng) }));
      setLookup({ busy: false, msg: `Found ${r.lat}, ${r.lng}. Check it is the right place.`, url: `https://www.openstreetmap.org/?mlat=${r.lat}&mlon=${r.lng}#map=16/${r.lat}/${r.lng}` });
    } catch (e) {
      setLookup({ busy: false, msg: e.message });
    }
  }

  function submit(e) {
    e.preventDefault();
    setLocalError("");
    const lat = form.lat === "" ? null : Number(form.lat);
    const lng = form.lng === "" ? null : Number(form.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return setLocalError("Latitude and longitude must be numbers, for example 28.5459 and 77.2732.");
    if ((lat === null) !== (lng === null)) return setLocalError("Enter both latitude and longitude, or leave both empty.");
    const payload = {
      title: form.title,
      platform: blank(form.platform),
      category: form.category,
      description: form.description,
      venue_name: blank(form.venue_name),
      lat,
      lng,
      start_at: blank(form.start_at),
      end_at: blank(form.end_at),
      registration_deadline: blank(form.registration_deadline),
      url: blank(form.url),
      is_public: form.is_public,
    };
    if (mode === "add") {
      payload.status = form.status;
      payload.stages = form.stages.filter((s) => s.name.trim()).map((s) => ({ name: s.name, due_at: blank(s.due_at) }));
    }
    onSubmit(payload);
  }

  return (
    <form className="card" onSubmit={submit}>
      {notice}
      <label>Title<input value={form.title} onChange={set("title")} required /></label>
      <div className="grid2">
        <label>Platform<input value={form.platform} onChange={set("platform")} placeholder="Unstop, Devfolio, direct..." /></label>
        <label>Category
          <select value={form.category} onChange={set("category")}>{CATEGORIES.map((c) => <option key={c} value={c}>{cap(c)}</option>)}</select>
        </label>
      </div>

      <label>Venue<input value={form.venue_name} onChange={setVenue} placeholder="IIIT Delhi, Okhla, New Delhi" /></label>
      <div className="row">
        <button type="button" className="btn ghost small" onClick={findLocation} disabled={!form.venue_name.trim() || lookup.busy}>{lookup.busy ? "Looking up..." : "Look up location"}</button>
        {form.lat !== "" && form.lng !== "" && <span className="small muted">Map position {form.lat}, {form.lng}</span>}
        {form.lat === "" && form.venue_name.trim() && !lookup.msg && <span className="small muted">No map position yet. It is looked up when you save.</span>}
      </div>
      {lookup.msg && <p className="small muted">{lookup.msg} {lookup.url && <a href={lookup.url} target="_blank" rel="noreferrer">See it on a map</a>}</p>}
      <details>
        <summary className="small">Enter the map position by hand</summary>
        <div className="grid2">
          <label>Latitude<input value={form.lat} onChange={set("lat")} inputMode="decimal" placeholder="28.5459" /></label>
          <label>Longitude<input value={form.lng} onChange={set("lng")} inputMode="decimal" placeholder="77.2732" /></label>
        </div>
        <p className="small muted">Tip: in Google Maps, right-click the place and click the two numbers at the top of the menu to copy them. The map position powers distance, travel checks and the discovery map.</p>
      </details>

      <div className="grid2">
        <label>Starts<input type="datetime-local" value={form.start_at} onChange={set("start_at")} /></label>
        <label>Ends<input type="datetime-local" value={form.end_at} onChange={set("end_at")} /></label>
      </div>
      <label>Registration deadline<input type="datetime-local" value={form.registration_deadline} onChange={set("registration_deadline")} /></label>
      <label>Link<input value={form.url} onChange={set("url")} placeholder="https://" /></label>

      {mode === "add" && (
        <fieldset>
          <legend>Other stages</legend>
          {form.stages.map((s, i) => (
            <div className="row" key={i}>
              <input value={s.name} onChange={(e) => setStage(i, "name", e.target.value)} aria-label="Stage name" />
              <input type="datetime-local" value={s.due_at} onChange={(e) => setStage(i, "due_at", e.target.value)} aria-label="Stage deadline" />
              <button type="button" className="linklike small" onClick={() => setForm({ ...form, stages: form.stages.filter((_, j) => j !== i) })}>Remove</button>
            </div>
          ))}
          <button type="button" className="linklike small" onClick={() => setForm({ ...form, stages: [...form.stages, { name: "", due_at: "" }] })}>+ Add a stage (Submit, Shortlist, Results)</button>
        </fieldset>
      )}

      <div className="grid2">
        {mode === "add" && (
          <label>Your status
            <select value={form.status} onChange={set("status")}><option value="registered">Registered</option><option value="interested">Interested</option></select>
          </label>
        )}
        <label className="check"><input type="checkbox" checked={form.is_public} onChange={set("is_public")} /> List it publicly so other students can find and review it</label>
      </div>

      {(localError || error) && <p className="error">{localError || error}</p>}
      <div className="row">
        <button className="btn" disabled={saving}>{saving ? "Saving..." : submitLabel}</button>
        {onBack && <button type="button" className="btn ghost" onClick={onBack}>Back</button>}
      </div>
    </form>
  );
}
