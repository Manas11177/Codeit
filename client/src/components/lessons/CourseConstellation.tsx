import { useEffect, useId, useMemo, useState } from 'react'
import { LESSON_DATA } from '../../carousel/lessonData'
import {
  STATS_UPDATED_EVENT,
  getCompletedSubtopics,
  getProfile,
  getTotalCompletedSubtopics,
  getTotalSubtopicCount,
  isSubtopicComplete,
} from '../../utils/lessonProgress'
import './CourseConstellation.css'

type Point = { x: number; y: number }

type TopicNode = {
  lessonId: string
  subtopic: string
  point: Point
  done: boolean
  isCurrent: boolean
}

type ChapterNode = {
  id: string
  title: string
  point: Point
  doneCount: number
  total: number
  topics: TopicNode[]
}

function findCurrentTopic() {
  for (const lesson of LESSON_DATA) {
    for (const subtopic of lesson.subtopics) {
      if (!isSubtopicComplete(lesson.id, subtopic)) {
        return { lessonId: lesson.id, subtopic }
      }
    }
  }
  return null
}

function buildLayout(vertical: boolean) {
  const current = findCurrentTopic()
  const chapterCount = Math.max(LESSON_DATA.length, 1)
  const width = vertical ? 360 : 860
  const topPad = 40
  const bottomPad = 36
  const chapterGap = vertical ? 92 : 82
  const height = topPad + chapterCount * chapterGap + bottomPad

  const chapters: ChapterNode[] = []
  const lines: {
    x1: number
    y1: number
    x2: number
    y2: number
    kind: 'trunk' | 'branch'
  }[] = []

  let prevChapter: Point | null = null

  LESSON_DATA.forEach((lesson, index) => {
    const t = chapterCount === 1 ? 0.5 : index / (chapterCount - 1)
    const y = topPad + index * chapterGap
    const x = vertical
      ? 78
      : width * 0.42 + Math.sin(t * Math.PI * 1.35) * (width * 0.16)

    const point = { x, y }
    if (prevChapter) {
      lines.push({
        x1: prevChapter.x,
        y1: prevChapter.y,
        x2: point.x,
        y2: point.y,
        kind: 'trunk',
      })
    }
    prevChapter = point

    const completed = getCompletedSubtopics(lesson.id)
    const topics: TopicNode[] = []
    const topicCount = lesson.subtopics.length
    const branchSide = index % 2 === 0 ? 1 : -1

    lesson.subtopics.forEach((subtopic, topicIndex) => {
      const along = topicCount <= 1 ? 0.5 : topicIndex / (topicCount - 1)
      let tx: number
      let ty: number
      if (vertical) {
        tx = point.x + 52 + Math.min(topicIndex, 6) * 30
        ty = point.y - 18 + topicIndex * 11 * 0.35
      } else {
        const spread = 24 + along * 58
        const drift = (along - 0.5) * 36 + Math.sin(topicIndex * 1.1) * 8
        tx = point.x + branchSide * spread
        ty = point.y + drift * 0.55
      }

      const topicPoint = { x: tx, y: ty }
      lines.push({
        x1: point.x,
        y1: point.y,
        x2: topicPoint.x,
        y2: topicPoint.y,
        kind: 'branch',
      })
      topics.push({
        lessonId: lesson.id,
        subtopic,
        point: topicPoint,
        done: completed.includes(subtopic),
        isCurrent:
          current?.lessonId === lesson.id && current.subtopic === subtopic,
      })
    })

    chapters.push({
      id: lesson.id,
      title: lesson.title,
      point,
      doneCount: completed.length,
      total: topicCount,
      topics,
    })
  })

  return { chapters, lines, width, height }
}

export function CourseConstellation() {
  const reactId = useId().replace(/:/g, '')
  const [tick, setTick] = useState(0)
  const [vertical, setVertical] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(max-width: 720px)').matches
      : false,
  )

  useEffect(() => {
    function refresh() {
      setTick((n) => n + 1)
    }
    window.addEventListener(STATS_UPDATED_EVENT, refresh)
    return () => window.removeEventListener(STATS_UPDATED_EVENT, refresh)
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)')
    function onChange() {
      setVertical(mq.matches)
    }
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const layout = useMemo(() => {
    void tick
    return buildLayout(vertical)
  }, [tick, vertical])

  const topicsDone = getTotalCompletedSubtopics()
  const topicsTotal = getTotalSubtopicCount()
  const chaptersDone = LESSON_DATA.filter(
    (lesson) =>
      lesson.subtopics.length > 0 &&
      getCompletedSubtopics(lesson.id).length >= lesson.subtopics.length,
  ).length
  const isEmpty = topicsDone === 0
  const displayName = getProfile()?.displayName?.trim() || null
  const glowId = `cc-glow-${reactId}`
  const softId = `cc-soft-${reactId}`
  const chapterR = 10

  const ariaLabel = `Course constellation. ${chaptersDone} of ${LESSON_DATA.length} chapters complete. ${topicsDone} of ${topicsTotal} topics complete.`

  return (
    <section className="cc" aria-label={ariaLabel}>
      <div className="cc__head">
        <div>
          <p className="cc__eyebrow">Course constellation</p>
          <h2>Your path among the stars</h2>
        </div>
        <p className="cc__count">
          {topicsDone} of {topicsTotal} topics
        </p>
      </div>

      <div className="cc__sky">
        <div className="cc__brand" aria-hidden="true">
          <span className="cc__wordmark">CodeMentor</span>
          {displayName ? <span className="cc__learner">{displayName}</span> : null}
        </div>

        <svg
          className="cc__svg"
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          role="img"
          aria-label={ariaLabel}
        >
          <defs>
            <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fff7c2" stopOpacity="0.95" />
              <stop offset="55%" stopColor="var(--cm-accent)" stopOpacity="0.55" />
              <stop offset="100%" stopColor="var(--cm-accent)" stopOpacity="0" />
            </radialGradient>
            <filter id={softId} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.6" />
            </filter>
          </defs>

          {Array.from({ length: 22 }, (_, i) => {
            const x = ((i * 97) % (layout.width - 24)) + 12
            const y = ((i * 53) % (layout.height - 24)) + 12
            return (
              <circle
                key={`dust-${i}`}
                className="cc-dust"
                cx={x}
                cy={y}
                r={i % 3 === 0 ? 1.2 : 0.7}
              />
            )
          })}

          {layout.lines.map((line, index) => (
            <line
              key={`line-${index}`}
              className={[
                line.kind === 'trunk' ? 'cc-line cc-line--trunk' : 'cc-line cc-line--branch',
                isEmpty ? 'is-faint' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
            />
          ))}

          {layout.chapters.map((chapter) => {
            const pct = isEmpty
              ? 0
              : chapter.total === 0
                ? 0
                : chapter.doneCount / chapter.total
            const fillId = `cc-fill-${reactId}-${chapter.id}`
            const r = chapterR
            const labelSide =
              vertical || chapter.point.x < layout.width * 0.45 ? 1 : -1
            const labelX = chapter.point.x + labelSide * (r + 12)
            const labelAnchor = labelSide > 0 ? 'start' : 'end'

            return (
              <g
                key={chapter.id}
                className={`cc-chapter ${isEmpty ? 'is-faint' : ''}`}
              >
                <defs>
                  <clipPath id={fillId}>
                    <rect
                      x={chapter.point.x - r}
                      y={chapter.point.y + r - r * 2 * pct}
                      width={r * 2}
                      height={r * 2 * pct}
                    />
                  </clipPath>
                </defs>
                <circle
                  className="cc-chapter__halo"
                  cx={chapter.point.x}
                  cy={chapter.point.y}
                  r={r + 5}
                />
                <circle
                  className="cc-chapter__base"
                  cx={chapter.point.x}
                  cy={chapter.point.y}
                  r={r}
                />
                {!isEmpty ? (
                  <circle
                    className="cc-chapter__fill"
                    cx={chapter.point.x}
                    cy={chapter.point.y}
                    r={r}
                    clipPath={`url(#${fillId})`}
                  />
                ) : null}
                <text
                  className="cc-chapter__label"
                  x={labelX}
                  y={chapter.point.y + 4}
                  textAnchor={labelAnchor}
                >
                  {chapter.title}
                </text>

                {chapter.topics.map((topic) => {
                  const className = isEmpty
                    ? 'cc-topic is-dim is-faint'
                    : topic.done
                      ? 'cc-topic is-done'
                      : topic.isCurrent
                        ? 'cc-topic is-current'
                        : 'cc-topic is-dim'

                  return (
                    <g
                      key={`${topic.lessonId}:${topic.subtopic}`}
                      className={className}
                      tabIndex={0}
                    >
                      <title>{topic.subtopic}</title>
                      {!isEmpty && (topic.done || topic.isCurrent) ? (
                        <circle
                          className="cc-topic__glow"
                          cx={topic.point.x}
                          cy={topic.point.y}
                          r={topic.isCurrent ? 7 : 5.5}
                          fill={`url(#${glowId})`}
                          filter={`url(#${softId})`}
                        />
                      ) : null}
                      <circle
                        className="cc-topic__core"
                        cx={topic.point.x}
                        cy={topic.point.y}
                        r={topic.done ? 3.2 : topic.isCurrent ? 3.4 : 2.4}
                      />
                    </g>
                  )
                })}
              </g>
            )
          })}
        </svg>

        {isEmpty ? (
          <p className="cc__empty">Complete a topic to light your first star</p>
        ) : null}
      </div>

      <ul className="cc-legend" aria-label="Constellation legend">
        <li>
          <span className="cc-legend__swatch cc-legend__swatch--done" />
          Completed topic
        </li>
        <li>
          <span className="cc-legend__swatch cc-legend__swatch--current" />
          Current / next topic
        </li>
        <li>
          <span className="cc-legend__swatch cc-legend__swatch--dim" />
          Not started
        </li>
        <li>
          <span className="cc-legend__swatch cc-legend__swatch--chapter" />
          Chapter (fills as topics complete)
        </li>
      </ul>
    </section>
  )
}
