import { ROOM, ROW_LABELS, ROOM_BACK_Z, ROOM_FRONT_Z } from '../data/room.js'

const PAD = 0.55
const VIEW_X = -ROOM.width / 2 - PAD
const VIEW_Y = ROOM_FRONT_Z - PAD
const VIEW_W = ROOM.width + PAD * 2
const VIEW_H = ROOM_BACK_Z - ROOM_FRONT_Z + PAD * 2

const STAGE_MID = ROOM.stage.zFront - ROOM.stage.depth / 2

export default function SeatMap({ seats, selectedId, onSelect }) {
  const pick = (seat) => {
    if (seat.status === 'sold') return
    onSelect(seat.id)
  }

  return (
    <svg
      className="seatmap"
      viewBox={`${VIEW_X} ${VIEW_Y} ${VIEW_W} ${VIEW_H}`}
      role="group"
      aria-label={`Seating plan for ${ROOM.name}`}
    >
      <rect
        className="room-floor"
        x={-ROOM.width / 2}
        y={ROOM_FRONT_Z}
        width={ROOM.width}
        height={ROOM_BACK_Z - ROOM_FRONT_Z}
        rx={0.12}
      />
      <rect
        className="stage"
        x={-ROOM.stage.width / 2}
        y={ROOM.stage.zFront - ROOM.stage.depth}
        width={ROOM.stage.width}
        height={ROOM.stage.depth}
        rx={0.08}
      />
      <text className="stage-label" x={0} y={STAGE_MID - 0.02} textAnchor="middle">
        STAGE
      </text>
      <text className="stage-sub" x={0} y={STAGE_MID + 0.34} textAnchor="middle">
        screen this way
      </text>

      {ROW_LABELS.slice(0, ROOM.rowCount).map((label, r) => {
        const z = ROOM.firstRowZ + r * ROOM.rowPitch
        return (
          <text key={label} className="row-label" x={-ROOM.width / 2 + 0.42} y={z + 0.11} textAnchor="middle">
            {label}
          </text>
        )
      })}

      {seats.map((seat) => {
        const state = seat.status === 'sold' ? 'sold' : seat.id === selectedId ? 'selected' : 'available'
        return (
          <g
            key={seat.id}
            className={`seat seat--${state}`}
            role="button"
            tabIndex={seat.status === 'sold' ? -1 : 0}
            aria-label={`Row ${seat.row}, seat ${seat.number}${seat.status === 'sold' ? ', taken' : ''}`}
            aria-pressed={seat.id === selectedId}
            onClick={() => pick(seat)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                pick(seat)
              }
            }}
          >
            <rect x={seat.x - 0.23} y={seat.z - 0.18} width={0.46} height={0.36} rx={0.07} />
            <title>{`Row ${seat.row} · seat ${seat.number}${seat.status === 'sold' ? ' (taken)' : ''}`}</title>
          </g>
        )
      })}
    </svg>
  )
}
