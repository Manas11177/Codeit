import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import {
  CAT_POSE_SRC,
  catStillUrl,
  type CatPose,
} from '../../cat/catAssets'
import {
  getQuestionTimerSnap,
  subscribeQuestionTimer,
} from '../../cat/questionTimerGate'
import './CompanionCat.css'

const POSES: CatPose[] = ['peek', 'sleep', 'alert', 'talk']
const CAT_DEV_POSE_EVENT = 'codementor-cat-dev-pose'
const EMOJI = '🐱'

type Anchor = 'left' | 'right' | 'hide'

type CompanionCatProps = {
  active: boolean
  phrase: string | null
  onPhraseDone: () => void
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (onStoreChange) => {
      const media = window.matchMedia('(prefers-reduced-motion: reduce)')
      media.addEventListener('change', onStoreChange)
      return () => media.removeEventListener('change', onStoreChange)
    },
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false,
  )
}

function useNarrowScreen() {
  return useSyncExternalStore(
    (onStoreChange) => {
      const media = window.matchMedia('(max-width: 639px)')
      media.addEventListener('change', onStoreChange)
      return () => media.removeEventListener('change', onStoreChange)
    },
    () => window.matchMedia('(max-width: 639px)').matches,
    () => false,
  )
}

function usePathname() {
  return useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener('popstate', onStoreChange)
      return () => window.removeEventListener('popstate', onStoreChange)
    },
    () => window.location.pathname,
    () => '/',
  )
}

function usePrefsOpen() {
  return useSyncExternalStore(
    (onStoreChange) => {
      const obs = new MutationObserver(onStoreChange)
      obs.observe(document.body, { childList: true, subtree: true })
      return () => obs.disconnect()
    },
    () => Boolean(document.querySelector('.prefs')),
    () => false,
  )
}

function useDevPose() {
  const [pose, setPose] = useState<CatPose | null>(null)
  useEffect(() => {
    function onPose(event: Event) {
      const detail = (event as CustomEvent<CatPose | null>).detail
      setPose(detail)
    }
    window.addEventListener(CAT_DEV_POSE_EVENT, onPose)
    return () => window.removeEventListener(CAT_DEV_POSE_EVENT, onPose)
  }, [])
  return pose
}

/** Lessons and Progress put Run / Next / the hint rail on the right. */
export function catAnchorForPath(pathname: string): Anchor {
  if (
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/virtual-editor' ||
    pathname === '/terms' ||
    pathname === '/privacy' ||
    pathname === '/license' ||
    pathname === '/course-map'
  ) {
    return 'hide'
  }
  if (pathname === '/lessons' || pathname === '/progress') return 'left'
  if (
    pathname === '/' ||
    pathname === '/dashboard' ||
    pathname === '/streak' ||
    pathname === '/rewards' ||
    pathname === '/constellation'
  ) {
    return 'right'
  }
  return 'hide'
}

function PoseVisual({
  pose,
  reduce,
  failed,
  onFail,
}: {
  pose: CatPose
  reduce: boolean
  failed: boolean
  onFail: () => void
}) {
  const stillPng = catStillUrl(pose)
  const [captured, setCaptured] = useState<string | null>(null)
  const bound = useRef(false)

  if (failed) {
    return (
      <span className="cat-companion__emoji" aria-hidden="true">
        {EMOJI}
      </span>
    )
  }

  if (reduce && stillPng) {
    return <img className="cat-companion__still" src={stillPng} alt="" />
  }

  if (reduce && captured) {
    return <img className="cat-companion__still" src={captured} alt="" />
  }

  return (
    <DotLottieReact
      src={CAT_POSE_SRC[pose]}
      loop={!reduce}
      autoplay={!reduce}
      className="cat-companion__lottie"
      dotLottieRefCallback={(dot) => {
        if (!dot || bound.current) return
        bound.current = true
        const player = dot as unknown as {
          addEventListener: (type: string, cb: () => void) => void
          setFrame: (frame: number) => void
          pause: () => void
          canvas?: HTMLCanvasElement
        }
        player.addEventListener('loadError', onFail)
        if (!reduce) return
        player.addEventListener('load', () => {
          player.setFrame(0)
          player.pause()
          const canvas = player.canvas
          if (!canvas) return
          const copy = document.createElement('canvas')
          copy.width = canvas.width || 280
          copy.height = canvas.height || 200
          const ctx = copy.getContext('2d')
          if (!ctx) return
          ctx.drawImage(canvas, 0, 0)
          setCaptured(copy.toDataURL('image/png'))
        })
      }}
    />
  )
}

export function CompanionCat({ active, phrase, onPhraseDone }: CompanionCatProps) {
  const reduce = usePrefersReducedMotion()
  const narrow = useNarrowScreen()
  const pathname = usePathname()
  const prefsOpen = usePrefsOpen()
  const devPose = useDevPose()
  const timer = useSyncExternalStore(
    subscribeQuestionTimer,
    getQuestionTimerSnap,
    getQuestionTimerSnap,
  )
  const anchor = catAnchorForPath(pathname)
  const allowed = anchor !== 'hide' && !narrow

  const [present, setPresent] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [intro, setIntro] = useState(false)
  const presentRef = useRef(false)
  const [shown, setShown] = useState<CatPose>('sleep')
  const [phase, setPhase] = useState<'in' | 'out'>('in')
  const [failed, setFailed] = useState<Partial<Record<CatPose, boolean>>>({})

  useEffect(() => {
    if (!active) return
    for (const src of Object.values(CAT_POSE_SRC)) {
      void fetch(src).catch(() => {})
    }
  }, [active])

  useEffect(() => {
    if (active && allowed) {
      presentRef.current = true
      setLeaving(false)
      setPresent(true)
      return
    }
    presentRef.current = false
    setPresent(false)
    setLeaving(false)
  }, [active, allowed])

  useEffect(() => {
    if (!present || leaving || reduce) {
      setIntro(false)
      return
    }
    setIntro(true)
    const timerId = window.setTimeout(() => setIntro(false), 2000)
    return () => window.clearTimeout(timerId)
  }, [present, leaving, reduce])

  // A line always uses the black rainbow cat (talk). Alert stays silent.
  const desired: CatPose = leaving
    ? 'peek'
    : devPose
      ? devPose
      : phrase
        ? 'talk'
        : intro
          ? 'peek'
          : timer === 'alert'
            ? 'alert'
            : 'sleep'

  useEffect(() => {
    if (desired === shown) {
      setPhase('in')
      return
    }
    if (reduce) {
      setShown(desired)
      setPhase('in')
      return
    }
    setPhase('out')
    const timerId = window.setTimeout(() => {
      setShown(desired)
      setPhase('in')
    }, 200)
    return () => window.clearTimeout(timerId)
  }, [desired, shown, reduce])

  useEffect(() => {
    if (!phrase || leaving || intro || devPose) return
    const timerId = window.setTimeout(onPhraseDone, 4000)
    return () => window.clearTimeout(timerId)
  }, [phrase, leaving, intro, devPose, onPhraseDone])

  if (!present || !allowed) return null

  const showBubble = Boolean(phrase) && shown === 'talk' && phase === 'in'

  return (
    <div
      className={[
        'cat-companion',
        anchor === 'left' ? 'cat-companion--left' : '',
        leaving ? 'is-leaving' : '',
        prefsOpen ? 'is-on-prefs' : '',
        showBubble ? 'is-talking' : '',
        reduce ? 'is-reduced' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {showBubble ? (
        <p className="cat-companion__bubble" role="status">
          {phrase}
        </p>
      ) : null}
      <div className="cat-companion__stage">
        {POSES.map((pose) => {
          const visible = pose === shown
          return (
            <div
              key={pose}
              className={[
                'cat-companion__pose',
                `cat-companion__pose--${pose}`,
                visible && phase === 'in' ? 'is-shown' : '',
                visible && phase === 'out' ? 'is-hiding' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div
                className={
                  pose === 'sleep' && visible && phase === 'in'
                    ? 'cat-companion__motion'
                    : undefined
                }
              >
                <PoseVisual
                  pose={pose}
                  reduce={reduce}
                  failed={Boolean(failed[pose])}
                  onFail={() =>
                    setFailed((prev) => (prev[pose] ? prev : { ...prev, [pose]: true }))
                  }
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export { CAT_DEV_POSE_EVENT }
