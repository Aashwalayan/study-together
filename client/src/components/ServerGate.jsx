import { useEffect, useState } from 'react';
import CornerTiles from './CornerTiles.jsx';

const BASE = import.meta.env.VITE_API_URL || '';
const HEALTH_URL = `${BASE}/api/health`;
const SHOW_AFTER_MS = 1000; // don't flash a loader if the server answers quickly
const RETRY_MS = 2000;
const REQUEST_TIMEOUT_MS = 8000;
const SLOW_AFTER_S = 60;
const DIAGNOSE_AFTER_S = 75;

// Add ?wake-preview to the address to look at this screen without waiting for the server to sleep
const PREVIEW = new URLSearchParams(window.location.search).has('wake-preview');

async function ping(options) {
  const controller = new AbortController();
  const abort = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(HEALTH_URL, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(abort);
  }
}

// Free hosts put idle servers to sleep. The app itself is static and loads
// instantly, so this gate waits for the API to wake up and shows a friendly
// message (and something to play with) instead of a broken page.
export default function ServerGate({ children }) {
  const [ready, setReady] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const [seconds, setSeconds] = useState(0);
  // The server answers, but the browser refuses to hand over the reply (CORS)
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (PREVIEW) {
      setShowLoader(true);
      return undefined;
    }
    let cancelled = false;
    const started = Date.now();
    const loaderTimer = setTimeout(() => setShowLoader(true), SHOW_AFTER_MS);
    const clock = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);

    (async () => {
      while (!cancelled) {
        try {
          const res = await ping();
          if (res.ok) {
            if (!cancelled) setReady(true);
            return;
          }
        } catch {
          // Failed. Is the server reachable at all? A no-cors request succeeds
          // whenever something answers, even if CORS hides the reply.
          try {
            await ping({ mode: 'no-cors' });
            if (!cancelled) setBlocked(true);
          } catch {
            if (!cancelled) setBlocked(false);
          }
        }
        // Back off the longer we wait, to keep the console and the server calm
        const waited = Date.now() - started;
        const delay = waited > 120000 ? 10000 : waited > 30000 ? 5000 : RETRY_MS;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(loaderTimer);
      clearInterval(clock);
    };
  }, []);

  if (ready) return children;
  if (!showLoader) return null;

  return (
    <main className="wake" role="status" aria-live="polite">
      <div className="wake-spinner" aria-hidden="true" />
      <h1>Waking up the study hall</h1>
      <p className="muted">
        {seconds >= SLOW_AFTER_S
          ? 'This is taking longer than usual. Still trying…'
          : 'The server naps when nobody is around. This usually takes under a minute.'}
        {seconds >= 5 && seconds < SLOW_AFTER_S && <> Waiting {seconds}s…</>}
      </p>

      {seconds >= DIAGNOSE_AFTER_S && blocked && (
        <p className="wake-note small">
          The server is online but is refusing requests from this site. If you own this site,
          add <code>{window.location.origin}</code> to <code>CLIENT_URL</code> on the server.
        </p>
      )}
      {seconds >= DIAGNOSE_AFTER_S && !blocked && (
        <p className="wake-note small">
          We can’t reach the server right now. Check your connection. We’ll keep trying.
        </p>
      )}

      <CornerTiles />
    </main>
  );
}