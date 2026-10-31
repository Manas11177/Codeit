/**
 * Read-only snapshot of the question timer.
 * The timer component still owns the clock; this only publishes what it already shows.
 */

export type QuestionTimerSnap = 'off' | 'run' | 'alert'

let running = false
let remaining: number | null = null
let snap: QuestionTimerSnap = 'off'
const listeners = new Set<() => void>()

function compute(): QuestionTimerSnap {
  if (!running) return 'off'
  if (remaining != null && remaining > 0 && remaining <= 10) return 'alert'
  return 'run'
}

function publish() {
  const next = compute()
  if (next === snap) return
  snap = next
  listeners.forEach((fn) => fn())
}

export function subscribeQuestionTimer(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getQuestionTimerSnap(): QuestionTimerSnap {
  return snap
}

/** Practice / warmup question timer — cat must not talk while this is true. */
export function setQuestionTimerRunning(next: boolean) {
  running = next
  if (!next) remaining = null
  publish()
}

/** Called from QuestionTimer with the seconds it is already displaying. */
export function reportQuestionTimer(nextRemaining: number, nextRunning: boolean) {
  running = nextRunning
  remaining = nextRunning ? nextRemaining : null
  publish()
}

export function isQuestionTimerRunning() {
  return snap === 'run' || snap === 'alert'
}

export function isQuestionTimerAlert() {
  return snap === 'alert'
}
