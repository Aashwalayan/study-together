import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const { verifyEmail } = useAuth();
  const navigate = useNavigate();
  const started = useRef(false); // React StrictMode runs effects twice in dev
  const [status, setStatus] = useState(token ? 'verifying' : 'error');
  const [error, setError] = useState(token ? '' : 'This verification link is incomplete.');

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    verifyEmail(token)
      .then(() => {
        setStatus('done');
        setTimeout(() => navigate('/', { replace: true }), 1500);
      })
      .catch((err) => {
        setError(err.message);
        setStatus('error');
      });
  }, [token, verifyEmail, navigate]);

  return (
    <main className="auth">
      <div className="auth-card">
        <h1>Study Together</h1>
        {status === 'verifying' && <p className="muted">Verifying your email…</p>}
        {status === 'done' && (
          <>
            <p className="success">Your email is verified. Taking you to the study rooms…</p>
            <p className="small"><Link to="/">Continue now</Link></p>
          </>
        )}
        {status === 'error' && (
          <>
            <p className="error" role="alert">{error}</p>
            <p className="muted small">
              Links expire after 24 hours and work once. <Link to="/login">Sign in</Link> to request a new one.
            </p>
          </>
        )}
      </div>
    </main>
  );
}