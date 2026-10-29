import { useEffect, useRef, useState, type FormEvent } from 'react'
import { askCodeHelp } from '../../api/codeHelp'
import type { DoubtMessage, TutorMode } from '../../api/doubts'
import type { HelpContext } from '../../learning/coach/helper'
import { CoachText } from './CoachText'

const HISTORY_SENT = 6

const SUGGESTIONS: Record<HelpContext['stage'], string[]> = {
  write: ['Is my code correct?', 'Why is there a colon?', 'What is a variable?'],
  explain: ['What does line 2 do?', 'Explain the whole code', 'How do I remember this?'],
  retype: ['Give me a hint', 'What comes next?', 'Why is my line wrong?'],
}

type CoachHelpProps = { context: HelpContext; typed?: string }

export function CoachHelp({ context, typed = '' }: CoachHelpProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<DoubtMessage[]>([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [mode, setMode] = useState<TutorMode | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' })
  }, [messages, thinking, open])

  async function send(text: string) {
    const question = text.trim()
    if (!question || thinking) return
    const history = messages.slice(-HISTORY_SENT)
    setMessages((prev) => [...prev, { role: 'user', content: question }])
    setInput('')
    setThinking(true)
    const reply = await askCodeHelp(context, question, history, typed)
    setMode(reply.mode)
    setMessages((prev) => [...prev, { role: 'assistant', content: reply.answer }])
    setThinking(false)
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    void send(input)
  }

  if (!open) {
    return (
      <button type="button" className="cc-help-fab" onClick={() => setOpen(true)}>
        <span aria-hidden>🙋</span> Need help? Ask the coach
      </button>
    )
  }

  return (
    <aside className="cc-help" aria-label="Ask the coach about your code">
      <header className="cc-help__head">
        <span className="cc-help__avatar" aria-hidden>
          🧑‍🏫
        </span>
        <div>
          <strong>Code coach</strong>
          <span>🔒 Only about the code on this page</span>
        </div>
        {mode ? <span className={`cc-help__mode cc-help__mode--${mode}`}>{mode === 'ai' ? '✨ AI' : '📘 Built-in'}</span> : null}
        <button type="button" className="cc-help__close" onClick={() => setOpen(false)} aria-label="Close help">
          ×
        </button>
      </header>

      <div className="cc-help__messages" ref={listRef}>
        <div className="cc-msg cc-msg--assistant">
          <CoachText
            as="p"
            text={
              context.stage === 'retype'
                ? 'Stuck while retyping? Ask for a **hint** and I’ll nudge you without giving the whole answer away. 💪'
                : 'Hi! 👋 Ask me about **any line, word or symbol** in your code. I explain — I don’t run code or write new programs.'
            }
          />
        </div>
        {messages.map((message, i) => (
          <div key={i} className={`cc-msg cc-msg--${message.role}`}>
            {message.role === 'assistant' ? <CoachText as="p" text={message.content} /> : message.content}
          </div>
        ))}
        {thinking ? (
          <div className="cc-msg cc-msg--assistant cc-typing" aria-label="Thinking">
            <span />
            <span />
            <span />
          </div>
        ) : null}
      </div>

      <div className="cc-help__suggestions">
        {SUGGESTIONS[context.stage].map((s) => (
          <button key={s} type="button" onClick={() => void send(s)} disabled={thinking}>
            {s}
          </button>
        ))}
      </div>

      <form className="cc-help__input" onSubmit={handleSubmit}>
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void send(input)
            }
          }}
          placeholder="Ask about your code…"
          rows={1}
          maxLength={500}
        />
        <button type="submit" disabled={!input.trim() || thinking} aria-label="Send question">
          ➤
        </button>
      </form>
    </aside>
  )
}
