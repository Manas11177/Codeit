import type { ExecutionResult } from '../types'
import { apiUrl } from '../lib/apiBase'
import { supabase } from '../lib/supabase'

interface ExecuteResponse {
  statusCode: number
  data: ExecutionResult
  message: string
  success: boolean
}

/** Run Python via the server playground endpoint (authenticated). */
export async function runPlaygroundCode(
  code: string,
): Promise<ExecutionResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new Error('You must be logged in to run code.')
  }

  const response = await fetch(apiUrl('/api/execute'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ code }),
  })

  let data: ExecuteResponse | null = null

  try {
    data = (await response.json()) as ExecuteResponse
  } catch {
    throw new Error('The execution server returned an invalid response.')
  }

  if (!response.ok || !data?.data) {
    const message =
      data?.message ||
      (response.status === 429
        ? 'Too many code runs. Please wait about a minute and try again.'
        : response.status === 502
          ? 'Code runner unavailable. Restart the server after updating server/.env.'
          : 'Unable to run the code.')
    throw new Error(message)
  }

  return data.data
}
