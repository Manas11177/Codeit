/**
 * DEV ONLY — remove this file's install (and the __catDev calls) before production.
 * Console: __catDev.help()
 *
 * setMode unlocks the cat for this session even if the goodie is still locked,
 * and writes the profile setting. setState forces a companion pose.
 * say(trigger) speaks one line and skips the 45s / session cap.
 */
import {
  forceCatTrigger,
  resetCatSessionLimitsForDev,
  setCatDevBypassUnlock,
} from '../cat/catEngine'
import type { CatTriggerId } from '../cat/catMessages'
import type { CatPose } from '../cat/catAssets'
import { CAT_DEV_POSE_EVENT } from '../components/cat/CompanionCat'
import { saveProfile, type CatModeSetting } from './lessonProgress'

const TRIGGERS: CatTriggerId[] = [
  'streak3',
  'streak5',
  'topicComplete',
  'firstQuizOfDay',
  'dailyTarget',
  'returnAfterMiss',
  'quizHigh',
  'quizMid',
  'quizLow',
]

export function installCatDevHelper() {
  if (!import.meta.env.DEV) return

  const api = {
    help() {
      console.info(
        '[cat dev] setMode("off"|"reactions"|"companion") | setState("peek"|"sleep"|"alert"|"talk") | say(trigger) | streak3() | topicComplete() | firstQuizOfDay() | resetLimits() | help()',
      )
      console.info('[cat dev] say triggers:', TRIGGERS.join(', '))
    },
    setMode(mode: CatModeSetting) {
      if (mode !== 'off' && mode !== 'reactions' && mode !== 'companion') {
        console.warn('[cat dev] mode must be off, reactions, or companion')
        return
      }
      setCatDevBypassUnlock(true)
      saveProfile({ catMode: mode })
      window.dispatchEvent(new CustomEvent(CAT_DEV_POSE_EVENT, { detail: null }))
      console.info(`[cat dev] mode ${mode} (unlock bypassed for this session)`)
    },
    setState(pose: CatPose) {
      if (pose !== 'peek' && pose !== 'sleep' && pose !== 'alert' && pose !== 'talk') {
        console.warn('[cat dev] state must be peek, sleep, alert, or talk')
        return
      }
      window.dispatchEvent(new CustomEvent(CAT_DEV_POSE_EVENT, { detail: pose }))
      console.info(`[cat dev] pose ${pose}`)
    },
    say(trigger: CatTriggerId) {
      if (!TRIGGERS.includes(trigger)) {
        console.warn('[cat dev] unknown trigger. Use help()')
        return
      }
      window.dispatchEvent(new CustomEvent(CAT_DEV_POSE_EVENT, { detail: null }))
      forceCatTrigger(trigger)
      console.info(`[cat dev] said ${trigger}`)
    },
    streak3() {
      resetCatSessionLimitsForDev()
      forceCatTrigger('streak3')
      console.info('[cat dev] fired streak3')
    },
    topicComplete() {
      resetCatSessionLimitsForDev()
      forceCatTrigger('topicComplete')
      console.info('[cat dev] fired topicComplete')
    },
    firstQuizOfDay() {
      resetCatSessionLimitsForDev()
      forceCatTrigger('firstQuizOfDay')
      console.info('[cat dev] fired firstQuizOfDay')
    },
    resetLimits() {
      resetCatSessionLimitsForDev()
      console.info('[cat dev] session rate limits cleared')
    },
  }

  ;(window as unknown as { __catDev: typeof api }).__catDev = api
}
