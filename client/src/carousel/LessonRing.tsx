import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import type { CarouselItem } from './items'
import './lessonRing.css'

const CARD_W = 576
const CARD_H = 420
const RING_GAP = 50
const TILT = -8
const PULL_FORWARD = 190
const STAGE_W = 1180
const STAGE_H = 560
const NARROW_SCREEN = 700
const NARROW_VISIBLE_SHARE = 0.6
const AUTO_EVERY = 4200
const IDLE_BEFORE_AUTO = 6000
const EASE = 0.11

const TILT_EASE = 0.06
const PITCH_RANGE = 7
const YAW_RANGE = 12
const MAX_LEAN = 8
const BOB_HEIGHT = 8
const POINTER_IDLE_MS = 2500

type LessonRingProps = {
  items: CarouselItem[]
  onLessonStart: (lessonId: string) => void
}

type DragState = { x: number; start: number; moved: boolean }

const mod = (n: number, m: number) => ((n % m) + m) % m

function wrapOffset(index: number, position: number, count: number) {
  return mod(index - position + count / 2, count) - count / 2
}

function lessonStatus(progress: number) {
  if (progress >= 100) return { label: 'Completed', tone: 'done', action: 'Review lesson' }
  if (progress > 0) return { label: `${progress}% done`, tone: 'progress', action: 'Continue lesson' }
  return { label: 'New', tone: 'new', action: 'Start lesson' }
}

const TOKEN =
  /(#.*)|("[^"]*")|\b(def|return|if|elif|else|for|in|while|True|False|None)\b|\b(print|range|len|append)\b|\b(\d+)\b/g
const TOKEN_CLASS = ['c', 's', 'k', 'b', 'n']

function highlight(line: string): ReactNode[] {
  const parts: ReactNode[] = []
  let last = 0
  for (const match of line.matchAll(TOKEN)) {
    const start = match.index ?? 0
    if (start > last) parts.push(line.slice(last, start))
    const group = match.slice(1).findIndex(Boolean)
    parts.push(
      <span key={start} className={`lr-tok-${TOKEN_CLASS[group]}`}>
        {match[0]}
      </span>,
    )
    last = start + match[0].length
  }
  if (last < line.length) parts.push(line.slice(last))
  return parts
}

function codeLine(snippet: string[]) {
  return snippet.find((line) => !line.trim().startsWith('#')) ?? snippet[0] ?? ''
}

function useStageScale(ref: RefObject<HTMLDivElement | null>) {
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const { width, height } = el.getBoundingClientRect()
      const visibleWidth =
        window.innerWidth < NARROW_SCREEN ? STAGE_W * NARROW_VISIBLE_SHARE : STAGE_W
      setScale(Math.max(0.35, Math.min(1.9, width / visibleWidth, height / STAGE_H)))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])

  return scale
}

export function LessonRing({ items, onLessonStart }: LessonRingProps) {
  const count = items.length
  const step = 360 / count
  const radius = Math.round(CARD_W / (2 * Math.tan(Math.PI / count)) + RING_GAP)

  const rootRef = useRef<HTMLDivElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const sceneRef = useRef<HTMLDivElement | null>(null)
  const cursorRef = useRef<HTMLDivElement | null>(null)
  const scale = useStageScale(stageRef)

  const target = useRef(0)
  const current = useRef(0)
  const hovering = useRef(false)
  const drag = useRef<DragState | null>(null)
  const lastInteraction = useRef(0)
  const pointer = useRef({ x: 0, y: 0, at: Number.NEGATIVE_INFINITY })
  const [position, setPosition] = useState(0)
  const [grabbing, setGrabbing] = useState(false)
  const [cursorVisible, setCursorVisible] = useState(false)

  const activeIndex = mod(Math.round(position), count)
  const active = items[activeIndex]
  const activeStatus = lessonStatus(active.progress)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let last = performance.now()
    let lastAuto = last
    let tiltX = 0
    let tiltY = 0
    let lean = 0
    let previous = current.current
    lastInteraction.current = last

    const onPointerMove = (event: PointerEvent) => {
      pointer.current = {
        x: (event.clientX / window.innerWidth) * 2 - 1,
        y: (event.clientY / window.innerHeight) * 2 - 1,
        at: performance.now(),
      }
    }
    window.addEventListener('pointermove', onPointerMove)

    const frame = (now: number) => {
      const dt = Math.min(64, now - last)
      last = now
      const delta = target.current - current.current
      const settled = Math.abs(delta) < 0.001

      if (
        !reduced &&
        settled &&
        !hovering.current &&
        !drag.current &&
        !document.hidden &&
        now - lastInteraction.current > IDLE_BEFORE_AUTO &&
        now - lastAuto > AUTO_EVERY
      ) {
        lastAuto = now
        target.current = Math.round(target.current) + 1
      }

      if (!settled) {
        const k = reduced ? 1 : 1 - Math.pow(1 - EASE, dt / (1000 / 60))
        current.current += delta * k
        setPosition(current.current)
      } else if (current.current !== target.current) {
        current.current = target.current
        setPosition(current.current)
      }

      const pointerIdle = now - pointer.current.at > POINTER_IDLE_MS
      const aimX = reduced ? 0 : pointerIdle ? Math.sin(now / 2600) * 0.55 : pointer.current.x
      const aimY = reduced ? 0 : pointerIdle ? Math.sin(now / 3400) * 0.45 : pointer.current.y
      const kt = 1 - Math.pow(1 - TILT_EASE, dt / (1000 / 60))
      tiltX += (aimX - tiltX) * kt
      tiltY += (aimY - tiltY) * kt

      const velocity = ((current.current - previous) / Math.max(dt, 1)) * 1000
      previous = current.current
      const aimLean = reduced ? 0 : Math.max(-MAX_LEAN, Math.min(MAX_LEAN, -velocity * 3.2))
      lean += (aimLean - lean) * Math.min(1, kt * 1.6)

      const bob = reduced ? 0 : Math.sin(now / 1500) * BOB_HEIGHT
      const scene = sceneRef.current
      if (scene) {
        scene.style.transform =
          `translateY(${bob.toFixed(2)}px) translateZ(${PULL_FORWARD - radius}px) ` +
          `rotateX(${(TILT - tiltY * PITCH_RANGE).toFixed(3)}deg) ` +
          `rotateY(${(tiltX * YAW_RANGE).toFixed(3)}deg) ` +
          `rotateZ(${lean.toFixed(3)}deg) ` +
          `rotateY(${(-current.current * step).toFixed(3)}deg)`
      }
      const root = rootRef.current
      if (root) {
        root.style.setProperty('--px', tiltX.toFixed(3))
        root.style.setProperty('--py', tiltY.toFixed(3))
      }

      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onPointerMove)
    }
  }, [radius, step])

  const markInteraction = () => {
    lastInteraction.current = performance.now()
  }

  const goBy = useCallback((delta: number) => {
    lastInteraction.current = performance.now()
    target.current = Math.round(target.current) + delta
  }, [])

  const goToIndex = (index: number) => {
    markInteraction()
    const base = Math.round(target.current)
    let delta = index - mod(base, count)
    if (delta > count / 2) delta -= count
    if (delta < -count / 2) delta += count
    target.current = base + delta
  }

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    let gestureStart: number | null = null
    let snap: ReturnType<typeof setTimeout> | undefined

    const onWheel = (event: WheelEvent) => {
      const delta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
      if (!delta) return
      event.preventDefault()
      lastInteraction.current = performance.now()
      if (gestureStart === null) gestureStart = Math.round(target.current)
      target.current += delta / 300
      clearTimeout(snap)
      snap = setTimeout(() => {
        const start = gestureStart ?? Math.round(target.current)
        const moved = target.current - start
        const steps =
          Math.abs(moved) < 0.12
            ? 0
            : Math.sign(moved) * Math.max(1, Math.round(Math.abs(moved)))
        target.current = start + steps
        gestureStart = null
      }, 140)
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      clearTimeout(snap)
    }
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (event.key === 'ArrowRight') goBy(1)
      if (event.key === 'ArrowLeft') goBy(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goBy])

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    drag.current = { x: event.clientX, start: target.current, moved: false }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const state = drag.current
    if (!state) return
    const dx = event.clientX - state.x
    if (!state.moved && Math.abs(dx) > 6) {
      state.moved = true
      event.currentTarget.setPointerCapture(event.pointerId)
      setGrabbing(true)
      setCursorVisible(false)
    }
    if (state.moved) {
      markInteraction()
      target.current = state.start - dx / (CARD_W * scale * 0.9)
    }
  }

  function handlePointerEnd() {
    if (drag.current?.moved) target.current = Math.round(target.current)
    drag.current = null
    setGrabbing(false)
  }

  function moveCursor(event: ReactPointerEvent<HTMLElement>) {
    const el = cursorRef.current
    if (el) el.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`
  }

  return (
    <div ref={rootRef} className="lr" style={{ '--accent': active.color } as CSSProperties}>
      <div className="lr-ambient" aria-hidden />

      <header className="lr-header">
        <span className="lr-eyebrow">🐍 Python learning path</span>
        <h1>Pick a lesson to begin</h1>
        <p>Drag, scroll or use the ← → keys to spin. Click the front card to open it.</p>
      </header>

      <div
        ref={stageRef}
        className={`lr-stage${grabbing ? ' is-grabbing' : ''}`}
        role="region"
        aria-roledescription="carousel"
        aria-label="Python lessons"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onPointerEnter={() => {
          hovering.current = true
        }}
        onPointerLeave={() => {
          hovering.current = false
        }}
      >
        <div className="lr-floor" aria-hidden />
        <div
          className="lr-scaler"
          style={{
            width: STAGE_W,
            height: STAGE_H,
            transform: `translate(-50%, -50%) scale(${scale})`,
          }}
        >
          <div className="lr-orbit" aria-hidden />
          <div ref={sceneRef} className="lr-scene">
            {items.map((item, index) => {
              const offset = wrapOffset(index, position, count)
              const depth = Math.min(1, Math.abs(offset) / (count / 2))
              const isActive = index === activeIndex
              const status = lessonStatus(item.progress)
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`lr-card${isActive ? ' is-active' : ''}`}
                  tabIndex={isActive ? 0 : -1}
                  aria-label={`Lesson ${item.chapter}: ${item.label}`}
                  style={
                    {
                      '--card-color': item.color,
                      '--offset': offset.toFixed(3),
                      width: CARD_W,
                      height: CARD_H,
                      marginLeft: -CARD_W / 2,
                      marginTop: -CARD_H / 2,
                      transform: `rotateY(${index * step}deg) translateZ(${radius}px)`,
                    } as CSSProperties
                  }
                  onClick={() => (isActive ? onLessonStart(item.id) : goToIndex(index))}
                  onPointerEnter={(event) => {
                    if (!isActive || drag.current?.moved) return
                    moveCursor(event)
                    setCursorVisible(true)
                  }}
                  onPointerMove={isActive ? moveCursor : undefined}
                  onPointerLeave={() => setCursorVisible(false)}
                >
                  <span className="lr-face lr-face--front">
                    <img
                      className="lr-face__img"
                      src={item.image}
                      alt=""
                      draggable={false}
                    />
                    <span className="lr-face__shade" aria-hidden />
                    <span className="lr-face__top">
                      <span className="lr-chip">Lesson {item.chapter}</span>
                      <span className={`lr-status lr-status--${status.tone}`}>
                        {status.label}
                      </span>
                    </span>
                    <span className="lr-face__bottom">
                      <span className="lr-face__title">{item.label}</span>
                      <span className="lr-code" aria-hidden>
                        {highlight(codeLine(item.snippet))}
                      </span>
                    </span>
                    <span className="lr-face__bar" aria-hidden>
                      <i style={{ width: `${item.progress}%` }} />
                    </span>
                    <span className="lr-face__shine" aria-hidden />
                    <span className="lr-face__dim" style={{ opacity: depth * 0.75 }} />
                  </span>
                  <span className="lr-face lr-face--back" aria-hidden>
                    <img
                      className="lr-face__img"
                      src={item.image}
                      alt=""
                      draggable={false}
                    />
                    <strong>{item.chapter}</strong>
                    <span className="lr-face__back-title">{item.label}</span>
                    <span className="lr-face__dim" style={{ opacity: depth * 0.6 }} />
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <section className="lr-details" aria-live="polite">
        <div className="lr-details__info" key={active.id}>
          <span className="lr-details__eyebrow">
            Lesson {active.chapter} · {active.level}
          </span>
          <h2>{active.label}</h2>
          <p>{active.description}</p>
          <div className="lr-meta">
            <span>📘 {active.exercises} topics</span>
            <span>
              {activeStatus.tone === 'done' ? '✅' : activeStatus.tone === 'progress' ? '⏳' : '✨'}{' '}
              {activeStatus.label}
            </span>
          </div>
        </div>

        <div className="lr-controls">
          <button
            type="button"
            className="lr-arrow"
            aria-label="Previous lesson"
            onClick={() => goBy(-1)}
          >
            ←
          </button>
          <button
            type="button"
            className="lr-start"
            onClick={() => onLessonStart(active.id)}
          >
            {activeStatus.action} →
          </button>
          <button
            type="button"
            className="lr-arrow"
            aria-label="Next lesson"
            onClick={() => goBy(1)}
          >
            →
          </button>
        </div>

        <div className="lr-dots">
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={`lr-dot${index === activeIndex ? ' is-active' : ''}${item.progress >= 100 ? ' is-done' : ''}`}
              aria-label={`Go to lesson ${item.chapter}: ${item.label}`}
              onClick={() => goToIndex(index)}
            />
          ))}
        </div>
      </section>

      <div
        ref={cursorRef}
        className={`lr-cursor${cursorVisible && !grabbing ? ' is-visible' : ''}`}
        aria-hidden
      >
        {activeStatus.tone === 'new' ? 'Start' : activeStatus.tone === 'done' ? 'Review' : 'Continue'}
      </div>
    </div>
  )
}
