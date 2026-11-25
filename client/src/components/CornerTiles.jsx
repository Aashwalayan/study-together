import { useEffect, useRef, useState } from 'react';

const GAP = 6; // space between tiles (matches the CSS)
const PAD = 14; // padding around each cluster (matches the CSS)
const MIN_TILE = 20;
const MAX_TILE = 38;
const MIN_N = 4;
const MAX_N = 10;
const CENTER_HALF_W = 210; // half the width of the message in the middle
const CENTER_HALF_H = 130; // half its height
const HOLD_MS = 450; // a tile rises, holds for a moment, then slowly settles (see the CSS)
const CORNERS = ['tl', 'tr', 'bl', 'br'];

// How far the clusters can reach on this screen: as far in as possible without
// touching each other or the message in the middle.
function measure() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const tile = Math.min(MAX_TILE, Math.max(MIN_TILE, w * 0.034));
  const unit = tile + GAP;
  const byWidth = Math.floor((w / 2 - PAD) / unit); // left and right clusters must not meet
  const byHeight = Math.floor((h / 2 - PAD) / unit); // top and bottom clusters must not meet
  const gapX = Math.max(0, w / 2 - CENTER_HALF_W - PAD);
  const gapY = Math.max(0, h / 2 - CENTER_HALF_H - PAD);
  const byCenter = Math.floor((gapX + gapY) / unit) - 1; // the slanted edge stays clear of the message
  return { tile, n: Math.max(MIN_N, Math.min(MAX_N, byWidth, byHeight, byCenter)) };
}

// A triangle of tiles growing out of the screen corner: tile (r, c) exists while r + c < n
function clusterOf(n) {
  const tiles = [];
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n - r; c += 1) tiles.push({ r, c });
  }
  return tiles;
}

// Place a tile so that (0, 0) is always the tile in the screen corner
function tileStyle(corner, n, r, c) {
  const distance = r + c;
  return {
    gridRow: corner.startsWith('t') ? r + 1 : n - r,
    gridColumn: corner.endsWith('l') ? c + 1 : n - c,
    '--o': Math.max(0.12, 1 - (distance / n) * 0.9), // tiles fade out away from the corner
    '--delay': `${distance * 0.3}s`, // the breathing ripples outwards
  };
}

export default function CornerTiles() {
  const timers = useRef(new Map());
  const [size, setSize] = useState(measure);

  useEffect(() => {
    let frame;
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = measure();
        setSize((prev) => (prev.n === next.n && Math.abs(prev.tile - next.tile) < 0.5 ? prev : next));
      });
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(frame);
    };
  }, []);

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

  const { tile, n } = size;
  const cluster = clusterOf(n);

  return (
    <div className="corner-tiles" aria-hidden="true">
      {CORNERS.map((corner) => (
        <div
          key={corner}
          className={`corner ${corner}`}
          style={{ '--tile': `${tile}px`, '--n': n }}
          onPointerMove={onPointer}
          onPointerDown={onPointer}
        >
          {cluster.map(({ r, c }) => (
            <span key={`${r}-${c}`} className="corner-tile" style={tileStyle(corner, n, r, c)} />
          ))}
        </div>
      ))}
    </div>
  );
}