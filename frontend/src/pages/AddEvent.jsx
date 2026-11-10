import { useEffect, useState } from "react";
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
  const [portals, setPortals] = useState([]);

  useEffect(() => {
    api.get("/portals")
      .then((r) => setPortals(r.portals || []))
      .catch(() => {});
  }, []);

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

  const notice = source ? (
    <p className="notice">
      <strong>Details Extracted:</strong> Review title, dates, venue, and deadlines below. You can also add or change the official hackathon link before confirming.
    </p>
  ) : null;

  function loadHinglishSample() {
    setText(
      "HackIIITD 2026 Innovation Challenge:\n" +
      "Venue: IIIT Delhi Campus, Audi 2\n" +
      "Starts: 21 Nov 2026, 12:00 PM | Ends: 22 Nov 2026, 02:00 PM\n" +
      "Abstract submission deadline: 18 Nov 11:59 PM\n" +
      "Official website: https://unstop.com/hackathons/hackiiitd-2026\n" +
      "Final round shortlisted teams must present live demo on Sunday 10:00 AM."
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Add an event</h1>
          <p className="muted small">Paste event text, upload a poster, or enter details by hand.</p>
        </div>
      </div>

      {!initial ? (
        <section className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
            <h2>Import from announcement or poster</h2>
            <span className="portal-badge">Smart Extraction</span>
          </div>
          <p className="muted small">
            We extract the title, dates, venue, registration deadlines, and website link. You review them before saving.
          </p>

          <div style={{ marginBottom: "0.6rem" }}>
            <button type="button" className="linklike small" onClick={loadHinglishSample}>
              Paste sample campus announcement
            </button>
          </div>

          <label>
            Event text or forwarded announcement
            <textarea
              rows={7}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"Hackathon X\nVenue: Campus A\n17 Oct 2026, 10:00 AM to 6:00 PM\nRegistrations close 12 Oct\nLink: https://..."}
            />
          </label>

          <label>
            Poster or screenshot (optional)
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0] || null)} />
          </label>

          {error && <p className="error">{error}</p>}

          <div className="row" style={{ marginTop: "1rem" }}>
            <button className="btn small" onClick={read} disabled={busy || (!text.trim() && !file)}>
              {busy ? "Reading details..." : "Read details"}
            </button>
            <button className="btn ghost small" onClick={() => { setInitial({ ...BLANK }); setSource("manual"); }}>
              Fill in manually
            </button>
          </div>

          {portals.length > 0 && (
            <div style={{ marginTop: "1.2rem", paddingTop: "0.9rem", borderTop: "1px solid var(--line)" }}>
              <span className="small muted">Or create from your tracked portals: </span>
              <div style={{ display: "inline-flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.3rem" }}>
                {portals.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="pill"
                    style={{ cursor: "pointer" }}
                    onClick={() => {
                      setInitial({ ...BLANK, platform: p.name });
                      setSource("portal");
                    }}
                  >
                    + {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}
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
