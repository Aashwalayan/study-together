import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function AuthPage({ mode }) {
  const isRegister = mode === 'register';
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', subject: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (isRegister) await register(form);
      else await login(form.email, form.password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth">
      <div className="auth-card">
        <h1>Study Together</h1>
        <p className="muted">
          {isRegister ? 'Create an account to find a seat.' : 'Sign in to rejoin your study hall.'}
        </p>
        <form onSubmit={submit}>
          {isRegister && (
            <>
              <label>
                Name
                <input value={form.name} onChange={set('name')} required minLength={2} maxLength={40} />
              </label>
              <label>
                What are you studying?
                <input value={form.subject} onChange={set('subject')} maxLength={60} placeholder="Operating systems" />
              </label>
            </>
          )}
          <label>
            Email
            <input type="email" value={form.email} onChange={set('email')} required />
          </label>
          <label>
            Password
            <input type="password" value={form.password} onChange={set('password')} required minLength={isRegister ? 8 : 1} />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="primary" disabled={busy}>
            {isRegister ? 'Create account' : 'Sign in'}
          </button>
        </form>
        <p className="muted small">
          {isRegister ? (
            <>Already registered? <Link to="/login">Sign in</Link></>
          ) : (
            <>New here? <Link to="/register">Create an account</Link></>
          )}
        </p>
      </div>
    </main>
  );
}
