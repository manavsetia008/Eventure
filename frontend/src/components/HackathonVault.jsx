import { useState } from "react";
import { Archive, Check, Copy, Sparkles, Loader2 } from "lucide-react";
import { api } from "../api";
import Checkbox from "./Checkbox.jsx";

export default function HackathonVault({ userEventId, initialNotes = "", onUpdate }) {
  const parseNotes = (raw) => {
    try {
      if (typeof raw === "string" && raw.trim().startsWith("{")) {
        return JSON.parse(raw);
      }
    } catch {
      /* not JSON: fall through to the default shape below */
    }
    return {
      github_url: "",
      demo_url: "",
      deck_url: "",
      video_url: "",
      tech_stack: "",
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
  const [aiReview, setAiReview] = useState(null);
  const [reviewing, setReviewing] = useState(false);

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
      `### Project Submission Links (Unstop / Devfolio)`,
      `• Live Demo / Deployment: ${vault.demo_url || "N/A"}`,
      `• GitHub Repository: ${vault.github_url || "N/A"}`,
      `• Presentation Slides: ${vault.deck_url || "N/A"}`,
      `• Demo Video URL: ${vault.video_url || "N/A"}`,
      `• Tech Stack: ${vault.tech_stack || "N/A"}`,
    ].join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  if (!open) {
    const hasAny = vault.demo_url || vault.github_url || vault.deck_url || vault.table_no;
    return (
      <div className="vault-open-wrap">
        <button
          type="button"
          className="btn ghost small vault-open-btn"
          onClick={() => setOpen(true)}
        >
          <Archive size={15} strokeWidth={1.75} />
          <span>Hackathon Toolkit & Submission Vault</span>
          {hasAny && <span className="pill ok vault-ready-pill">Ready</span>}
        </button>
      </div>
    );
  }

  return (
    <div className="vault-section card vault-section-open">
      <div className="vault-card-head">
        <div>
          <h3 className="vault-title">
            <Archive size={18} strokeWidth={1.75} className="vault-title-icon" />
            <span>Hackathon Submission Vault & Venue Toolkit</span>
          </h3>
          <p className="muted small vault-subtitle">
            Store your repo, demo link, slides, table number, and mentor feedback so you never scramble at deadline.
          </p>
        </div>
        <div className="vault-head-actions">
          <button type="button" className="btn small vault-copy-btn" onClick={copyAllLinks}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? "Copied Links!" : "Copy All Links"}</span>
          </button>
          <button type="button" className="linklike small muted" onClick={() => setOpen(false)}>
            Close
          </button>
        </div>
      </div>

      {msg && <p className="notice small">{msg}</p>}

      {/* Tabs */}
      <div className="tabs vault-tabs">
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
              <label htmlFor={`vault-${userEventId}-demo-url`}>Live Working Prototype URL</label>
              <input
                id={`vault-${userEventId}-demo-url`}
                type="url"
                value={vault.demo_url || ""}
                onChange={(e) => updateField("demo_url", e.target.value)}
                placeholder="https://myproject.vercel.app"
              />
            </div>
            <div className="vault-field">
              <label htmlFor={`vault-${userEventId}-github-url`}>GitHub Repository URL</label>
              <input
                id={`vault-${userEventId}-github-url`}
                type="url"
                value={vault.github_url || ""}
                onChange={(e) => updateField("github_url", e.target.value)}
                placeholder="https://github.com/team/project"
              />
            </div>
            <div className="vault-field">
              <label htmlFor={`vault-${userEventId}-deck-url`}>Pitch Deck / Slides Link</label>
              <input
                id={`vault-${userEventId}-deck-url`}
                type="url"
                value={vault.deck_url || ""}
                onChange={(e) => updateField("deck_url", e.target.value)}
                placeholder="https://docs.google.com/presentation/..."
              />
            </div>
            <div className="vault-field">
              <label htmlFor={`vault-${userEventId}-video-url`}>Demo Video (YouTube / Loom)</label>
              <input
                id={`vault-${userEventId}-video-url`}
                type="url"
                value={vault.video_url || ""}
                onChange={(e) => updateField("video_url", e.target.value)}
                placeholder="https://youtu.be/... or Loom"
              />
            </div>
            <div className="vault-field vault-field-full">
              <label htmlFor={`vault-${userEventId}-tech-stack`}>Tech Stack Tags (Libraries, Frameworks, AI Models)</label>
              <input
                id={`vault-${userEventId}-tech-stack`}
                type="text"
                value={vault.tech_stack || ""}
                onChange={(e) => updateField("tech_stack", e.target.value)}
                placeholder="e.g. React, Node.js, PostgreSQL, Tailwind"
              />
            </div>
          </div>

          <div className="vault-checklist">
            <strong>Pre-Submission Sanity Checklist:</strong>
            <Checkbox
              checked={vault.checks?.repo_public || false}
              onChange={() => toggleCheck("repo_public")}
              label="Public GitHub repo with clean README & LICENSE"
            />
            <Checkbox
              checked={vault.checks?.live_working || false}
              onChange={() => toggleCheck("live_working")}
              label="Working live deployment URL tested in incognito mode"
            />
            <Checkbox
              checked={vault.checks?.deck_accessible || false}
              onChange={() => toggleCheck("deck_accessible")}
              label='Google Slides / Figma link set to "Anyone with the link can view"'
            />
            <Checkbox
              checked={vault.checks?.video_recorded || false}
              onChange={() => toggleCheck("video_recorded")}
              label="Demo video recorded and strictly under time limit (e.g. 2 min)"
            />
            <Checkbox
              checked={vault.checks?.team_tagged || false}
              onChange={() => toggleCheck("team_tagged")}
              label="All teammates registered & tagged in submission form"
            />
          </div>

          {/* Gemini AI Submission Analysis */}
          <div style={{ marginTop: "1rem", paddingTop: "0.8rem", borderTop: "1px dashed var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
              <div>
                <strong>Gemini AI Submission Evaluator</strong>
                <p className="muted small" style={{ margin: "0.2rem 0 0" }}>
                  Runs judge rubric analysis on your links, tech stack, and pitch before final submission.
                </p>
              </div>
              <button
                type="button"
                className="btn small"
                disabled={reviewing}
                onClick={async () => {
                  setReviewing(true);
                  try {
                    const res = await api.post("/assistant/review-submission", {
                      vault,
                      event_title: "Hackathon Project",
                    });
                    setAiReview(res);
                  } catch (e) {
                    setMsg("Evaluation error: " + e.message);
                  } finally {
                    setReviewing(false);
                  }
                }}
              >
                {reviewing ? <Loader2 size={13} className="btn-spinner" /> : <Sparkles size={13} />}
                <span>{reviewing ? "Analyzing with Gemini..." : "Run AI Rubric Review"}</span>
              </button>
            </div>

            {aiReview && (
              <div
                className="card"
                style={{
                  marginTop: "0.8rem",
                  background: "rgba(99, 102, 241, 0.05)",
                  border: "1px solid var(--accent)",
                  borderRadius: "var(--radius-sm)",
                  padding: "0.9rem",
                  fontSize: "0.85rem",
                  lineHeight: "1.5",
                  whiteSpace: "pre-wrap",
                }}
              >
                {aiReview.markdown}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Offline Venue Survival Kit */}
      {activeTab === "venue" && (
        <div>
          <div className="vault-grid">
            <div className="vault-field">
              <label htmlFor={`vault-${userEventId}-table-no`}>Team Table / Seat Number</label>
              <input
                id={`vault-${userEventId}-table-no`}
                value={vault.table_no || ""}
                onChange={(e) => updateField("table_no", e.target.value)}
                placeholder="e.g. Table 24 (Audi Block B)"
              />
            </div>
            <div className="vault-field">
              <label htmlFor={`vault-${userEventId}-wifi-ssid`}>Venue Wi-Fi Network (SSID)</label>
              <input
                id={`vault-${userEventId}-wifi-ssid`}
                value={vault.wifi_ssid || ""}
                onChange={(e) => updateField("wifi_ssid", e.target.value)}
                placeholder="e.g. Campus-Guest / HackFest-5G"
              />
            </div>
            <div className="vault-field">
              <label htmlFor={`vault-${userEventId}-wifi-pass`}>Wi-Fi Password / Portal Code</label>
              <input
                id={`vault-${userEventId}-wifi-pass`}
                value={vault.wifi_pass || ""}
                onChange={(e) => updateField("wifi_pass", e.target.value)}
                placeholder="e.g. Hack@2026"
              />
            </div>
          </div>
          <div className="vault-checklist">
            <strong>Offline Survival Checklist (Carry to venue):</strong>
            <p className="muted small vault-checklist-note">
              Make sure your team carries: Physical College IDs, Laptop Chargers, 1 Spike Buster/Extension Board, HDMI Adapter, and Cash for late-night food.
            </p>
          </div>
        </div>
      )}

      {/* Tab 3: Mentor Notes */}
      {activeTab === "mentor" && (
        <div className="vault-field">
          <label htmlFor={`vault-${userEventId}-mentor-notes`}>Mentor Feedback & Questions Across Rounds</label>
          <textarea
            id={`vault-${userEventId}-mentor-notes`}
            rows={5}
            value={vault.mentor_notes || ""}
            onChange={(e) => updateField("mentor_notes", e.target.value)}
            placeholder="Round 1 (Idea Review): Mentor asked how we handle cold-start without API. Round 2: Need to show fallback logic before final demo."
          />
        </div>
      )}

      <div className="row vault-footer-actions">
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
