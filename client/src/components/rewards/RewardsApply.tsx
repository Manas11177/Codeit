import { useEffect, useState } from 'react'
import {
  STATS_UPDATED_EVENT,
  getRewardsSelection,
} from '../../utils/lessonProgress'
import './RewardsApply.css'

/** Applies selected accent theme across the app (frame wraps avatars only). */
export function RewardsApply() {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    function refresh() {
      setTick((n) => n + 1)
    }
    window.addEventListener(STATS_UPDATED_EVENT, refresh)
    return () => window.removeEventListener(STATS_UPDATED_EVENT, refresh)
  }, [])

  void tick
  const accentOn = getRewardsSelection()?.accentThemeId === 'accent-theme'

  useEffect(() => {
    const root = document.documentElement
    if (accentOn) {
      root.dataset.accentTheme = 'accent-theme'
      root.style.setProperty('--cm-accent', '#e11d48')
      root.style.setProperty('--cm-accent-soft', 'rgba(225, 29, 72, 0.16)')
    } else {
      delete root.dataset.accentTheme
      root.style.removeProperty('--cm-accent')
      root.style.removeProperty('--cm-accent-soft')
    }
    delete root.dataset.rewardFrame
  }, [accentOn])

  return null
}
