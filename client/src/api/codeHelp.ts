import { apiUrl } from '../lib/apiBase'
import { supabase } from '../lib/supabase'
import { guardCodeQuestion, offlineCodeHelp, type HelpContext } from '../learning/coach/helper'
import type { DoubtMessage, TutorMode } from './doubts'

export type CodeHelpAnswer = { answer: string; mode: TutorMode }

type HelpResponse = {
  success: boolean
  message?: string
  data?: { answer?: string; offTopic?: boolean }
}

let aiUnavailable = false

async function askServer(
  ctx: HelpContext,
  question: string,
  history: DoubtMessage[],
  typed: string,
): Promise<CodeHelpAnswer | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) return null

  const response = await fetch(apiUrl('/api/mentor/code-help'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ code: ctx.explanation.code, typed, stage: ctx.stage, question, history }),
  })

  const data = (await response.json().catch(() => null)) as HelpResponse | null

  if (response.status === 429 && data?.message) return { answer: data.message, mode: 'ai' }
  if (response.status === 503 && data?.message === 'AI_NOT_CONFIGURED') {
    aiUnavailable = true
    return null
  }
  if (!response.ok || !data?.success || !data.data?.answer) return null
  return { answer: data.data.answer, mode: 'ai' }
}

/** Answers questions about the learner's own code — AI when configured, built-in coach otherwise. */
export async function askCodeHelp(
  ctx: HelpContext,
  question: string,
  history: DoubtMessage[],
  typed = '',
): Promise<CodeHelpAnswer> {
  const refusal = guardCodeQuestion(question)
  if (refusal) return { answer: refusal, mode: aiUnavailable ? 'lesson' : 'ai' }

  if (!aiUnavailable) {
    try {
      const fromServer = await askServer(ctx, question, history, typed)
      if (fromServer) return fromServer
    } catch {
      // Network problems fall through to the built-in coach.
    }
  }
  return { answer: offlineCodeHelp(question, ctx), mode: 'lesson' }
}
