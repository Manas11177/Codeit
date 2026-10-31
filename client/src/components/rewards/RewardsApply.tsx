import { useEffect, useState } from 'react'
import {
  applyAccentTokens,
  getAccentTheme,
} from '../../rewards/accentThemes'
import {
  STATS_UPDATED_EVENT,
  getRewardsSelection,
} from '../../utils/lessonProgress'
import './RewardsApply.css'

/** Applies selected accent theme CSS variables across the app. */
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
  const theme = getAccentTheme(getRewardsSelection()?.accentThemeId)

  useEffect(() => {
    applyAccentTokens(document.documentElement, theme)
    delete document.documentElement.dataset.rewardFrame
  }, [theme])

  return null
}
