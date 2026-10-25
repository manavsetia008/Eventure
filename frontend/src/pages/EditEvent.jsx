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
        if (!mine.is_owner) return setBlocked("Only the person who added this event can edit it.");
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

  if (blocked) return <><p className="error">{blocked}</p><p><Link to="/">Back to your timeline</Link></p></>;
  if (!initial) return <p className="muted">Loading...</p>;
  return (
    <>
      <p><Link to={`/events/${id}`}>Back to the event</Link></p>
      <h1>Edit event</h1>
      <p className="muted">Changes show up on everyone's timeline that has this event. Stages and deadlines stay personal and are edited on your timeline.</p>
      <EventForm initial={initial} mode="edit" saving={saving} error={error} submitLabel="Save changes" onSubmit={save} />
    </>
  );
}
