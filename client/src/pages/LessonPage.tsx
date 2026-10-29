import { useMemo, useState } from 'react'
import { LESSON_DATA } from '../carousel/lessonData'
import { PracticeSession } from '../components/practice/PracticeSession'
import { getLearningInsights } from '../learning/adaptiveEngine'
import { buildPracticeSet, type PracticeQuestion } from '../learning/questionGenerator'
import {
  getCompletedSubtopics,
  getLessonProgress,
  getPracticeHistory,
  isSubtopicComplete,
} from '../utils/lessonProgress'
import { goTo } from '../utils/navigation'
import { SubtopicSession } from './SubtopicSession'

const QUIZ_LATER_KEY = 'codementor-quiz-later'

function isQuizPostponed(lessonId: string) {
  return sessionStorage.getItem(`${QUIZ_LATER_KEY}-${lessonId}`) === '1'
}

type LessonPageProps = {
  lessonId: string
  onBack: () => void
}

export function LessonPage({ lessonId, onBack }: LessonPageProps) {
  const [activeSubtopic, setActiveSubtopic] = useState<string | null>(null)
  const [progressTick, setProgressTick] = useState(0)
  const [quiz, setQuiz] = useState<{ questions: PracticeQuestion[]; nonce: number } | null>(null)
  const [quizPostponed, setQuizPostponed] = useState(() => isQuizPostponed(lessonId))

  const lesson = LESSON_DATA.find((item) => item.id === lessonId)

  const lastQuiz = useMemo(() => {
    void progressTick
    const records = getPracticeHistory().filter(
      (r) => r.source === 'chapter-quiz' && r.lessonId === lessonId,
    )
    if (records.length === 0) return null
    const recent = records.slice(-6)
    return { correct: recent.filter((r) => r.correct).length, total: recent.length }
  }, [lessonId, progressTick])

  function startQuiz() {
    const questions = buildPracticeSet({
      insights: getLearningInsights(),
      source: 'chapter-quiz',
      lessonId,
      kinds: ['mcq'],
      count: 6,
      seed: Date.now(),
    })
    setQuiz({ questions, nonce: Date.now() })
    window.scrollTo({ top: 0 })
  }

  function postponeQuiz() {
    sessionStorage.setItem(`${QUIZ_LATER_KEY}-${lessonId}`, '1')
    setQuizPostponed(true)
  }

  const progress = useMemo(() => {
    void progressTick
    if (!lesson) return { completed: 0, total: 0, percent: 0 }
    return getLessonProgress(lesson.id, lesson.subtopics.length)
  }, [lesson, progressTick])

  const completedSet = useMemo(() => {
    void progressTick
    return new Set(getCompletedSubtopics(lessonId))
  }, [lessonId, progressTick])

  if (!lesson) {
    return (
      <div className="lesson-page">
        <h1>Lesson not found</h1>
        <button className="back-button" type="button" onClick={onBack}>
          ← Back to Lessons
        </button>
      </div>
    )
  }

  if (activeSubtopic) {
    return (
      <SubtopicSession
        key={activeSubtopic}
        lessonId={lesson.id}
        lessonTitle={lesson.title}
        subtopic={activeSubtopic}
        onBack={() => {
          setActiveSubtopic(null)
          setProgressTick((n) => n + 1)
        }}
        onSubtopicSelect={(topic) => {
          setActiveSubtopic(topic)
          setProgressTick((n) => n + 1)
        }}
      />
    )
  }

  if (quiz) {
    return (
      <PracticeSession
        key={quiz.nonce}
        title={`${lesson.title} — chapter quiz`}
        subtitle="Six questions shaped by the hints you used, the mistakes you made, and how you solved each topic."
        source="chapter-quiz"
        questions={quiz.questions}
        onExit={() => {
          setQuiz(null)
          setProgressTick((n) => n + 1)
        }}
        onNewSet={startQuiz}
      />
    )
  }

  const chapterComplete = progress.total > 0 && progress.completed === progress.total

  return (
    <div className="lesson-page">
      <div className="lesson-page__glow" aria-hidden />

      <button className="back-button" type="button" onClick={onBack}>
        ← Back to Lessons
      </button>

      <div className="lesson-page-header">
        <span>PYTHON LESSON</span>
        <h1>{lesson.title}</h1>
        <p>
          Learn each topic step by step, then write the code yourself with
          guided hints.
        </p>

        <div className="lesson-progress">
          <div className="lesson-progress__labels">
            <span>Your progress</span>
            <span>
              {progress.completed}/{progress.total} topics
            </span>
          </div>
          <div className="lesson-progress__track">
            <div
              className="lesson-progress__fill"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      </div>

      {chapterComplete ? (
        <div className={`chapter-quiz ${quizPostponed ? 'is-compact' : ''}`}>
          <div className="chapter-quiz__text">
            <span className="chapter-quiz__eyebrow">
              🎉 Chapter complete · optional
            </span>
            {quizPostponed ? (
              <p>Your personalized chapter quiz is ready whenever you are.</p>
            ) : (
              <>
                <h3>Want a quick personalized quiz?</h3>
                <p>
                  Six multiple-choice questions focused on the topics where you
                  needed hints or made mistakes. It's completely optional — skip
                  it and it won't affect your progress.
                </p>
              </>
            )}
            {lastQuiz ? (
              <small>
                Last attempt: {lastQuiz.correct}/{lastQuiz.total} correct
              </small>
            ) : null}
          </div>
          <div className="chapter-quiz__actions">
            <button type="button" className="chapter-quiz__primary" onClick={startQuiz}>
              {lastQuiz ? 'Take a new quiz' : 'Take quiz'}
            </button>
            {!quizPostponed ? (
              <button type="button" onClick={postponeQuiz}>
                Maybe later
              </button>
            ) : null}
            <button type="button" onClick={() => goTo('/progress')}>
              Progress Tracker
            </button>
          </div>
        </div>
      ) : null}

      <div className="subtopics-container">
        <h2>Lesson Topics</h2>
        <p className="subtopics-flow-hint">
          Each topic: <strong>Learn</strong> → <strong>Multiple choice</strong> →{' '}
          <strong>Fill blanks</strong> → <strong>Arrange</strong> →{' '}
          <strong>Practice problem</strong> (hints 1–3 guide you, hint 4 is the
          answer)
        </p>

        <div className="subtopics-list">
          {lesson.subtopics.map((topic, index) => {
            const done = completedSet.has(topic) || isSubtopicComplete(lesson.id, topic)

            return (
              <button
                className={`subtopic-card ${done ? 'is-complete' : ''}`}
                key={topic}
                type="button"
                onClick={() => setActiveSubtopic(topic)}
              >
                <div className="subtopic-number">
                  {done ? '✓' : String(index + 1).padStart(2, '0')}
                </div>

                <div className="subtopic-content">
                  <h3>{topic}</h3>
                  <p>
                    {done
                      ? 'Completed — revisit anytime'
                      : 'Learn → Quiz → Practice problem'}
                  </p>
                </div>

                <span className="subtopic-arrow">{done ? '★' : '→'}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
