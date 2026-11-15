import { useEffect, useState } from 'react';
import { api } from '../api.js';

const COOLDOWN_SECONDS = 60; // matches the server-side limit

export default function ResendVerification({ email, startCooldown = false }) {
  const [seconds, setSeconds] = useState(startCooldown ? COOLDOWN_SECONDS : 0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (seconds <= 0) return undefined;
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [seconds]);

  const send = async () => {
    setError('');
    setMessage('');
    try {
      const data = await api('/api/auth/resend-verification', { method: 'POST', body: { email } });
      setMessage(data.message);
      setSeconds(COOLDOWN_SECONDS);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="resend">
      <button type="button" onClick={send} disabled={seconds > 0}>
        {seconds > 0 ? `Resend email (${seconds}s)` : 'Resend verification email'}
      </button>
      {message && <p className="success small" role="status">{message}</p>}
      {error && <p className="error small" role="alert">{error}</p>}
    </div>
  );
}