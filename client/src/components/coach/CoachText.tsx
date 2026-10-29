import type { ReactNode } from 'react'

/** Renders coach text: `code`, **bold**, line breaks and ```python blocks```. */
function renderInline(text: string, keyBase: string): ReactNode[] {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).flatMap((piece, i) => {
    const key = `${keyBase}-${i}`
    if (piece.startsWith('`') && piece.endsWith('`') && piece.length > 1) return [<code key={key}>{piece.slice(1, -1)}</code>]
    if (piece.startsWith('**') && piece.endsWith('**')) return [<strong key={key}>{piece.slice(2, -2)}</strong>]
    return piece.split('\n').flatMap((line, j) => (j === 0 ? [line] : [<br key={`${key}-${j}`} />, line]))
  })
}

export function CoachText({ text, as = 'span' }: { text: string; as?: 'span' | 'p' }) {
  if (as === 'span') return <span>{renderInline(text, 't')}</span>
  const parts = text.split(/```(?:python|py)?\n?([\s\S]*?)```/g)
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <pre key={i} className="cc-snippet">
            {part.replace(/\n$/, '')}
          </pre>
        ) : (
          part
            .split(/\n{2,}/)
            .filter((p) => p.trim())
            .map((p, j) => <p key={`${i}-${j}`}>{renderInline(p.trim(), `${i}-${j}`)}</p>)
        ),
      )}
    </>
  )
}
