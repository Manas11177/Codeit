import { useMemo, useState } from 'react'
import { PracticeSession } from '../components/practice/PracticeSession'
import { useLearningInsights } from '../hooks/useLearningInsights'
import {
  getLearningInsights,
  type ChapterInsight,
  type MasteryStatus,
  type TopicInsight,
} from '../learning/adaptiveEngine'
import { ERROR_TIPS } from '../learning/errors'
import {
  ACTIVITY_LABELS,
  availableKinds,
  buildPracticeSet,
  canGenerate,
  type PracticeQuestion,
  type PracticeSetOptions,
} from '../learning/questionGenerator'
import type { ActivityKind } from '../utils/lessonProgress'
import { goTo } from '../utils/navigation'
import './ProgressTracker.css'

type SessionConfig = {
  title: string
  subtitle: string
  options: Omit<PracticeSetOptions, 'insights' | 'seed'>
}

type ActiveSession = SessionConfig & {
  questions: PracticeQuestion[]
  nonce: number
}

const STATUS_LABEL: Record<MasteryStatus, string> = {
  mastered: 'Mastered',
  developing: 'Developing',
  weak: 'Needs work',
  'not-started': 'Not started',
}

const KIND_ICONS: Record<ActivityKind, string> = {
  mcq: '🔘',
  fill: '✏️',
  order: '🔀',
  code: '💻',
}

const ALL_KINDS: ActivityKind[] = ['mcq', 'fill', 'order', 'code']

function countFor(kinds: ActivityKind[] | undefined) {
  if (!kinds || kinds.length !== 1) return 8
  return kinds[0] === 'code' ? 3 : 5
}

export function ProgressTracker() {
  const insights = useLearningInsights()
  const [session, setSession] = useState<ActiveSession | null>(null)

  function startPractice(config: SessionConfig) {
    const questions = buildPracticeSet({
      ...config.options,
      insights: getLearningInsights(),
      seed: Date.now(),
    })
    setSession({ ...config, questions, nonce: Date.now() })
    window.scrollTo({ top: 0 })
  }

  if (session) {
    return (
      <PracticeSession
        key={session.nonce}
        title={session.title}
        subtitle={session.subtitle}
        source={session.options.source}
        questions={session.questions}
        onExit={() => setSession(null)}
        onNewSet={() => startPractice(session)}
      />
    )
  }

  const { totals } = insights

  return (
    <div className="pt">
      <div className="pt__glow" aria-hidden />
      <div className="pt__shell">
        <nav className="pt-nav">
          <button type="button" onClick={() => goTo('/')}>
            ← Dashboard
          </button>
          <button type="button" onClick={() => goTo('/lessons')}>
            Lessons
          </button>
        </nav>

        <header className="pt-hero">
          <span className="pt-eyebrow">Progress Tracker</span>
          <h1>Your learning, analyzed.</h1>
          <p>
            The adaptive coach studies your hints, mistakes, and solutions to
            find what needs attention. Everything below is optional — it
            recommends what to practice, you decide when and whether.
          </p>
        </header>

        <section className="pt-stats">
          <StatTile
            label="Chapters completed"
            value={`${totals.chaptersCompleted}/${totals.chaptersTotal}`}
          />
          <StatTile
            label="Concepts mastered"
            value={`${totals.conceptsMastered}/${totals.conceptsTotal}`}
          />
          <StatTile
            label="Problems solved"
            value={`${totals.problemsSolved}`}
            sub={`${totals.problemsAttempted} attempted`}
          />
          <StatTile
            label="Hints used"
            value={`${totals.hintsUsed}`}
            sub={`${totals.answersRevealed} answers revealed`}
          />
          <StatTile
            label="Practice accuracy"
            value={totals.practiceAccuracy === null ? '—' : `${totals.practiceAccuracy}%`}
            sub={`${totals.practiceAnswered} questions answered`}
          />
          <StatTile label="Streak" value={`${totals.streak} 🔥`} sub="days in a row" />
        </section>

        {!insights.hasData ? (
          <section className="pt-card pt-empty">
            <h2>No learning data yet</h2>
            <p>
              Complete a lesson topic and the coach will start analyzing how you
              solve problems. You can still practice any topic below.
            </p>
            <button type="button" className="pt-btn pt-btn--primary" onClick={() => goTo('/lessons')}>
              Start a lesson →
            </button>
          </section>
        ) : null}

        <TrainingSection insights={insights} onStart={startPractice} />

        <section className="pt-section">
          <div className="pt-section__head">
            <h2>Chapters</h2>
            <p>Coverage shows topics completed; understanding blends how you solved them with practice results.</p>
          </div>
          <div className="pt-chapters">
            {insights.chapters.map((chapter) => (
              <ChapterCard
                key={chapter.lessonId}
                chapter={chapter}
                onQuiz={() =>
                  startPractice({
                    title: `${chapter.title} — chapter quiz`,
                    subtitle: 'Six multiple-choice questions shaped by how you solved this chapter.',
                    options: {
                      source: 'chapter-quiz',
                      lessonId: chapter.lessonId,
                      kinds: ['mcq'],
                      count: 6,
                    },
                  })
                }
              />
            ))}
          </div>
        </section>

        {insights.hasData ? (
          <section className="pt-columns">
            <div className="pt-card">
              <h2>💪 Strengths</h2>
              {insights.strengths.length === 0 ? (
                <p className="pt-muted">
                  Topics you solve with few hints and no repeated mistakes will
                  show up here.
                </p>
              ) : (
                <ul className="pt-topic-list">
                  {insights.strengths.slice(0, 8).map((topic) => (
                    <TopicRow key={topic.key} topic={topic} />
                  ))}
                </ul>
              )}
            </div>
            <div className="pt-card">
              <h2>🧩 Weak concepts</h2>
              {insights.weaknesses.length === 0 ? (
                <p className="pt-muted">No weak concepts right now. Nice work!</p>
              ) : (
                <ul className="pt-topic-list">
                  {insights.weaknesses.slice(0, 8).map((topic) => (
                    <TopicRow key={topic.key} topic={topic} showReasons />
                  ))}
                </ul>
              )}
            </div>
          </section>
        ) : null}

        {insights.mistakes.length > 0 ? (
          <section className="pt-section">
            <div className="pt-section__head">
              <h2>Frequent mistakes</h2>
              <p>Collected from your code runs and solution checks.</p>
            </div>
            <div className="pt-mistakes">
              {insights.mistakes.slice(0, 6).map((mistake) => (
                <div key={mistake.category} className="pt-card pt-mistake">
                  <div className="pt-mistake__head">
                    <strong>{mistake.label}</strong>
                    <span>×{mistake.count}</span>
                  </div>
                  <p>{ERROR_TIPS[mistake.category]}</p>
                  <small>Seen in: {[...new Set(mistake.topics)].slice(0, 4).join(', ')}</small>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {insights.hasData ? <TrendSection insights={insights} /> : null}
      </div>
    </div>
  )
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="pt-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {sub ? <small>{sub}</small> : null}
    </div>
  )
}

function MasteryBar({ value }: { value: number | null }) {
  const width = value ?? 0
  const tone = value === null ? '' : value >= 80 ? 'is-good' : value >= 55 ? 'is-mid' : 'is-low'
  return (
    <div className="pt-bar">
      <div className={`pt-bar__fill ${tone}`} style={{ width: `${width}%` }} />
    </div>
  )
}

function TopicRow({ topic, showReasons }: { topic: TopicInsight; showReasons?: boolean }) {
  return (
    <li className="pt-topic">
      <div className="pt-topic__head">
        <div>
          <strong>{topic.subtopic}</strong>
          <small>{topic.lessonTitle}</small>
        </div>
        <span className={`pt-status pt-status--${topic.status}`}>
          {topic.mastery ?? '—'}%
        </span>
      </div>
      <MasteryBar value={topic.mastery} />
      {showReasons && topic.reasons.length > 0 ? (
        <div className="pt-reasons">
          {topic.reasons.map((reason) => (
            <span key={reason}>{reason}</span>
          ))}
        </div>
      ) : null}
    </li>
  )
}

function ChapterCard({ chapter, onQuiz }: { chapter: ChapterInsight; onQuiz: () => void }) {
  return (
    <div className={`pt-card pt-chapter pt-chapter--${chapter.status}`}>
      <div className="pt-chapter__head">
        <h3>{chapter.title}</h3>
        <span className={`pt-chapter__status pt-chapter__status--${chapter.status}`}>
          {chapter.status === 'completed'
            ? 'Completed'
            : chapter.status === 'in-progress'
              ? 'In progress'
              : 'Not started'}
        </span>
      </div>
      <div className="pt-chapter__metric">
        <span>Coverage</span>
        <span>
          {chapter.completedTopics}/{chapter.totalTopics}
        </span>
      </div>
      <MasteryBar value={chapter.coverage} />
      <div className="pt-chapter__metric">
        <span>Understanding</span>
        <span>{chapter.understanding === null ? '—' : `${chapter.understanding}%`}</span>
      </div>
      <MasteryBar value={chapter.understanding} />
      <div className="pt-chapter__facts">
        <span>✅ {chapter.problemsSolved} solved</span>
        <span>💡 {chapter.hintsUsed} hints</span>
        {chapter.weakCount > 0 ? <span>🧩 {chapter.weakCount} weak</span> : null}
      </div>
      <button
        type="button"
        className="pt-btn pt-btn--small"
        onClick={onQuiz}
        disabled={chapter.status === 'not-started'}
        title={chapter.status === 'not-started' ? 'Start this chapter to unlock its quiz' : undefined}
      >
        Chapter quiz (optional)
      </button>
    </div>
  )
}

function TrainingSection({
  insights,
  onStart,
}: {
  insights: ReturnType<typeof getLearningInsights>
  onStart: (config: SessionConfig) => void
}) {
  const [lessonId, setLessonId] = useState(insights.chapters[0]?.lessonId ?? '')
  const [subtopic, setSubtopic] = useState('')
  const lessonTopics = useMemo(
    () => insights.topics.filter((t) => t.lessonId === lessonId),
    [insights.topics, lessonId],
  )
  const lessonTitle = insights.chapters.find((c) => c.lessonId === lessonId)?.title ?? ''
  const pickerKinds = useMemo(() => {
    const scope = subtopic
      ? lessonTopics.filter((t) => t.subtopic === subtopic)
      : lessonTopics
    return new Set(scope.flatMap((t) => availableKinds(t)))
  }, [lessonTopics, subtopic])

  function startCustom(kind: ActivityKind | null) {
    const kinds = kind ? [kind] : undefined
    onStart({
      title: subtopic ? subtopic : lessonTitle,
      subtitle: kind ? ACTIVITY_LABELS[kind] : 'Mixed activities, adapted to your performance',
      options: {
        source: 'training',
        lessonId,
        subtopic: subtopic || undefined,
        kinds,
        count: countFor(kinds),
      },
    })
  }

  return (
    <section className="pt-section pt-training">
      <div className="pt-section__head">
        <h2>🎯 Personalized Training</h2>
        <p>Optional practice built from your weak areas. Pick any activity — or skip it entirely.</p>
      </div>

      {insights.recommendations.length > 0 ? (
        <>
          <div className="pt-recs">
            {insights.recommendations.slice(0, 4).map((topic) => (
              <div key={topic.key} className="pt-card pt-rec">
                <div className="pt-topic__head">
                  <div>
                    <strong>{topic.subtopic}</strong>
                    <small>{topic.lessonTitle}</small>
                  </div>
                  <span className={`pt-status pt-status--${topic.status}`}>
                    {STATUS_LABEL[topic.status]}
                  </span>
                </div>
                <MasteryBar value={topic.mastery} />
                {topic.reasons.length > 0 ? (
                  <div className="pt-reasons">
                    {topic.reasons.slice(0, 3).map((reason) => (
                      <span key={reason}>{reason}</span>
                    ))}
                  </div>
                ) : null}
                <p className="pt-rec__label">Suggested activities</p>
                <div className="pt-kinds">
                  {topic.suggestedKinds
                    .filter((kind) => canGenerate(topic, kind))
                    .slice(0, 3)
                    .map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      className="pt-kind"
                      onClick={() =>
                        onStart({
                          title: topic.subtopic,
                          subtitle: ACTIVITY_LABELS[kind],
                          options: {
                            source: 'training',
                            lessonId: topic.lessonId,
                            subtopic: topic.subtopic,
                            kinds: [kind],
                            count: countFor([kind]),
                          },
                        })
                      }
                    >
                      {KIND_ICONS[kind]} {ACTIVITY_LABELS[kind]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="pt-btn pt-btn--primary"
            onClick={() =>
              onStart({
                title: 'Your weak areas',
                subtitle: 'A mixed set focused on the topics that need the most work',
                options: { source: 'training', count: 8 },
              })
            }
          >
            Start a mixed set across all weak areas →
          </button>
        </>
      ) : insights.hasData ? (
        <div className="pt-card pt-allclear">
          <p>
            🎉 No weak areas detected right now. Want a challenge? The coach
            will pick harder questions from topics you have mastered.
          </p>
          <button
            type="button"
            className="pt-btn pt-btn--primary"
            onClick={() =>
              onStart({
                title: 'Challenge set',
                subtitle: 'Harder questions from topics you have already mastered',
                options: { source: 'training', count: 8 },
              })
            }
          >
            Start challenge set
          </button>
        </div>
      ) : null}

      <div className="pt-card pt-picker">
        <h3>Choose any topic</h3>
        <div className="pt-picker__row">
          <label>
            Chapter
            <select
              value={lessonId}
              onChange={(e) => {
                setLessonId(e.target.value)
                setSubtopic('')
              }}
            >
              {insights.chapters.map((chapter) => (
                <option key={chapter.lessonId} value={chapter.lessonId}>
                  {chapter.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Topic
            <select value={subtopic} onChange={(e) => setSubtopic(e.target.value)}>
              <option value="">All topics in this chapter</option>
              {lessonTopics.map((topic) => (
                <option key={topic.key} value={topic.subtopic}>
                  {topic.subtopic}
                  {topic.status !== 'not-started' ? ` — ${STATUS_LABEL[topic.status]}` : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="pt-kinds">
          <button type="button" className="pt-kind pt-kind--mixed" onClick={() => startCustom(null)}>
            ✨ Mixed
          </button>
          {ALL_KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              className="pt-kind"
              onClick={() => startCustom(kind)}
              disabled={!pickerKinds.has(kind)}
              title={
                pickerKinds.has(kind)
                  ? undefined
                  : 'Not available here — the solutions in this selection are too short'
              }
            >
              {KIND_ICONS[kind]} {ACTIVITY_LABELS[kind]}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

function TrendSection({ insights }: { insights: ReturnType<typeof getLearningInsights> }) {
  const maxDaily = Math.max(
    1,
    ...insights.trend.map((p) => p.topicsSolved + p.practiceAnswered),
  )
  return (
    <section className="pt-section">
      <div className="pt-section__head">
        <h2>Performance trends</h2>
        <p>Understanding per chapter, and your activity on recent learning days.</p>
      </div>
      <div className="pt-columns">
        <div className="pt-card">
          <h3>Understanding by chapter</h3>
          <div className="pt-chart">
            {insights.chapters.map((chapter, i) => (
              <div key={chapter.lessonId} className="pt-chart__col" title={chapter.title}>
                <span className="pt-chart__value">
                  {chapter.understanding === null ? '' : chapter.understanding}
                </span>
                <div className="pt-chart__track">
                  <div
                    className={`pt-chart__bar ${
                      chapter.understanding === null
                        ? ''
                        : chapter.understanding >= 80
                          ? 'is-good'
                          : chapter.understanding >= 55
                            ? 'is-mid'
                            : 'is-low'
                    }`}
                    style={{ height: `${chapter.understanding ?? 0}%` }}
                  />
                </div>
                <span className="pt-chart__label">Ch {i + 1}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="pt-card">
          <h3>Recent activity</h3>
          {insights.trend.length === 0 ? (
            <p className="pt-muted">Solve topics or practice to see your trend.</p>
          ) : (
            <>
              <div className="pt-chart">
                {insights.trend.map((point) => (
                  <div key={point.date} className="pt-chart__col" title={point.date}>
                    <span className="pt-chart__value">
                      {point.practiceAccuracy === null ? '' : `${point.practiceAccuracy}%`}
                    </span>
                    <div className="pt-chart__track pt-chart__track--stack">
                      <div
                        className="pt-chart__bar pt-chart__bar--practice"
                        style={{ height: `${(point.practiceAnswered / maxDaily) * 100}%` }}
                      />
                      <div
                        className="pt-chart__bar pt-chart__bar--solved"
                        style={{ height: `${(point.topicsSolved / maxDaily) * 100}%` }}
                      />
                    </div>
                    <span className="pt-chart__label">{point.date.slice(5)}</span>
                  </div>
                ))}
              </div>
              <div className="pt-legend">
                <span><i className="pt-legend__solved" /> Topics solved</span>
                <span><i className="pt-legend__practice" /> Practice answered</span>
                <span>% = practice accuracy that day</span>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
