import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import EventForm, { BLANK } from "../components/EventForm.jsx";
import { toInput } from "../utils";

export default function EditEvent() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [initial, setInitial] = useState(null);
  const [blocked, setBlocked] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get(`/events/${id}`)
      .then(({ event: e, mine }) => {
        if (!mine.is_owner) return setBlocked("Only the organizer who added this event can edit its public details.");
        setInitial({
          ...BLANK,
          title: e.title || "",
          platform: e.platform || "",
          category: e.category || "other",
          description: e.description || "",
          venue_name: e.venue_name || "",
          lat: e.lat ?? "",
          lng: e.lng ?? "",
          start_at: toInput(e.start_at),
          end_at: toInput(e.end_at),
          registration_deadline: toInput(e.registration_deadline),
          url: e.url || "",
          is_public: e.is_public,
        });
      })
      .catch((e) => setBlocked(e.message));
  }, [id]);

  async function save(payload) {
    setError("");
    setSaving(true);
    try {
      await api.put(`/events/${id}`, payload);
      navigate(`/events/${id}`);
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }

  if (blocked) {
    return (
      <div className="card" style={{ marginTop: "2rem", textAlign: "center" }}>
        <p className="error" style={{ display: "inline-block" }}>{blocked}</p>
        <p style={{ marginTop: "1rem" }}><Link to="/" className="btn">Back to Timeline</Link></p>
      </div>
    );
  }

  if (!initial) return <p className="muted" style={{ marginTop: "2rem" }}>Loading event details...</p>;

  return (
    <>
      <div style={{ marginBottom: "1rem" }}>
        <Link to={`/events/${id}`} className="linklike small">← Back to event page</Link>
      </div>
      <div className="page-head">
        <div>
          <h1>Edit Event Details</h1>
          <p className="muted" style={{ margin: 0 }}>
            Updates apply to the public listing for everyone following this event.
          </p>
        </div>
      </div>
      <div style={{ marginTop: "1.2rem" }}>
        <EventForm initial={initial} mode="edit" saving={saving} error={error} submitLabel="Save changes" onSubmit={save} />
      </div>
    </>
  );
}
