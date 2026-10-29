import { useMemo, useState } from 'react'
import { sectionHints, type CodeExplanation } from '../../learning/coach/explainer'
import { compareRetype, type RetypeResult } from '../../learning/coach/retype'
import { CodeEditor } from '../editor/CodeEditor'
import { CoachText } from './CoachText'

type RetypeStageProps = {
  explanation: CodeExplanation
  typed: string
  onTyped: (value: string) => void
  onFocusSection: (index: number | null) => void
  onBackToExplain: () => void
  onNewCode: () => void
}

function stars(hintsUsed: number) {
  if (hintsUsed === 0) return '⭐⭐⭐'
  if (hintsUsed <= 3) return '⭐⭐'
  return '⭐'
}

export function RetypeStage({ explanation, typed, onTyped, onFocusSection, onBackToExplain, onNewCode }: RetypeStageProps) {
  const [revealed, setRevealed] = useState<Record<number, number>>({})
  const [result, setResult] = useState<RetypeResult | null>(null)
  const [checkedText, setCheckedText] = useState<string | null>(null)
  const hints = useMemo(() => explanation.sections.map((s) => sectionHints(s)), [explanation])
  const hintsUsed = Object.values(revealed).reduce((sum, n) => sum + n, 0)
  const stale = result !== null && checkedText !== typed

  function revealNext(index: number) {
    setRevealed((prev) => ({ ...prev, [index]: Math.min(4, (prev[index] ?? 0) + 1) }))
    onFocusSection(index)
  }

  function check() {
    const next = compareRetype(explanation, typed)
    setResult(next)
    setCheckedText(typed)
    const firstWrong = next.sections.find((s) => !s.ok)
    onFocusSection(firstWrong ? firstWrong.index : null)
  }

  function restart() {
    onTyped('')
    setResult(null)
    setRevealed({})
    onFocusSection(null)
  }

  const sectionState = (index: number) => {
    if (!result || stale) return 'todo'
    return result.sections[index]?.ok ? 'ok' : 'wrong'
  }

  return (
    <div className="cc-retype">
      <div className="cc-retype__main">
        <div className="cc-terminal">
          <div className="cc-terminal__bar">
            <span className="cc-dots" aria-hidden>
              <i />
              <i />
              <i />
            </span>
            <span>retype.py — from memory</span>
            <span className="cc-terminal__lock">🔒 copy &amp; paste is off</span>
          </div>
          <CodeEditor value={typed} onChange={onTyped} language="python" height="400px" blockClipboard />
          <div className="cc-terminal__out" aria-live="polite">
            <div className="cc-terminal__prompt">
              <span>coach@code-mentor</span>:<span>~</span>$ {result && !stale ? 'check retype.py' : 'waiting for your code…'}
            </div>
            {!result || stale ? (
              <div className="cc-terminal__line cc-terminal__line--dim">
                {typed.trim()
                  ? stale
                    ? 'You changed the code — press “Check my retype” again.'
                    : 'Press “Check my retype” when you are ready.'
                  : 'Type the program you just studied. Use the hints on the right if you get stuck.'}
              </div>
            ) : result.empty ? (
              <div className="cc-terminal__line cc-terminal__line--warn">Nothing typed yet — start with the first line.</div>
            ) : result.perfect ? (
              <div className="cc-terminal__line cc-terminal__line--ok">
                ✔ Every line matches. You wrote it from memory! {stars(hintsUsed)}
              </div>
            ) : (
              <>
                <div className="cc-terminal__line">
                  {result.sections.filter((s) => s.ok).length} of {result.sections.length} parts correct · {result.score}% match
                </div>
                {result.sections
                  .filter((s) => !s.ok)
                  .flatMap((s) => s.lines.filter((l) => !l.ok).slice(0, 2).map((l) => ({ s, l })))
                  .slice(0, 5)
                  .map(({ s, l }) => (
                    <div key={`${s.index}-${l.no}`} className="cc-terminal__line cc-terminal__line--warn">
                      ✖ Part {s.index + 1}
                      {l.typedNo ? `, your line ${l.typedNo}` : ''}: <CoachText text={l.message ?? ''} />
                    </div>
                  ))}
                {result.extraLines.length ? (
                  <div className="cc-terminal__line cc-terminal__line--warn">
                    ✖ Extra line{result.extraLines.length > 1 ? 's' : ''} {result.extraLines.join(', ')} — not in the code you studied.
                  </div>
                ) : null}
                {result.issues.slice(0, 2).map((issue) => (
                  <div key={issue.id} className="cc-terminal__line cc-terminal__line--err">
                    ⚠ Line {issue.line}: {issue.title}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        <div className="cc-actions">
          <button type="button" className="cc-btn cc-btn--ghost" onClick={onBackToExplain}>
            ← Study it again
          </button>
          <button type="button" className="cc-btn cc-btn--ghost" onClick={restart} disabled={!typed}>
            ↺ Start over
          </button>
          <button type="button" className="cc-btn cc-btn--primary" onClick={check} disabled={!typed.trim()}>
            ✓ Check my retype
          </button>
        </div>

        {result?.perfect && !stale ? (
          <div className="cc-celebrate" role="status">
            <div className="cc-celebrate__burst" aria-hidden>
              🎉
            </div>
            <div>
              <h3>Brilliant — you’ve got it! {stars(hintsUsed)}</h3>
              <p>
                You rebuilt the whole program from memory
                {hintsUsed ? ` using ${hintsUsed} hint${hintsUsed === 1 ? '' : 's'}` : ' without a single hint'}. That is exactly how
                you learn code for exams.
              </p>
            </div>
            <div className="cc-celebrate__actions">
              <button type="button" className="cc-btn cc-btn--ghost" onClick={restart}>
                Do it once more
              </button>
              <button type="button" className="cc-btn cc-btn--primary" onClick={onNewCode}>
                Write new code →
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <aside className="cc-hints" aria-label="Hints for every section">
        <div className="cc-hints__head">
          <h3>💡 Hints for every part</h3>
          <span>Hints used: {hintsUsed}</span>
        </div>
        {explanation.sections.map((section) => {
          const level = revealed[section.index] ?? 0
          const state = sectionState(section.index)
          return (
            <article key={section.index} className={`cc-hint cc-tone-${section.index % 6} is-${state}`}>
              <header>
                <span className="cc-hint__state" aria-hidden>
                  {state === 'ok' ? '✓' : state === 'wrong' ? '!' : section.index + 1}
                </span>
                <div>
                  <span className="cc-section__part">Part {section.index + 1}</span>
                  <strong>
                    <CoachText text={section.title} />
                  </strong>
                </div>
              </header>
              {hints[section.index].slice(0, level).map((hint) => (
                <div key={hint.label} className="cc-hint__item">
                  <span className="cc-hint__label">{hint.label}</span>
                  {hint.isCode ? <pre>{hint.text}</pre> : <p><CoachText text={hint.text} /></p>}
                </div>
              ))}
              {state !== 'ok' && level < 4 ? (
                <button type="button" className="cc-btn cc-btn--tiny" onClick={() => revealNext(section.index)}>
                  {level === 0 ? 'Give me a hint' : level === 3 ? 'Show me this part' : 'One more hint'} ({level + 1}/4)
                </button>
              ) : null}
            </article>
          )
        })}
      </aside>
    </div>
  )
}
