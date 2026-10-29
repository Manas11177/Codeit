import { useMemo, useState } from 'react'
import type { CodeExplanation } from '../../learning/coach/explainer'
import { CodeView } from './CodeView'
import { CoachText } from './CoachText'

export type ExplainLevel = 'words' | 'sections' | 'overview' | 'remember'

export const LEVELS: { id: ExplainLevel; icon: string; title: string; blurb: string }[] = [
  { id: 'words', icon: '🔤', title: 'Word by word', blurb: 'Every word and symbol, one line at a time.' },
  { id: 'sections', icon: '🧩', title: 'Section by section', blurb: 'The code split into parts, like an exam answer.' },
  { id: 'overview', icon: '🗺️', title: 'Big picture', blurb: 'How Python walks through the whole process.' },
  { id: 'remember', icon: '🧠', title: 'How to remember', blurb: 'Memory tricks, the shape and golden rules.' },
]

type Props = {
  explanation: CodeExplanation
  level: ExplainLevel
}

export function ExplainLevelPicker({ level, onLevel, seen }: { level: ExplainLevel | null; onLevel: (l: ExplainLevel) => void; seen: Set<ExplainLevel> }) {
  return (
    <div className="cc-levels" role="tablist" aria-label="Explanation levels">
      {LEVELS.map((item, i) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={level === item.id}
          className={`cc-level cc-level--${item.id}${level === item.id ? ' is-active' : ''}`}
          onClick={() => onLevel(item.id)}
        >
          <span className="cc-level__step">Level {i + 1}</span>
          <span className="cc-level__icon" aria-hidden>
            {item.icon}
          </span>
          <strong>{item.title}</strong>
          <span className="cc-level__blurb">{item.blurb}</span>
          {seen.has(item.id) ? <span className="cc-level__seen">✓ seen</span> : null}
        </button>
      ))}
    </div>
  )
}

/* ───────── Level 1: word by word ───────── */

function WordByWord({ explanation }: { explanation: CodeExplanation }) {
  const lines = explanation.words
  const [index, setIndex] = useState(0)
  const current = lines[Math.min(index, lines.length - 1)]
  const active = useMemo(() => {
    const set = new Set<number>()
    if (current) for (let no = current.no; no <= (current.endNo ?? current.no); no += 1) set.add(no)
    return set
  }, [current])
  if (!current) return null

  return (
    <div className="cc-split">
      <CodeView
        lines={explanation.lines}
        active={active}
        onLineClick={(no) => {
          const at = lines.findIndex((l) => l.no <= no && no <= (l.endNo ?? l.no))
          if (at >= 0) setIndex(at)
        }}
      />
      <div className="cc-panel cc-words">
        <div className="cc-words__nav">
          <button type="button" className="cc-btn cc-btn--ghost" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}>
            ← Previous line
          </button>
          <span>
            {current.endNo && current.endNo > current.no ? `Lines ${current.no}–${current.endNo}` : `Line ${current.no}`} · {index + 1} of {lines.length}
          </span>
          <button
            type="button"
            className="cc-btn cc-btn--ghost"
            onClick={() => setIndex((i) => Math.min(lines.length - 1, i + 1))}
            disabled={index === lines.length - 1}
          >
            Next line →
          </button>
        </div>

        <pre className="cc-words__code">{current.code.trim()}</pre>

        <div className="cc-words__grid">
          {current.words.map((word, i) => (
            <div key={`${current.no}-${i}`} className={`cc-word cc-word--${word.kind}`}>
              <code>{word.text.length > 28 ? `${word.text.slice(0, 26)}…` : word.text}</code>
              <span>{word.meaning}</span>
            </div>
          ))}
        </div>

        <div className="cc-plain">
          <span className="cc-plain__label">In plain English</span>
          <CoachText text={current.sentence} />
        </div>
        <p className="cc-muted">Tip: click any line in the code to jump to it.</p>
      </div>
    </div>
  )
}

/* ───────── Level 2: section by section ───────── */

function SectionBySection({ explanation }: { explanation: CodeExplanation }) {
  const [active, setActive] = useState<number | null>(null)
  const tones = useMemo(() => {
    const map = new Map<number, number>()
    for (const s of explanation.sections) for (let no = s.start; no <= s.end; no += 1) map.set(no, s.index)
    return map
  }, [explanation])
  const activeLines = useMemo(() => {
    const s = active === null ? null : explanation.sections[active]
    const set = new Set<number>()
    if (s) for (let no = s.start; no <= s.end; no += 1) set.add(no)
    return set
  }, [active, explanation])

  return (
    <div className="cc-split">
      <CodeView
        lines={explanation.lines}
        tones={tones}
        active={activeLines}
        onLineClick={(no) => setActive(tones.get(no) ?? null)}
      />
      <div className="cc-sections">
        {explanation.sections.map((section) => (
          <article
            key={section.index}
            className={`cc-section cc-tone-${section.index % 6}${active === section.index ? ' is-active' : ''}`}
            onMouseEnter={() => setActive(section.index)}
            onMouseLeave={() => setActive(null)}
          >
            <header>
              <span className="cc-section__icon" aria-hidden>
                {section.icon}
              </span>
              <div>
                <span className="cc-section__part">
                  Part {section.index + 1} · {section.start === section.end ? `line ${section.start}` : `lines ${section.start}–${section.end}`}
                </span>
                <h3>
                  <CoachText text={section.title} />
                </h3>
              </div>
            </header>
            {section.note ? <p className="cc-section__note">🗒️ Your note: “{section.note}”</p> : null}
            <p className="cc-section__summary">
              <CoachText text={section.summary} />
            </p>
            {section.steps.length > 1 || (section.steps.length === 1 && section.steps[0].text !== section.summary) ? (
              <ol className="cc-section__steps">
                {section.steps.map((step) => (
                  <li key={step.no} style={{ marginLeft: `${step.depth * 1.1}rem` }}>
                    <span className="cc-section__ln">L{step.no}</span>
                    <CoachText text={step.text} />
                  </li>
                ))}
              </ol>
            ) : null}
            <p className="cc-section__tip">
              <strong>📝 Exam tip:</strong> {section.tip}
            </p>
          </article>
        ))}
      </div>
    </div>
  )
}

/* ───────── Level 3: the big picture ───────── */

function BigPicture({ explanation }: { explanation: CodeExplanation }) {
  const { overview } = explanation
  return (
    <div className="cc-panel cc-overview">
      <div className="cc-overview__short">
        <span aria-hidden>🎯</span>
        <CoachText text={overview.inShort} />
      </div>
      <ol className="cc-flow">
        {overview.steps.map((step, i) => (
          <li key={i} className={`cc-flow__step${step.repeats ? ' is-loop' : ''}`}>
            <span className="cc-flow__dot" aria-hidden>
              {step.icon}
            </span>
            <div className="cc-flow__body">
              <h3>
                <CoachText text={step.title} />
                {step.repeats ? <span className="cc-flow__badge">↻ repeats</span> : null}
              </h3>
              <p>
                <CoachText text={step.text} />
              </p>
              {step.branches.length ? (
                <div className="cc-flow__branches">
                  {step.branches.map((branch) => (
                    <code key={branch}>{branch}</code>
                  ))}
                  <span>← only one of these paths runs</span>
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      <p className="cc-overview__note">🧭 {overview.flowNote}</p>
    </div>
  )
}

/* ───────── Level 4: how to remember ───────── */

function Remember({ explanation }: { explanation: CodeExplanation }) {
  const { remember } = explanation
  const [showSkeleton, setShowSkeleton] = useState(true)
  return (
    <div className="cc-remember">
      {remember.chain.words.length > 1 ? (
        <section className="cc-panel cc-chain">
          <h3>🔗 The memory chain</h3>
          <p className="cc-muted">The parts of your code, in order. Learn the chain and the code follows.</p>
          <div className="cc-chain__row">
            {remember.chain.words.map((word, i) => (
              <span key={`${word}-${i}`} className="cc-chain__item">
                <span className={`cc-chain__pill cc-tone-${i % 6}`}>
                  <b>{word[0]}</b>
                  {word.slice(1)}
                </span>
                {i < remember.chain.words.length - 1 ? <span className="cc-chain__arrow">→</span> : null}
              </span>
            ))}
          </div>
          <p className="cc-chain__silly">
            Silly sentence to remember <b>{remember.chain.acronym}</b>: “{remember.chain.silly}” 😄
          </p>
        </section>
      ) : null}

      <section className="cc-hooks">
        {remember.hooks.map((hook) => (
          <article key={hook.title} className="cc-hook">
            <span aria-hidden>{hook.icon}</span>
            <h4>{hook.title}</h4>
            <p>{hook.text}</p>
          </article>
        ))}
      </section>

      <div className="cc-remember__cols">
        <section className="cc-panel">
          <div className="cc-remember__head">
            <h3>🦴 The shape of your code</h3>
            <button type="button" className="cc-btn cc-btn--ghost" onClick={() => setShowSkeleton((v) => !v)}>
              {showSkeleton ? 'Hide' : 'Show'}
            </button>
          </div>
          <p className="cc-muted">Remember the shape first — the blanks are names, numbers and text.</p>
          {showSkeleton ? <pre className="cc-skeleton">{remember.skeleton}</pre> : null}
        </section>

        <section className="cc-panel">
          <h3>⭐ Golden rules</h3>
          <ul className="cc-rules">
            {remember.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </section>
      </div>

      <section className="cc-panel">
        <h3>🗣️ Say it out loud</h3>
        <p className="cc-muted">Reading each line as a sentence is the fastest way to remember it.</p>
        <ol className="cc-aloud">
          {remember.readAloud.map((item) => (
            <li key={item.no}>
              <span className="cc-section__ln">L{item.no}</span>
              <CoachText text={item.text} />
            </li>
          ))}
        </ol>
      </section>

      <section className="cc-panel cc-practice">
        <h3>🏋️ Practice plan</h3>
        <ol>
          {remember.practice.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
    </div>
  )
}

export function ExplainLevelView({ explanation, level }: Props) {
  switch (level) {
    case 'words':
      return <WordByWord explanation={explanation} />
    case 'sections':
      return <SectionBySection explanation={explanation} />
    case 'overview':
      return <BigPicture explanation={explanation} />
    case 'remember':
      return <Remember explanation={explanation} />
  }
}
