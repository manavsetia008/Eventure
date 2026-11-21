import { useEffect, useRef, useState } from "react";
import { Link, Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { Privacy, Terms } from "./pages/Legal.jsx";
import { api } from "./api";
import { useAuth } from "./auth.jsx";
import Logo from "./components/Logo.jsx";
import AddEvent from "./pages/AddEvent.jsx";
import Community from "./pages/Community.jsx";
import Discover from "./pages/Discover.jsx";
import EditEvent from "./pages/EditEvent.jsx";
import EventDetail from "./pages/EventDetail.jsx";
import Inbox from "./pages/Inbox.jsx";
import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import NotFound from "./pages/NotFound.jsx";
import Notifications from "./pages/Notifications.jsx";
import Organizer from "./pages/Organizer.jsx";
import Settings from "./pages/Settings.jsx";
import Timeline from "./pages/Timeline.jsx";
import SarvamAssistant from "./components/SarvamAssistant.jsx";
import PortalSearchModal from "./components/PortalSearchModal.jsx";
import {
  Bell,
  Calendar,
  ClipboardList,
  Compass,
  Inbox as InboxIcon,
  LogOut,
  Moon,
  Plus,
  Settings as SettingsIcon,
  Sparkles,
  Sun,
  User,
  Users,
} from "lucide-react";

function Layout({ children, theme, toggleTheme }) {
  const { user, logout } = useAuth();
  const [unread, setUnread] = useState(0);
  const [inbox, setInbox] = useState(0);
  const [portalSearchOpen, setPortalSearchOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

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

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  return (
    <>
      <header className="topbar">
        <Link to="/" className="topbar-brand" aria-label="Eventure Home">
          <Logo size={24} />
        </Link>

        <nav className="desktop-nav" aria-label="Main Navigation">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
            <Calendar size={15} strokeWidth={1.75} />
            <span>Timeline</span>
          </NavLink>
          <NavLink to="/discover" className={({ isActive }) => (isActive ? "active" : "")}>
            <Compass size={15} strokeWidth={1.75} />
            <span>Discover</span>
          </NavLink>
          <NavLink to="/add" className={({ isActive }) => (isActive ? "active" : "")}>
            <Plus size={15} strokeWidth={1.75} />
            <span>Add event</span>
          </NavLink>
          <NavLink to="/inbox" className={({ isActive }) => (isActive ? "active" : "")}>
            <InboxIcon size={15} strokeWidth={1.75} />
            <span>Inbox</span>
            {inbox > 0 && <span className="nav-badge-count">{inbox}</span>}
          </NavLink>
          <NavLink to="/community" className={({ isActive }) => (isActive ? "active" : "")}>
            <Users size={15} strokeWidth={1.75} />
            <span>Community</span>
          </NavLink>
          <NavLink to="/organizer" className={({ isActive }) => (isActive ? "active" : "")}>
            <ClipboardList size={15} strokeWidth={1.75} />
            <span>Organizer</span>
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => (isActive ? "active" : "")}>
            <SettingsIcon size={15} strokeWidth={1.75} />
            <span>Settings</span>
          </NavLink>
        </nav>

        <div className="topbar-right">
          <button
            type="button"
            className="portal-search-trigger-btn"
            onClick={() => setPortalSearchOpen(true)}
            title="Search Top Portals (>70% Match Engine)"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "5px 10px",
              fontSize: "0.8rem",
              fontWeight: 500,
              background: "var(--accent-subtle, rgba(99, 102, 241, 0.1))",
              color: "var(--accent, #6366f1)",
              border: "1px solid var(--accent, #6366f1)",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            <Sparkles size={13} />
            <span>Search Portals</span>
          </button>

          <button
            type="button"
            className="theme-toggle-btn"
            onClick={toggleTheme}
            aria-label="Toggle light or dark theme"
          >
            {theme === "dark" ? <Sun size={16} strokeWidth={1.75} /> : <Moon size={16} strokeWidth={1.75} />}
          </button>

          <Link to="/notifications" className="bell-btn" aria-label="Notifications">
            <Bell size={17} strokeWidth={1.75} />
            {unread > 0 && <span className="bell-badge">{unread}</span>}
          </Link>

          {/* User Avatar Dropdown */}
          <div className="user-dropdown-wrap" ref={dropdownRef}>
            <button
              type="button"
              className="user-avatar-btn"
              onClick={() => setDropdownOpen((d) => !d)}
              aria-label="Open user profile menu"
              aria-expanded={dropdownOpen}
            >
              <User size={16} strokeWidth={1.75} />
            </button>
            {dropdownOpen && (
              <div className="user-dropdown-menu">
                <div className="dropdown-user-header">
                  <div className="dropdown-user-name">{user.name}</div>
                  <div className="dropdown-user-email">{user.email}</div>
                  {user.college && <div className="dropdown-user-college">{user.college}</div>}
                </div>
                <Link
                  to="/settings"
                  className="dropdown-menu-item"
                  onClick={() => setDropdownOpen(false)}
                >
                  <SettingsIcon size={15} strokeWidth={1.75} />
                  <span>Settings</span>
                </Link>
                <button
                  type="button"
                  className="dropdown-menu-item dropdown-signout"
                  onClick={() => {
                    setDropdownOpen(false);
                    logout();
                  }}
                >
                  <LogOut size={15} strokeWidth={1.75} />
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="page-main-container">{children}</main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
        <NavLink to="/" end className="mob-nav-item">
          <Calendar size={18} strokeWidth={1.75} />
          <span>Timeline</span>
        </NavLink>
        <NavLink to="/discover" className="mob-nav-item">
          <Compass size={18} strokeWidth={1.75} />
          <span>Discover</span>
        </NavLink>
        <NavLink to="/add" className="mob-nav-add" aria-label="Add event">
          <Plus size={20} strokeWidth={2} />
        </NavLink>
        <NavLink to="/inbox" className="mob-nav-item">
          <InboxIcon size={18} strokeWidth={1.75} />
          <span>Inbox</span>
          {inbox > 0 && <span className="mob-badge">{inbox}</span>}
        </NavLink>
        <NavLink to="/settings" className="mob-nav-item">
          <SettingsIcon size={18} strokeWidth={1.75} />
          <span>Settings</span>
        </NavLink>
      </nav>

      <PortalSearchModal isOpen={portalSearchOpen} onClose={() => setPortalSearchOpen(false)} />
      <SarvamAssistant />
    </>
  );
}

function Protected({ children, theme, toggleTheme }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="page-loading-state">Loading...</div>;
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Layout theme={theme} toggleTheme={toggleTheme}>{children}</Layout>;
}

const PAGE_TITLES = [
  [/^\/add/, "Add event"],
  [/^\/discover/, "Discover"],
  [/^\/inbox/, "Inbox"],
  [/^\/community/, "Community"],
  [/^\/organizer/, "Organizer"],
  [/^\/notifications/, "Notifications"],
  [/^\/settings/, "Settings"],
  [/^\/events\//, "Event"],
  [/^\/signup/, "Create account"],
  [/^\/login/, "Sign in"],
  [/^\/privacy/, "Privacy"],
  [/^\/terms/, "Terms"],
];

export default function App() {
  const { user } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const match = PAGE_TITLES.find(([re]) => re.test(location.pathname));
    const page = location.pathname === "/" ? (user ? "Timeline" : null) : match?.[1];
    document.title = page ? `${page} | Eventure` : "Eventure";
  }, [location.pathname, user]);
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("eventure_theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Follow the OS preference until the student makes an explicit choice.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => {
      const saved = localStorage.getItem("eventure_theme");
      if (saved !== "light" && saved !== "dark") setTheme(e.matches ? "dark" : "light");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const toggleTheme = () => {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      localStorage.setItem("eventure_theme", next);
      return next;
    });
  };

  return (
    <Routes>
      <Route path="/login" element={<Login initialMode="login" />} />
      <Route path="/signup" element={<Login initialMode="register" />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route
        path="/"
        element={
          user ? (
            <Protected theme={theme} toggleTheme={toggleTheme}>
              <Timeline />
            </Protected>
          ) : (
            <Landing theme={theme} toggleTheme={toggleTheme} />
          )
        }
      />
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
