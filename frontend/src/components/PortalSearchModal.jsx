import React, { useState, useRef } from "react";
import { Search, Upload, CheckCircle2, AlertCircle, ArrowRight, X, Calendar, MapPin, Tag } from "lucide-react";
import { api } from "../api";
import Badge from "./Badge";

export default function PortalSearchModal({ isOpen, onClose, onEventAdded }) {
  const [query, setQuery] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [addedId, setAddedId] = useState(null);

  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleSearch = async (autoAdd = false) => {
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const fd = new FormData();
      if (query.trim()) fd.append("text", query.trim());
      if (file) fd.append("image", file);
      if (autoAdd) fd.append("auto_add", "true");

      const res = await api.upload("/search-match", fd);
      setResult(res);
      if (res.auto_added) {
        setAddedId(res.added_user_event_id);
        if (onEventAdded) onEventAdded();
      }
    } catch (err) {
      setError(err.message || "Failed to search top portals.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectChoice = async (candidate) => {
    setLoading(true);
    setError("");
    try {
      // Add the chosen candidate event
      const payload = {
        title: candidate.title,
        platform: candidate.platform,
        category: candidate.category || "hackathon",
        venue_name: candidate.venue_name,
        lat: candidate.lat,
        lng: candidate.lng,
        start_at: candidate.start_at,
        end_at: candidate.end_at,
        registration_deadline: candidate.registration_deadline,
        url: candidate.url,
        description: candidate.description,
        stages: candidate.stages || [],
        is_public: true,
        status: "registered",
      };
      const res = await api.post("/events", payload);
      setAddedId(res.user_event?.id);
      if (onEventAdded) onEventAdded();
    } catch (err) {
      setError(err.message || "Could not add selected event.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card portal-search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>Search Top Portals (&gt;70% Match Engine)</h3>
            <p className="muted small">
              Searches Unstop, Devfolio, Hack2skill, and Luma. Matches &gt;70% auto-sync with your live calendar.
            </p>
          </div>
          <button className="btn-icon-subtle" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <div className="portal-search-form">
          <div className="search-input-wrap">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search event name, keywords (e.g. Flipkart GRiD, ETHIndia)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch(false)}
            />
          </div>

          <div className="upload-inline-row">
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              accept="image/*"
              onChange={(e) => setFile(e.target.files[0] || null)}
            />
            <button
              type="button"
              className="btn-tertiary small"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={13} /> {file ? file.name : "Upload flyer / poster to match"}
            </button>
            {file && (
              <button type="button" className="btn-icon-subtle" onClick={() => setFile(null)}>
                <X size={12} />
              </button>
            )}

            <button
              type="button"
              className="btn small"
              disabled={loading || (!query.trim() && !file)}
              onClick={() => handleSearch(false)}
            >
              {loading ? "Matching..." : "Match Portals"}
            </button>
          </div>
        </div>

        {error && <p className="error" style={{ marginTop: "0.8rem" }}>{error}</p>}

        {/* Results view */}
        {result && (
          <div className="portal-match-results">
            {/* >70% High Confidence Banner */}
            {result.high_confidence && result.best_match && (
              <div className="high-confidence-banner">
                <div className="banner-top">
                  <span className="match-pill success">
                    ✨ {result.best_match.match_score}% High-Confidence Match
                  </span>
                  <Badge variant="info" label={result.best_match.platform} />
                </div>
                <h4>{result.best_match.title}</h4>
                <p className="muted small">{result.best_match.description}</p>

                <div className="event-meta-chips">
                  {result.best_match.venue_name && (
                    <span>
                      <MapPin size={12} /> {result.best_match.venue_name}
                    </span>
                  )}
                  {result.best_match.registration_deadline && (
                    <span>
                      <Calendar size={12} /> Deadline: {result.best_match.registration_deadline.slice(0, 10)}
                    </span>
                  )}
                </div>

                <div className="banner-actions">
                  {addedId ? (
                    <span className="success-badge">
                      <CheckCircle2 size={15} /> Added to Live Timeline
                    </span>
                  ) : (
                    <button
                      className="btn small"
                      disabled={loading}
                      onClick={() => handleSelectChoice(result.best_match)}
                    >
                      Auto-Add to Calendar
                    </button>
                  )}
                  {result.best_match.url && (
                    <a
                      href={result.best_match.url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-tertiary small"
                    >
                      Visit Official Page &rarr;
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Conflicting Matches / User Choice Cards */}
            {result.choice_cards && result.choice_cards.length > 0 && (
              <div className="choice-cards-container">
                <h5 className="choice-cards-title">
                  {result.high_confidence
                    ? "Alternative Matches & Tracks"
                    : "Multiple Potential Matches (Select your event):"}
                </h5>
                <div className="choice-cards-grid">
                  {result.choice_cards.map((candidate) => (
                    <div key={candidate.id} className="choice-card">
                      <div className="choice-card-head">
                        <span className="choice-score">{candidate.match_score}% Match</span>
                        <Badge variant="neutral" label={candidate.platform} />
                      </div>
                      <h6>{candidate.title}</h6>
                      <p className="muted small">{candidate.description?.slice(0, 95)}...</p>

                      <div className="choice-meta">
                        <span className="small muted">
                          <Calendar size={12} /> {candidate.start_at?.slice(0, 10) || "TBD"}
                        </span>
                      </div>

                      <div className="choice-actions">
                        <button
                          className="btn-tertiary small"
                          disabled={loading}
                          onClick={() => handleSelectChoice(candidate)}
                        >
                          Select This Event <ArrowRight size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
