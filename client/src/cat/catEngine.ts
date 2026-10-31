/**
 * Cat trigger engine: eligibility, rate limits, celebration deferral.
 * Does not change quiz scoring, timers, progress math, or celebration popups.
 *
 * Reactions keeps the old toast limits (6s gap, 8 per session, streak every 3).
 * Companion uses a 45s gap and 6 per session. Topic completed and daily target
 * skip the gap but still count toward the cap.
 */

import { getGoodieStatuses } from '../rewards/goodies'
import {
  STATS_UPDATED_EVENT,
  getActivityDates,
  getPreferences,
  getProfile,
  getProgressUserId,
  getTotalCompletedSubtopics,
  normalizeCatMode,
  type CatModeSetting,
} from '../utils/lessonProgress'
import {
  CELEBRATION_IDLE_EVENT,
  isCelebrationBusy,
  wasCelebrationBusyAtStatsStart,
} from './celebrationGate'
import {
  CAT_TRIGGER_MOOD,
  pickCatMessage,
  type CatMood,
  type CatTriggerId,
} from './catMessages'
import { isQuestionTimerRunning } from './questionTimerGate'

export type CatToastPayload = {
  message: string
  mood: CatMood
  trigger: CatTriggerId
  gapExempt?: boolean
}

type ShowFn = (payload: CatToastPayload) => void

const REACTIONS_GAP_MS = 6000
const REACTIONS_CAP = 8
const COMPANION_GAP_MS = 45000
const COMPANION_CAP = 6
const AFTER_POPUP_PAUSE_MS = 1500

const COMPANION_ONLY = new Set<CatTriggerId>([
  'streak5',
  'dailyTarget',
  'returnAfterMiss',
  'quizHigh',
  'quizMid',
  'quizLow',
])

const GAP_EXEMPT = new Set<CatTriggerId>(['topicComplete', 'dailyTarget'])

let showFn: ShowFn | null = null
let correctStreak = 0
let sessionCount = 0
let lastShownAt = 0
let topicsSeen: number | null = null
let topicUserId: string | null = null
let pending: CatToastPayload | null = null
let deferTimer: number | null = null
let idleBound = false
let requestSerial = 0
/** DEV ONLY — lets __catDev.setMode show the cat before the goodie is unlocked. */
let devBypassUnlock = false

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function yesterdayISO() {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return yesterday.toISOString().slice(0, 10)
}

function celebrationsStorageKey(userId: string | null) {
  return userId
    ? `codementor-celebrations-${userId}`
    : 'codementor-celebrations'
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

function activeMsKey() {
  return `codementor-cat-active-ms-${todayISO()}`
}

export function isCatModeUnlocked() {
  return (
    devBypassUnlock ||
    getGoodieStatuses().some((g) => g.id === 'cat-mode' && g.unlocked)
  )
}

export function getCatSetting(): CatModeSetting {
  return normalizeCatMode(getProfile()?.catMode)
}

export function isReactionsCatOn() {
  return getCatSetting() === 'reactions' && isCatModeUnlocked()
}

export function isCompanionCatOn() {
  return getCatSetting() === 'companion' && isCatModeUnlocked()
}

export function isCatModeOn() {
  return isReactionsCatOn() || isCompanionCatOn()
}

/** DEV ONLY — called from __catDev.setMode. */
export function setCatDevBypassUnlock(on: boolean) {
  devBypassUnlock = on
}

export function registerCatToastShower(fn: ShowFn | null) {
  showFn = fn
}

function rateAllows(payload: CatToastPayload) {
  const companion = isCompanionCatOn()
  const cap = companion ? COMPANION_CAP : REACTIONS_CAP
  const gap = companion ? COMPANION_GAP_MS : REACTIONS_GAP_MS
  if (sessionCount >= cap) return false
  const exempt = companion && Boolean(payload.gapExempt)
  if (!exempt && Date.now() - lastShownAt < gap) return false
  return true
}

function buildPayload(trigger: CatTriggerId): CatToastPayload {
  return {
    trigger,
    mood: CAT_TRIGGER_MOOD[trigger],
    message: pickCatMessage(trigger),
    gapExempt: GAP_EXEMPT.has(trigger),
  }
}

function deliver(payload: CatToastPayload, ignoreRate = false) {
  if (!showFn) return
  if (isQuestionTimerRunning()) {
    pending = payload
    return
  }
  if (!ignoreRate && !rateAllows(payload)) {
    pending = null
    return
  }
  lastShownAt = Date.now()
  sessionCount += 1
  pending = null
  showFn(payload)
}

function clearDeferTimer() {
  if (deferTimer != null) {
    window.clearTimeout(deferTimer)
    deferTimer = null
  }
}

function scheduleAfterCelebrations(payload: CatToastPayload, serial: number) {
  pending = payload
  ensureIdleListener()
  if (!isCelebrationBusy()) {
    clearDeferTimer()
    deferTimer = window.setTimeout(() => {
      deferTimer = null
      if (serial !== requestSerial || !pending) return
      if (isCelebrationBusy() || isQuestionTimerRunning()) return
      deliver(pending)
    }, AFTER_POPUP_PAUSE_MS)
  }
}

function ensureIdleListener() {
  if (idleBound) return
  idleBound = true
  window.addEventListener(CELEBRATION_IDLE_EVENT, () => {
    if (!pending) return
    const serial = requestSerial
    clearDeferTimer()
    deferTimer = window.setTimeout(() => {
      deferTimer = null
      if (serial !== requestSerial || !pending) return
      if (isCelebrationBusy() || isQuestionTimerRunning()) return
      deliver(pending)
    }, AFTER_POPUP_PAUSE_MS)
  })
}

/**
 * @param dropIfCelebrationJustQueued — same-event competition: drop the cat
 *   when a celebration became busy for this event (e.g. topic unlocks a goodie).
 * Newer requests replace any phrase already waiting.
 */
function requestCat(
  trigger: CatTriggerId,
  dropIfCelebrationJustQueued: boolean,
) {
  if (!isCatModeOn() || !showFn) return
  if (COMPANION_ONLY.has(trigger) && !isCompanionCatOn()) return

  const serial = ++requestSerial
  const payload = buildPayload(trigger)
  pending = payload

  window.setTimeout(() => {
    if (serial !== requestSerial) return
    const nowBusy = isCelebrationBusy()
    const wasBusy = wasCelebrationBusyAtStatsStart()
    if (dropIfCelebrationJustQueued && !wasBusy && nowBusy) {
      pending = null
      return
    }
    if (nowBusy) {
      scheduleAfterCelebrations(payload, serial)
      return
    }
    if (isQuestionTimerRunning()) {
      pending = payload
      return
    }
    deliver(payload)
  }, 0)
}

/** Call after an answer is submitted (timer already paused). */
export function notifyCatQuizAnswer(input: {
  correct: boolean
  timedOut?: boolean
}) {
  const reactions = isReactionsCatOn()
  const companion = isCompanionCatOn()
  if (!reactions && !companion) {
    if (input.timedOut || !input.correct) correctStreak = 0
    return
  }

  if (input.timedOut || !input.correct) {
    correctStreak = 0
    return
  }

  correctStreak += 1

  const uid = getProgressUserId()
  const firstId = `cat:first-quiz:${todayISO()}`
  if (!hasShown(uid, firstId)) {
    markShown(uid, firstId)
    requestCat('firstQuizOfDay', false)
  }

  if (companion) {
    if (correctStreak === 3) requestCat('streak3', false)
    if (correctStreak === 5) requestCat('streak5', false)
    return
  }

  if (correctStreak > 0 && correctStreak % 3 === 0) {
    requestCat('streak3', false)
  }
}

/** Result screen only. Scoring is computed by the summary; this only reads it. */
export function notifyCatQuizFinished(score: number) {
  if (!isCompanionCatOn()) return
  const trigger = score >= 90 ? 'quizHigh' : score >= 50 ? 'quizMid' : 'quizLow'
  requestCat(trigger, score === 100)
}

function maybeReturnVisit() {
  if (!isCompanionCatOn()) return
  const dates = getActivityDates()
  const today = todayISO()
  if (!dates.includes(today)) return
  const lastPrior = dates.filter((day) => day < today).sort().at(-1)
  if (!lastPrior || lastPrior >= yesterdayISO()) return
  const id = `cat:return:${today}`
  const uid = getProgressUserId()
  if (hasShown(uid, id)) return
  markShown(uid, id)
  requestCat('returnAfterMiss', false)
}

/** Watch completed-topic count; call once from CatToastProvider. */
export function initCatTopicWatcher() {
  topicUserId = getProgressUserId()
  topicsSeen = getTotalCompletedSubtopics()

  function onStats() {
    const uid = getProgressUserId()
    const next = getTotalCompletedSubtopics()
    if (uid !== topicUserId) {
      topicUserId = uid
      topicsSeen = next
      return
    }
    const prev = topicsSeen
    topicsSeen = next
    if (prev != null && next > prev) {
      requestCat('topicComplete', true)
    }
    maybeReturnVisit()
  }

  maybeReturnVisit()
  window.addEventListener(STATS_UPDATED_EVENT, onStats)
  return () => window.removeEventListener(STATS_UPDATED_EVENT, onStats)
}

/**
 * Companion-only clock. Reads the saved daily-minutes preference.
 * Does not write progress. Time is kept in sessionStorage for this browser day.
 */
export function initCatDailyWatch() {
  let acc = Number(sessionStorage.getItem(activeMsKey()) || 0)
  if (!Number.isFinite(acc) || acc < 0) acc = 0
  let last = Date.now()

  const id = window.setInterval(() => {
    const now = Date.now()
    const elapsed = now - last
    last = now
    if (document.hidden || !isCompanionCatOn()) return
    acc += elapsed
    try {
      sessionStorage.setItem(activeMsKey(), String(Math.floor(acc)))
    } catch {
      /* private mode */
    }
    const prefs = getPreferences()
    const mins = prefs && !prefs.skipped ? prefs.dailyMinutes : undefined
    if (!mins) return
    const flag = `cat:daily-target:${todayISO()}`
    const uid = getProgressUserId()
    if (acc < mins * 60 * 1000 || hasShown(uid, flag)) return
    markShown(uid, flag)
    requestCat('dailyTarget', false)
  }, 5000)

  return () => window.clearInterval(id)
}

/** Flush a deferred cat if the timer just stopped and celebrations are clear. */
export function nudgeCatAfterTimerClear() {
  if (!pending || isCelebrationBusy() || isQuestionTimerRunning()) return
  const serial = requestSerial
  clearDeferTimer()
  deferTimer = window.setTimeout(() => {
    deferTimer = null
    if (serial !== requestSerial || !pending) return
    if (isCelebrationBusy() || isQuestionTimerRunning()) return
    deliver(pending)
  }, 0)
}

/**
 * Companion says a celebration line with the black rainbow cat.
 * Not held for the popup: this line is the congrats itself.
 * Reactions mode keeps the popup only, with no extra toast.
 */
export function speakCatCelebration(message: string) {
  if (!isCompanionCatOn() || !showFn) return
  const line = message.replace(/\s+/g, ' ').trim()
  if (!line) return
  showFn({
    message: line,
    mood: 'excited',
    trigger: 'topicComplete',
    gapExempt: true,
  })
}

/** DEV / tests — force a trigger, bypassing unlock and frequency. */
export function forceCatTrigger(trigger: CatTriggerId) {
  const serial = ++requestSerial
  const payload = buildPayload(trigger)
  pending = payload
  if (isCelebrationBusy()) {
    scheduleAfterCelebrations(payload, serial)
    return
  }
  if (isQuestionTimerRunning()) return
  deliver(payload, true)
}

export function resetCatSessionLimitsForDev() {
  sessionCount = 0
  lastShownAt = 0
  correctStreak = 0
}
