import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import ResendVerification from '../components/ResendVerification.jsx';

export default function AuthPage({ mode }) {
  const isRegister = mode === 'register';
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', subject: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // Set after registering, or after a sign-in attempt on an unverified account
  const [pending, setPending] = useState(null); // { email, emailSent }

  if (user) return <Navigate to="/" replace />;

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (isRegister) {
        const res = await register(form);
        setPending({ email: res.email, emailSent: res.emailSent });
      } else {
        await login(form.email, form.password);
        navigate('/');
      }
    } catch (err) {
      if (err.code === 'EMAIL_NOT_VERIFIED') setPending({ email: form.email, emailSent: null });
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (pending) {
    return (
      <main className="auth">
        <div className="auth-card">
          <h1>Check your email</h1>
          <p className="muted">
            {pending.emailSent === false
              ? <>We created your account but couldn’t send the email to <strong>{pending.email}</strong>. Use the button below to try again.</>
              : pending.emailSent === null
                ? <>Your account <strong>{pending.email}</strong> isn’t verified yet. Open the link in your inbox, or send a new one.</>
                : <>We sent a verification link to <strong>{pending.email}</strong>. Open it to finish signing up. It expires in 24 hours.</>}
          </p>
          <ResendVerification email={pending.email} startCooldown={pending.emailSent !== false} />
          <p className="muted small">
            Wrong address? <button type="button" className="linklike" onClick={() => setPending(null)}>Go back</button>
          </p>
        </div>
      </main>
    );
  }

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