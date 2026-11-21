import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="center not-found-view">
      <p className="muted small not-found-kicker">
        404
      </p>
      <h1 className="not-found-title">Page not found</h1>
      <p className="muted not-found-desc">
        The event, page, or resource you are looking for does not exist or has been moved.
      </p>
      <Link to="/" className="btn">
        Back to timeline
      </Link>
    </div>
  );
}
