import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import TopBar from '../components/TopBar.jsx';
import AvatarChip from '../components/AvatarChip.jsx';

function Person({ person, children, extra }) {
  return (
    <li className="person">
      <AvatarChip id={person.userId} name={person.name} />
      <div className="info">
        <div className="line"><strong>{person.name}</strong>{person.username && <span className="muted"> @{person.username}</span>}</div>
        <div className="line muted small">{extra || person.subject || 'No subject set'}</div>
      </div>
      <div className="actions">{children}</div>
    </li>
  );
}

export default function FriendsPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState({ friends: [], incoming: [], outgoing: [] });
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api('/api/friends', { token })
      .then((d) => {
        setData(d);
        window.dispatchEvent(new CustomEvent('friends:updated', { detail: d.incoming.length }));
      })
      .catch((e) => setError(e.message));
  }, [token]);

  // Refresh every few seconds so "in a room" status stays current
  useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [load]);

  // Debounced username search
  useEffect(() => {
    const q = query.trim().replace(/^@/, '');
    if (q.length < 2) {
      setResults([]);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      api(`/api/friends/search?q=${encodeURIComponent(q)}`, { token })
        .then((d) => {
          if (!cancelled) setResults(d.users);
        })
        .catch(() => { });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, token, refreshKey]);

  const act = async (fn) => {
    setError('');
    try {
      await fn();
      load();
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err.message);
    }
  };

  const sendRequest = (userId) =>
    act(() => api('/api/friends/requests', { method: 'POST', token, body: { userId } }));
  const accept = (id) => act(() => api(`/api/friends/requests/${id}/accept`, { method: 'POST', token }));
  const dismiss = (id) => act(() => api(`/api/friends/requests/${id}`, { method: 'DELETE', token }));
  const unfriend = (friend) => {
    if (!window.confirm(`Remove ${friend.name} from your friends?`)) return;
    act(() => api(`/api/friends/${friend.userId}`, { method: 'DELETE', token }));
  };

  const searching = query.trim().replace(/^@/, '').length >= 2;

  return (
    <div className="page">
      <TopBar incomingCount={data.incoming.length} />
      {error && <p className="error" role="alert">{error}</p>}

      <div className="social-grid">
        <section>
          <h2>Your friends ({data.friends.length})</h2>
          {data.friends.length === 0 && (
            <p className="muted">No friends yet. Search for a username to add someone.</p>
          )}
          <ul className="person-list">
            {data.friends.map((f) => {
              let status = 'Not in a room';
              if (f.presence?.roomName) status = `In “${f.presence.roomName}”`;
              else if (f.presence?.private) status = 'In a private room';
              return (
                <Person key={f.userId} person={f} extra={status}>
                  {f.presence?.roomId && (
                    <button className="primary small" onClick={() => navigate(`/room/${f.presence.roomId}`)}>Join</button>
                  )}
                  <button className="danger small" onClick={() => unfriend(f)}>Remove</button>
                </Person>
              );
            })}
          </ul>
        </section>

        <section>
          <div className="card">
            <h2>Add a friend</h2>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by username"
              aria-label="Search by username"
            />
            {searching && results.length === 0 && <p className="muted small">No one found with that username.</p>}
            <ul className="person-list search-results">
              {results.map((u) => (
                <Person key={u.userId} person={u}>
                  {u.relation === 'none' && <button className="primary small" onClick={() => sendRequest(u.userId)}>Add</button>}
                  {u.relation === 'sent' && <span className="muted small">Request sent</span>}
                  {u.relation === 'received' && <button className="primary small" onClick={() => accept(u.requestId)}>Accept</button>}
                  {u.relation === 'friends' && <span className="muted small">Friends</span>}
                </Person>
              ))}
            </ul>
          </div>

          {data.incoming.length > 0 && (
            <div className="card">
              <h2>Requests ({data.incoming.length})</h2>
              <ul className="person-list">
                {data.incoming.map((r) => (
                  <Person key={r.id} person={r}>
                    <button className="primary small" onClick={() => accept(r.id)}>Accept</button>
                    <button className="small" onClick={() => dismiss(r.id)}>Decline</button>
                  </Person>
                ))}
              </ul>
            </div>
          )}

          {data.outgoing.length > 0 && (
            <div className="card">
              <h2>Sent requests</h2>
              <ul className="person-list">
                {data.outgoing.map((r) => (
                  <Person key={r.id} person={r}>
                    <button className="small" onClick={() => dismiss(r.id)}>Cancel</button>
                  </Person>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}