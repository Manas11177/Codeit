import { useEffect, useState } from 'react'
import { LessonRing } from '../carousel/LessonRing'
import type { CarouselItem } from '../carousel/items'
import { goTo } from '../utils/navigation'
import {
  buildCarouselItems,
  consumeStartLesson,
  STATS_UPDATED_EVENT,
} from '../utils/lessonProgress'
import { LessonPage } from './LessonPage'
import './LessonPage.css'

export function Lessons() {
  const [selectedLesson, setSelectedLesson] = useState<string | null>(() =>
    consumeStartLesson(),
  )
  const [carouselItems, setCarouselItems] = useState<CarouselItem[]>(() =>
    buildCarouselItems(),
  )

  useEffect(() => {
    function refresh() {
      setCarouselItems(buildCarouselItems())
    }

    window.addEventListener(STATS_UPDATED_EVENT, refresh)
    return () => window.removeEventListener(STATS_UPDATED_EVENT, refresh)
  }, [])

  if (selectedLesson) {
    return (
      <LessonPage
        lessonId={selectedLesson}
        onBack={() => {
          setSelectedLesson(null)
          setCarouselItems(buildCarouselItems())
        }}
      />
    )
  }

  return (
    <div className="lessons-carousel-shell">
      <button
        type="button"
        className="lessons-home-link"
        onClick={() => goTo('/')}
      >
        ← Dashboard
      </button>
      <button
        type="button"
        className="lessons-home-link lessons-progress-link"
        onClick={() => goTo('/progress')}
      >
        📈 Progress & Practice
      </button>

      <div className="lessons-carousel-viewport">
        <LessonRing
          items={carouselItems}
          onLessonStart={(lessonId) => setSelectedLesson(lessonId)}
        />
      </div>
    </div>
  )
}
