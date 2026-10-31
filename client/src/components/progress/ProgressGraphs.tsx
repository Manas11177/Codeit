import { useEffect, useMemo, useState } from 'react'
import { useTheme } from '../../context/ThemeContext'
import {
  getAccuracyTrend,
  getChapterStrength,
  getWeeklyActivity,
  hasAnyPracticeAnswers,
  type ChapterStrength,
  type DayActivity,
  type SessionAccuracy,
} from '../../utils/progressGraphs'
import { STATS_UPDATED_EVENT } from '../../utils/lessonProgress'
import './ProgressGraphs.css'

type GraphData = {
  weekly: DayActivity[]
  trend: SessionAccuracy[]
  chapters: ChapterStrength[]
  hasPractice: boolean
}

function readGraphData(): GraphData {
  return {
    weekly: getWeeklyActivity(),
    trend: getAccuracyTrend(10),
    chapters: getChapterStrength(),
    hasPractice: hasAnyPracticeAnswers(),
  }
}

export function ProgressGraphs() {
  const { darkMode } = useTheme()
  const [data, setData] = useState<GraphData>(() => readGraphData())

  useEffect(() => {
    function refresh() {
      setData(readGraphData())
    }
    window.addEventListener(STATS_UPDATED_EVENT, refresh)
    return () => window.removeEventListener(STATS_UPDATED_EVENT, refresh)
  }, [])

  const weeklyTotal = useMemo(
    () => data.weekly.reduce((sum, day) => sum + day.count, 0),
    [data.weekly],
  )

  return (
    <section className={`pg ${darkMode ? 'pg--dark' : 'pg--light'}`}>
      <div className="pg__head">
        <h2>Progress graphs</h2>
        <p>Built from your practice answers and recent sessions on this account.</p>
      </div>

      <div className="pg__grid">
        <article className="pg-card">
          <h3>Weekly activity</h3>
          <p className="pg-card__sub">Questions answered · last 7 days</p>
          {!data.hasPractice || weeklyTotal === 0 ? (
            <EmptyChart message="Take a quiz to see your progress here" />
          ) : (
            <WeeklyBars days={data.weekly} />
          )}
        </article>

        <article className="pg-card">
          <h3>Accuracy trend</h3>
          <p className="pg-card__sub">Quiz / practice session accuracy · last 10</p>
          {data.trend.length === 0 ? (
            <EmptyChart message="Take a quiz to see your progress here" />
          ) : (
            <AccuracyLine sessions={data.trend} />
          )}
        </article>

        <article className="pg-card pg-card--wide">
          <h3>Chapter strength</h3>
          <p className="pg-card__sub">Practice accuracy by chapter</p>
          {data.chapters.length === 0 ? (
            <EmptyChart message="Take a quiz to see your progress here" />
          ) : (
            <ChapterBars chapters={data.chapters} />
          )}
        </article>
      </div>
    </section>
  )
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="pg-empty" role="status">
      <span aria-hidden="true">📉</span>
      <p>{message}</p>
    </div>
  )
}

function WeeklyBars({ days }: { days: DayActivity[] }) {
  const max = Math.max(1, ...days.map((d) => d.count))
  const height = 140
  const width = 320
  const padX = 28
  const padY = 18
  const gap = 10
  const barArea = width - padX * 2
  const barWidth = (barArea - gap * (days.length - 1)) / days.length
  const chartH = height - padY * 2 - 18

  return (
    <svg
      className="pg-svg"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Bar chart of questions answered over the last 7 days"
    >
      {[0.25, 0.5, 0.75, 1].map((ratio) => {
        const y = padY + chartH * (1 - ratio)
        return (
          <line
            key={ratio}
            className="pg-gridline"
            x1={padX}
            x2={width - padX}
            y1={y}
            y2={y}
          />
        )
      })}
      {days.map((day, i) => {
        const h = (day.count / max) * chartH
        const x = padX + i * (barWidth + gap)
        const y = padY + chartH - h
        return (
          <g key={day.date}>
            <rect
              className="pg-bar"
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(h, day.count > 0 ? 3 : 0)}
              rx={5}
            >
              <title>{`${day.date}: ${day.count} answered`}</title>
            </rect>
            <text className="pg-axis" x={x + barWidth / 2} y={height - 4} textAnchor="middle">
              {day.label}
            </text>
            {day.count > 0 ? (
              <text className="pg-value" x={x + barWidth / 2} y={y - 4} textAnchor="middle">
                {day.count}
              </text>
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}

function AccuracyLine({ sessions }: { sessions: SessionAccuracy[] }) {
  const height = 150
  const width = 340
  const padX = 34
  const padY = 22
  const chartW = width - padX * 2
  const chartH = height - padY * 2 - 14
  const points = sessions.map((session, i) => {
    const x =
      sessions.length === 1
        ? padX + chartW / 2
        : padX + (i / (sessions.length - 1)) * chartW
    const y = padY + chartH * (1 - session.accuracy / 100)
    return { ...session, x, y }
  })
  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ')

  return (
    <svg
      className="pg-svg"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Line chart of accuracy across recent quiz sessions"
    >
      {[0, 50, 100].map((pct) => {
        const y = padY + chartH * (1 - pct / 100)
        return (
          <g key={pct}>
            <line className="pg-gridline" x1={padX} x2={width - padX} y1={y} y2={y} />
            <text className="pg-axis" x={padX - 6} y={y + 3} textAnchor="end">
              {pct}
            </text>
          </g>
        )
      })}
      <polyline className="pg-line" points={polyline} fill="none" />
      {points.map((point) => (
        <g key={`${point.at}-${point.index}`}>
          <circle className="pg-dot" cx={point.x} cy={point.y} r={4.5}>
            <title>{`${point.label}: ${point.accuracy}% (${point.correct}/${point.total})`}</title>
          </circle>
          <text className="pg-axis" x={point.x} y={height - 2} textAnchor="middle">
            {point.label}
          </text>
        </g>
      ))}
    </svg>
  )
}

function ChapterBars({ chapters }: { chapters: ChapterStrength[] }) {
  const sorted = [...chapters].sort((a, b) => a.accuracy - b.accuracy)

  return (
    <ul className="pg-hbars">
      {sorted.map((chapter) => (
        <li
          key={chapter.lessonId}
          className={`pg-hbar ${chapter.needsRevision ? 'is-weak' : ''}`}
        >
          <div className="pg-hbar__meta">
            <strong title={chapter.title}>{chapter.shortTitle}</strong>
            <span>
              {chapter.accuracy}%
              <small>
                · {chapter.correct}/{chapter.total}
              </small>
            </span>
          </div>
          <div className="pg-hbar__track" aria-hidden="true">
            <div
              className="pg-hbar__fill"
              style={{ width: `${Math.max(chapter.accuracy, 2)}%` }}
            />
          </div>
          {chapter.needsRevision ? (
            <span className="pg-hbar__flag">Needs revision</span>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
