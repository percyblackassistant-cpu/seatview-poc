import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const smooth = (t) => t * t * (3 - 2 * t)

function disposeGroup(group) {
  group.traverse((obj) => {
    obj.geometry?.dispose?.()
    const mat = obj.material
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose?.())
    else mat?.dispose?.()
  })
}

function screenTexture(venue) {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 576
  const g = canvas.getContext('2d')
  const grad = g.createLinearGradient(0, 0, 1024, 576)
  grad.addColorStop(0, '#161c2b')
  grad.addColorStop(0.55, '#1e2533')
  grad.addColorStop(1, '#2a1c1e')
  g.fillStyle = grad
  g.fillRect(0, 0, 1024, 576)
  g.textAlign = 'center'
  g.fillStyle = 'rgba(230,185,104,0.94)'
  g.font = '600 44px system-ui, -apple-system, sans-serif'
  g.fillText(venue.screenTitle, 512, 264)
  g.fillStyle = 'rgba(236,232,224,0.6)'
  g.font = '400 22px system-ui, -apple-system, sans-serif'
  g.fillText(venue.screenSub, 512, 308)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

export default class RoomScene {
  constructor(host) {
    this.host = host
    this.venue = null
    this.seat = null
    this.seatId = null
    this.root = null
    this.standing = false
    this.standT = 0
    this.yaw = 0
    this.pitch = 0
    this.fps = 0
    this._frames = 0
    this._fpsAt = 0
    this._dragging = false
    this._px = 0
    this._py = 0
    this._raf = 0
    this._panoUrl = undefined

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color('#0c0d0f')
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.05, 80)

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.35
    this.renderer.domElement.className = 'room-canvas'
    this.renderer.domElement.setAttribute('role', 'img')
    this.renderer.domElement.setAttribute('aria-label', 'Three dimensional view from the selected seat')
    host.appendChild(this.renderer.domElement)

    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this._envRT = pmrem.fromScene(new RoomEnvironment(), 0.04)
    this.scene.environment = this._envRT.texture
    pmrem.dispose()

    this.resize()
    this._ro = new ResizeObserver(() => this.resize())
    this._ro.observe(host)

    this._onDown = this.onPointerDown.bind(this)
    this._onMove = this.onPointerMove.bind(this)
    this._onUp = this.onPointerUp.bind(this)
    const el = this.renderer.domElement
    el.addEventListener('pointerdown', this._onDown)
    el.addEventListener('pointermove', this._onMove)
    el.addEventListener('pointerup', this._onUp)
    el.addEventListener('pointercancel', this._onUp)

    this._tick = this.tick.bind(this)
    this._last = performance.now()
    this._fpsAt = this._last
    this._raf = requestAnimationFrame(this._tick)
  }

  /** Swap the room. Disposes the previous geometry so switching venues stays cheap. */
  setVenue(venue) {
    if (this.root) {
      this.scene.remove(this.root)
      disposeGroup(this.root)
    }
    this.venue = venue
    this.seat = null
    this.seatId = null
    this.standT = 0
    this._panoUrl = undefined
    this.scene.background = new THREE.Color(venue.palette.ceiling)
    this.scene.fog = new THREE.Fog(venue.palette.ceiling, venue.hall.depth * 0.9, venue.hall.depth * 2.4)

    this.root = new THREE.Group()
    this.scene.add(this.root)

    this.buildShell()
    this.buildTiers()
    this.buildStage()
    this.buildLights()
    this.buildSeats()
    this.buildBalcony()
    this.buildMarker()
    this.resize()
  }

  buildShell() {
    const { width, height, depth, frontZ } = this.venue.hall
    const palette = this.venue.palette
    const midZ = frontZ + depth / 2

    const matFloor = new THREE.MeshStandardMaterial({ color: palette.floor, roughness: 0.95, metalness: 0.02 })
    const matWall = new THREE.MeshStandardMaterial({ color: palette.wall, roughness: 0.92 })
    const matCeil = new THREE.MeshStandardMaterial({ color: palette.ceiling, roughness: 1 })

    const floor = new THREE.Mesh(new THREE.BoxGeometry(width, 0.2, depth), matFloor)
    floor.position.set(0, -0.1, midZ)
    floor.receiveShadow = true
    this.root.add(floor)

    const back = new THREE.Mesh(new THREE.PlaneGeometry(width, height), matWall)
    back.position.set(0, height / 2, frontZ + depth)
    back.rotation.y = Math.PI
    back.receiveShadow = true
    this.root.add(back)

    const front = new THREE.Mesh(new THREE.PlaneGeometry(width, height), matWall)
    front.position.set(0, height / 2, frontZ)
    this.root.add(front)

    const left = new THREE.Mesh(new THREE.PlaneGeometry(depth, height), matWall)
    left.position.set(-width / 2, height / 2, midZ)
    left.rotation.y = Math.PI / 2
    left.receiveShadow = true
    this.root.add(left)

    const right = new THREE.Mesh(new THREE.PlaneGeometry(depth, height), matWall)
    right.position.set(width / 2, height / 2, midZ)
    right.rotation.y = -Math.PI / 2
    right.receiveShadow = true
    this.root.add(right)

    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), matCeil)
    ceil.position.set(0, height, midZ)
    ceil.rotation.x = Math.PI / 2
    this.root.add(ceil)

    // Pilasters give the walls vertical rhythm without any texture work.
    const trimMat = new THREE.MeshStandardMaterial({ color: palette.trim, roughness: 0.55, metalness: 0.35 })
    const bays = Math.max(3, Math.round(depth / 3.4))
    for (const side of [-1, 1]) {
      for (let i = 0; i <= bays; i += 1) {
        const z = frontZ + (depth / bays) * i
        const pilaster = new THREE.Mesh(new THREE.BoxGeometry(0.18, height - 1.2, 0.42), trimMat)
        pilaster.position.set(side * (width / 2 - 0.09), (height - 1.2) / 2 + 0.3, z)
        this.root.add(pilaster)
      }
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, depth), trimMat)
      rail.position.set(side * (width / 2 - 0.05), height - 1.1, midZ)
      this.root.add(rail)
    }
  }

  /** Stepped terraces so raked seats sit on real steps instead of floating. */
  buildTiers() {
    const matStep = new THREE.MeshStandardMaterial({ color: this.venue.palette.floor, roughness: 0.95 })
    for (const tier of this.venue.tiers) {
      if (!tier.rake) continue
      const width = tier.footprint + 1.7
      const base = tier.elevation ?? 0
      for (let r = 0; r < tier.rows; r += 1) {
        const top = base + (r + 1) * tier.rake
        const step = new THREE.Mesh(
          new THREE.BoxGeometry(width, top - base, tier.rowPitch + 0.02),
          matStep,
        )
        step.position.set(0, base + (top - base) / 2, tier.firstZ + r * tier.rowPitch + tier.rowPitch / 2)
        step.receiveShadow = true
        this.root.add(step)
      }
    }
  }

  buildStage() {
    const { hall, screen, palette } = this.venue
    const stageZ = hall.frontZ + hall.stageDepth / 2
    const stageFrontZ = hall.frontZ + hall.stageDepth

    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(hall.stageWidth, hall.stageHeight, hall.stageDepth),
      new THREE.MeshStandardMaterial({ color: palette.stage, roughness: 0.86, metalness: 0.04 }),
    )
    deck.position.set(0, hall.stageHeight / 2, stageZ)
    deck.receiveShadow = true
    this.root.add(deck)

    const screenPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(screen.width, screen.height),
      new THREE.MeshBasicMaterial({ map: screenTexture(this.venue) }),
    )
    screenPlane.position.set(0, screen.centreY, screen.z)
    this.root.add(screenPlane)

    // Black masking behind the screen, so the stage void does not read as a hole.
    const masking = new THREE.Mesh(
      new THREE.PlaneGeometry(screen.width + 3.4, screen.height + 3.0),
      new THREE.MeshStandardMaterial({ color: '#0d0b0a', roughness: 1 }),
    )
    masking.position.set(0, screen.centreY + 0.3, screen.z - 0.04)
    this.root.add(masking)

    const trimMat = new THREE.MeshStandardMaterial({ color: palette.trim, roughness: 0.5, metalness: 0.4 })
    const wallMat = new THREE.MeshStandardMaterial({ color: palette.wall, roughness: 0.92 })
    if (palette.proscenium) {
      const openingHalf = screen.width / 2 + 0.9
      const towerWidth = Math.max(0.6, hall.width / 2 - openingHalf)
      const archHeight = screen.centreY + screen.height / 2 + 1.0
      for (const side of [-1, 1]) {
        const tower = new THREE.Mesh(new THREE.BoxGeometry(towerWidth, archHeight, 0.7), wallMat)
        tower.position.set(side * (openingHalf + towerWidth / 2), archHeight / 2, stageFrontZ)
        tower.castShadow = true
        this.root.add(tower)

        const edge = new THREE.Mesh(new THREE.BoxGeometry(0.18, archHeight, 0.8), trimMat)
        edge.position.set(side * (openingHalf + 0.09), archHeight / 2, stageFrontZ)
        this.root.add(edge)
      }
      const header = new THREE.Mesh(
        new THREE.BoxGeometry(hall.width, hall.height - archHeight, 0.7),
        wallMat,
      )
      header.position.set(0, archHeight + (hall.height - archHeight) / 2, stageFrontZ)
      this.root.add(header)

      const band = new THREE.Mesh(new THREE.BoxGeometry(openingHalf * 2 + 0.36, 0.16, 0.82), trimMat)
      band.position.set(0, archHeight, stageFrontZ)
      this.root.add(band)
    }

    if (palette.curtain) {
      const curtainMat = new THREE.MeshStandardMaterial({ color: palette.curtain, roughness: 0.95 })
      const openingHalf = screen.width / 2 + 0.8
      for (const side of [-1, 1]) {
        const drape = new THREE.Mesh(new THREE.BoxGeometry(1.1, screen.height + 2.2, 0.22), curtainMat)
        drape.position.set(
          side * (openingHalf - 0.45),
          hall.stageHeight + (screen.height + 2.2) / 2,
          stageFrontZ - 0.2,
        )
        this.root.add(drape)
      }
      const valance = new THREE.Mesh(new THREE.BoxGeometry(openingHalf * 2, 0.6, 0.32), curtainMat)
      valance.position.set(0, hall.stageHeight + screen.height + 2.0, stageFrontZ - 0.2)
      this.root.add(valance)
    }

    if (palette.chandelier) {
      const hangY = hall.height - 1.7
      const chandelier = new THREE.Group()
      const gold = new THREE.MeshStandardMaterial({
        color: palette.chandelier,
        emissive: new THREE.Color(palette.chandelier),
        emissiveIntensity: 0.5,
        roughness: 0.35,
        metalness: 0.7,
      })
      chandelier.add(new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 16), gold))
      const stemHeight = Math.max(0.4, hall.height - hangY - 0.55)
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, stemHeight, 8), gold)
      stem.position.set(0, 0.55 + stemHeight / 2, 0)
      chandelier.add(stem)
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.06, 10, 48), gold)
      ring.rotation.x = Math.PI / 2
      chandelier.add(ring)
      for (let i = 0; i < 12; i += 1) {
        const a = (i / 12) * Math.PI * 2
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), gold)
        bulb.position.set(Math.cos(a) * 1.05, 0.16, Math.sin(a) * 1.05)
        chandelier.add(bulb)
      }
      chandelier.position.set(0, hangY, hall.frontZ + hall.depth * 0.42)
      this.root.add(chandelier)
    }
  }

  buildLights() {
    const { hall, palette } = this.venue
    const warm = palette.chandelier ? '#ffe6bd' : '#fff2dc'

    this.root.add(new THREE.AmbientLight('#ffffff', 0.26))
    this.root.add(new THREE.HemisphereLight('#b9c9e0', '#2a2118', 0.55))

    const key = new THREE.DirectionalLight(warm, 1.9)
    key.position.set(hall.width * 0.22, hall.height * 0.8, hall.depth * 0.3)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    const span = Math.max(hall.width, hall.depth) * 0.6
    key.shadow.camera.left = -span
    key.shadow.camera.right = span
    key.shadow.camera.top = span
    key.shadow.camera.bottom = -span
    key.shadow.camera.near = 0.5
    key.shadow.camera.far = hall.depth * 2.5
    key.shadow.bias = -0.0007
    key.target.position.set(0, 0, hall.frontZ + hall.depth * 0.45)
    this.root.add(key)
    this.root.add(key.target)

    const stageLight = new THREE.SpotLight('#ffd7a1', 320, hall.depth * 1.5, 0.9, 0.6, 2)
    stageLight.position.set(0, hall.height - 0.4, hall.frontZ + hall.stageDepth)
    stageLight.target.position.set(0, hall.stageHeight, hall.frontZ + hall.stageDepth * 0.4)
    this.root.add(stageLight)
    this.root.add(stageLight.target)

    if (palette.chandelier) {
      const lamp = new THREE.PointLight(warm, 170, hall.depth * 0.9, 2)
      lamp.position.set(0, hall.height - 1.7, hall.frontZ + hall.depth * 0.5)
      this.root.add(lamp)
    }
  }

  buildSeats() {
    const seats = this.venue.seats
    const count = seats.length

    const cushionGeo = new THREE.BoxGeometry(0.5, 0.11, 0.46)
    const backGeo = new THREE.BoxGeometry(0.5, 0.56, 0.09)
    const baseGeo = new THREE.BoxGeometry(0.44, 0.34, 0.36)

    const fabric = () => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.82, metalness: 0.02 })
    const frameMat = new THREE.MeshStandardMaterial({ color: '#1b1917', roughness: 0.55, metalness: 0.3 })

    this.cushions = new THREE.InstancedMesh(cushionGeo, fabric(), count)
    this.backs = new THREE.InstancedMesh(backGeo, fabric(), count)
    this.bases = new THREE.InstancedMesh(baseGeo, frameMat, count)
    this.seatIndex = new Map()

    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const one = new THREE.Vector3(1, 1, 1)
    const t = new THREE.Vector3()

    seats.forEach((seat, i) => {
      this.seatIndex.set(seat.id, i)
      t.set(seat.x, seat.floor + 0.44, seat.z)
      this.cushions.setMatrixAt(i, m.compose(t, q, one))
      t.set(seat.x, seat.floor + 0.745, seat.z + 0.19)
      this.backs.setMatrixAt(i, m.compose(t, q, one))
      t.set(seat.x, seat.floor + 0.17, seat.z + 0.02)
      this.bases.setMatrixAt(i, m.compose(t, q, one))
    })

    for (const mesh of [this.cushions, this.backs, this.bases]) {
      mesh.castShadow = true
      mesh.receiveShadow = true
      this.root.add(mesh)
    }

    this.updateSeatColors()
  }

  updateSeatColors() {
    if (!this.cushions || !this.venue) return
    const palette = this.venue.palette
    const available = new THREE.Color(palette.seat)
    const sold = new THREE.Color(palette.seatSold)
    const accent = new THREE.Color(palette.accent)
    const tmp = new THREE.Color()
    this.venue.seats.forEach((seat, i) => {
      tmp.copy(seat.status === 'sold' ? sold : seat.id === this.seatId ? accent : available)
      this.cushions.setColorAt(i, tmp)
      this.backs.setColorAt(i, tmp)
    })
    this.cushions.instanceColor.needsUpdate = true
    this.backs.instanceColor.needsUpdate = true
  }

  buildBalcony() {
    const raised = this.venue.tiers.filter((tier) => (tier.elevation ?? 0) > 0)
    if (!raised.length) return
    const tier = raised[0]
    const palette = this.venue.palette
    const backZ = this.venue.hall.frontZ + this.venue.hall.depth
    const frontZ = tier.firstZ - 1.0
    const depth = Math.max(2, backZ - frontZ - 0.3)
    const width = Math.min(this.venue.hall.width - 0.8, tier.footprint + 3.2)

    const mat = new THREE.MeshStandardMaterial({ color: palette.balcony ?? palette.floor, roughness: 0.9 })
    const slab = new THREE.Mesh(new THREE.BoxGeometry(width, 0.36, depth), mat)
    slab.position.set(0, tier.elevation - 0.18, frontZ + depth / 2)
    slab.receiveShadow = true
    this.root.add(slab)

    const trimMat = new THREE.MeshStandardMaterial({ color: palette.trim, roughness: 0.5, metalness: 0.45 })
    const panel = new THREE.Mesh(new THREE.BoxGeometry(width, 0.72, 0.14), mat)
    panel.position.set(0, tier.elevation + 0.36, frontZ + 0.08)
    this.root.add(panel)

    const rail = new THREE.Mesh(new THREE.BoxGeometry(width, 0.09, 0.16), trimMat)
    rail.position.set(0, tier.elevation + 0.76, frontZ + 0.08)
    this.root.add(rail)

    for (const side of [-1, 1]) {
      const returnPanel = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.72, depth), mat)
      returnPanel.position.set(side * (width / 2 - 0.07), tier.elevation + 0.36, frontZ + depth / 2)
      this.root.add(returnPanel)
    }
  }

  buildMarker() {
    const mat = new THREE.MeshBasicMaterial({
      color: this.venue.palette.accent,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    })
    this.marker = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.44, 48), mat)
    this.marker.rotation.x = -Math.PI / 2
    this.marker.visible = false
    this.root.add(this.marker)
  }

  setSeatById(id) {
    if (!this.venue) return
    const seat = this.venue.seatsById.get(id)
    if (!seat) return
    this.seat = seat
    this.seatId = id
    this.updateSeatColors()
    this.marker.position.set(seat.x, seat.floor + 0.012, seat.z)
    this.marker.visible = true
    this.applyPanorama(seat)
    this.aimAtScreen()
  }

  setStanding(on) {
    this.standing = Boolean(on)
  }

  resetLook() {
    this.aimAtScreen()
  }

  /**
   * Landing on a seat should feel like sitting down and looking at the screen,
   * not staring at a blank wall: aim from the eye point at the screen centre.
   */
  aimAtScreen() {
    if (!this.seat || !this.venue) return
    const eye = this.seat.floor + this.eyeHeight(this.standT)
    const { screen } = this.venue
    const dx = 0 - this.seat.x
    const dy = screen.centreY - eye
    const dz = screen.z - this.seat.z
    this.yaw = Math.atan2(dx, -dz)
    this.pitch = clamp(Math.atan2(dy, Math.hypot(dx, dz)), -1.15, 1.15)
    this.placeCamera()
  }

  eyeHeight(t) {
    const { eyeSeated, eyeStanding } = this.venue
    return eyeSeated + (eyeStanding - eyeSeated) * smooth(t)
  }

  placeCamera() {
    if (!this.seat || !this.venue) return
    const eye = this.seat.floor + this.eyeHeight(this.standT)
    const { x, z } = this.seat
    this.camera.position.set(x, eye, z)
    const cp = Math.cos(this.pitch)
    const dx = Math.sin(this.yaw) * cp
    const dy = Math.sin(this.pitch)
    const dz = -Math.cos(this.yaw) * cp
    this.camera.lookAt(x + dx, eye + dy, z + dz)
  }

  applyPanorama(seat) {
    if (seat.panorama === this._panoUrl) return
    this._panoUrl = seat.panorama
    if (!seat.panorama) {
      if (this.root) this.root.visible = true
      this.scene.background = new THREE.Color(this.venue.palette.ceiling)
      return
    }
    new THREE.TextureLoader().load(
      new URL(seat.panorama, document.baseURI).href,
      (tex) => {
        tex.mapping = THREE.EquirectangularReflectionMapping
        tex.colorSpace = THREE.SRGBColorSpace
        this.scene.background = tex
        this.root.visible = false
      },
      undefined,
      () => {
        this._panoUrl = undefined
      },
    )
  }

  onPointerDown(e) {
    this._dragging = true
    this._px = e.clientX
    this._py = e.clientY
    try {
      this.renderer.domElement.setPointerCapture?.(e.pointerId)
    } catch {
      /* synthetic pointer events have no capture target */
    }
    this.renderer.domElement.classList.add('is-grabbing')
  }

  onPointerMove(e) {
    if (!this._dragging) return
    const dx = e.clientX - this._px
    const dy = e.clientY - this._py
    this._px = e.clientX
    this._py = e.clientY
    this.yaw += dx * 0.0035
    this.pitch = clamp(this.pitch - dy * 0.0035, -1.15, 1.15)
    this.placeCamera()
  }

  onPointerUp(e) {
    if (!this._dragging) return
    this._dragging = false
    try {
      this.renderer.domElement.releasePointerCapture?.(e.pointerId)
    } catch {
      /* nothing captured */
    }
    this.renderer.domElement.classList.remove('is-grabbing')
  }

  resize() {
    const w = this.host.clientWidth
    const h = this.host.clientHeight
    if (!w || !h) return
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  tick(now) {
    this._raf = requestAnimationFrame(this._tick)
    const dt = Math.min(0.1, (now - this._last) / 1000)
    this._last = now

    const target = this.standing ? 1 : 0
    if (Math.abs(this.standT - target) > 0.0005) {
      const step = dt / 0.45
      this.standT = target > this.standT ? Math.min(target, this.standT + step) : Math.max(target, this.standT - step)
      this.placeCamera()
    }

    this.renderer.render(this.scene, this.camera)

    this._frames += 1
    if (now - this._fpsAt >= 500) {
      this.fps = Math.round((this._frames * 1000) / (now - this._fpsAt))
      this._frames = 0
      this._fpsAt = now
    }
  }

  dispose() {
    cancelAnimationFrame(this._raf)
    this._ro?.disconnect()
    const el = this.renderer.domElement
    el.removeEventListener('pointerdown', this._onDown)
    el.removeEventListener('pointermove', this._onMove)
    el.removeEventListener('pointerup', this._onUp)
    el.removeEventListener('pointercancel', this._onUp)
    if (this.root) disposeGroup(this.root)
    this._envRT?.dispose?.()
    this.renderer.dispose()
    el.remove()
  }
}
