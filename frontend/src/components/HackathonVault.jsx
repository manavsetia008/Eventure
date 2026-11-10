import { useState } from "react";
import { api } from "../api";

export default function HackathonVault({ userEventId, initialNotes = "", onUpdate }) {
  const parseNotes = (raw) => {
    try {
      if (typeof raw === "string" && raw.trim().startsWith("{")) {
        return JSON.parse(raw);
      }
    } catch {}
    return {
      github_url: "",
      demo_url: "",
      deck_url: "",
      video_url: "",
      table_no: "",
      wifi_ssid: "",
      wifi_pass: "",
      mentor_notes: raw || "",
      checks: {
        repo_public: false,
        live_working: false,
        deck_accessible: false,
        video_recorded: false,
        team_tagged: false,
      },
    };
  };

  const [vault, setVault] = useState(() => parseNotes(initialNotes));
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("submission"); // "submission" | "venue" | "mentor"
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState("");

  const updateField = (key, val) => {
    setVault((prev) => ({ ...prev, [key]: val }));
  };

  const toggleCheck = (checkKey) => {
    setVault((prev) => ({
      ...prev,
      checks: {
        ...(prev.checks || {}),
        [checkKey]: !(prev.checks && prev.checks[checkKey]),
      },
    }));
  };

  const save = async () => {
    setSaving(true);
    setMsg("");
    try {
      const payload = JSON.stringify(vault);
      await api.patch(`/user-events/${userEventId}`, { notes: payload });
      setMsg("Saved to your hackathon vault.");
      if (onUpdate) onUpdate(payload);
    } catch (e) {
      setMsg("Failed to save: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const copyAllLinks = () => {
    const text = [
      `Live Demo: ${vault.demo_url || "N/A"}`,
      `GitHub Repo: ${vault.github_url || "N/A"}`,
      `Pitch Deck / Slides: ${vault.deck_url || "N/A"}`,
      `Demo Video: ${vault.video_url || "N/A"}`,
    ].join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  if (!open) {
    const hasAny = vault.demo_url || vault.github_url || vault.deck_url || vault.table_no;
    return (
      <div style={{ marginTop: "0.85rem" }}>
        <button
          type="button"
          className="btn ghost small"
          onClick={() => setOpen(true)}
          style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem" }}
        >
          <span>📦 Hackathon Toolkit & Submission Vault</span>
          {hasAny && <span className="pill ok" style={{ fontSize: "0.72rem" }}>Ready</span>}
        </button>
      </div>
    );
  }

  return (
    <div className="vault-section card" style={{ marginTop: "1rem", border: "1px solid var(--line-strong)" }}>
      <div className="vault-card-head">
        <div>
          <h3 style={{ margin: 0, fontSize: "1.05rem" }}>📦 Hackathon Submission Vault & Venue Toolkit</h3>
          <p className="muted small" style={{ margin: "0.2rem 0 0" }}>
            Store your repo, demo link, slides, table number, and mentor feedback so you never scramble at deadline.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button type="button" className="btn small" onClick={copyAllLinks}>
            {copied ? "Copied Links!" : "📋 Copy All Links"}
          </button>
          <button type="button" className="linklike small muted" onClick={() => setOpen(false)}>
            Close
          </button>
        </div>
      </div>

      {msg && <p className="notice small">{msg}</p>}

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: "1rem" }}>
        <button
          type="button"
          className={`tab ${activeTab === "submission" ? "on" : ""}`}
          onClick={() => setActiveTab("submission")}
        >
          1. Submission Links & Checklist
        </button>
        <button
          type="button"
          className={`tab ${activeTab === "venue" ? "on" : ""}`}
          onClick={() => setActiveTab("venue")}
        >
          2. Offline Venue & Wi-Fi Kit
        </button>
        <button
          type="button"
          className={`tab ${activeTab === "mentor" ? "on" : ""}`}
          onClick={() => setActiveTab("mentor")}
        >
          3. Mentorship & Round Notes
        </button>
      </div>

      {/* Tab 1: Submission Links */}
      {activeTab === "submission" && (
        <div>
          <div className="vault-grid">
            <div className="vault-field">
              <label>Live Working Prototype URL</label>
              <input
                type="url"
                value={vault.demo_url || ""}
                onChange={(e) => updateField("demo_url", e.target.value)}
                placeholder="https://myproject.vercel.app"
              />
            </div>
            <div className="vault-field">
              <label>GitHub Repository URL</label>
              <input
                type="url"
                value={vault.github_url || ""}
                onChange={(e) => updateField("github_url", e.target.value)}
                placeholder="https://github.com/team/project"
              />
            </div>
            <div className="vault-field">
              <label>Pitch Deck / Slides Link</label>
              <input
                type="url"
                value={vault.deck_url || ""}
                onChange={(e) => updateField("deck_url", e.target.value)}
                placeholder="https://docs.google.com/presentation/..."
              />
            </div>
            <div className="vault-field">
              <label>Demo Video (YouTube / Loom)</label>
              <input
                type="url"
                value={vault.video_url || ""}
                onChange={(e) => updateField("video_url", e.target.value)}
                placeholder="https://youtu.be/... or Loom"
              />
            </div>
          </div>

          <div className="vault-checklist">
            <strong>Pre-Submission Sanity Checklist:</strong>
            <label className="vault-check-item">
              <input
                type="checkbox"
                checked={vault.checks?.repo_public || false}
                onChange={() => toggleCheck("repo_public")}
              />
              <span>Public GitHub repo with clean README & LICENSE</span>
            </label>
            <label className="vault-check-item">
              <input
                type="checkbox"
                checked={vault.checks?.live_working || false}
                onChange={() => toggleCheck("live_working")}
              />
              <span>Working live deployment URL tested in incognito mode</span>
            </label>
            <label className="vault-check-item">
              <input
                type="checkbox"
                checked={vault.checks?.deck_accessible || false}
                onChange={() => toggleCheck("deck_accessible")}
              />
              <span>Google Slides / Figma link set to "Anyone with the link can view"</span>
            </label>
            <label className="vault-check-item">
              <input
                type="checkbox"
                checked={vault.checks?.video_recorded || false}
                onChange={() => toggleCheck("video_recorded")}
              />
              <span>Demo video recorded and strictly under time limit (e.g. 2 min)</span>
            </label>
            <label className="vault-check-item">
              <input
                type="checkbox"
                checked={vault.checks?.team_tagged || false}
                onChange={() => toggleCheck("team_tagged")}
              />
              <span>All teammates registered & tagged in submission form</span>
            </label>
          </div>
        </div>
      )}

      {/* Tab 2: Offline Venue Survival Kit */}
      {activeTab === "venue" && (
        <div>
          <div className="vault-grid">
            <div className="vault-field">
              <label>Team Table / Seat Number</label>
              <input
                value={vault.table_no || ""}
                onChange={(e) => updateField("table_no", e.target.value)}
                placeholder="e.g. Table 24 (Audi Block B)"
              />
            </div>
            <div className="vault-field">
              <label>Venue Wi-Fi Network (SSID)</label>
              <input
                value={vault.wifi_ssid || ""}
                onChange={(e) => updateField("wifi_ssid", e.target.value)}
                placeholder="e.g. IIITD-Guest / HackFest-5G"
              />
            </div>
            <div className="vault-field">
              <label>Wi-Fi Password / Portal Code</label>
              <input
                value={vault.wifi_pass || ""}
                onChange={(e) => updateField("wifi_pass", e.target.value)}
                placeholder="e.g. Hack@2026"
              />
            </div>
          </div>
          <div className="vault-checklist">
            <strong>Offline Survival Checklist (Carry to venue):</strong>
            <p className="muted small" style={{ margin: "0.2rem 0" }}>
              Make sure your team carries: Physical College IDs, Laptop Chargers, 1 Spike Buster/Extension Board, HDMI Adapter, and Cash for late-night food.
            </p>
          </div>
        </div>
      )}

      {/* Tab 3: Mentor Notes */}
      {activeTab === "mentor" && (
        <div className="vault-field">
          <label>Mentor Feedback & Questions Across Rounds</label>
          <textarea
            rows={5}
            value={vault.mentor_notes || ""}
            onChange={(e) => updateField("mentor_notes", e.target.value)}
            placeholder="Round 1 (Idea Review): Mentor asked how we handle cold-start without API. Round 2: Need to show fallback logic before final demo."
          />
        </div>
      )}

      <div className="row" style={{ marginTop: "1rem" }}>
        <button type="button" className="btn small" onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save changes"}
        </button>
        <button type="button" className="btn ghost small" onClick={() => setOpen(false)}>
          Done
        </button>
      </div>
    </div>
  );
}
