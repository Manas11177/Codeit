import type { CodeLine } from '../../learning/coach/lexer'

type CodeViewProps = {
  lines: CodeLine[]
  /** Line number → colour index for section bands. */
  tones?: Map<number, number>
  active?: Set<number>
  onLineClick?: (no: number) => void
  title?: string
}

export function CodeView({ lines, tones, active, onLineClick, title = 'your_code.py' }: CodeViewProps) {
  return (
    <div className="cc-codeview">
      <div className="cc-codeview__bar">
        <span className="cc-dots" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span>{title}</span>
      </div>
      <ol className="cc-codeview__lines">
        {lines.map((line) => {
          const tone = tones?.get(line.no)
          const classes = [
            'cc-codeview__line',
            tone !== undefined ? `cc-tone-${tone % 6}` : '',
            active?.has(line.no) ? 'is-active' : '',
            active && active.size > 0 && !active.has(line.no) ? 'is-dim' : '',
            onLineClick && line.kind !== 'blank' ? 'is-clickable' : '',
          ]
          return (
            <li
              key={line.no}
              className={classes.filter(Boolean).join(' ')}
              onClick={onLineClick && line.kind !== 'blank' ? () => onLineClick(line.no) : undefined}
            >
              <span className="cc-codeview__no">{line.no}</span>
              <code>{line.raw || ' '}</code>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
