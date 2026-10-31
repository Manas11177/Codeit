import { useEffect, useMemo, useState } from 'react'
import { LESSON_DATA } from '../carousel/lessonData'
import { useTheme } from '../context/ThemeContext'
import {
  STATS_UPDATED_EVENT,
  getAllPerformance,
  getCompletedSubtopics,
  isSubtopicComplete,
  queueStartLesson,
  topicKey,
} from '../utils/lessonProgress'
import { goTo, requireAuth } from '../utils/navigation'
import './CourseMap.css'

type TopicStatus = 'done' | 'in-progress' | 'not-started'

function topicStatus(lessonId: string, subtopic: string): TopicStatus {
  if (isSubtopicComplete(lessonId, subtopic)) return 'done'
  const perf = getAllPerformance()[topicKey(lessonId, subtopic)]
  if (perf) return 'in-progress'
  return 'not-started'
}

function findContinueTarget() {
  for (const lesson of LESSON_DATA) {
    for (const subtopic of lesson.subtopics) {
      if (!isSubtopicComplete(lesson.id, subtopic)) {
        return { lessonId: lesson.id, subtopic }
      }
    }
  }
  return null
}

const STATUS_ICON: Record<TopicStatus, string> = {
  done: '✓',
  'in-progress': '◐',
  'not-started': '○',
}

const STATUS_LABEL: Record<TopicStatus, string> = {
  done: 'Done',
  'in-progress': 'In progress',
  'not-started': 'Not started',
}

export function CourseMap() {
  const { darkMode } = useTheme()
  const [tick, setTick] = useState(0)
  const continueTarget = useMemo(() => {
    void tick
    return findContinueTarget()
  }, [tick])

  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const next: Record<string, boolean> = {}
    const target = findContinueTarget()
    for (const lesson of LESSON_DATA) {
      next[lesson.id] = target ? lesson.id === target.lessonId : lesson.id === LESSON_DATA[0]?.id
    }
    return next
  })

  useEffect(() => {
    function refresh() {
      setTick((n) => n + 1)
    }
    window.addEventListener(STATS_UPDATED_EVENT, refresh)
    return () => window.removeEventListener(STATS_UPDATED_EVENT, refresh)
  }, [])

  function expandAll() {
    const next: Record<string, boolean> = {}
    for (const lesson of LESSON_DATA) next[lesson.id] = true
    setExpanded(next)
  }

  function collapseAll() {
    const next: Record<string, boolean> = {}
    for (const lesson of LESSON_DATA) next[lesson.id] = false
    setExpanded(next)
  }

  function toggleChapter(lessonId: string) {
    setExpanded((prev) => ({ ...prev, [lessonId]: !prev[lessonId] }))
  }

  function openTopic(lessonId: string, subtopic: string) {
    queueStartLesson(lessonId, subtopic)
    void requireAuth('/lessons')
  }

  return (
    <div className={`cm ${darkMode ? 'cm--dark' : 'cm--light'}`}>
      <div className="cm__shell">
        <nav className="cm-nav">
          <button type="button" onClick={() => goTo('/')}>
            ← Dashboard
          </button>
          <button type="button" onClick={() => void requireAuth('/lessons')}>
            Lessons
          </button>
        </nav>

        <header className="cm-hero">
          <p className="cm-eyebrow">Course map</p>
          <h1>Your Python path</h1>
          <p>Browse every chapter and topic. Nothing is locked — jump in wherever you like.</p>
          <div className="cm-toolbar">
            <button type="button" onClick={expandAll}>
              Expand all
            </button>
            <button type="button" onClick={collapseAll}>
              Collapse all
            </button>
          </div>
        </header>

        <ul className="cm-tree" role="tree" aria-label="Course chapters">
          {LESSON_DATA.map((lesson, chapterIndex) => {
            const completed = getCompletedSubtopics(lesson.id)
            const doneCount = completed.length
            const total = lesson.subtopics.length
            const pct = total === 0 ? 0 : Math.round((doneCount / total) * 100)
            const isOpen = Boolean(expanded[lesson.id])
            const isLastChapter = chapterIndex === LESSON_DATA.length - 1

            return (
              <li
                key={lesson.id}
                className={`cm-chapter ${isLastChapter ? 'is-last' : ''}`}
                role="treeitem"
                aria-expanded={isOpen}
              >
                <button
                  type="button"
                  className="cm-chapter__btn"
                  aria-expanded={isOpen}
                  onClick={() => toggleChapter(lesson.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      toggleChapter(lesson.id)
                    }
                  }}
                >
                  <span className="cm-chapter__twist" aria-hidden="true">
                    {isOpen ? '▾' : '▸'}
                  </span>
                  <span className="cm-chapter__body">
                    <span className="cm-chapter__title">{lesson.title}</span>
                    <span className="cm-chapter__meta">
                      {doneCount}/{total} topics done
                    </span>
                    <span className="cm-bar" aria-hidden="true">
                      <span className="cm-bar__fill" style={{ width: `${pct}%` }} />
                    </span>
                  </span>
                </button>

                {isOpen ? (
                  <ul className="cm-topics" role="group">
                    {lesson.subtopics.map((subtopic, topicIndex) => {
                      const status = topicStatus(lesson.id, subtopic)
                      const isContinue =
                        continueTarget?.lessonId === lesson.id &&
                        continueTarget.subtopic === subtopic
                      const isLastTopic = topicIndex === lesson.subtopics.length - 1

                      return (
                        <li
                          key={subtopic}
                          className={`cm-topic ${isLastTopic ? 'is-last' : ''} ${
                            isContinue ? 'is-continue' : ''
                          }`}
                          role="treeitem"
                        >
                          <button
                            type="button"
                            className="cm-topic__btn"
                            onClick={() => openTopic(lesson.id, subtopic)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                openTopic(lesson.id, subtopic)
                              }
                            }}
                          >
                            <span
                              className={`cm-topic__status cm-topic__status--${status}`}
                              aria-hidden="true"
                            >
                              {STATUS_ICON[status]}
                            </span>
                            <span className="cm-topic__text">
                              <span className="cm-topic__name">{subtopic}</span>
                              <span className="cm-topic__meta">
                                {STATUS_LABEL[status]}
                                {isContinue ? ' · Continue here' : ''}
                              </span>
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                ) : null}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
