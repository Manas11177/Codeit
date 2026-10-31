import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  CelebrationPopup,
  type CelebrationContent,
} from '../components/celebration/CelebrationPopup'
import { getGoodieStatuses } from '../rewards/goodies'
import {
  MEDAL_EMOJI,
  STATS_UPDATED_EVENT,
  computeStreak,
  getAchievements,
  getActivityDates,
  getProgressUserId,
  type AchievementTier,
} from '../utils/lessonProgress'

type QueuedCelebration = CelebrationContent & { id: string }

type CelebrationContextValue = {
  showCelebration: (content: CelebrationContent & { id?: string }) => void
}

const CelebrationContext = createContext<CelebrationContextValue | null>(null)

const STREAK_MILESTONES: {
  days: number
  title: string
  message: string
  tier: AchievementTier
}[] = [
  {
    days: 1,
    title: 'First Step',
    message: '1-day streak! Your bronze First Step medal is yours.',
    tier: 'bronze',
  },
  {
    days: 3,
    title: '3-Day Streak',
    message: "3-day streak! You're building a habit.",
    tier: 'bronze',
  },
  {
    days: 7,
    title: 'Week Warrior',
    message: "7-day streak! You're on fire.",
    tier: 'silver',
  },
  {
    days: 14,
    title: 'Dedicated Learner',
    message: '14-day streak! Consistency looks good on you.',
    tier: 'gold',
  },
  {
    days: 30,
    title: 'Monthly Master',
    message: '30-day streak! Absolute legend.',
    tier: 'gold',
  },
]

function celebrationsStorageKey(userId: string | null) {
  return userId
    ? `codementor-celebrations-${userId}`
    : 'codementor-celebrations'
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function readShown(userId: string | null): Set<string> {
  try {
    const raw = localStorage.getItem(celebrationsStorageKey(userId))
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as { shown?: string[] }
    return new Set(parsed.shown ?? [])
  } catch {
    return new Set()
  }
}

function writeShown(userId: string | null, shown: Set<string>) {
  localStorage.setItem(
    celebrationsStorageKey(userId),
    JSON.stringify({ shown: [...shown] }),
  )
}

function hasShown(userId: string | null, id: string) {
  return readShown(userId).has(id)
}

function markShown(userId: string | null, id: string) {
  const shown = readShown(userId)
  if (shown.has(id)) return
  shown.add(id)
  writeShown(userId, shown)
}

/** After a DEV clearShown(), skip auto-seed so simulateStreak can re-fire popups. */
let suppressCelebrationSeed = false

function seedExistingProgress(userId: string | null) {
  if (suppressCelebrationSeed) return

  const seedKey = `seeded:${userId ?? 'anon'}`
  if (hasShown(userId, seedKey)) return

  const streak = computeStreak(getActivityDates())
  const unlocked = getAchievements().filter((item) => item.unlocked)
  const unlockedGoodies = getGoodieStatuses().filter((item) => item.unlocked)
  // Defer seeding until progress exists so a later cloud sync isn't treated as "new" unlocks.
  if (streak === 0 && unlocked.length === 0 && unlockedGoodies.length === 0) return

  const shown = readShown(userId)
  shown.add(seedKey)

  for (const milestone of STREAK_MILESTONES) {
    if (streak >= milestone.days) shown.add(`streak-${milestone.days}`)
  }

  for (const achievement of unlocked) {
    shown.add(`achievement:${achievement.id}`)
  }

  for (const goodie of unlockedGoodies) {
    shown.add(`reward:${goodie.id}`)
  }

  writeShown(userId, shown)
}

export function CelebrationProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<QueuedCelebration[]>([])
  const [active, setActive] = useState<QueuedCelebration | null>(null)
  const prevStreakRef = useRef<number | null>(null)
  const closingRef = useRef(false)

  const activeIdRef = useRef<string | null>(null)
  activeIdRef.current = active?.id ?? null

  const showCelebration = useCallback(
    (content: CelebrationContent & { id?: string }) => {
      const id = content.id ?? `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      setQueue((prev) => {
        if (prev.some((item) => item.id === id) || activeIdRef.current === id) return prev
        return [...prev, { id, icon: content.icon, title: content.title, message: content.message }]
      })
    },
    [],
  )

  const dismiss = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    setActive(null)
    window.setTimeout(() => {
      closingRef.current = false
    }, 50)
  }, [])

  useEffect(() => {
    if (active || queue.length === 0) return
    setActive(queue[0])
    setQueue((prev) => prev.slice(1))
  }, [active, queue])

  useEffect(() => {
    const userId = getProgressUserId()
    seedExistingProgress(userId)
    prevStreakRef.current = computeStreak(getActivityDates())

    function maybeCelebrate() {
      const uid = getProgressUserId()
      seedExistingProgress(uid)

      const streak = computeStreak(getActivityDates())
      const prev = prevStreakRef.current
      prevStreakRef.current = streak

      if (prev !== null && streak > prev) {
        const milestone = STREAK_MILESTONES.find((item) => item.days === streak)
        if (milestone) {
          const id = `streak-${milestone.days}`
          if (!hasShown(uid, id)) {
            markShown(uid, id)
            showCelebration({
              id,
              icon: MEDAL_EMOJI[milestone.tier],
              title: milestone.title,
              message: milestone.message,
            })
          }
        } else {
          const id = `streak-increase-${todayISO()}`
          if (!hasShown(uid, id)) {
            markShown(uid, id)
            showCelebration({
              id,
              icon: '🔥',
              title: `${streak}-day streak`,
              message: `${streak}-day streak! Keep showing up.`,
            })
          }
        }
      }

      for (const achievement of getAchievements()) {
        if (!achievement.unlocked) continue
        const id = `achievement:${achievement.id}`
        if (hasShown(uid, id)) continue
        markShown(uid, id)
        showCelebration({
          id,
          icon: MEDAL_EMOJI[achievement.tier],
          title: achievement.title,
          message: `${achievement.description} ${MEDAL_EMOJI[achievement.tier]} ${achievement.tier} medal unlocked!`,
        })
      }

      for (const goodie of getGoodieStatuses()) {
        if (!goodie.unlocked) continue
        const id = `reward:${goodie.id}`
        if (hasShown(uid, id)) continue
        markShown(uid, id)
        showCelebration({
          id,
          icon: goodie.icon,
          title: goodie.name,
          message: `${goodie.description} Unlocked!`,
        })
      }
    }

    window.addEventListener(STATS_UPDATED_EVENT, maybeCelebrate)
    return () => window.removeEventListener(STATS_UPDATED_EVENT, maybeCelebrate)
  }, [showCelebration])

  // DEV ONLY — remove before production. Console: __celebrationDev.help()
  useEffect(() => {
    if (!import.meta.env.DEV) return

    const api = {
      help() {
        console.info(
          '[celebration dev] clearShown() | simulateStreak(n) | preview(icon?, title?, message?) | listShown()',
        )
      },
      clearShown() {
        const uid = getProgressUserId()
        localStorage.removeItem(celebrationsStorageKey(uid))
        suppressCelebrationSeed = true
        console.info('[celebration dev] cleared shown flags for', uid)
      },
      listShown() {
        console.table([...readShown(getProgressUserId())])
      },
      preview(icon = '🥇', title = 'Test celebration', message = 'Dev preview popup') {
        showCelebration({ icon, title, message })
      },
      /** Sets activity dates so streak == n, then fires stats update. */
      simulateStreak(n: number) {
        const days = Math.max(0, Math.floor(n))
        const uid = getProgressUserId()
        const key = uid ? `codementor-progress-${uid}` : 'codementor-lesson-progress'
        const raw = localStorage.getItem(key)
        const store = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
        const dates: string[] = []
        for (let i = days - 1; i >= 0; i -= 1) {
          const d = new Date()
          d.setDate(d.getDate() - i)
          dates.push(d.toISOString().slice(0, 10))
        }
        localStorage.setItem(
          key,
          JSON.stringify({
            completed: {},
            performance: {},
            practice: [],
            warmups: {},
            ...store,
            activityDates: dates,
          }),
        )
        suppressCelebrationSeed = true
        prevStreakRef.current = Math.max(0, days - 1)
        window.dispatchEvent(new CustomEvent(STATS_UPDATED_EVENT))
        console.info('[celebration dev] simulated streak', days)
      },
    }

    ;(window as unknown as { __celebrationDev: typeof api }).__celebrationDev = api
    return () => {
      delete (window as unknown as { __celebrationDev?: typeof api }).__celebrationDev
    }
  }, [showCelebration])

  const value = useMemo(() => ({ showCelebration }), [showCelebration])

  return (
    <CelebrationContext.Provider value={value}>
      {children}
      {active ? (
        <CelebrationPopup
          icon={active.icon}
          title={active.title}
          message={active.message}
          onClose={dismiss}
        />
      ) : null}
    </CelebrationContext.Provider>
  )
}

export function useCelebration() {
  const ctx = useContext(CelebrationContext)
  if (!ctx) {
    throw new Error('useCelebration must be used inside CelebrationProvider')
  }
  return ctx
}
