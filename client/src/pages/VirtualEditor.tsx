import { useEffect, useMemo, useState } from 'react'
import { CodeEditor } from '../components/editor/CodeEditor'
import { CoachHelp } from '../components/coach/CoachHelp'
import { ExplainLevelPicker, ExplainLevelView, LEVELS, type ExplainLevel } from '../components/coach/ExplainLevels'
import { IssueList } from '../components/coach/IssueList'
import { RetypeStage } from '../components/coach/RetypeStage'
import { applyFix, checkCode, fixAll, type Issue } from '../learning/coach/checker'
import { explainCode, type CodeExplanation } from '../learning/coach/explainer'
import type { CoachStage } from '../learning/coach/helper'
import '../components/coach/coach.css'
import './VirtualEditor.css'

const DRAFT_KEY = 'code-mentor:coach-draft'

const STARTER_CODE = `# Check if a student passed
name = "Asha"
marks = 72

if marks >= 40:
    print(name, "passed")
else:
    print(name, "needs more practice")
`

const STAGES: { id: CoachStage; label: string; hint: string }[] = [
  { id: 'write', label: 'Write & check', hint: 'We correct mistakes' },
  { id: 'explain', label: 'Understand', hint: '4 levels of explanation' },
  { id: 'retype', label: 'Retype from memory', hint: 'With hints for every part' },
]

function safeExplain(code: string): CodeExplanation | null {
  try {
    return explainCode(code)
  } catch {
    return null
  }
}

function readDraft() {
  try {
    return localStorage.getItem(DRAFT_KEY) ?? STARTER_CODE
  } catch {
    return STARTER_CODE
  }
}

export function VirtualEditor() {
  const [stage, setStage] = useState<CoachStage>('write')
  const [code, setCode] = useState(readDraft)
  const [issues, setIssues] = useState<Issue[] | null>(null)
  const [checkedCode, setCheckedCode] = useState<string | null>(null)
  const [blockedExplain, setBlockedExplain] = useState(false)
  const [fixMessage, setFixMessage] = useState<string | null>(null)
  const [studied, setStudied] = useState<string | null>(null)
  const [level, setLevel] = useState<ExplainLevel | null>(null)
  const [seen, setSeen] = useState<Set<ExplainLevel>>(new Set())
  const [typed, setTyped] = useState('')
  const [focusSection, setFocusSection] = useState<number | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, code)
    } catch {
      // Storage can be unavailable (private mode); the draft just won't persist.
    }
  }, [code])

  const explanation = useMemo(() => (studied ? safeExplain(studied) : null), [studied])
  const draftExplanation = useMemo(() => (stage === 'write' ? safeExplain(code) : null), [stage, code])
  const liveIssues = useMemo(() => (stage === 'write' ? checkCode(code) : []), [stage, code])
  const hasCode = code.split('\n').some((line) => line.trim() && !line.trim().startsWith('#'))
  const checkIsFresh = issues !== null && checkedCode === code
  const lineCount = code.split('\n').filter((l) => l.trim()).length

  function runCheck() {
    const found = checkCode(code)
    setIssues(found)
    setCheckedCode(code)
    setFixMessage(null)
    return found
  }

  function startExplaining(source: string) {
    setStudied(source)
    setLevel(null)
    setSeen(new Set())
    setTyped('')
    setFocusSection(null)
    setBlockedExplain(false)
    setStage('explain')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleExplain() {
    const found = runCheck()
    if (found.length > 0) {
      setBlockedExplain(true)
      return
    }
    startExplaining(code)
  }

  function handleFix(issue: Issue) {
    const next = applyFix(code, issue)
    setCode(next)
    const found = checkCode(next)
    setIssues(found)
    setCheckedCode(next)
    setFixMessage(found.length === 0 ? 'All fixed! Your code is correct now. ✨' : `Fixed line ${issue.line}.`)
  }

  function handleFixAll() {
    const result = fixAll(code)
    setCode(result.code)
    setIssues(result.remaining)
    setCheckedCode(result.code)
    setFixMessage(
      result.remaining.length === 0
        ? `Fixed ${result.fixed} mistake${result.fixed === 1 ? '' : 's'}. Your code is correct now. ✨`
        : `Fixed ${result.fixed}. ${result.remaining.length} still need${result.remaining.length === 1 ? 's' : ''} you.`,
    )
  }

  function chooseLevel(next: ExplainLevel) {
    setLevel(next)
    setSeen((prev) => new Set(prev).add(next))
  }

  function goToStage(next: CoachStage) {
    if (next === 'write') setStage('write')
    else if (next === 'explain' && studied) setStage('explain')
    else if (next === 'retype' && studied) setStage('retype')
  }

  const stageIndex = STAGES.findIndex((s) => s.id === stage)
  const helpContext =
    stage === 'write'
      ? draftExplanation && { explanation: draftExplanation, stage, issues: liveIssues, focusSection: null }
      : explanation && {
          explanation,
          stage,
          issues: stage === 'retype' ? checkCode(typed) : [],
          focusSection: focusSection === null ? null : explanation.sections[focusSection] ?? null,
        }

  return (
    <main className="virtual-editor-page">
      <header className="virtual-editor-page__header">
        <span className="virtual-editor-page__eyebrow">CODE COACH</span>
        <h1>Virtual Editor</h1>
        <p>
          Write your code, let the coach correct it, understand it the way toppers do in exams — then retype it from memory.
        </p>
      </header>

      <ol className="cc-stepper" aria-label="Steps">
        {STAGES.map((item, i) => {
          const reachable = item.id === 'write' || Boolean(studied)
          return (
            <li key={item.id} className={`${i === stageIndex ? 'is-current' : ''} ${i < stageIndex ? 'is-done' : ''}`}>
              <button type="button" onClick={() => goToStage(item.id)} disabled={!reachable}>
                <span className="cc-stepper__num">{i < stageIndex ? '✓' : i + 1}</span>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.hint}</small>
                </span>
              </button>
            </li>
          )
        })}
      </ol>

      {stage === 'write' ? (
        <section className="cc-write">
          <div className="virtual-editor-page__editor-card">
            <header className="virtual-editor-page__toolbar">
              <div>
                <h2>Python Editor</h2>
                <p>No running here — the coach reads your code, corrects it and explains it.</p>
              </div>
              <span className="cc-chip">{lineCount} line{lineCount === 1 ? '' : 's'}</span>
            </header>

            <div className="virtual-editor-page__monaco">
              <CodeEditor value={code} onChange={setCode} language="python" height="460px" />
            </div>

            <div className="cc-actions">
              <button type="button" className="cc-btn cc-btn--ghost" onClick={runCheck} disabled={!hasCode}>
                🩺 Check my code
              </button>
              <button type="button" className="cc-btn cc-btn--primary cc-btn--big" onClick={handleExplain} disabled={!hasCode}>
                💡 Explain the code
              </button>
            </div>
          </div>

          <aside className="cc-report" aria-live="polite">
            <span className="virtual-editor-page__section-label">COACH REPORT</span>
            {!hasCode ? (
              <div className="cc-empty">
                <span aria-hidden>✍️</span>
                <h3>Start typing your Python code</h3>
                <p>When you are done, press “Explain the code”. The coach checks it first, then explains it in 4 levels.</p>
              </div>
            ) : !checkIsFresh ? (
              <div className="cc-empty">
                <span aria-hidden>🩺</span>
                <h3>Ready when you are</h3>
                <p>Press “Check my code” to find mistakes, or “Explain the code” to check and learn it in one go.</p>
                <ul className="cc-howto">
                  {LEVELS.map((l) => (
                    <li key={l.id}>
                      <span aria-hidden>{l.icon}</span> <strong>{l.title}</strong> — {l.blurb}
                    </li>
                  ))}
                </ul>
              </div>
            ) : issues && issues.length > 0 ? (
              <>
                {fixMessage ? <p className="cc-toast">{fixMessage}</p> : null}
                {blockedExplain ? (
                  <p className="cc-callout">Let’s fix these first, so you learn the correct version of your code.</p>
                ) : null}
                <IssueList issues={issues} onFix={handleFix} onFixAll={handleFixAll} />
                {blockedExplain ? (
                  <button type="button" className="cc-link" onClick={() => startExplaining(code)}>
                    Explain it anyway →
                  </button>
                ) : null}
              </>
            ) : (
              <div className="cc-success">
                <span aria-hidden>✅</span>
                <h3>Your code looks correct!</h3>
                <p>{fixMessage ?? 'No grammar, spelling or spacing mistakes found.'}</p>
                <button type="button" className="cc-btn cc-btn--primary cc-btn--big" onClick={() => startExplaining(code)}>
                  💡 Explain the code
                </button>
              </div>
            )}
          </aside>
        </section>
      ) : null}

      {stage === 'explain' && explanation ? (
        <section className="cc-explain">
          <div className="cc-explain__intro">
            <h2>How do you want it explained?</h2>
            <p>Go through the levels in order like an exam answer — or jump to the one you need.</p>
          </div>
          <ExplainLevelPicker level={level} onLevel={chooseLevel} seen={seen} />

          {level ? (
            <div className="cc-explain__view" key={level}>
              <ExplainLevelView explanation={explanation} level={level} />
            </div>
          ) : (
            <div className="cc-empty cc-empty--wide">
              <span aria-hidden>👆</span>
              <h3>Pick a level to begin</h3>
              <p>Start with “Word by word” if this code is new to you.</p>
            </div>
          )}

          <div className="cc-understood">
            <div>
              <strong>Feel confident about this code?</strong>
              <span>
                {seen.size === 0
                  ? 'Explore at least one level first.'
                  : `You explored ${seen.size} of 4 levels. Now prove it — retype it from memory.`}
              </span>
            </div>
            <div className="cc-actions">
              <button type="button" className="cc-btn cc-btn--ghost" onClick={() => setStage('write')}>
                ← Edit code
              </button>
              <button
                type="button"
                className="cc-btn cc-btn--primary cc-btn--big"
                disabled={seen.size === 0}
                onClick={() => {
                  setStage('retype')
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
              >
                I understood it ✓ — let me retype it
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {stage === 'retype' && explanation ? (
        <RetypeStage
          explanation={explanation}
          typed={typed}
          onTyped={setTyped}
          onFocusSection={setFocusSection}
          onBackToExplain={() => setStage('explain')}
          onNewCode={() => {
            setStudied(null)
            setIssues(null)
            setStage('write')
          }}
        />
      ) : null}

      {helpContext ? <CoachHelp key={stage} context={helpContext} typed={typed} /> : null}
    </main>
  )
}
