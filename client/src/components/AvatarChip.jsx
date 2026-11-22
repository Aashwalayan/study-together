// A round badge with the person's initial, coloured from their id so it stays
// the same everywhere they appear.
const hueOf = (key) => {
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % 360;
};

export default function AvatarChip({ id, name, size = 38 }) {
  return (
    <span
      className="avatar-chip"
      style={{ width: size, height: size, background: `hsl(${hueOf(String(id))} 26% 36%)`, fontSize: size * 0.42 }}
      aria-hidden="true"
    >
      {(name || '?').trim().charAt(0).toUpperCase()}
    </span>
  );
}