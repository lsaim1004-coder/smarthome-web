import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { Geometry, PlacedDevice } from './types'
import { styleOf } from './types'

/**
 * 2D 로 그린 구조를 그대로 세운 3D 뷰.
 *
 * 같은 데이터를 쓴다 — 벽을 고치면 여기도 바뀐다. 따로 모델링하지 않는다.
 * 문·창은 벽을 잘라 만든다(위 인방 · 창 아래 허리벽). 그래야 시공 검토에서
 * "스위치가 문에 걸리는지" 같은 것이 눈으로 보인다.
 *
 * 좌표 변환: 비율 x → 미터 x, 비율 y → 미터 z. 높이가 y 축이다.
 */
export default function PlanView3D({
  geometry,
  devices,
  wallHeightMm,
  mmPerUnitX,
  mmPerUnitY,
  showLabels,
}: {
  geometry: Geometry
  devices: PlacedDevice[]
  wallHeightMm: number
  mmPerUnitX: number
  mmPerUnitY: number
  showLabels: boolean
}) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#eef1f6')

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    host.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.maxPolarAngle = Math.PI / 2.05   // 바닥 아래로는 못 내려가게

    scene.add(new THREE.AmbientLight(0xffffff, 0.75))
    const sun = new THREE.DirectionalLight(0xffffff, 1.1)
    sun.position.set(6, 12, 8)
    scene.add(sun)

    const H = wallHeightMm / 1000
    const toX = (v: number) => (v * mmPerUnitX) / 1000
    const toZ = (v: number) => (v * mmPerUnitY) / 1000

    const group = new THREE.Group()
    scene.add(group)

    const labelSprites: THREE.Sprite[] = []

    // ---- 바닥 (방 다각형) ----
    const floorMat = new THREE.MeshLambertMaterial({ color: '#d8dee9', side: THREE.DoubleSide })
    for (const r of geometry.rooms) {
      if (r.points.length < 3) continue
      const shape = new THREE.Shape()
      r.points.forEach(([x, y], i) => {
        const px = toX(x)
        const pz = toZ(y)
        if (i === 0) shape.moveTo(px, pz)
        else shape.lineTo(px, pz)
      })
      shape.closePath()
      // 얇은 면은 보는 각도에 따라 사라진다. 살짝 두께를 줘 바닥이 늘 보이게 한다.
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false })
      const mesh = new THREE.Mesh(geo, floorMat)
      mesh.rotation.x = Math.PI / 2
      mesh.position.y = 0.04
      group.add(mesh)

      // 방 이름을 바닥 위에 띄운다. 고객에게 보여 줄 때 이게 없으면 설명이 안 된다.
      if (showLabels && r.name) {
        const cx = r.points.reduce((n, pt) => n + toX(pt[0]), 0) / r.points.length
        const cz = r.points.reduce((n, pt) => n + toZ(pt[1]), 0) / r.points.length
        const tag = makeLabel(r.name, '#2a78d6')
        tag.scale.multiplyScalar(1.5)
        tag.position.set(cx, 0.55, cz)
        group.add(tag)
        labelSprites.push(tag)
      }
    }

    // ---- 벽 (문·창을 빼고 조각으로) ----
    const wallMat = new THREE.MeshLambertMaterial({ color: '#f5f6f8' })
    const edgeMat = new THREE.LineBasicMaterial({ color: '#9aa4b2' })

    for (const w of geometry.walls) {
      const ax = toX(w.x1)
      const az = toZ(w.y1)
      const bx = toX(w.x2)
      const bz = toZ(w.y2)
      const len = Math.hypot(bx - ax, bz - az)
      if (len < 0.05) continue
      const angle = Math.atan2(bz - az, bx - ax)
      const t = (w.thicknessMm || 150) / 1000

      /** 벽을 따라 [from, to] 구간을, 높이 [y0, y1] 로 세운다. */
      const slab = (from: number, to: number, y0: number, y1: number) => {
        const segLen = to - from
        const segH = y1 - y0
        if (segLen <= 0.01 || segH <= 0.01) return
        const geo = new THREE.BoxGeometry(segLen, segH, t)
        const mid = (from + to) / 2
        const pos = new THREE.Vector3(
          ax + Math.cos(angle) * mid,
          y0 + segH / 2,
          az + Math.sin(angle) * mid,
        )
        const mesh = new THREE.Mesh(geo, wallMat)
        mesh.position.copy(pos)
        mesh.rotation.y = -angle
        group.add(mesh)

        // 면만 있으면 흰 덩어리로 보인다. 모서리를 그려야 구조가 읽힌다.
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat)
        edges.position.copy(pos)
        edges.rotation.y = -angle
        group.add(edges)
      }

      const holes = geometry.openings
        .filter((o) => o.wallId === w.id)
        .map((o) => {
          const center = o.t * len
          const half = o.widthMm / 1000 / 2
          return { a: Math.max(0, center - half), b: Math.min(len, center + half), o }
        })
        .sort((p, q) => p.a - q.a)

      // 모서리에서 두 벽이 맞물리도록 양 끝을 반 두께만큼 늘린다.
      // 늘리지 않으면 직각으로 만나는 자리에 벽 두께만 한 홈이 남아 3D 가 뚫려 보인다.
      const ext = t / 2

      let cursor = -ext
      for (const h of holes) {
        slab(cursor, h.a, 0, H)                                   // 개구부 사이 온전한 벽
        const sill = h.o.sillMm / 1000
        const top = Math.min(H, sill + h.o.heightMm / 1000)
        if (sill > 0.01) slab(h.a, h.b, 0, sill)                  // 창 아래 허리벽
        if (top < H - 0.01) slab(h.a, h.b, top, H)                // 개구부 위 인방
        cursor = h.b
      }
      slab(cursor, len + ext, 0, H)
    }

    // ---- 기기 마커 ----
    for (const d of devices) {
      const st = styleOf(d.item)
      const y = Math.min(d.mountMm, wallHeightMm) / 1000
      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 20, 14),
        new THREE.MeshLambertMaterial({ color: st.color }),
      )
      ball.position.set(toX(d.x), y, toZ(d.y))
      group.add(ball)

      // 바닥까지 가는 가는 선 — 공중에 뜬 점의 위치를 가늠하게 해 준다
      const stem = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(toX(d.x), 0, toZ(d.y)),
          new THREE.Vector3(toX(d.x), y, toZ(d.y)),
        ]),
        new THREE.LineBasicMaterial({ color: st.color, transparent: true, opacity: 0.45 }),
      )
      group.add(stem)

      if (showLabels) {
        const sprite = makeLabel(st.short, st.color)
        sprite.position.set(toX(d.x), y + 0.28, toZ(d.y))
        group.add(sprite)
        labelSprites.push(sprite)
      }
    }

    // ---- 카메라를 전체가 들어오게 맞춘다 ----
    const box = new THREE.Box3().setFromObject(group)
    if (box.isEmpty()) {
      box.set(new THREE.Vector3(-3, 0, -3), new THREE.Vector3(3, H, 3))
    }
    const center = box.getCenter(new THREE.Vector3())
    const span = Math.max(box.getSize(new THREE.Vector3()).x, box.getSize(new THREE.Vector3()).z, 3)
    controls.target.copy(center)
    camera.position.set(center.x + span * 0.9, center.y + span * 0.85, center.z + span * 0.9)

    const grid = new THREE.GridHelper(Math.ceil(span * 2), Math.ceil(span * 2), 0xc3cad6, 0xdfe4ec)
    grid.position.set(center.x, 0, center.z)
    scene.add(grid)

    let alive = true
    const tick = () => {
      if (!alive) return
      controls.update()
      renderer.render(scene, camera)
      requestAnimationFrame(tick)
    }
    tick()

    const resize = () => {
      const r = host.getBoundingClientRect()
      if (r.width < 2 || r.height < 2) return
      renderer.setSize(r.width, r.height, false)
      camera.aspect = r.width / r.height
      camera.updateProjectionMatrix()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(host)

    return () => {
      alive = false
      ro.disconnect()
      controls.dispose()
      renderer.dispose()
      scene.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.geometry) m.geometry.dispose()
      })
      for (const sp of labelSprites) {
        const mat = sp.material as THREE.SpriteMaterial
        mat.map?.dispose()
        mat.dispose()
      }
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement)
    }
  }, [geometry, devices, wallHeightMm, mmPerUnitX, mmPerUnitY, showLabels])

  return <div ref={hostRef} className="plan-3d" />
}

/** 캔버스로 글자를 그려 스프라이트로 띄운다. 고객에게 보여 줄 때 이름이 있어야 설명이 된다. */
function makeLabel(text: string, color: string): THREE.Sprite {
  const pad = 10
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  ctx.font = '600 40px system-ui, sans-serif'
  const w = ctx.measureText(text).width + pad * 2
  canvas.width = Math.ceil(w)
  canvas.height = 60

  const c = canvas.getContext('2d')!
  c.font = '600 40px system-ui, sans-serif'
  c.fillStyle = 'rgba(255,255,255,0.92)'
  c.fillRect(0, 0, canvas.width, canvas.height)
  c.strokeStyle = color
  c.lineWidth = 4
  c.strokeRect(2, 2, canvas.width - 4, canvas.height - 4)
  c.fillStyle = '#14233d'
  c.textBaseline = 'middle'
  c.fillText(text, pad, canvas.height / 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }))
  sprite.scale.set((canvas.width / canvas.height) * 0.42, 0.42, 1)
  return sprite
}
