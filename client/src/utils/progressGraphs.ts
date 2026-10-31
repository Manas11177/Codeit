import { LESSON_DATA } from '../carousel/lessonData'
import {
  getPracticeHistory,
  type PracticeRecord,
  type PracticeSource,
} from './lessonProgress'

export type DayActivity = {
  date: string
  label: string
  count: number
}

export type SessionAccuracy = {
  index: number
  label: string
  accuracy: number
  correct: number
  total: number
  source: PracticeSource
  at: string
}

export type ChapterStrength = {
  lessonId: string
  title: string
  shortTitle: string
  accuracy: number
  correct: number
  total: number
  needsRevision: boolean
}

const SESSION_GAP_MS = 15 * 60 * 1000

function todayLocalISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function shiftDays(iso: string, delta: number) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + delta)
  const yy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function weekdayLabel(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short' })
}

function dayKey(isoTimestamp: string) {
  return isoTimestamp.slice(0, 10)
}

type PracticeSessionBucket = {
  source: PracticeSource
  startMs: number
  endMs: number
  correct: number
  total: number
  at: string
}

function groupPracticeSessions(records: PracticeRecord[]): PracticeSessionBucket[] {
  const sorted = [...records].sort((a, b) => a.at.localeCompare(b.at))
  const sessions: PracticeSessionBucket[] = []

  for (const record of sorted) {
    const t = new Date(record.at).getTime()
    const current = sessions.at(-1)
    const gap = current ? t - current.endMs : Infinity
    const sameSource = current?.source === record.source

    if (!current || gap > SESSION_GAP_MS || !sameSource) {
      sessions.push({
        source: record.source,
        startMs: t,
        endMs: t,
        correct: record.correct ? 1 : 0,
        total: 1,
        at: record.at,
      })
      continue
    }

    current.endMs = t
    current.total += 1
    if (record.correct) current.correct += 1
    current.at = record.at
  }

  return sessions
}

/** Questions answered per day for the last 7 local calendar days. */
export function getWeeklyActivity(): DayActivity[] {
  const practice = getPracticeHistory()
  const end = todayLocalISO()
  const counts = new Map<string, number>()
  for (const record of practice) {
    const key = dayKey(record.at)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const days: DayActivity[] = []
  for (let i = 6; i >= 0; i -= 1) {
    const date = shiftDays(end, -i)
    days.push({
      date,
      label: weekdayLabel(date),
      count: counts.get(date) ?? 0,
    })
  }
  return days
}

export function hasAnyPracticeAnswers() {
  return getPracticeHistory().length > 0
}

/** Accuracy % for the last up to 10 practice/quiz sessions. */
export function getAccuracyTrend(limit = 10): SessionAccuracy[] {
  const sessions = groupPracticeSessions(getPracticeHistory()).filter((s) => s.total > 0)
  const recent = sessions.slice(-limit)
  return recent.map((session, index) => ({
    index: index + 1,
    label: `Q${index + 1}`,
    accuracy: Math.round((session.correct / session.total) * 100),
    correct: session.correct,
    total: session.total,
    source: session.source,
    at: session.at,
  }))
}

function shortLessonTitle(title: string) {
  return title
    .replace(/^Introduction to /i, '')
    .replace(/ & /g, ' ')
}

/** Per-chapter practice accuracy; weakest chapter flagged for revision. */
export function getChapterStrength(): ChapterStrength[] {
  const practice = getPracticeHistory()
  const byLesson = new Map<string, { correct: number; total: number }>()

  for (const record of practice) {
    const entry = byLesson.get(record.lessonId) ?? { correct: 0, total: 0 }
    entry.total += 1
    if (record.correct) entry.correct += 1
    byLesson.set(record.lessonId, entry)
  }

  const rows: ChapterStrength[] = LESSON_DATA.map((lesson) => {
    const stats = byLesson.get(lesson.id) ?? { correct: 0, total: 0 }
    return {
      lessonId: lesson.id,
      title: lesson.title,
      shortTitle: shortLessonTitle(lesson.title),
      accuracy: stats.total ? Math.round((stats.correct / stats.total) * 100) : 0,
      correct: stats.correct,
      total: stats.total,
      needsRevision: false,
    }
  }).filter((row) => row.total > 0)

  if (rows.length === 0) return rows

  let weakest = rows[0]
  for (const row of rows) {
    if (
      row.accuracy < weakest.accuracy ||
      (row.accuracy === weakest.accuracy && row.total > weakest.total)
    ) {
      weakest = row
    }
  }

  return rows.map((row) =>
    row.lessonId === weakest.lessonId ? { ...row, needsRevision: true } : row,
  )
}
