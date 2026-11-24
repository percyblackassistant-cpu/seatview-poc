import { useEffect, useRef, useState } from 'react'
import { ROOM, SEATS, SEAT_BY_ID } from './data/room.js'
import SeatMap from './components/SeatMap.jsx'
import RoomScene from './three/RoomScene.js'

const DEFAULT_SEAT = 'E5'

export default function App() {
  const [selectedId, setSelectedId] = useState(DEFAULT_SEAT)
  const [standing, setStanding] = useState(false)
  const [fps, setFps] = useState(0)
  const [ready, setReady] = useState(false)
  const hostRef = useRef(null)
  const sceneRef = useRef(null)
  const viewRef = useRef(null)

  useEffect(() => {
    const scene = new RoomScene(hostRef.current)
    sceneRef.current = scene
    scene.setSeatById(DEFAULT_SEAT)
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

  const chooseSeat = (id) => {
    setSelectedId(id)
    sceneRef.current?.setSeatById(id)
    if (window.matchMedia('(max-width: 940px)').matches) {
      viewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  useEffect(() => {
    if (!ready) return
    sceneRef.current?.setStanding(standing)
  }, [standing, ready])

  const seat = SEAT_BY_ID.get(selectedId) ?? SEAT_BY_ID.get(DEFAULT_SEAT)
  const free = SEATS.filter((s) => s.status === 'available').length
  const eye = standing ? ROOM.eyeStanding : ROOM.eyeSeated

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">Seat preview</p>
          <h1>{ROOM.name}</h1>
          <p className="sub">Pick a seat on the plan, then look around the room from it.</p>
        </div>
        <div className="readouts">
          <span>
            {free} of {SEATS.length} seats free
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
          <div className="map-frame">
            <SeatMap seats={SEATS} selectedId={selectedId} onSelect={chooseSeat} />
          </div>
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
                Look at stage
              </button>
            </div>
          </div>

          <div className="view-frame">
            <div className="canvas-host" ref={hostRef} />
            <div className="view-badge">
              <strong>
                Row {seat.row} · seat {seat.number}
              </strong>
              <span>eye height {eye.toFixed(2)} m</span>
            </div>
            <div className="view-hint">drag to look around</div>
          </div>

          <p className="fineprint">
            These views come from the room geometry, so standing up genuinely changes how much of the stage
            clears the row in front. A 360 capture for a seat can replace its rendered view later without
            touching this UI.
          </p>
        </section>
      </main>
    </div>
  )
}
