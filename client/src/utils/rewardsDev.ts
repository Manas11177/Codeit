/**
 * DEV ONLY — remove before production.
 * Console: __rewardsDev.help()
 */
import { LESSON_DATA } from '../carousel/lessonData'
import {
  getProgressStoreSnapshot,
  getProgressUserId,
  getTotalSubtopicCount,
  replaceProgressStoreSnapshot,
} from './lessonProgress'

export function installRewardsDevHelper() {
  if (!import.meta.env.DEV) return

  const api = {
    help() {
      console.info(
        '[rewards dev] setTopics(n) — mark first n topics complete locally (for unlock testing)',
      )
    },
    setTopics(n: number) {
      const count = Math.max(0, Math.floor(n))
      const total = getTotalSubtopicCount()
      const target = Math.min(count, total)
      const snap = getProgressStoreSnapshot()
      const completed: Record<string, string[]> = {}
      let left = target
      for (const lesson of LESSON_DATA) {
        if (left <= 0) break
        const take = Math.min(left, lesson.subtopics.length)
        completed[lesson.id] = lesson.subtopics.slice(0, take)
        left -= take
      }
      replaceProgressStoreSnapshot({
        ...snap,
        completed,
      })
      console.info(
        '[rewards dev] set completed topics to',
        target,
        '· user',
        getProgressUserId(),
      )
    },
  }

  ;(window as unknown as { __rewardsDev: typeof api }).__rewardsDev = api
}
