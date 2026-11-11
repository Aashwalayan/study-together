export default function PresenceList({ occupants, myUserId, ownerId, isOwner, onKick }) {
  return (
    <section className="panel">
      <h2>In this room ({occupants.length})</h2>
      <ul className="presence">
        {occupants.map((o) => (
          <li key={o.userId}>
            <span>
              <strong>{o.userId === myUserId ? `${o.name} (you)` : o.name}</strong>
              {o.userId === ownerId && <span className="badge">owner</span>}
              <br />
              <span className="muted small">
                {o.subject || 'No subject set'} · {o.seatId ? `seat ${o.seatId.replace('seat_', '')}` : 'standing'}
              </span>
            </span>
            {isOwner && o.userId !== myUserId && (
              <button className="danger small" onClick={() => onKick(o.userId)}>Remove</button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
