import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { ROOM, ROOM_BACK_Z, ROOM_FRONT_Z, SEAT_BY_ID, SEATS } from '../data/room.js'

const ACCENT = new THREE.Color('#e6b24a')
const AVAILABLE = new THREE.Color('#7d3038')
const SOLD = new THREE.Color('#3c4046')

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const smooth = (t) => t * t * (3 - 2 * t)

export default class RoomScene {
  constructor(host) {
    this.host = host
    this.seat = null
    this.seatId = null
    this.standing = false
    this.standT = 0
    this.yaw = 0
    this.pitch = -0.05
    this.fps = 0
    this._frames = 0
    this._fpsAt = 0
    this._dragging = false
    this._px = 0
    this._py = 0
    this._raf = 0
    this._panoUrl = undefined

    this.frontZ = ROOM_FRONT_Z
    this.backZ = ROOM_BACK_Z
    const depth = this.backZ - this.frontZ
    const midZ = (this.backZ + this.frontZ) / 2

    this.scene = new THREE.Scene()
    this._bg = new THREE.Color('#0c0d0f')
    this.scene.background = this._bg
    this.scene.fog = new THREE.Fog('#0c0d0f', 17, 34)

    this.camera = new THREE.PerspectiveCamera(72, 1, 0.05, 60)

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.32
    this.renderer.domElement.className = 'room-canvas'
    this.renderer.domElement.setAttribute('aria-label', 'Three dimensional view from the selected seat')
    this.renderer.domElement.setAttribute('role', 'img')
    host.appendChild(this.renderer.domElement)

    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this._envRT = pmrem.fromScene(new RoomEnvironment(), 0.04)
    this.scene.environment = this._envRT.texture
    pmrem.dispose()

    this.room = new THREE.Group()
    this.scene.add(this.room)

    this.buildShell(depth, midZ)
    this.buildStage()
    this.buildLights()
    this.buildSeats()
    this.buildMarker()

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

  buildShell(depth, midZ) {
    const w = ROOM.width
    const h = ROOM.height

    const matFloor = new THREE.MeshStandardMaterial({ color: '#2b2521', roughness: 0.94, metalness: 0.03 })
    const matWall = new THREE.MeshStandardMaterial({ color: '#3a352f', roughness: 0.96 })
    const matCeil = new THREE.MeshStandardMaterial({ color: '#211f1d', roughness: 1 })

    const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, depth), matFloor)
    floor.position.set(0, -0.1, midZ)
    floor.receiveShadow = true
    this.room.add(floor)

    const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), matWall)
    back.position.set(0, h / 2, this.backZ)
    back.rotation.y = Math.PI
    this.room.add(back)

    const front = new THREE.Mesh(new THREE.PlaneGeometry(w, h), matWall)
    front.position.set(0, h / 2, this.frontZ)
    this.room.add(front)

    const left = new THREE.Mesh(new THREE.PlaneGeometry(depth, h), matWall)
    left.position.set(-w / 2, h / 2, midZ)
    left.rotation.y = Math.PI / 2
    this.room.add(left)

    const right = new THREE.Mesh(new THREE.PlaneGeometry(depth, h), matWall)
    right.position.set(w / 2, h / 2, midZ)
    right.rotation.y = -Math.PI / 2
    this.room.add(right)

    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, depth), matCeil)
    ceil.position.set(0, h, midZ)
    ceil.rotation.x = Math.PI / 2
    this.room.add(ceil)

    const coveMat = new THREE.MeshBasicMaterial({ color: '#ffe6bd' })
    for (const x of [-2.4, 2.4]) {
      const cove = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, depth * 0.42), coveMat)
      cove.position.set(x, h - 0.07, midZ + 1.6)
      this.room.add(cove)
    }
  }

  buildStage() {
    const s = ROOM.stage
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(s.width, s.height, s.depth),
      new THREE.MeshStandardMaterial({ color: '#332c26', roughness: 0.86, metalness: 0.04 }),
    )
    deck.position.set(0, s.height / 2, s.zFront - s.depth / 2)
    deck.receiveShadow = true
    this.room.add(deck)

    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 576
    const g = canvas.getContext('2d')
    const grad = g.createLinearGradient(0, 0, 1024, 576)
    grad.addColorStop(0, '#151b2b')
    grad.addColorStop(0.55, '#1d2433')
    grad.addColorStop(1, '#2b1d20')
    g.fillStyle = grad
    g.fillRect(0, 0, 1024, 576)
    g.textAlign = 'center'
    g.fillStyle = 'rgba(230,178,74,0.9)'
    g.font = '600 38px system-ui, -apple-system, sans-serif'
    g.fillText('STUDIO  HALL', 512, 264)
    g.fillStyle = 'rgba(232,230,225,0.55)'
    g.font = '400 22px system-ui, -apple-system, sans-serif'
    g.fillText('one hundred seats, one screen', 512, 308)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4

    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(4.6, 2.6),
      new THREE.MeshBasicMaterial({ map: tex }),
    )
    screen.position.set(0, 2.3, this.frontZ + 0.09)
    this.room.add(screen)

    const lectern = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 1.02, 0.44),
      new THREE.MeshStandardMaterial({ color: '#4a3f35', roughness: 0.72 }),
    )
    lectern.position.set(-1.7, s.height + 0.51, s.zFront - 1.15)
    lectern.castShadow = true
    this.room.add(lectern)

    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(s.width, 0.03, 0.045),
      new THREE.MeshBasicMaterial({ color: '#b8893a' }),
    )
    strip.position.set(0, s.height - 0.03, s.zFront + 0.02)
    this.room.add(strip)
  }

  buildLights() {
    this.scene.add(new THREE.AmbientLight('#ffffff', 0.3))
    this.scene.add(new THREE.HemisphereLight('#a9c0e0', '#2a2118', 0.72))

    const key = new THREE.DirectionalLight('#fff2dc', 2.1)
    key.position.set(3.6, 7.4, 2.2)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.camera.left = -8
    key.shadow.camera.right = 8
    key.shadow.camera.top = 9
    key.shadow.camera.bottom = -9
    key.shadow.camera.near = 0.5
    key.shadow.camera.far = 26
    key.shadow.bias = -0.0006
    key.target.position.set(0, 0, -1.5)
    this.scene.add(key)
    this.scene.add(key.target)

    const stageLight = new THREE.SpotLight('#ffd7a1', 260, 18, 0.85, 0.55, 2)
    stageLight.position.set(0, ROOM.height - 0.25, -6.4)
    stageLight.target.position.set(0, 0.4, -8.8)
    this.scene.add(stageLight)
    this.scene.add(stageLight.target)
  }

  buildSeats() {
    const count = SEATS.length
    const cushionGeo = new THREE.BoxGeometry(0.5, 0.11, 0.46)
    const backGeo = new THREE.BoxGeometry(0.5, 0.56, 0.09)
    const baseGeo = new THREE.BoxGeometry(0.44, 0.36, 0.36)

    const fabric = () =>
      new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, metalness: 0.02 })
    const frameMat = new THREE.MeshStandardMaterial({ color: '#1b1917', roughness: 0.55, metalness: 0.3 })

    this.cushions = new THREE.InstancedMesh(cushionGeo, fabric(), count)
    this.backs = new THREE.InstancedMesh(backGeo, fabric(), count)
    this.bases = new THREE.InstancedMesh(baseGeo, frameMat, count)
    this.seatIndex = new Map()

    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const one = new THREE.Vector3(1, 1, 1)
    const t = new THREE.Vector3()

    SEATS.forEach((seat, i) => {
      this.seatIndex.set(seat.id, i)
      t.set(seat.x, 0.44, seat.z)
      this.cushions.setMatrixAt(i, m.compose(t, q, one))
      t.set(seat.x, 0.745, seat.z + 0.19)
      this.backs.setMatrixAt(i, m.compose(t, q, one))
      t.set(seat.x, 0.19, seat.z + 0.02)
      this.bases.setMatrixAt(i, m.compose(t, q, one))
    })

    for (const mesh of [this.cushions, this.backs, this.bases]) {
      mesh.castShadow = true
      mesh.receiveShadow = true
      this.room.add(mesh)
    }

    this.updateSeatColors()
  }

  updateSeatColors() {
    if (!this.cushions) return
    const tmp = new THREE.Color()
    SEATS.forEach((seat, i) => {
      tmp.copy(seat.status === 'sold' ? SOLD : seat.id === this.seatId ? ACCENT : AVAILABLE)
      this.cushions.setColorAt(i, tmp)
      this.backs.setColorAt(i, tmp)
    })
    this.cushions.instanceColor.needsUpdate = true
    this.backs.instanceColor.needsUpdate = true
  }

  buildMarker() {
    const mat = new THREE.MeshBasicMaterial({
      color: '#e6b24a',
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    })
    this.marker = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.44, 48), mat)
    this.marker.rotation.x = -Math.PI / 2
    this.marker.visible = false
    this.room.add(this.marker)
  }

  setSeatById(id) {
    const seat = SEAT_BY_ID.get(id)
    if (!seat) return
    this.seat = seat
    this.seatId = id
    this.updateSeatColors()
    this.marker.position.set(seat.x, 0.012, seat.z)
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
    if (!this.seat) return
    const eye = ROOM.eyeSeated + (ROOM.eyeStanding - ROOM.eyeSeated) * smooth(this.standT)
    const dx = 0 - this.seat.x
    const dy = 2.3 - eye
    const dz = this.frontZ + 0.09 - this.seat.z
    this.yaw = Math.atan2(dx, -dz)
    this.pitch = clamp(Math.atan2(dy, Math.hypot(dx, dz)), -1.15, 1.15)
    this.placeCamera()
  }

  placeCamera() {
    if (!this.seat) return
    const eye = ROOM.eyeSeated + (ROOM.eyeStanding - ROOM.eyeSeated) * smooth(this.standT)
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
      this.room.visible = true
      this.scene.background = this._bg
      return
    }
    new THREE.TextureLoader().load(
      new URL(seat.panorama, document.baseURI).href,
      (tex) => {
        tex.mapping = THREE.EquirectangularReflectionMapping
        tex.colorSpace = THREE.SRGBColorSpace
        this.scene.background = tex
        this.room.visible = false
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
    this.scene.traverse((obj) => {
      obj.geometry?.dispose?.()
      const mat = obj.material
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose?.())
      else mat?.dispose?.()
    })
    this._envRT?.dispose?.()
    this.renderer.dispose()
    el.remove()
  }
}
