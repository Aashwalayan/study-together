// The server owns the seat layout. Clients only render what they are told,
// so changing the classroom shape later means editing this one file.
//
// Coordinate system (matches the three.js scene on the client):
//   x: left/right, z: depth. The whiteboard is at negative z, so students
//   sit at positive z and face -z.

const COLUMNS = 6;
const SPACING_X = 1.6;
const SPACING_Z = 2.2;
const START_Z = 1.2;

export function buildSeatLayout(maxSeats = 24) {
  const seats = [];
  for (let i = 0; i < maxSeats; i += 1) {
    const row = Math.floor(i / COLUMNS);
    const col = i % COLUMNS;
    seats.push({
      id: `seat_${i + 1}`,
      label: i + 1,
      position: [(col - (COLUMNS - 1) / 2) * SPACING_X, 0, START_Z + row * SPACING_Z],
    });
  }
  return seats;
}
