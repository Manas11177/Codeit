import alertUrl from '../assets/cat/cat-alert.lottie?url'
import peekUrl from '../assets/cat/cat-peek.lottie?url'
import sleepUrl from '../assets/cat/cat-sleep.lottie?url'
import talkUrl from '../assets/cat/cat-talk.lottie?url'

export type CatPose = 'peek' | 'sleep' | 'alert' | 'talk'

/** talk is the black rainbow cat, the one that spins. It is the only pose that speaks. */
export const CAT_POSE_SRC: Record<CatPose, string> = {
  peek: peekUrl,
  sleep: sleepUrl,
  alert: alertUrl,
  talk: talkUrl,
}

/** Bundled stills, if a cat-xxx-still.png is added later. None ship today. */
const STILL_URLS = import.meta.glob('../assets/cat/*-still.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

export function catStillUrl(pose: CatPose): string | undefined {
  const key = Object.keys(STILL_URLS).find((path) => path.includes(`cat-${pose}-still`))
  return key ? STILL_URLS[key] : undefined
}
