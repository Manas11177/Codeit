import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { notifyCatQuizAnswer, nudgeCatAfterTimerClear } from '../cat/catEngine'
import { setQuestionTimerRunning } from '../cat/questionTimerGate'
import { LESSON_DATA } from '../carousel/lessonData'
import { runPlaygroundCode } from '../api/playground'
import { CodeEditor } from '../components/editor/CodeEditor'
import { ConceptDiagram } from '../components/diagrams/ConceptDiagram'
import { DoubtAssistant } from '../components/doubts/DoubtAssistant'
import {
  FillView,
  McqView,
  OrderView,
  QUESTION_TIME_LIMITS,
  QuestionTimer,
} from '../components/practice/PracticeSession'
import { getConceptExplainer } from '../data/lessonExplanations'
import { getSubtopicExercise } from '../data/subtopicContent'
import { codesMatch, outputsMatch } from '../utils/codeCompare'
import { useUserStats } from '../hooks/useUserStats'
import { getLearningInsights } from '../learning/adaptiveEngine'
import { classifyError } from '../learning/errors'
import {
  buildSectionQuestions,
  type PracticeQuestion,
} from '../learning/questionGenerator'
import type { TutorTopic } from '../learning/topicTutor'
import {
  getLessonProgress,
  getWarmupHistory,
  isSubtopicComplete,
  markSubtopicComplete,
  recordCodeRun,
  recordHintUsed,
  recordPracticeResult,
  recordSolutionCheck,
  saveWarmupVisit,
} from '../utils/lessonProgress'
import { clipboardBlockProps } from '../utils/blockClipboard'
import { requireAuth } from '../utils/navigation'
import '../components/practice/PracticeSession.css'
import './SubtopicSession.css'

type WarmupKind = 'mcq' | 'fill' | 'order'
type WarmupResult = 'correct' | 'wrong' | 'skipped'
type PageId = 'learn' | WarmupKind | 'practice'
type PageStatus = 'done' | 'current' | 'open' | 'locked'

function WarmupTimerBridge({ running }: { running: boolean }) {
  useEffect(() => {
    setQuestionTimerRunning(running)
    if (!running) nudgeCatAfterTimerClear()
    return () => setQuestionTimerRunning(false)
  }, [running])
  return null
}

const PAGE_META: Record<PageId, { label: string; title: string; icon: string; intro: string }> = {
  learn: {
    label: 'Learn',
    title: 'Understand the concept',
    icon: '💡',
    intro: 'Read slowly. Everything is explained in simple words.',
  },
  mcq: {
    label: 'Multiple choice',
    title: 'Multiple choice',
    icon: '🎯',
    intro: 'Pick the right answer. Wrong answers are fine — read the explanation and learn from it.',
  },
  fill: {
    label: 'Fill blanks',
    title: 'Fill in the blanks',
    icon: '✏️',
    intro: 'Type or tap the missing piece of code.',
  },
  order: {
    label: 'Arrange',
    title: 'Arrange in order',
    icon: '🔀',
    intro:
      'Put the lines in the order they run. If a line does not belong, leave it out.',
  },
  practice: {
    label: 'Program',
    title: 'Write the program',
    icon: '🚀',
    intro: 'Now write the code yourself. Use the hints on the right if you get stuck.',
  },
}

const WARMUP_ORDER: WarmupKind[] = ['mcq', 'fill', 'order']

type SubtopicSessionProps = {
  lessonId: string
  lessonTitle: string
  subtopic: string
  onBack: () => void
  onSubtopicSelect?: (subtopic: string) => void
}

function lessonShortTitle(title: string) {
  return title
    .replace(/^Introduction to /i, '')
    .replace(/ & /g, ' ')
}

function isWarmup(page: PageId): page is WarmupKind {
  return page === 'mcq' || page === 'fill' || page === 'order'
}

export function SubtopicSession({
  lessonId,
  lessonTitle,
  subtopic,
  onBack,
  onSubtopicSelect,
}: SubtopicSessionProps) {
  const lesson = LESSON_DATA.find((l) => l.id === lessonId)
  const lessonIndex = LESSON_DATA.findIndex((l) => l.id === lessonId)
  const subtopicIndex = lesson?.subtopics.indexOf(subtopic) ?? 0

  const exercise = useMemo(
    () => getSubtopicExercise(lessonId, lessonTitle, subtopic),
    [lessonId, lessonTitle, subtopic],
  )

  const stats = useUserStats()

  const progress = useMemo(
    () => getLessonProgress(lessonId, lesson?.subtopics.length ?? 0),
    [lessonId, lesson?.subtopics.length, stats.topicsCompleted],
  )

  const [code, setCode] = useState(exercise.starterCode)
  const [hintsUsed, setHintsUsed] = useState(0)
  const [revealedHints, setRevealedHints] = useState<string[]>([])
  const [expandedHint, setExpandedHint] = useState<number | null>(null)
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [running, setRunning] = useState(false)
  const [success, setSuccess] = useState(false)
  const [exampleOutput, setExampleOutput] = useState('')
  const [exampleRunning, setExampleRunning] = useState(false)

  const explainer = getConceptExplainer(lessonId, subtopic)
  const tutorTopic: TutorTopic = useMemo(
    () => ({ lessonId, lessonTitle, subtopic, exercise, explainer }),
    [lessonId, lessonTitle, subtopic, exercise, explainer],
  )

  const [reviewMode] = useState(() => isSubtopicComplete(lessonId, subtopic))
  const [warmups] = useState(() =>
    buildSectionQuestions(
      getLearningInsights(),
      lessonId,
      subtopic,
      Date.now(),
      getWarmupHistory(lessonId, subtopic),
    ),
  )

  useEffect(() => {
    const shownIds = WARMUP_ORDER.flatMap((kind) => warmups[kind]?.id ?? [])
    saveWarmupVisit(lessonId, subtopic, shownIds)
  }, [lessonId, subtopic, warmups])

  const pages: PageId[] = [
    'learn',
    ...WARMUP_ORDER.filter((kind) => warmups[kind] !== null),
    'practice',
  ]
  const [pageIndex, setPageIndex] = useState(0)
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')
  const [learnDone, setLearnDone] = useState(reviewMode)
  const [answers, setAnswers] = useState<Partial<Record<WarmupKind, WarmupResult>>>({})
  const [warmupTimedOut, setWarmupTimedOut] = useState<Partial<Record<WarmupKind, boolean>>>({})

  const page = pages[pageIndex]
  const lessonLabel = `${lessonIndex + 1}.${subtopicIndex + 1}`
  const nextSubtopic = lesson?.subtopics[subtopicIndex + 1]

  function isPageComplete(id: PageId) {
    if (id === 'learn') return learnDone
    if (isWarmup(id)) return answers[id] !== undefined
    return success
  }

  function isPageUnlocked(index: number) {
    if (reviewMode || index === 0) return true
    return pages.slice(0, index).every(isPageComplete)
  }

  function pageStatus(index: number): PageStatus {
    if (index === pageIndex) return 'current'
    if (isPageComplete(pages[index])) return 'done'
    return isPageUnlocked(index) ? 'open' : 'locked'
  }

  function goToPage(index: number) {
    if (index < 0 || index >= pages.length || !isPageUnlocked(index)) return
    setDirection(index >= pageIndex ? 'forward' : 'back')
    setPageIndex(index)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function finishLearning() {
    setLearnDone(true)
    setDirection('forward')
    setPageIndex(1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function skipWarmup(kind: WarmupKind) {
    setAnswers((prev) => ({ ...prev, [kind]: prev[kind] ?? 'skipped' }))
    setDirection('forward')
    setPageIndex((index) => Math.min(index + 1, pages.length - 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleWarmupAnswer(
    kind: WarmupKind,
    question: PracticeQuestion,
    correct: boolean,
    fromTimeout = false,
  ) {
    if (answers[kind] !== undefined && answers[kind] !== 'skipped') return
    setAnswers((prev) => ({ ...prev, [kind]: correct ? 'correct' : 'wrong' }))
    recordPracticeResult({
      questionId: question.baseId,
      lessonId,
      subtopic,
      kind: question.kind,
      difficulty: question.difficulty,
      correct,
      usedHint: false,
      source: 'lesson',
    })
    notifyCatQuizAnswer({ correct, timedOut: fromTimeout })
  }

  async function handleRunExample() {
    setExampleRunning(true)
    setExampleOutput('')
    try {
      const result = await runPlaygroundCode(exercise.exampleCode)
      setExampleOutput(result.error || result.output || '(no output)')
    } catch (err) {
      setExampleOutput(err instanceof Error ? err.message : 'Could not run example.')
    } finally {
      setExampleRunning(false)
    }
  }

  async function handleRun() {
    setRunning(true)
    setError('')
    setOutput('')
    try {
      const result = await runPlaygroundCode(code)
      setOutput(result.error || result.output || '(no output)')
      if (result.error) setError(result.error)
      recordCodeRun(lessonId, subtopic, classifyError(result.error))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Run failed.')
    } finally {
      setRunning(false)
    }
  }

  async function handleCheck() {
    setError('')
    setSuccess(false)
    if (!code.trim()) {
      setError('Write your code first — you learn by typing it yourself!')
      return
    }
    if (codesMatch(code, exercise.solution)) {
      setSuccess(true)
      recordSolutionCheck(lessonId, subtopic, true, null)
      markSubtopicComplete(lessonId, subtopic)
      return
    }
    try {
      const result = await runPlaygroundCode(code)
      const out = (result.output || '').trim()
      if (!result.error && outputsMatch(out, exercise.expectedOutput)) {
        setSuccess(true)
        recordSolutionCheck(lessonId, subtopic, true, null)
        markSubtopicComplete(lessonId, subtopic)
        setOutput(out)
        return
      }
      recordSolutionCheck(lessonId, subtopic, false, classifyError(result.error) ?? 'WrongOutput')
      setOutput(result.error || result.output || '')
      setError('Not quite right yet. Compare your output with the challenge, or use a hint.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check your code.')
    }
  }

  function revealHint() {
    if (hintsUsed >= 4) return
    const next = hintsUsed + 1
    setHintsUsed(next)
    recordHintUsed(lessonId, subtopic, next)
    const text = next <= 3 ? exercise.hints[next - 1] : `Answer:\n${exercise.solution}`
    setRevealedHints((prev) => [...prev, text])
    setExpandedHint(next - 1)
  }

  function handleResetCode() {
    setCode(exercise.starterCode)
    setOutput('')
    setError('')
    setSuccess(false)
  }

  function goToNextSubtopic() {
    if (!lesson) return
    const next = lesson.subtopics[subtopicIndex + 1]
    if (next && onSubtopicSelect) {
      onSubtopicSelect(next)
    } else {
      onBack()
    }
  }

  function renderWarmup(kind: WarmupKind, question: PracticeQuestion) {
    const settled = answers[kind] === 'correct' || answers[kind] === 'wrong'
    const timedOut = Boolean(warmupTimedOut[kind])
    const onAnswer = (correct: boolean) => handleWarmupAnswer(kind, question, correct)
    const onTimeout = () => {
      setWarmupTimedOut((prev) => ({ ...prev, [kind]: true }))
      handleWarmupAnswer(kind, question, false, true)
    }

    const view =
      question.kind === 'mcq' ? (
        <McqView question={question} onAnswer={onAnswer} timedOut={timedOut} />
      ) : question.kind === 'fill' ? (
        <FillView question={question} onAnswer={onAnswer} timedOut={timedOut} />
      ) : question.kind === 'order' ? (
        <OrderView question={question} onAnswer={onAnswer} timedOut={timedOut} />
      ) : null

    if (!view) return null

    return (
      <div key={question.id}>
        <WarmupTimerBridge running={!settled} />
        <QuestionTimer
          totalSeconds={QUESTION_TIME_LIMITS[kind][question.difficulty]}
          paused={settled}
          onTimeout={onTimeout}
        />
        {view}
      </div>
    )
  }

  const meta = PAGE_META[page]
  const nextPage = pages[pageIndex + 1]
  const layoutVariant = page === 'learn' ? 'learn' : page === 'practice' ? 'practice' : 'quiz'

  return (
    <div className="lc-session" {...clipboardBlockProps}>
      <div className="lc-session__dots" aria-hidden="true" />
      <div className="lc-session__glow" aria-hidden="true" />
      <header className="lc-session__header">
        <button type="button" className="lc-back" onClick={onBack}>
          ← Back to topics
        </button>
        <div className="lc-session__course-badge">
          <span className="lc-session__course-icon">🐍</span>
          {lessonShortTitle(lessonTitle)}
        </div>
        <button
          type="button"
          className="lc-session__streak"
          onClick={() => void requireAuth('/streak')}
          title="Open streak & medals"
        >
          <span>🔥</span>
          <span>{stats.streak} day streak</span>
        </button>
      </header>

      <div className={`lc-session__layout lc-session__layout--${layoutVariant}`}>
        <aside className="lc-sidebar">
          <p className="lc-sidebar__title">Topics</p>
          <nav className="lc-sidebar__nav">
            {lesson?.subtopics.map((topic, i) => {
              const done = isSubtopicComplete(lessonId, topic)
              const active = topic === subtopic
              return (
                <button
                  key={topic}
                  type="button"
                  className={`lc-sidebar__item ${active ? 'is-active' : ''} ${done ? 'is-done' : ''}`}
                  onClick={() => onSubtopicSelect?.(topic)}
                >
                  <span className="lc-sidebar__num">{done ? '✓' : i + 1}</span>
                  <span className="lc-sidebar__label">{topic}</span>
                  {active ? <span className="lc-sidebar__arrow">›</span> : null}
                </button>
              )
            })}
          </nav>
          <div className="lc-sidebar__motivation">
            <span>🌱</span>
            <p>Keep going! Small steps make big progress.</p>
          </div>
        </aside>

        <main className="lc-main">
          <div className="lc-main__hero">
            <span className="lc-hero__eyebrow">
              Topic {lessonLabel} · Step {pageIndex + 1} of {pages.length}
            </span>
            <h1>{subtopic}</h1>
            <ol className="lc-stepper" aria-label="Your path through this topic">
              {pages.map((id, i) => {
                const status = pageStatus(i)
                const skipped = isWarmup(id) && answers[id] === 'skipped'
                return (
                  <li key={id}>
                    <button
                      type="button"
                      className={`lc-stepper__item is-${status} ${skipped ? 'is-skipped' : ''}`}
                      onClick={() => goToPage(i)}
                      disabled={status === 'locked'}
                      aria-current={status === 'current' ? 'step' : undefined}
                      title={skipped ? 'Skipped' : undefined}
                    >
                      <span className="lc-stepper__dot">
                        {status === 'done' ? (skipped ? '⏭' : '✓') : status === 'locked' ? '🔒' : i + 1}
                      </span>
                      <span className="lc-stepper__label">{PAGE_META[id].label}</span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </div>

          <div key={page} className={`lc-page lc-page--${direction}`}>
            {page === 'learn' ? (
              <LearnPage
                exercise={exercise}
                explainer={explainer}
                exampleOutput={exampleOutput}
                exampleRunning={exampleRunning}
                onRunExample={handleRunExample}
                onContinue={finishLearning}
              />
            ) : null}

            {isWarmup(page) ? (
              <section className="lc-panel lc-panel--quiz lc-quiz-page">
                <div className="lc-quiz-page__head">
                  <span className="lc-quiz-page__icon">{meta.icon}</span>
                  <div>
                    <h2>{meta.title}</h2>
                    <p>{meta.intro}</p>
                  </div>
                </div>
                <div className="lc-quiz">
                  {warmups[page] ? renderWarmup(page, warmups[page]) : null}
                </div>
                <div className="lc-page-nav">
                  <button
                    type="button"
                    className="lc-btn lc-btn--ghost"
                    onClick={() => goToPage(pageIndex - 1)}
                  >
                    ← {PAGE_META[pages[pageIndex - 1]].label}
                  </button>
                  <div className="lc-page-nav__forward">
                    {answers[page] === undefined ? (
                      <button
                        type="button"
                        className="lc-btn lc-btn--skip"
                        onClick={() => skipWarmup(page)}
                        title="Skip this question and move on"
                      >
                        Skip ⏭
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="lc-btn lc-btn--primary"
                      onClick={() => goToPage(pageIndex + 1)}
                      disabled={!isPageComplete(page) && !reviewMode}
                    >
                      {nextPage ? `Next: ${PAGE_META[nextPage].title} →` : 'Next →'}
                    </button>
                  </div>
                </div>
              </section>
            ) : null}

            {page === 'practice' ? (
              <>
                <section className="lc-panel lc-panel--mint">
                  <div className="lc-quiz-page__head">
                    <span className="lc-quiz-page__icon">{meta.icon}</span>
                    <div>
                      <h2>{meta.title}</h2>
                      <p>{meta.intro}</p>
                    </div>
                  </div>
                  <div className="lc-challenge">
                    <strong>🎯 Your challenge</strong>
                    <p>{exercise.challenge}</p>
                  </div>
                  <div className="lc-editor-wrap">
                    <div className="lc-code-block__bar">
                      <span>main.py</span>
                      <div className="lc-editor-actions">
                        <button type="button" className="lc-btn lc-btn--ghost" onClick={handleResetCode}>
                          Reset
                        </button>
                        <button
                          type="button"
                          className="lc-btn lc-btn--run"
                          onClick={handleRun}
                          disabled={running}
                        >
                          {running ? 'Running…' : '▶ Run'}
                        </button>
                        <button
                          type="button"
                          className="lc-btn lc-btn--check"
                          onClick={handleCheck}
                          disabled={running}
                        >
                          Check ✓
                        </button>
                      </div>
                    </div>
                    <CodeEditor
                      value={code}
                      onChange={setCode}
                      language="python"
                      height="300px"
                      blockClipboard
                    />
                  </div>

                  {output ? (
                    <div className="lc-output">
                      <span>Output</span>
                      <pre>{output}</pre>
                    </div>
                  ) : (
                    <div className="lc-output lc-output--hint">
                      Ready for your first run! Write code and click Run to see output.
                    </div>
                  )}

                  {error ? <div className="lc-error">{error}</div> : null}
                </section>

                {success || reviewMode ? (
                  <section className={`lc-complete${success ? ' is-celebrating' : ''}`}>
                    <span className="lc-complete__icon">🏆</span>
                    <h2>{success ? 'Topic complete — amazing work!' : 'You already finished this topic'}</h2>
                    <p>
                      <strong>Why it works:</strong> {exercise.exampleNote}
                    </p>
                    <button
                      type="button"
                      className="lc-btn lc-btn--primary lc-btn--wide"
                      onClick={goToNextSubtopic}
                    >
                      {nextSubtopic ? `Next topic: ${nextSubtopic} →` : 'Back to all topics →'}
                    </button>
                  </section>
                ) : null}

                <div className="lc-page-nav">
                  <button
                    type="button"
                    className="lc-btn lc-btn--ghost"
                    onClick={() => goToPage(pageIndex - 1)}
                  >
                    ← {PAGE_META[pages[pageIndex - 1]].label}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </main>

        {page === 'learn' ? <DoubtAssistant topic={tutorTopic} /> : null}

        {page === 'practice' ? (
          <aside className="lc-rail">
            <div className="lc-rail-card lc-rail-card--progress">
              <h3>Your Progress</h3>
              <div className="lc-progress-ring">
                <svg viewBox="0 0 36 36">
                  <path
                    className="lc-progress-ring__bg"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="lc-progress-ring__fill"
                    strokeDasharray={`${progress.percent}, 100`}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <span className="lc-progress-ring__text">{progress.percent}%</span>
              </div>
              <p className="lc-progress-label">
                {progress.completed} / {progress.total} topics
              </p>
              <div className="lc-progress-bar">
                <div className="lc-progress-bar__fill" style={{ width: `${progress.percent}%` }} />
              </div>
            </div>

            <div className="lc-rail-card lc-rail-card--hints">
              <h3>💡 Hints</h3>
              <p className="lc-rail-sub">Try on your own first. Hint 4 is the full answer.</p>
              <div className="lc-hint-list">
                {[0, 1, 2, 3].map((i) => {
                  const revealed = revealedHints[i]
                  const isOpen = expandedHint === i
                  const label = i === 3 ? 'Hint 4 — Answer' : `Hint ${i + 1}`
                  return (
                    <div
                      key={i}
                      className={`lc-hint-item ${revealed ? 'is-revealed' : ''} ${i === 3 ? 'is-answer' : ''}`}
                    >
                      <button
                        type="button"
                        className="lc-hint-item__head"
                        onClick={() => (revealed ? setExpandedHint(isOpen ? null : i) : undefined)}
                        disabled={!revealed}
                      >
                        <span>{i + 1}</span>
                        {label}
                        {revealed ? (
                          <span className="lc-hint-item__chev">{isOpen ? '▾' : '▸'}</span>
                        ) : (
                          <span className="lc-hint-item__lock">🔒</span>
                        )}
                      </button>
                      {revealed && isOpen ? <p className="lc-hint-item__body">{revealed}</p> : null}
                    </div>
                  )
                })}
              </div>
              <button
                type="button"
                className="lc-btn lc-btn--hint lc-btn--wide"
                onClick={revealHint}
                disabled={hintsUsed >= 4}
              >
                {hintsUsed >= 4 ? 'All hints used' : `Get hint ${hintsUsed + 1}`}
              </button>
            </div>

            <div className="lc-rail-card lc-rail-card--ref">
              <h3>📋 Quick Reference</h3>
              <pre className="lc-ref-code">{exercise.exampleCode}</pre>
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  )
}

type LearnPageProps = {
  exercise: ReturnType<typeof getSubtopicExercise>
  explainer: ReturnType<typeof getConceptExplainer>
  exampleOutput: string
  exampleRunning: boolean
  onRunExample: () => void
  onContinue: () => void
}

function LearnPage({
  exercise,
  explainer,
  exampleOutput,
  exampleRunning,
  onRunExample,
  onContinue,
}: LearnPageProps) {
  const bigIdea = explainer?.simple[0] ?? exercise.concept
  const moreDetail = explainer ? explainer.simple.slice(1) : [exercise.concept]

  return (
    <>
      <section className="lc-panel lc-panel--sky">
        <PanelHead icon="💡" title="The big idea" intro="Just one idea to learn on this page." />
        <p className="lc-bigidea">{bigIdea}</p>

        <div className="lc-picture">
          <div className="lc-picture__head">
            <span>👀</span>
            <div>
              <h3>See it in a picture</h3>
              <p>Follow the numbers to watch this code run:</p>
            </div>
          </div>
          <pre className="lc-picture__code">{exercise.exampleCode}</pre>
          <ConceptDiagram lessonId={exercise.lessonId} code={exercise.exampleCode} />
        </div>
      </section>

      <section className="lc-tiles">
        {explainer ? (
          <article className="lc-tile lc-tile--life">
            <span className="lc-tile__icon">🏠</span>
            <h3>Like in real life</h3>
            <p>{explainer.realLife}</p>
          </article>
        ) : null}
        <article className="lc-tile lc-tile--steps">
          <span className="lc-tile__icon">🛠️</span>
          <h3>How to write it</h3>
          <ol>
            {exercise.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </article>
        {explainer ? (
          <>
            <article className="lc-tile lc-tile--warn">
              <span className="lc-tile__icon">⚠️</span>
              <h3>Watch out</h3>
              <p>{explainer.mistake}</p>
            </article>
            <article className="lc-tile lc-tile--remember">
              <span className="lc-tile__icon">📌</span>
              <h3>Remember</h3>
              <ul>
                {explainer.remember.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </article>
          </>
        ) : null}
      </section>

      {moreDetail.length ? (
        <details className="lc-more">
          <summary>
            <span>📖 Want more detail?</span>
            <small>Open the full explanation (optional)</small>
          </summary>
          <div className="lc-more__body">
            {moreDetail.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </details>
      ) : null}

      <section className="lc-panel lc-panel--lavender">
        <PanelHead
          icon="🧩"
          title="Try it yourself"
          intro="This is the code from the picture. Press Run and check that the screen matches."
        />
        <div className="lc-code-block">
          <div className="lc-code-block__bar">
            <span>sample.py</span>
            <button
              type="button"
              className="lc-btn lc-btn--run"
              onClick={onRunExample}
              disabled={exampleRunning}
            >
              {exampleRunning ? 'Running…' : '▶ Run & check'}
            </button>
          </div>
          <pre>{exercise.exampleCode}</pre>
          {exampleOutput ? (
            <div className="lc-code-block__output">
              <span>Output</span>
              <pre>{exampleOutput}</pre>
            </div>
          ) : null}
        </div>
        {exampleOutput ? (
          <div className="lc-explain__box lc-explain__box--life lc-sample-why">
            <strong>✨ Why this happens</strong>
            <p>{exercise.exampleNote}</p>
          </div>
        ) : null}
      </section>

      <section className="lc-continue">
        <div>
          <strong>Got it? 🙌</strong>
          <p>Ask the doubt helper if anything is unclear. When you're ready, test yourself with some quick questions.</p>
        </div>
        <button type="button" className="lc-btn lc-btn--primary lc-continue__btn" onClick={onContinue}>
          I understand — start the questions →
        </button>
      </section>
    </>
  )
}

function PanelHead({ icon, title, intro }: { icon: string; title: string; intro: ReactNode }) {
  return (
    <div className="lc-panel__head">
      <span className="lc-panel__icon">{icon}</span>
      <div>
        <h2>{title}</h2>
        <p>{intro}</p>
      </div>
    </div>
  )
}
