import { useEffect, useRef } from 'react';

const N = 6; // tiles along each edge of a corner cluster
const HOLD_MS = 450; // a tile rises, holds for a moment, then slowly settles (see the CSS)
const CORNERS = ['tl', 'tr', 'bl', 'br'];

// Each cluster is a triangle of tiles growing out of its corner of the screen
const CLUSTER = [];
for (let r = 0; r < N; r += 1) {
  for (let c = 0; c < N - r; c += 1) CLUSTER.push({ r, c });
}

// Place a tile so that (0, 0) is always the tile in the screen corner
function tileStyle(corner, r, c) {
  const distance = r + c;
  return {
    gridRow: corner.startsWith('t') ? r + 1 : N - r,
    gridColumn: corner.endsWith('l') ? c + 1 : N - c,
    '--o': 1 - distance * 0.14, // tiles fade out away from the corner
    '--delay': `${distance * 0.4}s`, // the breathing ripples outwards
  };
}

export default function CornerTiles() {
  const timers = useRef(new Map());

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const lift = (el) => {
    el.classList.add('lifted');
    clearTimeout(timers.current.get(el));
    timers.current.set(el, setTimeout(() => el.classList.remove('lifted'), HOLD_MS));
  };

  // Works for mouse, pen and a finger dragged across the tiles
  const onPointer = (e) => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (el?.classList.contains('corner-tile')) lift(el);
  };

  return (
    <div className="corner-tiles" aria-hidden="true">
      {CORNERS.map((corner) => (
        <div key={corner} className={`corner ${corner}`} onPointerMove={onPointer} onPointerDown={onPointer}>
          {CLUSTER.map(({ r, c }) => (
            <span key={`${r}-${c}`} className="corner-tile" style={tileStyle(corner, r, c)} />
          ))}
        </div>
      ))}
    </div>
  );
}