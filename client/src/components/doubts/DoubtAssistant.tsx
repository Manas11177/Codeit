import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { askDoubt, type DoubtMessage, type TutorMode } from '../../api/doubts'
import type { TutorTopic } from '../../learning/topicTutor'
import './DoubtAssistant.css'

type DoubtAssistantProps = {
  topic: TutorTopic
}

const HISTORY_SENT = 6

function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((piece, i) => {
    if (piece.startsWith('**') && piece.endsWith('**')) {
      return <strong key={i}>{piece.slice(2, -2)}</strong>
    }
    return piece.split('\n').flatMap((line, j) => (j === 0 ? [line] : [<br key={`${i}-${j}`} />, line]))
  })
}

function RichText({ text }: { text: string }) {
  const parts = text.split(/```(?:python|py)?\n?([\s\S]*?)```/g)
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <pre key={i} className="da-code">
            {part.trim()}
          </pre>
        ) : (
          part
            .split(/\n{2,}/)
            .filter((paragraph) => paragraph.trim())
            .map((paragraph, j) => <p key={`${i}-${j}`}>{renderInline(paragraph.trim())}</p>)
        ),
      )}
    </>
  )
}

export function DoubtAssistant({ topic }: DoubtAssistantProps) {
  const [messages, setMessages] = useState<DoubtMessage[]>([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [mode, setMode] = useState<TutorMode | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  const suggestions = [
    `What is ${topic.subtopic}?`,
    'Show me a tiny example',
    'What mistake should I avoid?',
    'Explain it even simpler',
  ]

  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' })
  }, [messages, thinking])

  async function send(text: string) {
    const question = text.trim()
    if (!question || thinking) return
    const history = messages.slice(-HISTORY_SENT)
    setMessages((prev) => [...prev, { role: 'user', content: question }])
    setInput('')
    setThinking(true)
    const reply = await askDoubt(topic, question, history)
    setMode(reply.mode)
    setMessages((prev) => [...prev, { role: 'assistant', content: reply.answer }])
    setThinking(false)
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    void send(input)
  }

  return (
    <aside className="da" aria-label={`Doubt helper for ${topic.subtopic}`}>
      <header className="da-head">
        <span className="da-avatar" aria-hidden>
          🤖
        </span>
        <div>
          <strong>Doubt helper</strong>
          <span className="da-lock">🔒 Only about “{topic.subtopic}”</span>
        </div>
        {mode ? (
          <span className={`da-mode da-mode--${mode}`}>
            {mode === 'ai' ? '✨ AI' : '📘 Lesson notes'}
          </span>
        ) : null}
      </header>

      <div className="da-messages" ref={listRef}>
        <div className="da-msg da-msg--assistant">
          <RichText
            text={`Hi! 👋 I'm your helper for **${topic.subtopic}**.\n\nStuck on something? Ask me, and I'll explain it in very easy words. I only answer questions about this topic, and I won't write programs for you.`}
          />
        </div>

        {messages.map((message, i) => (
          <div key={i} className={`da-msg da-msg--${message.role}`}>
            {message.role === 'assistant' ? <RichText text={message.content} /> : message.content}
          </div>
        ))}

        {thinking ? (
          <div className="da-msg da-msg--assistant da-typing" aria-label="Thinking">
            <span />
            <span />
            <span />
          </div>
        ) : null}
      </div>

      {messages.length === 0 ? (
        <div className="da-suggestions">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => void send(suggestion)}
              disabled={thinking}
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}

      <form className="da-input" onSubmit={handleSubmit}>
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void send(input)
            }
          }}
          placeholder={`Ask a doubt about ${topic.subtopic}…`}
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
