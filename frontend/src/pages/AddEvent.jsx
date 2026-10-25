import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../api";
import EventForm, { BLANK } from "../components/EventForm.jsx";
import { toInput } from "../utils";

function fromParsed(parsed) {
  return {
    ...BLANK,
    title: parsed.title || "",
    platform: parsed.platform || "",
    category: parsed.category || "other",
    venue_name: parsed.venue_name || "",
    start_at: toInput(parsed.start_at),
    end_at: toInput(parsed.end_at),
    registration_deadline: toInput(parsed.registration_deadline),
    url: parsed.url || "",
    description: parsed.description || "",
    stages: (parsed.stages || []).filter((s) => s.name !== "Register").map((s) => ({ name: s.name, due_at: toInput(s.due_at) })),
  };
}

export default function AddEvent() {
  const navigate = useNavigate();
  const location = useLocation();
  const fromInbox = location.state?.parsed || null;
  const inboxId = location.state?.inboxId || null;

  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [initial, setInitial] = useState(fromInbox ? fromParsed(fromInbox) : null);
  const [source, setSource] = useState(fromInbox ? fromInbox.source || "" : "");

  async function read() {
    setError("");
    setBusy(true);
    try {
      const fd = new FormData();
      if (text.trim()) fd.append("text", text);
      if (file) fd.append("image", file);
      const { parsed } = await api.upload("/extract", fd);
      setSource(parsed.source);
      setInitial(fromParsed(parsed));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function save(payload) {
    setError("");
    setSaving(true);
    try {
      await api.post("/events", { ...payload, inbox_item_id: inboxId });
      navigate("/");
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  const notice =
    source === "rules" ? <p className="notice">Read with the built-in parser. Check every field below.</p>
    : source === "llm" ? <p className="notice">Read by AI. Check every field below.</p>
    : null;

  return (
    <>
      <h1>Add an event</h1>
      {!initial ? (
        <section className="card">
          <h2>Paste it, drop a poster, or forward the details</h2>
          <p className="muted">We read the dates, venue and deadlines. You check them before anything is saved.</p>
          <label>
            Event text or email
            <textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={"Hackathon X\nVenue: Campus A\n17 Oct 2026, 10:00 AM to 6:00 PM\nRegistrations close 12 Oct"} />
          </label>
          <label>
            Poster or screenshot (optional)
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0] || null)} />
          </label>
          {error && <p className="error">{error}</p>}
          <div className="row">
            <button className="btn" onClick={read} disabled={busy || (!text.trim() && !file)}>{busy ? "Reading..." : "Read the details"}</button>
            <button className="btn ghost" onClick={() => { setInitial({ ...BLANK }); setSource("manual"); }}>Fill in manually</button>
          </div>
        </section>
      ) : (
        <EventForm
          initial={initial}
          mode="add"
          notice={notice}
          saving={saving}
          error={error}
          submitLabel="Confirm and add"
          onSubmit={save}
          onBack={() => { setInitial(null); setError(""); }}
        />
      )}
    </>
  );
}
