import { useEffect, useMemo, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { UserAvatar } from '../components/profile/UserAvatar'
import { supabase } from '../lib/supabase'
import {
  MEDAL_EMOJI,
  STATS_UPDATED_EVENT,
  STREAK_MEDAL_MILESTONES,
  computeLongestStreak,
  computeStreak,
  getAchievements,
  getActivityDates,
  type Achievement,
} from '../utils/lessonProgress'
import { goTo } from '../utils/navigation'
import './StreakMedals.css'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function daysUntilNextMilestone(streak: number) {
  const next = STREAK_MEDAL_MILESTONES.find((n) => n > streak)
  if (next == null) return null
  return { target: next, days: next - streak }
}

/** First calendar day a consecutive streak of `target` days was completed. */
function dateStreakMilestoneReached(activityDates: string[], target: number) {
  if (target <= 0) return null
  const sorted = [...new Set(activityDates)].sort()
  let run = 0
  let runEnd: string | null = null

  for (let i = 0; i < sorted.length; i += 1) {
    if (i === 0) {
      run = 1
      runEnd = sorted[0]
    } else {
      const prev = new Date(`${sorted[i - 1]}T00:00:00`)
      const curr = new Date(`${sorted[i]}T00:00:00`)
      const gap = Math.round((curr.getTime() - prev.getTime()) / 86_400_000)
      if (gap === 1) {
        run += 1
        runEnd = sorted[i]
      } else {
        run = 1
        runEnd = sorted[i]
      }
    }
    if (run >= target && runEnd) return runEnd
  }
  return null
}

function earnedDateFor(achievement: Achievement, activityDates: string[]) {
  const streakMatch = /^streak-(\d+)$/.exec(achievement.id)
  if (streakMatch) {
    return dateStreakMilestoneReached(activityDates, Number(streakMatch[1]))
  }
  if (achievement.id === 'first-step') {
    return dateStreakMilestoneReached(activityDates, 1) ?? activityDates.slice().sort()[0] ?? null
  }
  return null
}

function buildMonthCells(year: number, monthIndex: number, active: Set<string>) {
  const first = new Date(year, monthIndex, 1)
  const startPad = first.getDay()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const cells: { key: string; day: number | null; iso: string | null; active: boolean }[] = []

  for (let i = 0; i < startPad; i += 1) {
    cells.push({ key: `pad-${i}`, day: null, iso: null, active: false })
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    cells.push({ key: iso, day, iso, active: active.has(iso) })
  }
  return cells
}

export function StreakMedals() {
  const { darkMode } = useTheme()
  const [tick, setTick] = useState(0)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    function refresh() {
      setTick((n) => n + 1)
    }
    window.addEventListener(STATS_UPDATED_EVENT, refresh)
    return () => window.removeEventListener(STATS_UPDATED_EVENT, refresh)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserEmail(data.session?.user?.email ?? null)
    })
  }, [])

  const data = useMemo(() => {
    const activityDates = getActivityDates()
    const streak = computeStreak(activityDates)
    const longest = computeLongestStreak(activityDates)
    const achievements = getAchievements()
    const next = daysUntilNextMilestone(streak)
    const now = new Date()
    void tick
    return {
      activityDates,
      streak,
      longest,
      achievements,
      next,
      year: now.getFullYear(),
      monthIndex: now.getMonth(),
      monthLabel: now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    }
  }, [tick])

  const activeSet = useMemo(() => new Set(data.activityDates), [data.activityDates])
  const cells = useMemo(
    () => buildMonthCells(data.year, data.monthIndex, activeSet),
    [data.year, data.monthIndex, activeSet],
  )
  const empty = data.activityDates.length === 0

  return (
    <div className={`sm ${darkMode ? 'sm--dark' : 'sm--light'}`}>
      <div className="sm__glow" aria-hidden />
      <div className="sm__shell">
        <nav className="sm-nav">
          <button type="button" onClick={() => goTo('/')}>
            ← Dashboard
          </button>
          <button type="button" onClick={() => goTo('/progress')}>
            Progress
          </button>
          <span className="sm-nav__avatar" title="Your avatar">
            <UserAvatar email={userEmail} size="md" />
          </span>
        </nav>

        <header className="sm-hero">
          <span className="sm-eyebrow">Streak &amp; Medals</span>
          <h1>Keep the fire going.</h1>
          <p>Your daily learning rhythm and the medals you have earned along the way.</p>
        </header>

        {empty ? (
          <section className="sm-card sm-empty">
            <span aria-hidden="true">🔥</span>
            <h2>No streak yet</h2>
            <p>Start a lesson to begin your streak</p>
            <button type="button" className="sm-btn" onClick={() => goTo('/lessons')}>
              Start a lesson →
            </button>
          </section>
        ) : (
          <>
            <section className="sm-stats">
              <div className="sm-card sm-stat sm-stat--hero">
                <span>Current streak</span>
                <strong>
                  {data.streak}
                  <em>🔥</em>
                </strong>
                <small>{data.streak === 1 ? 'day in a row' : 'days in a row'}</small>
              </div>
              <div className="sm-card sm-stat">
                <span>Longest streak</span>
                <strong>{data.longest}</strong>
                <small>best run so far</small>
              </div>
              <div className="sm-card sm-stat">
                <span>Next streak medal</span>
                {data.next ? (
                  <>
                    <strong>{data.next.days}</strong>
                    <small>
                      day{data.next.days === 1 ? '' : 's'} to the {data.next.target}-day medal
                    </small>
                  </>
                ) : (
                  <>
                    <strong>✨</strong>
                    <small>All streak medals unlocked</small>
                  </>
                )}
              </div>
            </section>

            <section className="sm-card sm-calendar">
              <div className="sm-section__head">
                <h2>{data.monthLabel}</h2>
                <p>Highlighted days are ones you learned on.</p>
              </div>
              <div className="sm-cal__weekdays">
                {WEEKDAYS.map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
              <div className="sm-cal__grid">
                {cells.map((cell) =>
                  cell.day == null ? (
                    <span key={cell.key} className="sm-cal__cell is-empty" />
                  ) : (
                    <span
                      key={cell.key}
                      className={`sm-cal__cell ${cell.active ? 'is-active' : ''}`}
                      title={cell.active ? `Active · ${cell.iso}` : cell.iso ?? undefined}
                    >
                      {cell.day}
                    </span>
                  ),
                )}
              </div>
            </section>
          </>
        )}

        <section className="sm-shelf">
          <div className="sm-section__head">
            <h2>Medals shelf</h2>
            <p>Earned medals glow; locked ones show how to unlock them.</p>
          </div>
          <ul className="sm-medals">
            {data.achievements.map((item) => {
              const earnedOn = item.unlocked
                ? earnedDateFor(item, data.activityDates)
                : null
              return (
                <li
                  key={item.id}
                  className={`sm-medal ${item.unlocked ? 'is-earned' : 'is-locked'}`}
                >
                  <span className="sm-medal__icon" aria-hidden="true">
                    {item.unlocked ? MEDAL_EMOJI[item.tier] : '🤍'}
                  </span>
                  <div className="sm-medal__body">
                    <div className="sm-medal__title">
                      <strong>{item.title}</strong>
                      <span className={`sm-tier sm-tier--${item.tier}`}>{item.tier}</span>
                    </div>
                    {item.unlocked ? (
                      <p>
                        {item.description}
                        {earnedOn ? ` · Earned ${formatDate(earnedOn)}` : ''}
                      </p>
                    ) : (
                      <p className="sm-medal__how">How to earn: {item.description}</p>
                    )}
                  </div>
                  <span className="sm-medal__badge" aria-hidden="true">
                    {item.icon}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      </div>
    </div>
  )
}

export default StreakMedals
