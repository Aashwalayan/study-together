import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

// Shared header. Shows how many friend requests are waiting. Pages that
// already know the count (the Friends page) pass it in to avoid a second fetch.
export default function TopBar({ incomingCount }) {
  const { token, user, logout } = useAuth();
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if (incomingCount !== undefined) return undefined;
    let cancelled = false;
    const load = () =>
      api('/api/friends', { token })
        .then((d) => {
          if (!cancelled) setPending(d.incoming.length);
        })
        .catch(() => {});
    load();
    const id = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [token, incomingCount]);

  const count = incomingCount ?? pending;
  const link = ({ isActive }) => (isActive ? 'active' : undefined);

  return (
    <header className="topbar">
      <h1>Study Together</h1>
      <nav className="topbar-nav">
        <NavLink to="/" end className={link}>Rooms</NavLink>
        <NavLink to="/friends" className={link}>
          Friends{count > 0 && <span className="badge-count">{count}</span>}
        </NavLink>
        <NavLink to="/profile" className={link}>Profile</NavLink>
      </nav>
      <div className="topbar-right">
        <span className="muted">{user.name}</span>
        <button onClick={logout}>Sign out</button>
      </div>
    </header>
  );
}