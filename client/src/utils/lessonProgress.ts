import { LESSON_DATA } from '../carousel/lessonData'
import { CAROUSEL_META, type CarouselItem } from '../carousel/items'

export const STATS_UPDATED_EVENT = 'codementor-stats-updated'

const LEGACY_KEY = 'codementor-lesson-progress'

export type ErrorCategory =
  | 'SyntaxError'
  | 'IndentationError'
  | 'NameError'
  | 'TypeError'
  | 'ValueError'
  | 'ZeroDivisionError'
  | 'IndexError'
  | 'KeyError'
  | 'AttributeError'
  | 'WrongOutput'
  | 'OtherError'

export type TopicPerformance = {
  lessonId: string
  subtopic: string
  hintsUsed: number
  sawAnswer: boolean
  runs: number
  checks: number
  failedChecks: number
  errors: Partial<Record<ErrorCategory, number>>
  solved: boolean
  firstActivityAt: string
  lastActivityAt: string
  solvedAt?: string
}

export type ActivityKind = 'mcq' | 'fill' | 'order' | 'code'
export type Difficulty = 'easy' | 'medium' | 'hard'
export type PracticeSource = 'chapter-quiz' | 'training' | 'lesson'

export type PracticeRecord = {
  questionId: string
  lessonId: string
  subtopic: string
  kind: ActivityKind
  difficulty: Difficulty
  correct: boolean
  usedHint: boolean
  source: PracticeSource
  at: string
}

export type WarmupHistory = {
  attempt: number
  recent: string[]
}

export type PreferenceGoal = 'job' | 'college' | 'hobby'
export type PreferenceExperience = 'never' | 'some' | 'comfortable'
export type PreferenceDailyMinutes = 10 | 20 | 30

export type UserPreferences = {
  goal?: PreferenceGoal
  experience?: PreferenceExperience
  dailyMinutes?: PreferenceDailyMinutes
  skipped?: boolean
  updatedAt: string
}

/** Selected cosmetic rewards only — unlock state is computed from progress. */
export type UserRewards = {
  avatarFrameId?: string | null
  accentThemeId?: string | null
  updatedAt: string
}

/** Display name + avatar icon; email is never stored here. */
export type UserProfile = {
  displayName?: string | null
  avatarId?: string | null
  updatedAt: string
}

export type ProgressStore = {
  completed: Record<string, string[]>
  activityDates: string[]
  performance: Record<string, TopicPerformance>
  practice: PracticeRecord[]
  warmups: Record<string, WarmupHistory>
  preferences?: UserPreferences | null
  rewards?: UserRewards | null
  profile?: UserProfile | null
}

const MAX_PRACTICE_RECORDS = 600

let activeUserId: string | null = null

function storageKey(userId: string | null) {
  return userId ? `codementor-progress-${userId}` : LEGACY_KEY
}

function emptyStore(): ProgressStore {
  return {
    completed: {},
    activityDates: [],
    performance: {},
    practice: [],
    warmups: {},
    preferences: null,
    rewards: null,
    profile: null,
  }
}

function readStore(): ProgressStore {
  try {
    const raw = localStorage.getItem(storageKey(activeUserId))
    if (!raw) return emptyStore()
    const parsed = JSON.parse(raw) as Partial<ProgressStore>
    return {
      completed: parsed.completed ?? {},
      activityDates: parsed.activityDates ?? [],
      performance: parsed.performance ?? {},
      practice: parsed.practice ?? [],
      warmups: parsed.warmups ?? {},
      preferences: parsed.preferences ?? null,
      rewards: parsed.rewards ?? null,
      profile: parsed.profile ?? null,
    }
  } catch {
    return emptyStore()
  }
}

function writeStore(store: ProgressStore) {
  localStorage.setItem(storageKey(activeUserId), JSON.stringify(store))
  window.dispatchEvent(new CustomEvent(STATS_UPDATED_EVENT))
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function migrateLegacyProgress(userId: string | null) {
  if (!userId) return
  const userKey = storageKey(userId)
  if (localStorage.getItem(userKey)) return

  const legacy = localStorage.getItem(LEGACY_KEY)
  if (legacy) {
    localStorage.setItem(userKey, legacy)
  }
}

export function setProgressUserId(userId: string | null) {
  if (userId === activeUserId) return
  activeUserId = userId
  migrateLegacyProgress(userId)
  window.dispatchEvent(new CustomEvent(STATS_UPDATED_EVENT))
}

export function getProgressUserId() {
  return activeUserId
}

/** Snapshot of the active user's local progress blob (for cloud sync). */
export function getProgressStoreSnapshot(): ProgressStore {
  return readStore()
}

/** Replace the active user's local progress blob (used after cloud merge). */
export function replaceProgressStoreSnapshot(store: ProgressStore) {
  writeStore({
    completed: store.completed ?? {},
    activityDates: store.activityDates ?? [],
    performance: store.performance ?? {},
    practice: store.practice ?? [],
    warmups: store.warmups ?? {},
    preferences: store.preferences ?? null,
    rewards: store.rewards ?? null,
    profile: store.profile ?? null,
  })
}

export function getPreferences(): UserPreferences | null {
  return readStore().preferences ?? null
}

/** True once the user saved answers or explicitly skipped. */
export function hasPreferencesDecision(): boolean {
  const prefs = getPreferences()
  if (!prefs?.updatedAt) return false
  if (prefs.skipped) return true
  return Boolean(prefs.goal && prefs.experience && prefs.dailyMinutes)
}

export function savePreferences(
  input: Omit<UserPreferences, 'updatedAt' | 'skipped'> & { skipped?: false },
) {
  const store = readStore()
  store.preferences = {
    goal: input.goal,
    experience: input.experience,
    dailyMinutes: input.dailyMinutes,
    skipped: false,
    updatedAt: new Date().toISOString(),
  }
  writeStore(store)
}

export function skipPreferences() {
  const store = readStore()
  store.preferences = {
    skipped: true,
    updatedAt: new Date().toISOString(),
  }
  writeStore(store)
}

export function getRewardsSelection(): UserRewards | null {
  return readStore().rewards ?? null
}

export function saveRewardsSelection(input: {
  avatarFrameId?: string | null
  accentThemeId?: string | null
}) {
  const store = readStore()
  const prev = store.rewards
  store.rewards = {
    avatarFrameId:
      input.avatarFrameId !== undefined
        ? input.avatarFrameId
        : (prev?.avatarFrameId ?? null),
    accentThemeId:
      input.accentThemeId !== undefined
        ? input.accentThemeId
        : (prev?.accentThemeId ?? null),
    updatedAt: new Date().toISOString(),
  }
  writeStore(store)
}

export function getProfile(): UserProfile | null {
  return readStore().profile ?? null
}

/** Default display name from email local-part; never persists email. */
export function defaultDisplayNameFromEmail(email: string | null | undefined) {
  if (!email) return 'Learner'
  const local = email.split('@')[0]?.trim()
  if (!local) return 'Learner'
  return local
}

export function getDisplayName(email?: string | null) {
  const saved = getProfile()?.displayName?.trim()
  if (saved) return saved
  return defaultDisplayNameFromEmail(email)
}

export function saveProfile(input: {
  displayName?: string | null
  avatarId?: string | null
}) {
  const store = readStore()
  const prev = store.profile
  let displayName =
    input.displayName !== undefined ? input.displayName : (prev?.displayName ?? null)
  if (typeof displayName === 'string') {
    displayName = displayName.trim()
    if (displayName.length < 2 || displayName.length > 20) {
      displayName = prev?.displayName ?? null
    }
  }
  store.profile = {
    displayName,
    avatarId:
      input.avatarId !== undefined ? input.avatarId : (prev?.avatarId ?? null),
    updatedAt: new Date().toISOString(),
  }
  writeStore(store)
}

/** Suggested first lesson id from experience preference (Continue card). */
export function getPreferredStartLessonId(): string {
  const experience = getPreferences()?.experience
  if (experience === 'comfortable') return 'conditions'
  if (experience === 'some') return 'variables'
  return 'python-basics'
}

export const START_LESSON_KEY = 'codementor-start-lesson'
export const START_SUBTOPIC_KEY = 'codementor-start-subtopic'

export function queueStartLesson(lessonId: string, subtopic?: string) {
  sessionStorage.setItem(START_LESSON_KEY, lessonId)
  if (subtopic) {
    sessionStorage.setItem(START_SUBTOPIC_KEY, subtopic)
  } else {
    sessionStorage.removeItem(START_SUBTOPIC_KEY)
  }
}

export function consumeStartLesson(): string | null {
  const id = sessionStorage.getItem(START_LESSON_KEY)
  sessionStorage.removeItem(START_LESSON_KEY)
  return id
}

export function consumeStartSubtopic(): string | null {
  const subtopic = sessionStorage.getItem(START_SUBTOPIC_KEY)
  sessionStorage.removeItem(START_SUBTOPIC_KEY)
  return subtopic
}

export type AchievementTier = 'bronze' | 'silver' | 'gold'

export const MEDAL_EMOJI: Record<AchievementTier, string> = {
  bronze: '🥉',
  silver: '🥈',
  gold: '🥇',
}

export function getTotalSubtopicCount() {
  return LESSON_DATA.reduce((sum, lesson) => sum + lesson.subtopics.length, 0)
}

export function getTotalCompletedSubtopics() {
  const store = readStore()
  return LESSON_DATA.reduce(
    (sum, lesson) => sum + (store.completed[lesson.id]?.length ?? 0),
    0,
  )
}

export function computeStreak(activityDates: string[]) {
  if (activityDates.length === 0) return 0

  const days = new Set(activityDates)
  const today = todayISO()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayISO = yesterday.toISOString().slice(0, 10)

  const mostRecent = [...days].sort().at(-1)
  if (mostRecent !== today && mostRecent !== yesterdayISO) {
    return 0
  }

  let streak = 0
  const cursor = new Date()
  if (!days.has(today)) {
    cursor.setDate(cursor.getDate() - 1)
  }

  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
}

/** Longest run of consecutive calendar days in activityDates (not persisted). */
export function computeLongestStreak(activityDates: string[]) {
  if (activityDates.length === 0) return 0

  const sorted = [...new Set(activityDates)].sort()
  let best = 1
  let run = 1

  for (let i = 1; i < sorted.length; i += 1) {
    const prev = new Date(`${sorted[i - 1]}T00:00:00`)
    const curr = new Date(`${sorted[i]}T00:00:00`)
    const gap = Math.round((curr.getTime() - prev.getTime()) / 86_400_000)
    if (gap === 1) {
      run += 1
      best = Math.max(best, run)
    } else {
      run = 1
    }
  }

  return best
}

/** Streak medal milestones (display only — same targets as celebrations). */
export const STREAK_MEDAL_MILESTONES = [1, 3, 7, 14, 30] as const

export function getCompletedLessonCount() {
  const store = readStore()
  return LESSON_DATA.filter(
    (lesson) =>
      (store.completed[lesson.id]?.length ?? 0) >= lesson.subtopics.length,
  ).length
}

export type AchievementDef = {
  id: string
  title: string
  description: string
  icon: string
  tier: AchievementTier
  check: (ctx: AchievementContext) => boolean
}

type AchievementContext = {
  completedTopics: number
  totalTopics: number
  progressPct: number
  streak: number
  completedLessons: number
  totalLessons: number
}

const ACHIEVEMENT_DEFS: AchievementDef[] = [
  {
    id: 'first-step',
    title: 'First Step',
    description: 'Complete your first lesson topic.',
    icon: '🌱',
    tier: 'bronze',
    check: (ctx) => ctx.completedTopics >= 1,
  },
  {
    id: 'five-topics',
    title: 'Getting Warm',
    description: 'Complete 5 lesson topics.',
    icon: '✨',
    tier: 'bronze',
    check: (ctx) => ctx.completedTopics >= 5,
  },
  {
    id: 'ten-topics',
    title: 'On a Roll',
    description: 'Complete 10 lesson topics.',
    icon: '🔥',
    tier: 'silver',
    check: (ctx) => ctx.completedTopics >= 10,
  },
  {
    id: 'first-lesson',
    title: 'Lesson Cleared',
    description: 'Finish every topic in one full lesson.',
    icon: '📘',
    tier: 'silver',
    check: (ctx) => ctx.completedLessons >= 1,
  },
  {
    id: 'three-lessons',
    title: 'Python Explorer',
    description: 'Finish 3 complete lessons.',
    icon: '🧭',
    tier: 'gold',
    check: (ctx) => ctx.completedLessons >= 3,
  },
  {
    id: 'streak-3',
    title: '3-Day Streak',
    description: 'Learn on 3 days in a row.',
    icon: '⚡',
    tier: 'bronze',
    check: (ctx) => ctx.streak >= 3,
  },
  {
    id: 'streak-7',
    title: 'Week Warrior',
    description: 'Keep a 7-day learning streak.',
    icon: '🏅',
    tier: 'silver',
    check: (ctx) => ctx.streak >= 7,
  },
  {
    id: 'half-progress',
    title: 'Halfway Hero',
    description: 'Reach 50% overall progress.',
    icon: '🎯',
    tier: 'silver',
    check: (ctx) => ctx.progressPct >= 50,
  },
  {
    id: 'twenty-five',
    title: 'Code Builder',
    description: 'Complete 25 lesson topics.',
    icon: '🛠️',
    tier: 'gold',
    check: (ctx) => ctx.completedTopics >= 25,
  },
  {
    id: 'all-lessons',
    title: 'Course Champion',
    description: 'Finish all 8 Python lessons.',
    icon: '🏆',
    tier: 'gold',
    check: (ctx) => ctx.completedLessons >= ctx.totalLessons,
  },
  {
    id: 'full-progress',
    title: 'Python Graduate',
    description: 'Complete every topic in the curriculum.',
    icon: '🎓',
    tier: 'gold',
    check: (ctx) => ctx.completedTopics >= ctx.totalTopics,
  },
  {
    id: 'streak-14',
    title: 'Dedicated Learner',
    description: 'Maintain a 14-day streak.',
    icon: '💎',
    tier: 'gold',
    check: (ctx) => ctx.streak >= 14,
  },
]

function getAchievementContext(): AchievementContext {
  const totalTopics = getTotalSubtopicCount()
  const completedTopics = getTotalCompletedSubtopics()
  const progressPct = totalTopics
    ? Math.round((completedTopics / totalTopics) * 100)
    : 0
  const store = readStore()

  return {
    completedTopics,
    totalTopics,
    progressPct,
    streak: computeStreak(store.activityDates),
    completedLessons: getCompletedLessonCount(),
    totalLessons: LESSON_DATA.length,
  }
}

export type Achievement = AchievementDef & { unlocked: boolean }

export function getAchievements(): Achievement[] {
  const ctx = getAchievementContext()
  return ACHIEVEMENT_DEFS.map((def) => ({
    ...def,
    unlocked: def.check(ctx),
  }))
}

export function getUnlockedAchievementCount() {
  return getAchievements().filter((item) => item.unlocked).length
}

export function getDashboardStats() {
  const ctx = getAchievementContext()
  return {
    lessonCount: LESSON_DATA.length,
    lessonsCompleted: ctx.completedLessons,
    topicsCompleted: ctx.completedTopics,
    topicsTotal: ctx.totalTopics,
    progressPct: ctx.progressPct,
    streak: ctx.streak,
    achievementsUnlocked: getUnlockedAchievementCount(),
    achievementsTotal: ACHIEVEMENT_DEFS.length,
  }
}

export function topicKey(lessonId: string, subtopic: string) {
  return `${lessonId}:${subtopic}`
}

function ensurePerformance(
  store: ProgressStore,
  lessonId: string,
  subtopic: string,
): TopicPerformance {
  const key = topicKey(lessonId, subtopic)
  const now = new Date().toISOString()
  const existing = store.performance[key]
  if (existing) {
    existing.lastActivityAt = now
    return existing
  }
  const created: TopicPerformance = {
    lessonId,
    subtopic,
    hintsUsed: 0,
    sawAnswer: false,
    runs: 0,
    checks: 0,
    failedChecks: 0,
    errors: {},
    solved: false,
    firstActivityAt: now,
    lastActivityAt: now,
  }
  store.performance[key] = created
  return created
}

function countError(perf: TopicPerformance, category: ErrorCategory | null) {
  if (!category) return
  perf.errors[category] = (perf.errors[category] ?? 0) + 1
}

export function recordHintUsed(
  lessonId: string,
  subtopic: string,
  level: number,
) {
  const store = readStore()
  const perf = ensurePerformance(store, lessonId, subtopic)
  perf.hintsUsed = Math.max(perf.hintsUsed, level)
  if (level >= 4) perf.sawAnswer = true
  writeStore(store)
}

export function recordCodeRun(
  lessonId: string,
  subtopic: string,
  errorCategory: ErrorCategory | null,
) {
  const store = readStore()
  const perf = ensurePerformance(store, lessonId, subtopic)
  perf.runs += 1
  countError(perf, errorCategory)
  writeStore(store)
}

export function recordSolutionCheck(
  lessonId: string,
  subtopic: string,
  passed: boolean,
  errorCategory: ErrorCategory | null,
) {
  const store = readStore()
  const perf = ensurePerformance(store, lessonId, subtopic)
  perf.checks += 1
  if (passed) {
    if (!perf.solved) perf.solvedAt = new Date().toISOString()
    perf.solved = true
  } else {
    perf.failedChecks += 1
    countError(perf, errorCategory)
  }
  writeStore(store)
}

export function recordPracticeResult(record: Omit<PracticeRecord, 'at'>) {
  const store = readStore()
  store.practice = [
    ...store.practice,
    { ...record, at: new Date().toISOString() },
  ].slice(-MAX_PRACTICE_RECORDS)
  writeStore(store)
}

export function getAllPerformance(): Record<string, TopicPerformance> {
  return readStore().performance
}

export function getPracticeHistory(): PracticeRecord[] {
  return readStore().practice
}

export function getWarmupHistory(lessonId: string, subtopic: string): WarmupHistory {
  return readStore().warmups[topicKey(lessonId, subtopic)] ?? { attempt: 0, recent: [] }
}

export function saveWarmupVisit(lessonId: string, subtopic: string, shownIds: string[]) {
  const store = readStore()
  const key = topicKey(lessonId, subtopic)
  const previous = store.warmups[key] ?? { attempt: 0, recent: [] }
  store.warmups[key] = { attempt: previous.attempt + 1, recent: shownIds }
  writeStore(store)
}

export function getActivityDates(): string[] {
  return readStore().activityDates
}

export function markSubtopicComplete(lessonId: string, subtopic: string) {
  const store = readStore()
  const existing = store.completed[lessonId] ?? []
  if (existing.includes(subtopic)) return

  store.completed[lessonId] = [...existing, subtopic]
  const today = todayISO()
  if (!store.activityDates.includes(today)) {
    store.activityDates = [...store.activityDates, today]
  }
  writeStore(store)
}

export function isSubtopicComplete(lessonId: string, subtopic: string) {
  return (readStore().completed[lessonId] ?? []).includes(subtopic)
}

export function getLessonProgress(lessonId: string, total: number) {
  const completed = readStore().completed[lessonId]?.length ?? 0
  return {
    completed,
    total,
    percent: total > 0 ? Math.round((completed / total) * 100) : 0,
  }
}

export function getCompletedSubtopics(lessonId: string) {
  return readStore().completed[lessonId] ?? []
}

export function getLessonProgressPercent(lessonId: string) {
  const lesson = LESSON_DATA.find((item) => item.id === lessonId)
  if (!lesson) return 0
  return getLessonProgress(lessonId, lesson.subtopics.length).percent
}

export function buildCarouselItems(): CarouselItem[] {
  return CAROUSEL_META.map((meta) => {
    const lesson = LESSON_DATA.find((item) => item.id === meta.id)
    return {
      ...meta,
      exercises: lesson?.subtopics.length ?? meta.exercises,
      progress: getLessonProgressPercent(meta.id),
    }
  })
}
