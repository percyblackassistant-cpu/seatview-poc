import { useEffect, useRef, useState } from 'react'
import { DEFAULT_VENUE_ID, VENUES, VENUE_BY_ID } from './data/venues.js'
import SeatMap from './components/SeatMap.jsx'
import RoomScene from './three/RoomScene.js'

function readHash() {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  return { venue: params.get('venue'), seat: params.get('seat') }
}

function middleSeat(venue, tierId) {
  const tier = venue.tiers.find((t) => t.id === tierId) ?? venue.tiers[0]
  const inTier = venue.seats.filter((seat) => seat.tier === tier.id && seat.status !== 'sold')
  const midRow = Math.floor(tier.rows * 0.4)
  const rowSeats = inTier.filter((seat) => seat.rowIndex === midRow)
  const pool = rowSeats.length ? rowSeats : inTier
  return pool[Math.floor(pool.length / 2)]?.id
}

function initialVenue() {
  const fromHash = VENUE_BY_ID.get(readHash().venue)
  return fromHash ?? VENUE_BY_ID.get(DEFAULT_VENUE_ID)
}

const firstVenue = initialVenue()
const hashSeat = readHash().seat
const initialSeat = firstVenue.seatsById.has(hashSeat) ? hashSeat : middleSeat(firstVenue)

export default function App() {
  const [venueId, setVenueId] = useState(firstVenue.id)
  const [tierId, setTierId] = useState(firstVenue.tiers[0].id)
  const [selectedId, setSelectedId] = useState(initialSeat)
  const [standing, setStanding] = useState(false)
  const [fps, setFps] = useState(0)
  const [ready, setReady] = useState(false)
  const hostRef = useRef(null)
  const sceneRef = useRef(null)
  const viewRef = useRef(null)

  const venue = VENUE_BY_ID.get(venueId) ?? firstVenue
  const tier = venue.tiers.find((t) => t.id === tierId) ?? venue.tiers[0]
  const seat = venue.seatsById.get(selectedId) ?? venue.seatsById.get(middleSeat(venue))

  useEffect(() => {
    const scene = new RoomScene(hostRef.current)
    sceneRef.current = scene
    setReady(true)
    if (import.meta.env.DEV) window.__seatview = scene
    const poll = window.setInterval(() => setFps(scene.fps), 1000)
    return () => {
      window.clearInterval(poll)
      scene.dispose()
      sceneRef.current = null
      if (import.meta.env.DEV) delete window.__seatview
    }
  }, [])

  // Build the room whenever the venue changes, then land on a sensible seat.
  useEffect(() => {
    if (!ready) return
    const scene = sceneRef.current
    const next = VENUE_BY_ID.get(venueId)
    if (!scene || !next) return
    scene.setVenue(next)
    document.title = `${next.room} · ${next.name}`
    const wanted = readHash().seat
    const seatId = next.seatsById.has(wanted) ? wanted : middleSeat(next, next.tiers[0].id)
    setTierId(next.seatsById.get(seatId)?.tier ?? next.tiers[0].id)
    setSelectedId(seatId)
    scene.setSeatById(seatId)
    scene.setStanding(false)
    setStanding(false)
  }, [venueId, ready])

  const chooseSeat = (id) => {
    setSelectedId(id)
    sceneRef.current?.setSeatById(id)
    const chosen = venue.seatsById.get(id)
    if (chosen) setTierId(chosen.tier)
    if (window.matchMedia('(max-width: 940px)').matches) {
      viewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  useEffect(() => {
    if (!ready) return
    sceneRef.current?.setStanding(standing)
  }, [standing, ready])

  useEffect(() => {
    if (!seat) return
    const hash = `#venue=${venue.id}&seat=${seat.id}`
    if (window.location.hash !== hash) {
      window.history.replaceState(null, '', hash)
    }
  }, [venue.id, seat])

  // Links shared while the app is already open change only the hash.
  useEffect(() => {
    const onHash = () => {
      const next = readHash()
      const targetVenue = VENUE_BY_ID.get(next.venue)
      if (targetVenue && targetVenue.id !== venueId) {
        setVenueId(targetVenue.id)
        return
      }
      if (next.seat && venue.seatsById.has(next.seat) && next.seat !== selectedId) {
        chooseSeat(next.seat)
      }
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [venueId, selectedId, venue])

  if (!seat) return null

  const free = venue.seats.filter((s) => s.status === 'available').length
  const eyeSeat = (standing ? venue.eyeStanding : venue.eyeSeated).toFixed(2)

  return (
    <div className="app">
      <header className="topbar">
        <div className="title-block">
          <p className="eyebrow">Seat preview</p>
          <h1>{venue.name}</h1>
          <p className="sub">
            {venue.room} · {venue.city}
          </p>
          <div className="venue-switch" role="tablist" aria-label="Venue">
            {VENUES.map((v) => (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={v.id === venue.id}
                className={v.id === venue.id ? 'chip chip--on' : 'chip'}
                onClick={() => setVenueId(v.id)}
              >
                {v.id === 'urania' ? 'Uránia, Budapest' : 'Studio Hall demo'}
              </button>
            ))}
          </div>
        </div>
        <div className="readouts">
          <span>
            {free} of {venue.seats.length} seats free
          </span>
          <span className={fps >= 55 ? 'fps is-good' : 'fps'}>{fps || '--'} fps</span>
        </div>
      </header>

      <main className="layout">
        <section className="panel map-panel" aria-labelledby="plan-heading">
          <div className="panel-head">
            <h2 id="plan-heading">Seating plan</h2>
            <span className="muted">tap a seat</span>
          </div>

          {venue.tiers.length > 1 ? (
            <div className="tier-tabs" role="tablist" aria-label="Level">
              {venue.tiers.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={t.id === tier.id}
                  className={t.id === tier.id ? 'chip chip--on' : 'chip'}
                  onClick={() => setTierId(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          ) : null}

          <div className="map-frame">
            <SeatMap venue={venue} tier={tier} selectedId={selectedId} onSelect={chooseSeat} />
          </div>

          <p className="tier-note">{tier.note}</p>

          <ul className="legend">
            <li>
              <i className="swatch swatch--free" /> free
            </li>
            <li>
              <i className="swatch swatch--chosen" /> your seat
            </li>
            <li>
              <i className="swatch swatch--taken" /> taken
            </li>
          </ul>
        </section>

        <section className="panel view-panel" aria-labelledby="view-heading" ref={viewRef}>
          <div className="panel-head">
            <h2 id="view-heading">Your view</h2>
            <div className="controls">
              <button
                type="button"
                className="btn"
                onClick={() => setStanding((v) => !v)}
                aria-pressed={standing}
              >
                {standing ? 'Sit down' : 'Stand up'}
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => sceneRef.current?.resetLook()}
              >
                Look at screen
              </button>
            </div>
          </div>

          <div className="view-frame">
            <div className="canvas-host" ref={hostRef} />
            <div className="view-badge">
              <strong>
                {seat.tierLabel} · row {seat.row} · seat {seat.number}
              </strong>
              <span>
                eye {eyeSeat} m over the seat floor
                {seat.floor > 0.2 ? ` · floor ${seat.floor.toFixed(2)} m up` : ''}
              </span>
            </div>
            <div className="view-hint">drag to look around</div>
          </div>

          <p className="fineprint">{venue.provenance}</p>
        </section>
      </main>
    </div>
  )
}
