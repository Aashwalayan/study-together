import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

const tabFor = (pathname) => {
  if (pathname === '/') return 'rooms';
  if (pathname.startsWith('/friends')) return 'friends';
  if (pathname.startsWith('/profile')) return 'profile';
  return null;
};

export default function TopBar() {
  const { token, user, logout } = useAuth();
  const { pathname } = useLocation();
  const activeTab = tabFor(pathname);
  const [pending, setPending] = useState(0); // friend requests waiting for you
  const [bar, setBar] = useState(null); // where the underline sits: { x, w }
  const [animated, setAnimated] = useState(false);
  const links = useRef({});

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      api('/api/friends', { token })
        .then((d) => {
          if (!cancelled) setPending(d.incoming.length);
        })
        .catch(() => {});
    // The Friends page announces its latest count so the badge updates instantly
    const onUpdate = (e) => setPending(e.detail);

    load();
    const id = setInterval(load, 30000);
    window.addEventListener('friends:updated', onUpdate);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener('friends:updated', onUpdate);
    };
  }, [token]);

  const measure = useCallback(() => {
    const el = activeTab ? links.current[activeTab] : null;
    const next = el ? { x: el.offsetLeft, w: el.offsetWidth } : null;
    setBar((prev) => (prev && next && prev.x === next.x && prev.w === next.w ? prev : next));
  }, [activeTab]);

  // Move the underline under the active tab before the browser paints
  useLayoutEffect(() => {
    measure();
  }, [measure]);

  // Only start animating once the first position is set, so the line doesn't fly in from the corner
  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  // Keep it aligned when a tab changes width (fonts loading, the friends badge appearing)
  useEffect(() => {
    const observer = new ResizeObserver(measure);
    Object.values(links.current).forEach((el) => el && observer.observe(el));
    document.fonts?.ready.then(measure);
    return () => observer.disconnect();
  }, [measure]);

  const track = (tab) => (el) => {
    links.current[tab] = el;
  };

  return (
    <header className="topbar">
      <h1>Study Together</h1>
      <nav className="topbar-nav">
        <NavLink ref={track('rooms')} to="/" end>Rooms</NavLink>
        <NavLink ref={track('friends')} to="/friends">
          Friends{pending > 0 && <span className="badge-count">{pending}</span>}
        </NavLink>
        <NavLink ref={track('profile')} to="/profile">Profile</NavLink>
        <span
          className={`nav-indicator${animated ? ' animated' : ''}`}
          style={bar ? { width: bar.w, transform: `translateX(${bar.x}px)` } : { opacity: 0 }}
          aria-hidden="true"
        />
      </nav>
      <div className="topbar-right">
        <span className="muted">{user.name}</span>
        <button onClick={logout}>Sign out</button>
      </div>
    </header>
  );
}