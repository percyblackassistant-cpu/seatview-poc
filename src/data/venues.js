/**
 * Venue data. Two rooms, one engine.
 *
 * Sources for the Uránia numbers (checked 24/11/2026):
 *  - capacity 425 for screenings, 460 for other events, screen 820 x 480 cm
 *    https://urania-nf.hu/rendezvenyhelyszin
 *  - dress circle / balcony structure described in the venue history
 *    https://urania-nf.hu/en/history
 *
 * The Uránia does not publish a seat-level plan or hall dimensions. Its 425
 * seats are real; the split between stalls (285) and balcony (140), the row
 * pitch, block widths and the rake below are a reconstruction that matches the
 * published capacity and screen size. Nothing here claims to be the venue's
 * official seat numbering.
 */

const ROW_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

function columns(blocks, seatPitch, aisleWidth) {
  const perRow = blocks.reduce((a, b) => a + b, 0)
  const width = perRow * seatPitch + (blocks.length - 1) * aisleWidth
  let cursor = -width / 2
  const xs = []
  for (const count of blocks) {
    for (let i = 0; i < count; i += 1) {
      xs.push(cursor + seatPitch / 2 + i * seatPitch)
    }
    cursor += count * seatPitch + aisleWidth
  }
  return { xs, width }
}

function buildSeats(tier, rowStart) {
  if (!tier) return []
  const { xs } = columns(tier.blocks, tier.seatPitch, tier.aisleWidth)
  const seats = []
  for (let r = 0; r < tier.rows; r += 1) {
    const row = ROW_LETTERS[rowStart + r]
    for (let i = 0; i < xs.length; i += 1) {
      seats.push({
        id: `${row}${i + 1}`,
        tier: tier.id,
        tierLabel: tier.label,
        row,
        rowIndex: r,
        number: i + 1,
        x: xs[i],
        z: tier.firstZ + r * tier.rowPitch,
        floor: (tier.elevation ?? 0) + r * tier.rake,
        status: 'available',
        panorama: null,
      })
    }
  }
  return seats
}

function defineVenue(config) {
  let rowCursor = 0
  const seats = []
  const tiers = config.tiers.map((tier) => {
    const list = buildSeats(tier, rowCursor)
    rowCursor += tier.rows
    seats.push(...list)
    return {
      ...tier,
      rowStart: list[0]?.row,
      rowEnd: list[list.length - 1]?.row,
      seatCount: list.length,
      footprint: columns(tier.blocks, tier.seatPitch, tier.aisleWidth).width,
    }
  })

  for (const seat of seats) {
    if (config.sold?.has(seat.id)) seat.status = 'sold'
  }

  const byId = new Map(seats.map((s) => [s.id, s]))
  const screen = {
    ...config.screen,
    z: config.screen.z ?? config.hall.frontZ + 0.12,
    centreY: config.hall.stageHeight + config.screen.bottom + config.screen.height / 2,
  }

  return {
    ...config,
    tiers,
    seats,
    seatsById: byId,
    capacityBuilt: seats.length,
    screen,
    backZ: config.hall.frontZ + config.hall.depth,
  }
}

const studioHall = defineVenue({
  id: 'studio-hall',
  name: 'Studio Hall',
  room: 'Demo room',
  city: 'Proof of concept',
  subtitle: 'A 100-seat room built to test the flow',
  provenance: 'Invented room. Not a real venue.',
  hall: {
    width: 9,
    depth: 12.8,
    height: 4,
    stageWidth: 8,
    stageDepth: 2.4,
    stageHeight: 0.5,
    frontZ: -10,
  },
  screen: { width: 4.6, height: 2.6, bottom: 1.05 },
  screenTitle: 'STUDIO HALL',
  screenSub: 'one hundred seats, one screen',
  palette: {
    floor: '#2b2521',
    wall: '#3a352f',
    ceiling: '#211f1d',
    stage: '#332c26',
    seat: '#7d3038',
    seatSold: '#3c4046',
    accent: '#e6b24a',
    trim: '#b8893a',
    curtain: null,
    chandelier: null,
    proscenium: false,
    balcony: false,
  },
  eyeSeated: 1.18,
  eyeStanding: 1.68,
  tiers: [
    {
      id: 'stalls',
      label: 'Floor',
      rows: 10,
      blocks: [3, 4, 3],
      seatPitch: 0.55,
      rowPitch: 0.95,
      aisleWidth: 1.05,
      firstZ: -6.5,
      rake: 0,
      elevation: 0,
      note: 'Flat floor, one level.',
    },
  ],
  sold: new Set(['A4', 'B7', 'C2', 'D9', 'F5', 'G1', 'H8', 'J3']),
})

const urania = defineVenue({
  id: 'urania',
  name: 'Uránia Nemzeti Filmszínház',
  room: 'Díszterem',
  city: 'Budapest',
  subtitle: 'Rákóczi út 21, VIII. kerület',
  provenance:
    'Published by the venue: 425 seats for screenings, a 8.2 x 4.8 m screen and a 100 m2 stage. The seat grid is reconstructed to that capacity, and the hall dimensions, rake and screen position within the stage are modelled, not surveyed.',
  hall: {
    width: 17,
    depth: 26.7,
    height: 10,
    stageWidth: 11.5,
    stageDepth: 8.7,
    stageHeight: 0.9,
    frontZ: -14.7,
  },
  screen: { width: 8.2, height: 4.8, bottom: 1.15, z: -8.2 },
  screenTitle: 'DÍSZTEREM',
  screenSub: 'Uránia Nemzeti Filmszínház',
  palette: {
    floor: '#241916',
    wall: '#5b4436',
    ceiling: '#241a17',
    stage: '#3a2a24',
    seat: '#8d1f24',
    balcony: '#4a1117',
    seatSold: '#42393a',
    accent: '#e0b968',
    trim: '#c9a35c',
    curtain: '#4a1013',
    chandelier: '#f6dda4',
    proscenium: true,
    hasBalcony: true,
  },
  eyeSeated: 1.16,
  eyeStanding: 1.66,
  tiers: [
    {
      id: 'stalls',
      label: 'Stalls',
      rows: 15,
      blocks: [6, 7, 6],
      seatPitch: 0.55,
      rowPitch: 0.95,
      aisleWidth: 0.95,
      firstZ: -3.6,
      rake: 0.13,
      elevation: 0,
      note: 'Raked floor, rows A to O.',
    },
    {
      id: 'balcony',
      label: 'Balcony',
      rows: 7,
      blocks: [6, 8, 6],
      seatPitch: 0.55,
      rowPitch: 1.0,
      aisleWidth: 0.95,
      firstZ: 3.0,
      rake: 0.2,
      elevation: 4.35,
      note: 'Upper level over the rear stalls, rows P to V.',
    },
  ],
  sold: new Set([
    'A5', 'A6', 'B12', 'C3', 'C4', 'D8', 'D9', 'D10', 'E1', 'E2',
    'F7', 'F8', 'G14', 'G15', 'H5', 'H6', 'H7', 'J9', 'K3', 'K4',
    'L11', 'L12', 'M6', 'N8', 'N9', 'P3', 'P4', 'Q12', 'R7', 'R8',
    'S15', 'T2', 'U9', 'U10', 'V5',
  ]),
})

export const VENUES = [urania, studioHall]
export const VENUE_BY_ID = new Map(VENUES.map((v) => [v.id, v]))
export const DEFAULT_VENUE_ID = 'urania'
