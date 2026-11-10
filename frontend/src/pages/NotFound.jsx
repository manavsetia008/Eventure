import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="center not-found-view" style={{ padding: "4rem 1rem" }}>
      <p className="muted small" style={{ textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
        404
      </p>
      <h1 style={{ fontSize: "2.2rem", margin: "0.4rem 0 0.8rem" }}>Page not found</h1>
      <p className="muted" style={{ maxWidth: "440px", margin: "0 auto 1.6rem" }}>
        The event, page, or resource you are looking for does not exist or has been moved.
      </p>
      <Link to="/" className="btn">
        Back to timeline
      </Link>
    </div>
  );
}
