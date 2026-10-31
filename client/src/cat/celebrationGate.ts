/**
 * Lightweight bridge so cat toasts can wait on CelebrationPopup without
 * changing popup behaviour. CelebrationProvider updates these.
 */

import { STATS_UPDATED_EVENT } from '../utils/lessonProgress'

export const CELEBRATION_IDLE_EVENT = 'codementor-celebration-idle'

let celebrationBusy = false
/** Snapshot at capture-phase start of each stats event (before celebration queues). */
let busyAtStatsEventStart = false
let captureBound = false

export function setCelebrationBusy(busy: boolean) {
  const was = celebrationBusy
  celebrationBusy = busy
  if (was && !busy) {
    window.dispatchEvent(new CustomEvent(CELEBRATION_IDLE_EVENT))
  }
}

export function isCelebrationBusy() {
  return celebrationBusy
}

export function wasCelebrationBusyAtStatsStart() {
  return busyAtStatsEventStart
}

/** Call once from app boot so topic-complete can detect same-event popup queues. */
export function installCelebrationBusyCapture() {
  if (captureBound || typeof window === 'undefined') return
  captureBound = true
  window.addEventListener(
    STATS_UPDATED_EVENT,
    () => {
      busyAtStatsEventStart = celebrationBusy
    },
    true,
  )
}
