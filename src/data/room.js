/**
 * Room definition for the 100-seat POC.
 *
 * Everything here is in metres, right-handed: x across, y up, z toward the back
 * of the room. The stage sits at negative z, so a seated person faces -z.
 *
 * This is the file a real venue replaces. Keep the shape, swap the numbers.
 */

export const ROOM = {
  name: 'Studio Hall',
  width: 9.0, // interior width
  height: 4.0,
  stage: { width: 8.0, depth: 2.4, height: 0.5, zFront: -7.6 },
  rowCount: 10,
  rowPitch: 0.95,
  firstRowZ: -6.5,
  seatPitch: 0.55,
  aisleWidth: 1.05,
  blocks: [3, 4, 3], // seats per block, separated by aisles
  eyeSeated: 1.18,
  eyeStanding: 1.68,
}

export const ROW_LABELS = 'ABCDEFGHIJ'.split('')

// A handful of seats marked taken so the availability states are real.
const SOLD = new Set(['A4', 'B7', 'C2', 'D9', 'F5', 'G1', 'H8', 'J3'])

function seatColumns() {
  const blocks = ROOM.blocks
  const perRow = blocks.reduce((a, b) => a + b, 0)
  const contentWidth = perRow * ROOM.seatPitch + (blocks.length - 1) * ROOM.aisleWidth
  let cursor = -contentWidth / 2
  const xs = []
  for (const count of blocks) {
    for (let i = 0; i < count; i += 1) {
      xs.push(cursor + ROOM.seatPitch / 2 + i * ROOM.seatPitch)
    }
    cursor += count * ROOM.seatPitch + ROOM.aisleWidth
  }
  return xs
}

export const SEATS = (() => {
  const xs = seatColumns()
  const seats = []
  for (let r = 0; r < ROOM.rowCount; r += 1) {
    const row = ROW_LABELS[r]
    const z = ROOM.firstRowZ + r * ROOM.rowPitch
    xs.forEach((x, i) => {
      const number = i + 1
      const id = `${row}${number}`
      seats.push({
        id,
        row,
        rowIndex: r,
        number,
        x,
        z,
        status: SOLD.has(id) ? 'sold' : 'available',
        /**
         * Real-venue hook. Set this to the URL of an equirectangular (2:1)
         * 360 capture for this seat and the viewer swaps its rendered view for
         * that photo. One capture per seat, per eye height: it is a still, so
         * standing up inside it cannot show true parallax.
         */
        panorama: null,
      })
    })
  }
  return seats
})()

export const SEAT_BY_ID = new Map(SEATS.map((seat) => [seat.id, seat]))

export const ROOM_FRONT_Z = ROOM.stage.zFront - ROOM.stage.depth
export const ROOM_BACK_Z = ROOM.firstRowZ + (ROOM.rowCount - 1) * ROOM.rowPitch + 1.15
