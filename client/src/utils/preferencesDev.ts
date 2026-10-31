/**
 * DEV ONLY — remove before production.
 * Console: __preferencesDev.reset()
 * Clears local preferences and the preferences field on the cloud user_progress row.
 */
import { supabase } from '../lib/supabase'
import {
  getProgressStoreSnapshot,
  getProgressUserId,
  replaceProgressStoreSnapshot,
} from './lessonProgress'

export function installPreferencesDevHelper() {
  if (!import.meta.env.DEV) return

  const api = {
    help() {
      console.info('[preferences dev] reset() — clear local + cloud preferences, then reload')
    },
    async reset() {
      const userId = getProgressUserId()
      const snap = getProgressStoreSnapshot()
      replaceProgressStoreSnapshot({ ...snap, preferences: null })

      if (userId) {
        const { data, error } = await supabase
          .from('user_progress')
          .select('data')
          .eq('user_id', userId)
          .maybeSingle()
        if (error) {
          console.warn('[preferences dev] cloud read failed', error)
        } else if (data?.data && typeof data.data === 'object') {
          const row = data.data as {
            progress?: Record<string, unknown>
            celebrations?: { shown?: string[] }
          }
          const next = {
            ...row,
            progress: {
              ...(row.progress ?? {}),
              preferences: null,
            },
          }
          const { error: upErr } = await supabase.from('user_progress').upsert(
            {
              user_id: userId,
              data: next,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' },
          )
          if (upErr) console.warn('[preferences dev] cloud clear failed', upErr)
        }
      }

      console.info('[preferences dev] cleared — reloading')
      window.location.reload()
    },
  }

  ;(window as unknown as { __preferencesDev: typeof api }).__preferencesDev = api
}
