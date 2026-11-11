import { useEffect, useState } from 'react';

const LABELS = { idle: 'Ready', focus: 'Focus', break: 'Break' };

const format = (ms) => {
  const total = Math.ceil(ms / 1000);
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
};

// The server only sends when a phase ends (endsAt). Every client works out the
// remaining time itself, corrected by the server clock offset, so late joiners
// and laggy connections all show the same countdown.
export default function PomodoroTimer({ timer, offsetRef, isOwner, onStart, onReset }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const phase = timer?.phase ?? 'idle';
  const remaining = phase === 'idle' ? 0 : Math.max(0, timer.endsAt - (now + offsetRef.current));
  const progress = phase === 'idle' ? 0 : 1 - remaining / timer.durationMs;

  return (
    <section className={`panel timer ${phase}`}>
      <h2>{LABELS[phase]}</h2>
      <div className="clock" role="timer">{phase === 'idle' ? '--:--' : format(remaining)}</div>
      <div className="bar"><div style={{ width: `${progress * 100}%` }} /></div>
      {isOwner ? (
        <div className="row">
          <button className="primary" onClick={onStart}>{phase === 'idle' ? 'Start session' : 'Restart'}</button>
          {phase !== 'idle' && <button onClick={onReset}>Stop</button>}
        </div>
      ) : (
        <p className="muted small">{phase === 'idle' ? 'Waiting for the owner to start' : 'Controlled by the room owner'}</p>
      )}
    </section>
  );
}
