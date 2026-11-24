const PAD = 0.6

export default function SeatMap({ venue, tier, selectedId, onSelect }) {
  const seats = venue.seats.filter((seat) => seat.tier === tier.id)
  const { hall, screen } = venue
  const stageFront = hall.frontZ + hall.stageDepth
  const lastRowZ = tier.firstZ + (tier.rows - 1) * tier.rowPitch

  const minX = -hall.width / 2 - PAD
  const minZ = hall.frontZ - PAD
  const width = hall.width + PAD * 2
  const height = Math.max(lastRowZ + 0.9, stageFront + 1) - minZ

  const pick = (seat) => {
    if (seat.status === 'sold') return
    onSelect(seat.id)
  }

  const raised = (tier.elevation ?? 0) > 0
  const rows = Array.from(new Set(seats.map((seat) => seat.row)))

  return (
    <svg
      className="seatmap"
      viewBox={`${minX} ${minZ} ${width} ${height}`}
      role="group"
      aria-label={`${tier.label} seating plan for ${venue.name}`}
    >
      <rect
        className="room-floor"
        x={-hall.width / 2}
        y={hall.frontZ}
        width={hall.width}
        height={hall.depth}
        rx={0.15}
      />

      <rect
        className="stage"
        x={-hall.stageWidth / 2}
        y={hall.frontZ}
        width={hall.stageWidth}
        height={hall.stageDepth}
        rx={0.08}
      />
      <rect
        className="screen"
        x={-screen.width / 2}
        y={screen.z - 0.16}
        width={screen.width}
        height={0.32}
        rx={0.06}
      />
      <text className="stage-label" x={0} y={hall.frontZ + hall.stageDepth / 2 - 0.1} textAnchor="middle">
        STAGE
      </text>
      <text className="stage-sub" x={0} y={hall.frontZ + hall.stageDepth / 2 + 0.4} textAnchor="middle">
        screen {screen.width} × {screen.height} m
      </text>

      {raised ? (
        <text className="ghost-note" x={0} y={(stageFront + tier.firstZ) / 2} textAnchor="middle">
          stalls below, rows A to O
        </text>
      ) : null}

      {rows.map((row) => {
        const seat = seats.find((s) => s.row === row)
        return (
          <text
            key={row}
            className="row-label"
            x={-hall.width / 2 + 0.55}
            y={seat.z + 0.11}
            textAnchor="middle"
          >
            {row}
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
            aria-label={`${tier.label}, row ${seat.row}, seat ${seat.number}${seat.status === 'sold' ? ', taken' : ''}`}
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
            <title>{`${tier.label} · row ${seat.row} · seat ${seat.number}${seat.status === 'sold' ? ' (taken)' : ''}`}</title>
          </g>
        )
      })}
    </svg>
  )
}
