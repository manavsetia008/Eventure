import { useEffect, useState } from "react";
import { Link, Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { api } from "./api";
import { useAuth } from "./auth.jsx";
import AddEvent from "./pages/AddEvent.jsx";
import Community from "./pages/Community.jsx";
import Discover from "./pages/Discover.jsx";
import EditEvent from "./pages/EditEvent.jsx";
import EventDetail from "./pages/EventDetail.jsx";
import Inbox from "./pages/Inbox.jsx";
import Login from "./pages/Login.jsx";
import NotFound from "./pages/NotFound.jsx";
import Notifications from "./pages/Notifications.jsx";
import Organizer from "./pages/Organizer.jsx";
import Settings from "./pages/Settings.jsx";
import Timeline from "./pages/Timeline.jsx";

function Layout({ children, theme, toggleTheme }) {
  const { user, logout } = useAuth();
  const [unread, setUnread] = useState(0);
  const [inbox, setInbox] = useState(0);

  useEffect(() => {
    let alive = true;
    const poll = () =>
      api
        .get("/notifications")
        .then((r) => {
          if (!alive) return;
          setUnread(r.unread);
          setInbox(r.inbox_pending || 0);
        })
        .catch(() => {});
    poll();
    const id = setInterval(poll, 60000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const firstName = user.name.split(" ")[0];

  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">
          Eventure
        </Link>
        <nav aria-label="Main Navigation">
          <NavLink to="/" end>Timeline</NavLink>
          <NavLink to="/discover">Discover</NavLink>
          <NavLink to="/add">Add event</NavLink>
          <NavLink to="/inbox">Inbox{inbox > 0 && <b className="badge">{inbox}</b>}</NavLink>
          <NavLink to="/community">Community</NavLink>
          <NavLink to="/organizer">Organizer</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
        <div className="topbar-right">
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={toggleTheme}
            aria-label="Toggle light or dark theme"
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
          <Link to="/notifications" className="bell" aria-label="Notifications">
            Alerts{unread > 0 && <b>{unread}</b>}
          </Link>
          <button className="linklike logout-btn" onClick={logout}>Sign out ({firstName})</button>
        </div>
      </header>
      <main className="page">{children}</main>
    </>
  );
}

function Protected({ children, theme, toggleTheme }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p className="center muted">Loading...</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Layout theme={theme} toggleTheme={toggleTheme}>{children}</Layout>;
}

export default function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("eventure_theme") || "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("eventure_theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  };

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Protected theme={theme} toggleTheme={toggleTheme}><Timeline /></Protected>} />
      <Route path="/add" element={<Protected theme={theme} toggleTheme={toggleTheme}><AddEvent /></Protected>} />
      <Route path="/inbox" element={<Protected theme={theme} toggleTheme={toggleTheme}><Inbox /></Protected>} />
      <Route path="/organizer" element={<Protected theme={theme} toggleTheme={toggleTheme}><Organizer /></Protected>} />
      <Route path="/discover" element={<Protected theme={theme} toggleTheme={toggleTheme}><Discover /></Protected>} />
      <Route path="/events/:id/edit" element={<Protected theme={theme} toggleTheme={toggleTheme}><EditEvent /></Protected>} />
      <Route path="/events/:id" element={<Protected theme={theme} toggleTheme={toggleTheme}><EventDetail /></Protected>} />
      <Route path="/community" element={<Protected theme={theme} toggleTheme={toggleTheme}><Community /></Protected>} />
      <Route path="/notifications" element={<Protected theme={theme} toggleTheme={toggleTheme}><Notifications /></Protected>} />
      <Route path="/settings" element={<Protected theme={theme} toggleTheme={toggleTheme}><Settings /></Protected>} />
      <Route path="*" element={<Protected theme={theme} toggleTheme={toggleTheme}><NotFound /></Protected>} />
    </Routes>
  );
}
