import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import TopBar from '../components/TopBar.jsx';
import AvatarChip from '../components/AvatarChip.jsx';

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const [form, setForm] = useState({
    name: user.name,
    username: user.username || '',
    subject: user.subject || '',
    bio: user.bio || '',
  });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const payload = { name: form.name, subject: form.subject, bio: form.bio };
      if (form.username.trim()) payload.username = form.username;
      const saved = await updateProfile(payload);
      setForm((f) => ({ ...f, username: saved.username || '' }));
      setMessage('Profile saved');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const copyUsername = async () => {
    try {
      await navigator.clipboard.writeText(`@${user.username}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard can be blocked; the username is visible on screen anyway */
    }
  };

  return (
    <div className="page">
      <TopBar />

      <div className="profile-head">
        <AvatarChip id={user.id} name={user.name} size={64} />
        <div>
          <h2>{user.name}</h2>
          {user.username ? (
            <p className="muted">
              @{user.username}{' '}
              <button type="button" className="linklike" onClick={copyUsername}>
                {copied ? 'Copied' : 'Copy'}
              </button>
            </p>
          ) : (
            <p className="error">Pick a username below so friends can find you.</p>
          )}
        </div>
      </div>

      <form className="card profile-form" onSubmit={save}>
        <label>
          Name
          <input value={form.name} onChange={set('name')} required minLength={2} maxLength={40} />
        </label>
        <label>
          Username
          <input
            value={form.username}
            onChange={set('username')}
            minLength={3}
            maxLength={20}
            pattern="[A-Za-z0-9_]+"
            title="Letters, numbers and underscores"
            required={!user.username}
          />
          <span className="hint">3 to 20 letters, numbers or underscores. Friends find you with this.</span>
        </label>
        <label>
          What are you studying?
          <input value={form.subject} onChange={set('subject')} maxLength={60} />
        </label>
        <label>
          About you
          <textarea value={form.bio} onChange={set('bio')} maxLength={160} rows={3} />
          <span className="hint">{form.bio.length}/160</span>
        </label>
        <label>
          Email
          <input value={user.email} disabled />
        </label>

        {error && <p className="error" role="alert">{error}</p>}
        {message && <p className="success" role="status">{message}</p>}
        <button className="primary" disabled={busy}>Save changes</button>
      </form>
    </div>
  );
}