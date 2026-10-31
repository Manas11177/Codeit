import { LESSON_DATA } from '../carousel/lessonData'
import {
  computeStreak,
  getActivityDates,
  getAllPerformance,
  getCompletedSubtopics,
  getPracticeHistory,
  getPreferences,
  topicKey,
  type ActivityKind,
  type Difficulty,
  type ErrorCategory,
  type PracticeRecord,
  type TopicPerformance,
} from '../utils/lessonProgress'
import { ERROR_LABELS } from './errors'

export type MasteryStatus = 'mastered' | 'developing' | 'weak' | 'not-started'

export type TopicInsight = {
  key: string
  lessonId: string
  lessonTitle: string
  subtopic: string
  mastery: number | null
  status: MasteryStatus
  completed: boolean
  hintsUsed: number
  sawAnswer: boolean
  failedChecks: number
  runs: number
  topErrors: { category: ErrorCategory; count: number }[]
  practiceAttempts: number
  practiceCorrect: number
  practiceAccuracy: number | null
  reasons: string[]
  suggestedKinds: ActivityKind[]
  difficulty: Difficulty
}

export type ChapterInsight = {
  lessonId: string
  title: string
  totalTopics: number
  completedTopics: number
  coverage: number
  understanding: number | null
  masteredCount: number
  weakCount: number
  hintsUsed: number
  problemsAttempted: number
  problemsSolved: number
  practiceAccuracy: number | null
  status: 'not-started' | 'in-progress' | 'completed'
}

export type MistakeInsight = {
  category: ErrorCategory
  label: string
  count: number
  topics: string[]
}

export type TrendPoint = {
  date: string
  topicsSolved: number
  practiceAnswered: number
  practiceAccuracy: number | null
}

export type LearningInsights = {
  hasData: boolean
  topics: TopicInsight[]
  chapters: ChapterInsight[]
  strengths: TopicInsight[]
  weaknesses: TopicInsight[]
  recommendations: TopicInsight[]
  mistakes: MistakeInsight[]
  trend: TrendPoint[]
  totals: {
    chaptersCompleted: number
    chaptersTotal: number
    conceptsMastered: number
    conceptsTotal: number
    problemsAttempted: number
    problemsSolved: number
    hintsUsed: number
    answersRevealed: number
    practiceAnswered: number
    practiceAccuracy: number | null
    streak: number
  }
}

const RECENT_PRACTICE_WINDOW = 10
const SYNTAX_ERRORS: ErrorCategory[] = [
  'SyntaxError',
  'IndentationError',
  'NameError',
]
const LOGIC_ERRORS: ErrorCategory[] = [
  'WrongOutput',
  'ZeroDivisionError',
  'IndexError',
  'KeyError',
]
const TYPE_ERRORS: ErrorCategory[] = ['TypeError', 'ValueError', 'AttributeError']

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function percent(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 100) : 0
}

function average(values: number[]) {
  if (values.length === 0) return null
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length)
}

function totalErrors(perf: TopicPerformance) {
  return Object.values(perf.errors).reduce((sum, n) => sum + (n ?? 0), 0)
}

function solveScore(perf: TopicPerformance): number {
  if (perf.solved) {
    return clamp(
      100 -
        Math.min(perf.hintsUsed, 3) * 10 -
        (perf.sawAnswer ? 30 : 0) -
        Math.min(perf.failedChecks * 6, 24) -
        Math.min(totalErrors(perf) * 3, 12),
      15,
      100,
    )
  }
  return clamp(40 - perf.failedChecks * 5 - perf.hintsUsed * 5, 5, 40)
}

export function statusFor(mastery: number | null): MasteryStatus {
  if (mastery === null) return 'not-started'
  if (mastery >= 80) return 'mastered'
  if (mastery >= 55) return 'developing'
  return 'weak'
}

export function difficultyFor(status: MasteryStatus): Difficulty {
  if (status === 'mastered') return 'hard'
  if (status === 'developing') return 'medium'
  return 'easy'
}

function suggestKinds(
  status: MasteryStatus,
  perf: TopicPerformance | undefined,
  topErrors: ErrorCategory[],
): ActivityKind[] {
  const kinds: ActivityKind[] = []
  if (topErrors.some((e) => SYNTAX_ERRORS.includes(e))) kinds.push('fill', 'mcq')
  if (topErrors.some((e) => TYPE_ERRORS.includes(e))) kinds.push('fill', 'mcq')
  if (
    topErrors.some((e) => LOGIC_ERRORS.includes(e)) ||
    (perf?.failedChecks ?? 0) >= 2
  ) {
    kinds.push('order', 'mcq', 'code')
  }
  if (perf?.sawAnswer || (perf?.hintsUsed ?? 0) >= 2) kinds.push('mcq', 'order')
  if (status === 'mastered') kinds.push('code', 'mcq')
  kinds.push('mcq', 'fill', 'order', 'code')
  return [...new Set(kinds)]
}

function buildReasons(
  perf: TopicPerformance | undefined,
  topErrors: { category: ErrorCategory; count: number }[],
  practiceAttempts: number,
  practiceAccuracy: number | null,
): string[] {
  const reasons: string[] = []
  if (perf && !perf.solved) reasons.push('Challenge not solved yet')
  if (perf?.sawAnswer) reasons.push('Needed the full answer (hint 4)')
  else if ((perf?.hintsUsed ?? 0) >= 2) reasons.push(`Used ${perf?.hintsUsed} hints`)
  if ((perf?.failedChecks ?? 0) >= 2) {
    reasons.push(`${perf?.failedChecks} incorrect submissions`)
  }
  const repeated = topErrors.find((e) => e.count >= 2)
  if (repeated) {
    reasons.push(`Repeated: ${ERROR_LABELS[repeated.category].toLowerCase()}`)
  }
  if (practiceAccuracy !== null && practiceAttempts >= 2 && practiceAccuracy < 60) {
    reasons.push(`Practice accuracy ${practiceAccuracy}%`)
  }
  return reasons
}

function practiceStatsFor(records: PracticeRecord[]) {
  const recent = records.slice(-RECENT_PRACTICE_WINDOW)
  const correct = recent.filter((r) => r.correct).length
  return {
    attempts: records.length,
    correctTotal: records.filter((r) => r.correct).length,
    recentAccuracy: recent.length ? percent(correct, recent.length) : null,
  }
}

function buildTopicInsight(
  lessonId: string,
  lessonTitle: string,
  subtopic: string,
  completed: boolean,
  perf: TopicPerformance | undefined,
  practice: PracticeRecord[],
): TopicInsight {
  const stats = practiceStatsFor(practice)
  let mastery: number | null = null

  if (perf) {
    const base = solveScore(perf)
    mastery =
      stats.attempts >= 2 && stats.recentAccuracy !== null
        ? Math.round(base * 0.55 + stats.recentAccuracy * 0.45)
        : base
  } else if (completed) {
    mastery = 85
  } else if (stats.attempts >= 2 && stats.recentAccuracy !== null) {
    mastery = stats.recentAccuracy
  }

  const status = statusFor(mastery)
  const topErrors = Object.entries(perf?.errors ?? {})
    .map(([category, count]) => ({
      category: category as ErrorCategory,
      count: count ?? 0,
    }))
    .filter((e) => e.count > 0)
    .sort((a, b) => b.count - a.count)

  return {
    key: topicKey(lessonId, subtopic),
    lessonId,
    lessonTitle,
    subtopic,
    mastery,
    status,
    completed,
    hintsUsed: perf?.hintsUsed ?? 0,
    sawAnswer: perf?.sawAnswer ?? false,
    failedChecks: perf?.failedChecks ?? 0,
    runs: perf?.runs ?? 0,
    topErrors,
    practiceAttempts: stats.attempts,
    practiceCorrect: stats.correctTotal,
    practiceAccuracy: stats.attempts ? percent(stats.correctTotal, stats.attempts) : null,
    reasons: buildReasons(perf, topErrors, stats.attempts, stats.recentAccuracy),
    suggestedKinds: suggestKinds(
      status,
      perf,
      topErrors.map((e) => e.category),
    ),
    difficulty: (() => {
      const base = difficultyFor(status)
      // Only nudge brand-new topics (no history). Never override once data exists.
      const noHistory = !perf && !completed && stats.attempts === 0
      if (!noHistory) return base
      if (getPreferences()?.experience === 'comfortable') return 'medium'
      return base
    })(),
  }
}

function buildTrend(
  performance: TopicPerformance[],
  practice: PracticeRecord[],
): TrendPoint[] {
  const days = new Map<string, { solved: number; answered: number; correct: number }>()
  const bump = (date: string) => {
    if (!days.has(date)) days.set(date, { solved: 0, answered: 0, correct: 0 })
    return days.get(date)!
  }
  for (const perf of performance) {
    if (perf.solvedAt) bump(perf.solvedAt.slice(0, 10)).solved += 1
  }
  for (const record of practice) {
    const day = bump(record.at.slice(0, 10))
    day.answered += 1
    if (record.correct) day.correct += 1
  }
  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-10)
    .map(([date, d]) => ({
      date,
      topicsSolved: d.solved,
      practiceAnswered: d.answered,
      practiceAccuracy: d.answered ? percent(d.correct, d.answered) : null,
    }))
}

export function getLearningInsights(): LearningInsights {
  const performance = getAllPerformance()
  const practice = getPracticeHistory()

  const practiceByTopic = new Map<string, PracticeRecord[]>()
  for (const record of practice) {
    const key = topicKey(record.lessonId, record.subtopic)
    practiceByTopic.set(key, [...(practiceByTopic.get(key) ?? []), record])
  }

  const topics: TopicInsight[] = []
  const chapters: ChapterInsight[] = []

  for (const lesson of LESSON_DATA) {
    const completedSet = new Set(getCompletedSubtopics(lesson.id))
    const lessonTopics = lesson.subtopics.map((subtopic) =>
      buildTopicInsight(
        lesson.id,
        lesson.title,
        subtopic,
        completedSet.has(subtopic),
        performance[topicKey(lesson.id, subtopic)],
        practiceByTopic.get(topicKey(lesson.id, subtopic)) ?? [],
      ),
    )
    topics.push(...lessonTopics)

    const lessonPerf = lesson.subtopics
      .map((s) => performance[topicKey(lesson.id, s)])
      .filter((p): p is TopicPerformance => Boolean(p))
    const lessonPractice = lesson.subtopics.flatMap(
      (s) => practiceByTopic.get(topicKey(lesson.id, s)) ?? [],
    )
    const completedTopics = completedSet.size
    const anyActivity = completedTopics > 0 || lessonPerf.length > 0

    chapters.push({
      lessonId: lesson.id,
      title: lesson.title,
      totalTopics: lesson.subtopics.length,
      completedTopics,
      coverage: percent(completedTopics, lesson.subtopics.length),
      understanding: average(
        lessonTopics
          .map((t) => t.mastery)
          .filter((m): m is number => m !== null),
      ),
      masteredCount: lessonTopics.filter((t) => t.status === 'mastered').length,
      weakCount: lessonTopics.filter((t) => t.status === 'weak').length,
      hintsUsed: lessonPerf.reduce((sum, p) => sum + p.hintsUsed, 0),
      problemsAttempted: lessonPerf.filter((p) => p.checks > 0 || p.solved).length,
      problemsSolved: lessonPerf.filter((p) => p.solved).length,
      practiceAccuracy: lessonPractice.length
        ? percent(lessonPractice.filter((r) => r.correct).length, lessonPractice.length)
        : null,
      status:
        completedTopics >= lesson.subtopics.length
          ? 'completed'
          : anyActivity
            ? 'in-progress'
            : 'not-started',
    })
  }

  const tracked = topics.filter((t) => t.status !== 'not-started')
  const byMasteryAsc = [...tracked].sort(
    (a, b) => (a.mastery ?? 0) - (b.mastery ?? 0),
  )
  const weaknesses = byMasteryAsc.filter((t) => t.status === 'weak')
  const recommendations = byMasteryAsc
    .filter((t) => t.status === 'weak' || t.status === 'developing')
    .slice(0, 6)

  const mistakeMap = new Map<ErrorCategory, MistakeInsight>()
  for (const t of topics) {
    for (const e of t.topErrors) {
      const entry = mistakeMap.get(e.category) ?? {
        category: e.category,
        label: ERROR_LABELS[e.category],
        count: 0,
        topics: [],
      }
      entry.count += e.count
      entry.topics.push(t.subtopic)
      mistakeMap.set(e.category, entry)
    }
  }

  const perfList = Object.values(performance)
  const practiceCorrect = practice.filter((r) => r.correct).length

  return {
    hasData: tracked.length > 0 || practice.length > 0,
    topics,
    chapters,
    strengths: [...tracked]
      .filter((t) => t.status === 'mastered')
      .sort((a, b) => (b.mastery ?? 0) - (a.mastery ?? 0)),
    weaknesses,
    recommendations,
    mistakes: [...mistakeMap.values()].sort((a, b) => b.count - a.count),
    trend: buildTrend(perfList, practice),
    totals: {
      chaptersCompleted: chapters.filter((c) => c.status === 'completed').length,
      chaptersTotal: chapters.length,
      conceptsMastered: topics.filter((t) => t.status === 'mastered').length,
      conceptsTotal: topics.length,
      problemsAttempted: perfList.filter((p) => p.checks > 0 || p.solved).length,
      problemsSolved: perfList.filter((p) => p.solved).length,
      hintsUsed: perfList.reduce((sum, p) => sum + p.hintsUsed, 0),
      answersRevealed: perfList.filter((p) => p.sawAnswer).length,
      practiceAnswered: practice.length,
      practiceAccuracy: practice.length ? percent(practiceCorrect, practice.length) : null,
      streak: computeStreak(getActivityDates()),
    },
  }
}
