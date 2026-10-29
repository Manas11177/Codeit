import { useMemo, type ReactNode } from 'react'
import {
  forEachExpr,
  isDict,
  isSeq,
  pyStr,
  simulate,
  typeKey,
  typeLabel,
  type DecisionRecord,
  type Expr,
  type ExprSteps,
  type LoopRecord,
  type PyDict,
  type PyList,
  type PyVal,
  type RunResult,
  type Stmt,
  type TernaryRecord,
} from '../../learning/miniPython'
import './conceptDiagram.css'

type Stage = { title: string; hint?: string; body: ReactNode }

const show = (v: PyVal) => pyStr(v, true, '"')

function isFunc(v: PyVal) {
  return typeof v === 'object' && v !== null && 'kind' in v && v.kind === 'func'
}

export function ConceptDiagram({ lessonId, code }: { lessonId: string; code: string }) {
  const run = useMemo(() => simulate(code), [code])
  if (!run) return null

  const stages = buildStages(lessonId, run)
  if (!stages.length) return null

  return (
    <div className="cd" aria-label="Picture of how the example works">
      {stages.map((stage, i) => (
        <section key={stage.title} className="cd-stage">
          <span className="cd-stage__num">{i + 1}</span>
          <div className="cd-stage__main">
            <h4 className="cd-stage__title">{stage.title}</h4>
            {stage.hint ? <p className="cd-stage__hint">{stage.hint}</p> : null}
            <div className="cd-stage__body">{stage.body}</div>
          </div>
        </section>
      ))}
    </div>
  )
}

function buildStages(lessonId: string, run: RunResult): Stage[] {
  const stages: Stage[] = []
  const vars = [...run.firstValues.entries()].filter(([, v]) => !isFunc(v))
  const simpleVars = vars.filter(([, v]) => !isSeq(v) && !isDict(v))
  const seqVars = vars.filter((entry): entry is [string, PyList] => isSeq(entry[1]))
  const dictVars = vars.filter((entry): entry is [string, PyDict] => isDict(entry[1]))
  const screen: Stage = {
    title: 'The screen shows the answer',
    hint: 'print() puts the result on the screen.',
    body: <Screen lines={run.output} />,
  }

  if (run.calls.length) {
    const first = run.calls[0]
    stages.push({
      title: 'Build the machine',
      hint: 'def makes a reusable machine. Nothing runs yet!',
      body: <Machine name={first.name} signature={first.signature} body={first.body} />,
    })
    stages.push({
      title: 'Use the machine',
      hint: run.calls.length > 1 ? 'Each call runs the machine again.' : 'Calling it by name makes it run.',
      body: <Calls run={run} />,
    })
    stages.push(screen)
    return stages
  }

  if (lessonId === 'python-basics' || run.comments.length || (!vars.length && !run.loops.length)) {
    stages.push({
      title: 'Python reads your code',
      hint: 'One line at a time, from top to bottom.',
      body: <CodeReading program={run.program} comments={run.comments} />,
    })
  }

  if (dictVars.length) {
    stages.push({
      title: 'Python builds a dictionary',
      hint: 'Each label (key) points to its value.',
      body: dictVars.map(([name, first]) => (
        <DictView key={name} name={name} first={first} final={run.finalValues.get(name)} program={run.program} />
      )),
    })
  } else if (seqVars.length) {
    stages.push({
      title: seqVars.some(([, v]) => v.kind === 'tuple') ? 'Python lines up the items' : 'Python builds a list',
      hint: 'Every item sits in a numbered slot. Counting starts at 0.',
      body: seqVars.map(([name, first]) => (
        <ListView key={name} name={name} first={first} final={run.finalValues.get(name)} program={run.program} />
      )),
    })
  }

  if (simpleVars.length) {
    stages.push({
      title: run.loops.length ? 'Start values' : 'Python stores values in boxes',
      hint: 'A variable is a box with a name tag.',
      body: <VarBoxes vars={simpleVars} />,
    })
  }

  if (run.decisions.length || run.ternaries.length) {
    stages.push({
      title: 'Python asks a question',
      hint: 'Yes → that block runs. No → Python skips it.',
      body: (
        <>
          {run.decisions.map((d, i) => (
            <DecisionView key={i} rec={d} />
          ))}
          {run.ternaries.map((t, i) => (
            <TernaryView key={i} rec={t} />
          ))}
        </>
      ),
    })
  }

  if (run.loops.length) {
    stages.push({
      title: 'The loop goes round and round',
      hint: 'Each card is one round of the loop.',
      body: run.loops.map((loop, i) => <LoopView key={i} rec={loop} />),
    })
  }

  if (run.exprSteps.length) {
    stages.push({
      title: 'Python works it out, step by step',
      hint: 'Names are swapped for their values, then Python solves it.',
      body: <StepsView items={run.exprSteps} />,
    })
  }

  if (run.output.length) stages.push(screen)
  return stages
}

/* ───────── Small building blocks ───────── */

function Screen({ lines }: { lines: string[] }) {
  return (
    <div className="cd-screen">
      <div className="cd-screen__bar">
        <i />
        <i />
        <i />
        <span>Screen</span>
      </div>
      <pre>{lines.length ? lines.join('\n') : '(nothing printed)'}</pre>
    </div>
  )
}

function VarBoxes({ vars }: { vars: [string, PyVal][] }) {
  return (
    <div className="cd-boxes">
      {vars.map(([name, value]) => (
        <div key={name} className={`cd-box cd-box--${typeKey(value)}`}>
          <span className="cd-box__name">{name}</span>
          <div className="cd-box__value">{show(value)}</div>
          <span className="cd-box__type">{typeLabel(value)}</span>
        </div>
      ))}
    </div>
  )
}

function CodeReading({ program, comments }: { program: Stmt[]; comments: string[] }) {
  const lines = [
    ...comments.map((c) => ({ text: c, comment: true })),
    ...program.map((s) => ({ text: s.src, comment: false })),
  ]
  return (
    <ol className="cd-reading">
      {lines.map((line, i) => (
        <li key={i} className={line.comment ? 'is-comment' : undefined}>
          <code>{line.text}</code>
          <span>{line.comment ? '💤 comment — Python skips it' : '▶ Python runs this'}</span>
        </li>
      ))}
    </ol>
  )
}

function resultClass(text: string) {
  if (text === 'True') return ' cd-chip--true'
  if (text === 'False') return ' cd-chip--false'
  return ''
}

function StepsView({ items }: { items: ExprSteps[] }) {
  return (
    <div className="cd-steps">
      {items.map((item, index) => (
        <div key={index} className="cd-steprow">
          <span className="cd-steprow__label">
            <code>{item.label}</code>
          </span>
          <div className="cd-steprow__chain">
            {item.steps.map((step, i) => {
              const last = i === item.steps.length - 1
              return (
                <span key={i} className="cd-steprow__step">
                  {i > 0 ? <span className="cd-arrow">→</span> : null}
                  <span className={`cd-chip${last ? ` cd-chip--final${resultClass(step)}` : ''}`}>{step}</span>
                </span>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ───────── Decisions ───────── */

function DecisionView({ rec }: { rec: DecisionRecord }) {
  return (
    <div className="cd-decision">
      {rec.checks.map((check, i) => {
        const state = check.result === true ? 'yes' : check.result === false ? 'no' : 'skip'
        return (
          <div key={i}>
            <div className={`cd-q is-${state}`}>
              <div className="cd-q__ask">
                <span className="cd-q__diamond">?</span>
                <div>
                  <strong>{check.question}</strong>
                  {check.result === null ? (
                    <small>Not checked — an earlier answer was Yes</small>
                  ) : (
                    <code>
                      {check.substituted} → {check.result ? 'True' : 'False'}
                    </code>
                  )}
                </div>
              </div>
              <span className="cd-q__answer">{state === 'yes' ? 'Yes ➜' : state === 'no' ? 'No ✗' : '—'}</span>
              <div className="cd-q__do">
                {check.nested ? (
                  <DecisionView rec={check.nested} />
                ) : (
                  <code>{check.action.join('\n')}</code>
                )}
                <span className="cd-q__tag">{state === 'yes' ? '✓ this runs' : 'skipped'}</span>
              </div>
            </div>
            {state === 'no' && (i < rec.checks.length - 1 || rec.elseAction) ? (
              <div className="cd-q__down">No → ask the next question ↓</div>
            ) : null}
          </div>
        )
      })}
      {rec.elseAction ? (
        <div className={`cd-q cd-q--else is-${rec.elseTaken ? 'yes' : 'skip'}`}>
          <div className="cd-q__ask">
            <span className="cd-q__diamond">↳</span>
            <div>
              <strong>Otherwise (else)</strong>
              <small>{rec.elseTaken ? 'Every answer was No' : 'Not needed'}</small>
            </div>
          </div>
          <span className="cd-q__answer">{rec.elseTaken ? 'Runs ➜' : '—'}</span>
          <div className="cd-q__do">
            <code>{rec.elseAction.join('\n')}</code>
            <span className="cd-q__tag">{rec.elseTaken ? '✓ this runs' : 'skipped'}</span>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function TernaryView({ rec }: { rec: TernaryRecord }) {
  return (
    <div className="cd-decision">
      <div className="cd-q is-yes">
        <div className="cd-q__ask">
          <span className="cd-q__diamond">?</span>
          <div>
            <strong>{rec.question}</strong>
            <code>
              {rec.substituted} → {rec.result ? 'True' : 'False'}
            </code>
          </div>
        </div>
        <span className="cd-q__answer">{rec.result ? 'Yes ➜' : 'No ➜'}</span>
        <div className="cd-ternary">
          <span className={rec.result ? 'is-picked' : undefined}>Yes: {rec.yes}</span>
          <span className={!rec.result ? 'is-picked' : undefined}>No: {rec.no}</span>
          <strong>
            {rec.target} = {rec.result ? rec.yes : rec.no}
          </strong>
        </div>
      </div>
    </div>
  )
}

/* ───────── Loops ───────── */

function LoopView({ rec, mini = false }: { rec: LoopRecord; mini?: boolean }) {
  return (
    <div className={`cd-loop${mini ? ' cd-loop--mini' : ''}`}>
      {!mini ? (
        <div className="cd-loop__head">
          <code>{rec.header}</code>
          <span>
            {rec.kind === 'for' ? `🔁 Goes through: ${rec.iterText}` : `🔁 Keeps going while ${rec.iterText} is True`}
          </span>
        </div>
      ) : (
        <span className="cd-loop__minihead">
          <code>{rec.header}</code>
        </span>
      )}
      <ol className="cd-rounds">
        {rec.rounds.map((round, i) => (
          <li key={i} className={`cd-round${round.event ? ` is-${round.event}` : ''}`}>
            {!mini ? <span className="cd-round__num">{round.event === 'end' ? 'Check' : `Round ${i + 1}`}</span> : null}
            <strong className="cd-round__label">{round.label}</strong>
            {round.check ? (
              <code className={`cd-round__check ${round.passed ? 'is-ok' : 'is-no'}`}>
                {round.check} {round.passed ? '✓' : '✗'}
              </code>
            ) : null}
            {round.inner ? <LoopView rec={round.inner} mini /> : null}
            {round.prints.map((p, j) => (
              <span key={`p${j}`} className="cd-round__print">
                🖨️ {p}
              </span>
            ))}
            {round.changes.map((c, j) => (
              <span key={`c${j}`} className="cd-round__change">
                ✏️ {c}
              </span>
            ))}
            {round.event === 'break' ? <span className="cd-round__event">🛑 break — the loop stops</span> : null}
            {round.event === 'continue' ? <span className="cd-round__event">⏭️ continue — skip to next round</span> : null}
            {round.event === 'end' ? <span className="cd-round__event">🏁 False, so the loop ends</span> : null}
          </li>
        ))}
        {rec.notReached.map((label) => (
          <li key={label} className="cd-round is-skipped">
            <strong className="cd-round__label">{label}</strong>
            <span className="cd-round__event">never runs</span>
          </li>
        ))}
        {!mini && rec.kind === 'for' && !rec.notReached.length && rec.rounds.at(-1)?.event !== 'break' ? (
          <li className="cd-round is-end">
            <span className="cd-round__num">Done</span>
            <span className="cd-round__event">🏁 No items left, so the loop ends</span>
          </li>
        ) : null}
      </ol>
    </div>
  )
}

/* ───────── Functions ───────── */

function Machine({ name, signature, body }: { name: string; signature: string; body: string[] }) {
  return (
    <div className="cd-machine">
      <div className="cd-machine__top">
        <span>⚙️</span>
        <strong>{name}</strong>
      </div>
      <pre>
        {signature}
        {body.map((line) => `\n    ${line}`).join('')}
      </pre>
    </div>
  )
}

function Calls({ run }: { run: RunResult }) {
  return (
    <div className="cd-calls">
      {run.calls.map((call, i) => (
        <div key={i} className="cd-call">
          <div className="cd-call__in">
            {call.inputs.length ? (
              call.inputs.map((input) => (
                <span key={input.name} className="cd-chip">
                  {input.name} = {input.value}
                  {input.isDefault ? <em>default</em> : null}
                </span>
              ))
            ) : (
              <span className="cd-chip cd-chip--ghost">no inputs</span>
            )}
          </div>
          <span className="cd-arrow">➜</span>
          <div className="cd-call__box">
            ⚙️ <strong>{call.name}</strong>
          </div>
          <span className="cd-arrow">➜</span>
          <div className="cd-call__out">
            {call.result !== null ? (
              <>
                gives back <strong>{call.result}</strong>
              </>
            ) : call.prints.length ? (
              <>
                prints <strong>{call.prints.join(' / ')}</strong>
              </>
            ) : (
              'done'
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ───────── Lists & tuples ───────── */

function exprsOf(program: Stmt[]) {
  const all: Expr[] = []
  forEachExpr(program, (e) => all.push(e))
  return all
}

function intOf(e: Expr | null): number | null {
  if (!e) return null
  if (e.k === 'val' && typeof e.v === 'number') return e.v
  if (e.k === 'un' && e.op === '-' && e.e.k === 'val' && typeof e.e.v === 'number') return -e.e.v
  return null
}

function ListView({ name, first, final, program }: { name: string; first: PyList; final?: PyVal; program: Stmt[] }) {
  const n = first.items.length
  const lit = new Set<number>()
  const notes: string[] = []
  for (const e of exprsOf(program)) {
    const idx = e.k === 'index' ? intOf(e.idx) : null
    if (e.k === 'index' && e.obj.k === 'name' && e.obj.id === name && idx !== null) {
      lit.add(idx < 0 ? idx + n : idx)
    } else if (e.k === 'slice' && e.obj.k === 'name' && e.obj.id === name) {
      const lo = intOf(e.lo) ?? 0
      const hi = intOf(e.hi) ?? n
      for (let i = lo; i < hi; i++) lit.add(i)
      notes.push(`Slice ${lo}:${hi} takes slots ${lo} up to ${hi - 1} (it stops before ${hi}).`)
    } else if (
      e.k === 'call' &&
      e.fn.k === 'attr' &&
      e.fn.name === 'count' &&
      e.fn.obj.k === 'name' &&
      e.fn.obj.id === name &&
      e.args[0]?.k === 'val'
    ) {
      const target = show(e.args[0].v)
      first.items.forEach((v, i) => show(v) === target && lit.add(i))
    }
  }

  const after = final && isSeq(final) && show(final) !== show(first) ? final : null
  const changeSrc = program.find(
    (s) => s.k === 'expr' && s.e.k === 'call' && s.e.fn.k === 'attr' && s.e.fn.obj.k === 'name' && s.e.fn.obj.id === name,
  )?.src

  return (
    <div className="cd-list">
      <div className="cd-list__head">
        <code>{name}</code>
        <span className="cd-tag">{first.kind === 'tuple' ? '🔒 tuple — cannot be changed' : '📋 list — can be changed'}</span>
      </div>
      <Slots items={first.items} lit={lit} />
      {notes.map((note) => (
        <p key={note} className="cd-note">
          {note}
        </p>
      ))}
      {after ? (
        <>
          <div className="cd-list__after">
            After <code>{changeSrc ?? 'the change'}</code>
          </div>
          <Slots items={after.items} lit={new Set()} fresh={first.items.length} />
        </>
      ) : null}
    </div>
  )
}

function Slots({ items, lit, fresh }: { items: PyVal[]; lit: Set<number>; fresh?: number }) {
  return (
    <div className="cd-slots">
      {items.map((v, i) => (
        <div
          key={i}
          className={`cd-slot${lit.has(i) ? ' is-lit' : ''}${fresh !== undefined && i >= fresh ? ' is-new' : ''}`}
        >
          <span className="cd-slot__idx">{i}</span>
          <div className="cd-slot__val">{show(v)}</div>
          <span className="cd-slot__neg">{i - items.length}</span>
          {fresh !== undefined && i >= fresh ? <span className="cd-slot__badge">NEW</span> : null}
        </div>
      ))}
    </div>
  )
}

/* ───────── Dictionaries ───────── */

function chainOf(e: Expr): (string | number)[] | null {
  if (e.k === 'name') return [e.id]
  if (e.k === 'index' && e.idx.k === 'val' && (typeof e.idx.v === 'string' || typeof e.idx.v === 'number')) {
    const base = chainOf(e.obj)
    return base ? [...base, e.idx.v] : null
  }
  return null
}

function DictView({ name, first, final, program }: { name: string; first: PyDict; final?: PyVal; program: Stmt[] }) {
  const lit = new Set<string>()
  const missing: { key: string; fallback: string }[] = []
  const finalDict = final && isDict(final) ? final : first

  for (const e of exprsOf(program)) {
    const chain = chainOf(e)
    if (chain && chain[0] === name && chain.length > 1) {
      for (let i = 2; i <= chain.length; i++) lit.add(chain.slice(1, i).join('/'))
    }
    if (
      e.k === 'call' &&
      e.fn.k === 'attr' &&
      e.fn.name === 'get' &&
      e.fn.obj.k === 'name' &&
      e.fn.obj.id === name &&
      e.args[0]?.k === 'val' &&
      typeof e.args[0].v === 'string'
    ) {
      const key = e.args[0].v
      if (finalDict.map.has(key) || first.map.has(key)) lit.add(key)
      else missing.push({ key, fallback: e.args[1]?.k === 'val' ? show(e.args[1].v) : 'None' })
    }
  }

  return (
    <div className="cd-dict">
      <div className="cd-list__head">
        <code>{name}</code>
        <span className="cd-tag">📖 dictionary — find values by their label</span>
      </div>
      <Pairs first={first} final={finalDict} lit={lit} prefix="" />
      {missing.map((m) => (
        <div key={m.key} className="cd-pair is-missing">
          <span className="cd-pair__key">{`"${m.key}"`}</span>
          <span className="cd-pair__arrow">→</span>
          <span className="cd-pair__val">not found, so .get() gives {m.fallback}</span>
        </div>
      ))}
    </div>
  )
}

function Pairs({ first, final, lit, prefix }: { first: PyDict; final: PyDict; lit: Set<string>; prefix: string }) {
  const keys = [...new Set([...first.map.keys(), ...final.map.keys()])]
  return (
    <div className="cd-pairs">
      {keys.map((key) => {
        const path = prefix ? `${prefix}/${key}` : String(key)
        const before = first.map.get(key) ?? null
        const after = final.map.get(key) ?? null
        const added = !first.map.has(key)
        const removed = !final.map.has(key)
        const changed = !added && !removed && show(before) !== show(after)
        const value = removed ? before : after
        const state = added ? ' is-new' : removed ? ' is-removed' : changed ? ' is-changed' : ''
        return (
          <div key={String(key)} className={`cd-pair${state}${lit.has(path) ? ' is-lit' : ''}`}>
            <span className="cd-pair__key">{show(key)}</span>
            <span className="cd-pair__arrow">→</span>
            <span className="cd-pair__val">
              {isDict(value) ? (
                <Pairs first={isDict(before) ? before : value} final={value} lit={lit} prefix={path} />
              ) : changed ? (
                <>
                  <s>{show(before)}</s> {show(value)}
                </>
              ) : (
                show(value)
              )}
            </span>
            {added ? <span className="cd-slot__badge">NEW</span> : null}
            {changed ? <span className="cd-slot__badge cd-slot__badge--changed">UPDATED</span> : null}
            {removed ? <span className="cd-slot__badge cd-slot__badge--removed">REMOVED</span> : null}
          </div>
        )
      })}
    </div>
  )
}
