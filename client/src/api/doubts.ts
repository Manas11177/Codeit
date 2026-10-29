import { apiUrl } from '../lib/apiBase'
import { supabase } from '../lib/supabase'
import {
  answerFromLesson,
  guardQuestion,
  topicContext,
  type TutorTopic,
} from '../learning/topicTutor'

export type DoubtMessage = { role: 'user' | 'assistant'; content: string }
export type TutorMode = 'ai' | 'lesson'
export type DoubtAnswer = { answer: string; mode: TutorMode }

type AskResponse = {
  success: boolean
  message?: string
  data?: { answer?: string; offTopic?: boolean }
}

let aiUnavailable = false

export function currentTutorMode(): TutorMode {
  return aiUnavailable ? 'lesson' : 'ai'
}

async function askServer(
  topic: TutorTopic,
  question: string,
  history: DoubtMessage[],
): Promise<DoubtAnswer | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) return null

  const response = await fetch(apiUrl('/api/mentor/ask'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      lessonId: topic.lessonId,
      lessonTitle: topic.lessonTitle,
      subtopic: topic.subtopic,
      context: topicContext(topic),
      question,
      history,
    }),
  })

  const data = (await response.json().catch(() => null)) as AskResponse | null

  if (response.status === 429 && data?.message) {
    return { answer: data.message, mode: 'ai' }
  }
  if (response.status === 503 && data?.message === 'AI_NOT_CONFIGURED') {
    aiUnavailable = true
    return null
  }
  if (!response.ok || !data?.success || !data.data?.answer) return null

  return { answer: data.data.answer, mode: 'ai' }
}

/** Answers a doubt about one topic only — AI when configured, lesson content otherwise. */
export async function askDoubt(
  topic: TutorTopic,
  question: string,
  history: DoubtMessage[],
): Promise<DoubtAnswer> {
  const guard = guardQuestion(topic, question)
  if (!guard.ok) return { answer: guard.reply, mode: currentTutorMode() }

  if (!aiUnavailable) {
    try {
      const fromServer = await askServer(topic, question, history)
      if (fromServer) return fromServer
    } catch {
      // Network problems fall through to the built-in tutor.
    }
  }

  return { answer: answerFromLesson(topic, question), mode: 'lesson' }
}
