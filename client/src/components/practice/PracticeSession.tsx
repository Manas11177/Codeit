import { useMemo, useRef, useState } from 'react'
import { runPlaygroundCode } from '../../api/playground'
import {
  ACTIVITY_LABELS,
  checkFillAnswers,
  isOrderCorrect,
  type CodeQuestion,
  type FillQuestion,
  type McqQuestion,
  type OrderQuestion,
  type PracticeQuestion,
} from '../../learning/questionGenerator'
import { clipboardBlockProps } from '../../utils/blockClipboard'
import { codesMatch, outputsMatch } from '../../utils/codeCompare'
import {
  recordPracticeResult,
  type PracticeSource,
} from '../../utils/lessonProgress'
import { CodeEditor } from '../editor/CodeEditor'
import './PracticeSession.css'

export type AnswerHandler = (correct: boolean, usedHint: boolean) => void

type Result = {
  question: PracticeQuestion
  correct: boolean
  usedHint: boolean
}

type PracticeSessionProps = {
  title: string
  subtitle: string
  source: PracticeSource
  questions: PracticeQuestion[]
  onExit: () => void
  onNewSet?: () => void
}

const DIFFICULTY_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }

export function PracticeSession({
  title,
  subtitle,
  source,
  questions,
  onExit,
  onNewSet,
}: PracticeSessionProps) {
  const [index, setIndex] = useState(0)
  const [results, setResults] = useState<Result[]>([])
  const [answered, setAnswered] = useState(false)

  const finished = index >= questions.length
  const question = questions[index]

  function handleAnswer(correct: boolean, usedHint: boolean) {
    if (answered || !question) return
    setAnswered(true)
    setResults((prev) => [...prev, { question, correct, usedHint }])
    recordPracticeResult({
      questionId: question.baseId,
      lessonId: question.lessonId,
      subtopic: question.subtopic,
      kind: question.kind,
      difficulty: question.difficulty,
      correct,
      usedHint,
      source,
    })
  }

  function goNext() {
    setAnswered(false)
    setIndex((i) => i + 1)
  }

  if (questions.length === 0) {
    return (
      <div className="ps" {...clipboardBlockProps}>
        <div className="ps__shell">
          <PracticeHeader title={title} subtitle={subtitle} onExit={onExit} />
          <div className="ps-card ps-empty">
            <p>
              This activity type isn&apos;t available for the selected topic
              (its solution is too short). Try another activity or topic.
            </p>
            <button type="button" className="ps-btn ps-btn--primary" onClick={onExit}>
              Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="ps" {...clipboardBlockProps}>
      <div className="ps__shell">
        <PracticeHeader title={title} subtitle={subtitle} onExit={onExit} />

        <div className="ps-progress">
          <div className="ps-progress__labels">
            <span>
              {finished
                ? 'Finished'
                : `Question ${index + 1} of ${questions.length}`}
            </span>
            <span>
              {results.filter((r) => r.correct).length} correct
            </span>
          </div>
          <div className="ps-progress__track">
            <div
              className="ps-progress__fill"
              style={{
                width: `${Math.round(((finished ? questions.length : index) / questions.length) * 100)}%`,
              }}
            />
          </div>
        </div>

        {finished ? (
          <PracticeSummary
            results={results}
            onExit={onExit}
            onNewSet={onNewSet}
          />
        ) : (
          <div className="ps-card" key={question.id}>
            <div className="ps-meta">
              <span className="ps-chip ps-chip--kind">
                {ACTIVITY_LABELS[question.kind]}
              </span>
              <span className={`ps-chip ps-chip--${question.difficulty}`}>
                {DIFFICULTY_LABEL[question.difficulty]}
              </span>
              <span className="ps-chip">{question.subtopic}</span>
            </div>
            <p className="ps-focus">🎯 {question.focus}</p>

            {question.kind === 'mcq' ? (
              <McqView question={question} onAnswer={handleAnswer} />
            ) : null}
            {question.kind === 'fill' ? (
              <FillView question={question} onAnswer={handleAnswer} />
            ) : null}
            {question.kind === 'order' ? (
              <OrderView question={question} onAnswer={handleAnswer} />
            ) : null}
            {question.kind === 'code' ? (
              <CodeView question={question} onAnswer={handleAnswer} />
            ) : null}

            {answered ? (
              <div className="ps-next">
                <button type="button" className="ps-btn ps-btn--primary" onClick={goNext}>
                  {index + 1 < questions.length ? 'Next question →' : 'See results →'}
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

function PracticeHeader({
  title,
  subtitle,
  onExit,
}: {
  title: string
  subtitle: string
  onExit: () => void
}) {
  return (
    <header className="ps-header">
      <div>
        <span className="ps-header__eyebrow">Optional practice</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <button type="button" className="ps-btn ps-btn--ghost" onClick={onExit}>
        Exit — no penalty
      </button>
    </header>
  )
}

function Feedback({
  correct,
  note,
  explanation,
}: {
  correct: boolean
  note?: string | null
  explanation: string
}) {
  return (
    <div className={`ps-feedback ${correct ? 'is-correct' : 'is-wrong'}`}>
      <strong>{correct ? '✓ Correct!' : '✗ Not quite.'}</strong>
      {note ? <p>{note}</p> : null}
      <pre>{explanation}</pre>
    </div>
  )
}

/* ---------------- MCQ ---------------- */

export function McqView({
  question,
  onAnswer,
}: {
  question: McqQuestion
  onAnswer: AnswerHandler
}) {
  const [picked, setPicked] = useState<number | null>(null)

  function choose(i: number) {
    if (picked !== null) return
    setPicked(i)
    onAnswer(i === question.answerIndex, false)
  }

  return (
    <div>
      <p className="ps-prompt">{question.prompt}</p>
      {question.code ? <pre className="ps-code">{question.code}</pre> : null}
      <div className="ps-options">
        {question.options.map((option, i) => {
          const state =
            picked === null
              ? ''
              : i === question.answerIndex
                ? 'is-correct'
                : i === picked
                  ? 'is-wrong'
                  : 'is-dim'
          return (
            <button
              key={i}
              type="button"
              className={`ps-option ${state}`}
              onClick={() => choose(i)}
              disabled={picked !== null}
            >
              <span className="ps-option__letter">{String.fromCharCode(65 + i)}</span>
              {question.optionsAreCode ? <pre>{option}</pre> : <span>{option}</span>}
            </button>
          )
        })}
      </div>
      {picked !== null ? (
        <Feedback
          correct={picked === question.answerIndex}
          note={question.optionNotes[picked]}
          explanation={question.explanation}
        />
      ) : null}
    </div>
  )
}

/* ---------------- Fill in the blanks ---------------- */

export function FillView({
  question,
  onAnswer,
}: {
  question: FillQuestion
  onAnswer: AnswerHandler
}) {
  const [inputs, setInputs] = useState<string[]>(() => question.answers.map(() => ''))
  const [checked, setChecked] = useState<boolean[] | null>(null)
  const activeBlank = useRef(0)

  const parts = useMemo(() => question.template.split(/\{\{(\d+)\}\}/), [question.template])

  function setBlank(i: number, value: string) {
    setInputs((prev) => prev.map((v, j) => (j === i ? value : v)))
  }

  function insertWord(word: string) {
    if (checked) return
    const target =
      inputs[activeBlank.current] === ''
        ? activeBlank.current
        : Math.max(0, inputs.findIndex((v) => v === ''))
    setBlank(target, word)
  }

  function check() {
    const result = checkFillAnswers(question, inputs)
    setChecked(result)
    onAnswer(result.every(Boolean), false)
  }

  return (
    <div>
      <p className="ps-prompt">{question.prompt}</p>
      <pre className="ps-code ps-code--fill">
        {parts.map((part, i) => {
          if (i % 2 === 0) return <span key={i}>{part}</span>
          const blank = Number(part)
          const state = checked ? (checked[blank] ? 'is-correct' : 'is-wrong') : ''
          return (
            <input
              key={i}
              className={`ps-blank ${state}`}
              value={inputs[blank]}
              size={Math.max(question.answers[blank].length + 1, 4)}
              disabled={Boolean(checked)}
              onFocus={() => {
                activeBlank.current = blank
              }}
              onChange={(e) => setBlank(blank, e.target.value)}
              aria-label={`Blank ${blank + 1}`}
              spellCheck={false}
              autoComplete="off"
            />
          )
        })}
      </pre>

      {question.wordBank ? (
        <div className="ps-wordbank">
          <span>Word bank:</span>
          {question.wordBank.map((word) => (
            <button
              key={word}
              type="button"
              className="ps-word"
              onClick={() => insertWord(word)}
              disabled={Boolean(checked)}
            >
              {word}
            </button>
          ))}
        </div>
      ) : (
        <p className="ps-subtle">Hard mode: no word bank — type each missing piece.</p>
      )}

      {!checked ? (
        <button
          type="button"
          className="ps-btn ps-btn--primary"
          onClick={check}
          disabled={inputs.some((v) => !v.trim())}
        >
          Check answer
        </button>
      ) : (
        <Feedback
          correct={checked.every(Boolean)}
          note={
            checked.every(Boolean)
              ? null
              : `Missing piece${question.answers.length > 1 ? 's' : ''}: ${question.answers.join('  ·  ')}`
          }
          explanation={question.explanation}
        />
      )}
    </div>
  )
}

/* ---------------- Arrange in order ---------------- */

export function OrderView({
  question,
  onAnswer,
}: {
  question: OrderQuestion
  onAnswer: AnswerHandler
}) {
  const [order, setOrder] = useState<number[]>(question.shuffledOrder)
  const [result, setResult] = useState<boolean | null>(null)

  function move(position: number, delta: number) {
    const target = position + delta
    if (target < 0 || target >= order.length) return
    setOrder((prev) => {
      const next = [...prev]
      ;[next[position], next[target]] = [next[target], next[position]]
      return next
    })
  }

  function check() {
    const correct = isOrderCorrect(question, order)
    setResult(correct)
    onAnswer(correct, false)
  }

  return (
    <div>
      <p className="ps-prompt">{question.prompt}</p>
      <ol className="ps-order">
        {order.map((lineIndex, position) => (
          <li key={lineIndex} className="ps-order__item">
            <span className="ps-order__num">{position + 1}</span>
            <pre>{question.lines[lineIndex]}</pre>
            <div className="ps-order__controls">
              <button
                type="button"
                onClick={() => move(position, -1)}
                disabled={result !== null || position === 0}
                aria-label="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(position, 1)}
                disabled={result !== null || position === order.length - 1}
                aria-label="Move down"
              >
                ↓
              </button>
            </div>
          </li>
        ))}
      </ol>
      <p className="ps-subtle">
        {question.mode === 'pieces'
          ? 'Read the pieces from top to bottom — together they make the code. Use ↑ and ↓ to move them.'
          : 'Indentation is kept to help you spot which lines belong inside a block.'}
      </p>
      {result === null ? (
        <button type="button" className="ps-btn ps-btn--primary" onClick={check}>
          Check order
        </button>
      ) : (
        <Feedback correct={result} explanation={question.explanation} />
      )}
    </div>
  )
}

/* ---------------- Practice problem ---------------- */

function CodeView({
  question,
  onAnswer,
}: {
  question: CodeQuestion
  onAnswer: AnswerHandler
}) {
  const [code, setCode] = useState(question.starterCode)
  const [output, setOutput] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [hintsShown, setHintsShown] = useState(0)
  const [outcome, setOutcome] = useState<'solved' | 'gave-up' | null>(null)
  const expected = useRef<string | null>(question.expectedOutput)

  async function getExpected() {
    if (expected.current !== null) return expected.current
    const reference = await runPlaygroundCode(question.referenceSolution)
    expected.current = (reference.output || '').trim()
    return expected.current
  }

  async function run() {
    setBusy(true)
    setMessage('')
    try {
      const result = await runPlaygroundCode(code)
      setOutput(result.error || result.output || '(no output)')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Run failed.')
    } finally {
      setBusy(false)
    }
  }

  async function check() {
    if (!code.trim()) {
      setMessage('Write your code first.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      if (codesMatch(code, question.referenceSolution)) {
        setOutcome('solved')
        onAnswer(true, hintsShown > 0)
        return
      }
      const [result, target] = await Promise.all([runPlaygroundCode(code), getExpected()])
      const out = (result.output || '').trim()
      setOutput(result.error || result.output || '(no output)')
      if (!result.error && outputsMatch(out, target)) {
        setOutcome('solved')
        onAnswer(true, hintsShown > 0)
      } else {
        setMessage(
          result.error
            ? 'Your code raised an error — read the last line of the message.'
            : `Output doesn't match yet. Expected:\n${target}`,
        )
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not check your code.')
    } finally {
      setBusy(false)
    }
  }

  function giveUp() {
    setOutcome('gave-up')
    onAnswer(false, hintsShown > 0)
  }

  return (
    <div>
      <p className="ps-prompt">{question.prompt}</p>
      <div className="ps-challenge">{question.challenge}</div>

      <div className="ps-editor">
        <CodeEditor
          value={code}
          onChange={setCode}
          language="python"
          height="220px"
          readOnly={outcome !== null}
          blockClipboard
        />
      </div>

      {outcome === null ? (
        <div className="ps-actions">
          <button type="button" className="ps-btn" onClick={run} disabled={busy}>
            {busy ? 'Running…' : '▶ Run'}
          </button>
          <button type="button" className="ps-btn ps-btn--primary" onClick={check} disabled={busy}>
            Check ✓
          </button>
          <button
            type="button"
            className="ps-btn ps-btn--ghost"
            onClick={() => setHintsShown((n) => Math.min(n + 1, question.hints.length))}
            disabled={hintsShown >= question.hints.length}
          >
            💡 Hint ({question.hints.length - hintsShown} left)
          </button>
          <button type="button" className="ps-btn ps-btn--ghost" onClick={giveUp}>
            Show solution
          </button>
        </div>
      ) : null}

      {hintsShown > 0 ? (
        <ul className="ps-hints">
          {question.hints.slice(0, hintsShown).map((hint, i) => (
            <li key={i}>{hint}</li>
          ))}
        </ul>
      ) : null}

      {output ? (
        <div className="ps-output">
          <span>Output</span>
          <pre>{output}</pre>
        </div>
      ) : null}
      {message ? <pre className="ps-message">{message}</pre> : null}

      {outcome ? (
        <Feedback
          correct={outcome === 'solved'}
          note={
            outcome === 'solved' && hintsShown > 0
              ? 'Solved with hints — try a similar one without hints next time.'
              : null
          }
          explanation={question.explanation}
        />
      ) : null}
    </div>
  )
}

/* ---------------- Summary ---------------- */

function PracticeSummary({
  results,
  onExit,
  onNewSet,
}: {
  results: Result[]
  onExit: () => void
  onNewSet?: () => void
}) {
  const correct = results.filter((r) => r.correct).length
  const score = results.length ? Math.round((correct / results.length) * 100) : 0
  const toReview = [
    ...new Set(results.filter((r) => !r.correct).map((r) => r.question.subtopic)),
  ]
  const byKind = Object.entries(
    results.reduce<Record<string, { total: number; correct: number }>>((acc, r) => {
      const entry = acc[r.question.kind] ?? { total: 0, correct: 0 }
      entry.total += 1
      if (r.correct) entry.correct += 1
      acc[r.question.kind] = entry
      return acc
    }, {}),
  )

  return (
    <div className="ps-card ps-summary">
      <div className="ps-summary__score">
        <strong>{score}%</strong>
        <span>
          {correct} of {results.length} correct
        </span>
      </div>
      <p className="ps-summary__message">
        {score >= 80
          ? 'Excellent — these concepts are getting solid. Your recommendations will move on to new areas.'
          : score >= 50
            ? 'Good progress. The coach will keep mixing in these topics until they feel easy.'
            : 'These topics need more practice — and that is completely fine. Your next set will start easier.'}
      </p>

      <div className="ps-summary__kinds">
        {byKind.map(([kind, stats]) => (
          <div key={kind}>
            <span>{ACTIVITY_LABELS[kind as PracticeQuestion['kind']]}</span>
            <strong>
              {stats.correct}/{stats.total}
            </strong>
          </div>
        ))}
      </div>

      {toReview.length > 0 ? (
        <div className="ps-summary__review">
          <span>Worth reviewing:</span>
          {toReview.map((topic) => (
            <span key={topic} className="ps-chip">
              {topic}
            </span>
          ))}
        </div>
      ) : null}

      <div className="ps-actions">
        {onNewSet ? (
          <button type="button" className="ps-btn ps-btn--primary" onClick={onNewSet}>
            New personalized set
          </button>
        ) : null}
        <button type="button" className="ps-btn" onClick={onExit}>
          Done
        </button>
      </div>
    </div>
  )
}
