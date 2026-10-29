import type { Issue } from '../../learning/coach/checker'
import { CoachText } from './CoachText'

const CATEGORY_LABEL: Record<string, string> = {
  SyntaxError: 'Grammar mistake',
  IndentationError: 'Spacing mistake',
  NameError: 'Unknown name',
  TypeError: 'Wrong kind of value',
  ValueError: 'Wrong value',
  ZeroDivisionError: 'Dividing by zero',
  IndexError: 'Position out of range',
  KeyError: 'Missing key',
}

function shown(text: string, issue: Issue) {
  if (issue.category !== 'IndentationError') return text.trim() || '(empty)'
  return text.trimEnd().replace(/^[ \t]+/, (lead) => '·'.repeat(lead.replace(/\t/g, '    ').length)) || '(empty)'
}

type IssueListProps = {
  issues: Issue[]
  onFix: (issue: Issue) => void
  onFixAll: () => void
}

export function IssueList({ issues, onFix, onFixAll }: IssueListProps) {
  const fixable = issues.filter((i) => i.after !== null).length
  return (
    <div className="cc-issues">
      <div className="cc-issues__head">
        <div>
          <strong>
            {issues.length === 1 ? '1 thing to fix' : `${issues.length} things to fix`}
          </strong>
          <span>Every mistake is a lesson — read why, then fix it.</span>
          {issues.some((i) => i.category === 'IndentationError') ? <span>A dot · means one space.</span> : null}
        </div>
        {fixable > 1 ? (
          <button type="button" className="cc-btn cc-btn--soft" onClick={onFixAll}>
            🪄 Fix all for me
          </button>
        ) : null}
      </div>

      <ul>
        {issues.map((issue) => (
          <li key={issue.id} className="cc-issue">
            <div className="cc-issue__top">
              <span className="cc-issue__line">Line {issue.line}</span>
              <span className="cc-issue__cat">{CATEGORY_LABEL[issue.category] ?? issue.category}</span>
            </div>
            <h4>{issue.title}</h4>
            <p>
              <CoachText text={issue.explain} />
            </p>
            <div className="cc-diff">
              <div className="cc-diff__row cc-diff__row--before">
                <span>You wrote</span>
                <code>{shown(issue.before, issue)}</code>
              </div>
              {issue.after !== null ? (
                <div className="cc-diff__row cc-diff__row--after">
                  <span>Correct</span>
                  <code>{shown(issue.after, issue)}</code>
                </div>
              ) : null}
            </div>
            {issue.after !== null ? (
              <button type="button" className="cc-btn cc-btn--tiny" onClick={() => onFix(issue)}>
                ✓ Fix this line
              </button>
            ) : (
              <span className="cc-issue__manual">✍️ This one needs you — change the line yourself.</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
