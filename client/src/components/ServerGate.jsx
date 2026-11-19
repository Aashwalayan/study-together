import { useEffect, useState } from 'react';

const BASE = import.meta.env.VITE_API_URL || '';
const SHOW_AFTER_MS = 1000; // don't flash a loader if the server answers quickly
const RETRY_MS = 2000;
const REQUEST_TIMEOUT_MS = 8000;

// Free hosts put idle servers to sleep. The app itself is static and loads
// instantly, so this gate waits for the API to wake up and shows a friendly
// message instead of a broken page or a pile of failed requests.
export default function ServerGate({ children }) {
  const [ready, setReady] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const started = Date.now();
    const loaderTimer = setTimeout(() => setShowLoader(true), SHOW_AFTER_MS);
    const clock = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);

    (async () => {
      while (!cancelled) {
        const controller = new AbortController();
        const abort = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
          const res = await fetch(`${BASE}/api/health`, { signal: controller.signal });
          if (res.ok) {
            if (!cancelled) setReady(true);
            return;
          }
        } catch {
          /* the server is still starting; try again shortly */
        } finally {
          clearTimeout(abort);
        }
        await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
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
        The server naps when nobody is around. This usually takes under a minute.
        {seconds >= 5 && <> Waiting {seconds}s…</>}
      </p>
    </main>
  );
}