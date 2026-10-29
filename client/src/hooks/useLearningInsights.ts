import { useEffect, useState } from 'react'
import {
  getLearningInsights,
  type LearningInsights,
} from '../learning/adaptiveEngine'
import { STATS_UPDATED_EVENT } from '../utils/lessonProgress'

export function useLearningInsights(): LearningInsights {
  const [insights, setInsights] = useState(() => getLearningInsights())

  useEffect(() => {
    function refresh() {
      setInsights(getLearningInsights())
    }

    window.addEventListener(STATS_UPDATED_EVENT, refresh)
    return () => window.removeEventListener(STATS_UPDATED_EVENT, refresh)
  }, [])

  return insights
}
