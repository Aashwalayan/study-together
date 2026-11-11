import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function RoomsPage() {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [form, setForm] = useState({ name: '', subject: '', isPrivate: false, focusMinutes: 25, breakMinutes: 5 });

  const load = useCallback(() => {
    api('/api/rooms', { token })
      .then((d) => setRooms(d.rooms))
      .catch((e) => setError(e.message));
  }, [token]);

  useEffect(() => {
    load();
    const id = setInterval(load, 10000); // keep occupant counts fresh
    return () => clearInterval(id);
  }, [load]);

  const create = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const { room } = await api('/api/rooms', { method: 'POST', token, body: form });
      navigate(`/room/${room.id}`);
    } catch (err) {
      setError(err.message);
    }
  };

  const joinByCode = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const { room } = await api('/api/rooms/join', { method: 'POST', token, body: { inviteCode: code } });
      navigate(`/room/${room.id}`);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page">
      <header className="topbar">
        <h1>Study Together</h1>
        <div className="topbar-right">
          <span className="muted">{user.name}</span>
          <button onClick={logout}>Sign out</button>
        </div>
      </header>

      {error && <p className="error" role="alert">{error}</p>}

      <div className="rooms-grid">
        <section>
          <h2>Open rooms</h2>
          {rooms.length === 0 && <p className="muted">No rooms yet. Create the first one.</p>}
          <ul className="room-list">
            {rooms.map((r) => (
              <li key={r.id}>
                <button className="room-item" onClick={() => navigate(`/room/${r.id}`)}>
                  <strong>{r.name}</strong>
                  <span className="muted">
                    {r.subject || 'Any subject'} · {r.focusMinutes}/{r.breakMinutes} min
                    {r.isPrivate ? ' · private' : ''}
                  </span>
                  <span className="count">{r.occupants} studying</span>
                </button>
                {r.isOwner && r.inviteCode && (
                  <p className="muted small">Invite code: <code>{r.inviteCode}</code></p>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="side-forms">
          <form onSubmit={create}>
            <h2>Create a room</h2>
            <label>
              Room name
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} maxLength={60} />
            </label>
            <label>
              Subject
              <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} maxLength={60} />
            </label>
            <div className="row">
              <label>
                Focus (min)
                <input type="number" min={1} max={120} value={form.focusMinutes} onChange={(e) => setForm({ ...form, focusMinutes: e.target.value })} />
              </label>
              <label>
                Break (min)
                <input type="number" min={1} max={60} value={form.breakMinutes} onChange={(e) => setForm({ ...form, breakMinutes: e.target.value })} />
              </label>
            </div>
            <label className="check">
              <input type="checkbox" checked={form.isPrivate} onChange={(e) => setForm({ ...form, isPrivate: e.target.checked })} />
              Private (invite code only)
            </label>
            <button className="primary">Create room</button>
          </form>

          <form onSubmit={joinByCode}>
            <h2>Have an invite code?</h2>
            <label>
              Code
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="A1B2C3" maxLength={12} />
            </label>
            <button>Join room</button>
          </form>
        </section>
      </div>
    </div>
  );
}
