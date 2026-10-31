/**
 * Client-side progress sync via Supabase (no Express).
 * Synced payload shape is extensible — add future keys under SyncedProgressData.
 */
import { supabase } from '../lib/supabase'
import {
  STATS_UPDATED_EVENT,
  getProgressStoreSnapshot,
  getProgressUserId,
  replaceProgressStoreSnapshot,
  type PracticeRecord,
  type ProgressStore,
  type TopicPerformance,
  type UserPreferences,
  type UserProfile,
  type UserRewards,
  type WarmupHistory,
} from '../utils/lessonProgress'

export type SyncedProgressData = {
  progress: ProgressStore
  celebrations: { shown: string[] }
}

const DEBOUNCE_MS = 3000
const TABLE = 'user_progress'

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let syncingUserId: string | null = null
let suppressPush = false
let listenersBound = false
let pushInFlight: Promise<void> | null = null
let pendingPush = false

function celebrationsKey(userId: string) {
  return `codementor-celebrations-${userId}`
}

function readCelebrations(userId: string): { shown: string[] } {
  try {
    const raw = localStorage.getItem(celebrationsKey(userId))
    if (!raw) return { shown: [] }
    const parsed = JSON.parse(raw) as { shown?: string[] }
    return { shown: Array.isArray(parsed.shown) ? parsed.shown : [] }
  } catch {
    return { shown: [] }
  }
}

function writeCelebrations(userId: string, celebrations: { shown: string[] }) {
  localStorage.setItem(
    celebrationsKey(userId),
    JSON.stringify({ shown: [...new Set(celebrations.shown)] }),
  )
}

function emptyProgress(): ProgressStore {
  return {
    completed: {},
    activityDates: [],
    performance: {},
    practice: [],
    warmups: {},
    preferences: null,
    rewards: null,
    profile: null,
  }
}

function hasSavedPreferences(prefs: UserPreferences | null | undefined) {
  if (!prefs?.updatedAt) return false
  if (prefs.skipped) return true
  return Boolean(prefs.goal && prefs.experience && prefs.dailyMinutes)
}

function hasSavedRewards(rewards: UserRewards | null | undefined) {
  return Boolean(rewards?.updatedAt)
}

function hasSavedProfile(profile: UserProfile | null | undefined) {
  return Boolean(profile?.updatedAt)
}

function isProgressEmpty(store: ProgressStore) {
  return (
    store.activityDates.length === 0 &&
    store.practice.length === 0 &&
    Object.keys(store.completed).length === 0 &&
    Object.keys(store.performance).length === 0 &&
    Object.keys(store.warmups).length === 0 &&
    !hasSavedPreferences(store.preferences) &&
    !hasSavedRewards(store.rewards) &&
    !hasSavedProfile(store.profile)
  )
}

function isSyncedEmpty(data: SyncedProgressData | null | undefined) {
  if (!data?.progress) return true
  const shown = data.celebrations?.shown?.length ?? 0
  return isProgressEmpty(data.progress) && shown === 0
}

/** Newer updatedAt wins; empty/missing never overwrites a saved value. */
export function mergePreferences(
  local: UserPreferences | null | undefined,
  remote: UserPreferences | null | undefined,
): UserPreferences | null {
  const localOk = hasSavedPreferences(local)
  const remoteOk = hasSavedPreferences(remote)
  if (!localOk && !remoteOk) return null
  if (!localOk) return remote ?? null
  if (!remoteOk) return local ?? null
  return (local!.updatedAt >= remote!.updatedAt ? local : remote) ?? null
}

/** Newer updatedAt wins; empty/missing never overwrites a saved value. */
export function mergeRewards(
  local: UserRewards | null | undefined,
  remote: UserRewards | null | undefined,
): UserRewards | null {
  const localOk = hasSavedRewards(local)
  const remoteOk = hasSavedRewards(remote)
  if (!localOk && !remoteOk) return null
  if (!localOk) return remote ?? null
  if (!remoteOk) return local ?? null
  return (local!.updatedAt >= remote!.updatedAt ? local : remote) ?? null
}

/** Newer updatedAt wins; empty/missing never overwrites a saved value. */
export function mergeProfile(
  local: UserProfile | null | undefined,
  remote: UserProfile | null | undefined,
): UserProfile | null {
  const localOk = hasSavedProfile(local)
  const remoteOk = hasSavedProfile(remote)
  if (!localOk && !remoteOk) return null
  if (!localOk) return remote ?? null
  if (!remoteOk) return local ?? null
  return (local!.updatedAt >= remote!.updatedAt ? local : remote) ?? null
}

function practiceKey(record: PracticeRecord) {
  return `${record.questionId}|${record.at}|${record.source}`
}

function mergeStringLists(a: string[] = [], b: string[] = []) {
  return [...new Set([...a, ...b])]
}

function mergeCompleted(
  local: Record<string, string[]>,
  remote: Record<string, string[]>,
) {
  const keys = new Set([...Object.keys(local), ...Object.keys(remote)])
  const out: Record<string, string[]> = {}
  for (const key of keys) {
    out[key] = mergeStringLists(local[key], remote[key])
  }
  return out
}

function mergePerformance(
  local: Record<string, TopicPerformance>,
  remote: Record<string, TopicPerformance>,
) {
  const keys = new Set([...Object.keys(local), ...Object.keys(remote)])
  const out: Record<string, TopicPerformance> = {}
  for (const key of keys) {
    const a = local[key]
    const b = remote[key]
    if (!a) {
      out[key] = b
      continue
    }
    if (!b) {
      out[key] = a
      continue
    }
    const errors: TopicPerformance['errors'] = { ...a.errors }
    for (const [err, count] of Object.entries(b.errors ?? {})) {
      const typed = err as keyof TopicPerformance['errors']
      errors[typed] = Math.max(errors[typed] ?? 0, count ?? 0)
    }
    out[key] = {
      lessonId: a.lessonId || b.lessonId,
      subtopic: a.subtopic || b.subtopic,
      hintsUsed: Math.max(a.hintsUsed, b.hintsUsed),
      sawAnswer: a.sawAnswer || b.sawAnswer,
      runs: Math.max(a.runs, b.runs),
      checks: Math.max(a.checks, b.checks),
      failedChecks: Math.max(a.failedChecks, b.failedChecks),
      errors,
      solved: a.solved || b.solved,
      firstActivityAt:
        a.firstActivityAt <= b.firstActivityAt ? a.firstActivityAt : b.firstActivityAt,
      lastActivityAt:
        a.lastActivityAt >= b.lastActivityAt ? a.lastActivityAt : b.lastActivityAt,
      solvedAt: [a.solvedAt, b.solvedAt].filter(Boolean).sort().at(0),
    }
  }
  return out
}

function mergeWarmups(
  local: Record<string, WarmupHistory>,
  remote: Record<string, WarmupHistory>,
) {
  const keys = new Set([...Object.keys(local), ...Object.keys(remote)])
  const out: Record<string, WarmupHistory> = {}
  for (const key of keys) {
    const a = local[key]
    const b = remote[key]
    if (!a) {
      out[key] = b
      continue
    }
    if (!b) {
      out[key] = a
      continue
    }
    out[key] = {
      attempt: Math.max(a.attempt, b.attempt),
      recent: mergeStringLists(a.recent, b.recent).slice(-20),
    }
  }
  return out
}

function mergePractice(local: PracticeRecord[], remote: PracticeRecord[]) {
  const map = new Map<string, PracticeRecord>()
  for (const record of [...remote, ...local]) {
    map.set(practiceKey(record), record)
  }
  return [...map.values()]
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(-600)
}

export function mergeSyncedData(
  local: SyncedProgressData,
  remote: SyncedProgressData | null,
): SyncedProgressData {
  if (!remote || isSyncedEmpty(remote)) return local
  if (isSyncedEmpty(local)) return remote

  return {
    progress: {
      completed: mergeCompleted(local.progress.completed, remote.progress.completed),
      activityDates: mergeStringLists(
        local.progress.activityDates,
        remote.progress.activityDates,
      ).sort(),
      performance: mergePerformance(
        local.progress.performance,
        remote.progress.performance,
      ),
      practice: mergePractice(local.progress.practice, remote.progress.practice),
      warmups: mergeWarmups(local.progress.warmups, remote.progress.warmups),
      preferences: mergePreferences(
        local.progress.preferences,
        remote.progress.preferences,
      ),
      rewards: mergeRewards(local.progress.rewards, remote.progress.rewards),
      profile: mergeProfile(local.progress.profile, remote.progress.profile),
    },
    celebrations: {
      shown: mergeStringLists(
        local.celebrations.shown,
        remote.celebrations.shown,
      ),
    },
  }
}

function readLocalSyncedData(userId: string): SyncedProgressData {
  return {
    progress: getProgressStoreSnapshot(),
    celebrations: readCelebrations(userId),
  }
}

function applyLocalSyncedData(userId: string, data: SyncedProgressData) {
  suppressPush = true
  try {
    // Write celebration flags BEFORE progress. Progress replace fires
    // STATS_UPDATED; if flags aren't in place yet, medal popups replay.
    writeCelebrations(userId, data.celebrations ?? { shown: [] })
    replaceProgressStoreSnapshot(data.progress ?? emptyProgress())
  } finally {
    // Allow the stats event from replaceProgressStoreSnapshot to settle first.
    window.setTimeout(() => {
      suppressPush = false
    }, 0)
  }
}

async function fetchRemote(userId: string): Promise<SyncedProgressData | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('data')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  if (!data?.data) return null
  const raw = data.data as Partial<SyncedProgressData>
  return {
    progress: {
      ...emptyProgress(),
      ...(raw.progress ?? {}),
    },
    celebrations: { shown: raw.celebrations?.shown ?? [] },
  }
}

async function upsertRemote(userId: string, payload: SyncedProgressData) {
  const { error } = await supabase.from(TABLE).upsert(
    {
      user_id: userId,
      data: payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (error) throw error
}

async function pushNow(userId: string) {
  if (suppressPush) return
  if (pushInFlight) {
    pendingPush = true
    return
  }

  pushInFlight = (async () => {
    try {
      const local = readLocalSyncedData(userId)
      await upsertRemote(userId, local)
    } catch (err) {
      console.warn('[progressSync] push failed; will keep local and retry later', err)
    } finally {
      pushInFlight = null
      if (pendingPush && syncingUserId === userId) {
        pendingPush = false
        void pushNow(userId)
      }
    }
  })()

  await pushInFlight
}

function schedulePush(userId: string | null = syncingUserId) {
  if (!userId || suppressPush) return
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    void pushNow(userId)
  }, DEBOUNCE_MS)
}

const SYNC_TIMEOUT_MS = 4000

/** Pull remote row (if any), merge with local, write local, upsert merged. */
export async function syncProgressOnLogin(userId: string) {
  syncingUserId = userId
  try {
    const local = readLocalSyncedData(userId)
    let remote: SyncedProgressData | null = null
    try {
      remote = await fetchRemote(userId)
    } catch (err) {
      console.warn('[progressSync] pull failed; continuing with local only', err)
      schedulePush(userId)
      return
    }

    if (!remote || isSyncedEmpty(remote)) {
      if (!isSyncedEmpty(local)) {
        await upsertRemote(userId, local).catch((err) => {
          console.warn('[progressSync] create-from-local failed', err)
        })
      } else {
        await upsertRemote(userId, local).catch(() => {
          /* empty seed optional */
        })
      }
      return
    }

    const merged = mergeSyncedData(local, remote)
    applyLocalSyncedData(userId, merged)
    await upsertRemote(userId, merged).catch((err) => {
      console.warn('[progressSync] upsert merged failed', err)
    })
  } catch (err) {
    console.warn('[progressSync] sync on login failed', err)
  }
}

/** Wait for login sync, or resolve after timeout so offline users aren't blocked. */
export async function waitForInitialSync(userId: string, timeoutMs = SYNC_TIMEOUT_MS) {
  syncingUserId = userId
  await Promise.race([
    syncProgressOnLogin(userId),
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, timeoutMs)
    }),
  ])
}

/** Flush pending changes immediately (logout / tab close). */
export async function flushProgressSync() {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  const userId = syncingUserId ?? getProgressUserId()
  if (!userId) return
  await pushNow(userId)
}

export function stopProgressSync() {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  syncingUserId = null
}

function onStatsUpdated() {
  const userId = getProgressUserId()
  if (!userId) return
  syncingUserId = userId
  schedulePush(userId)
}

function onVisibilityOrUnload() {
  if (document.visibilityState && document.visibilityState !== 'hidden') return
  void flushProgressSync()
}

/** Bind listeners once (safe to call repeatedly). */
export function initProgressSync() {
  if (listenersBound) return
  listenersBound = true
  window.addEventListener(STATS_UPDATED_EVENT, onStatsUpdated)
  window.addEventListener('pagehide', () => {
    void flushProgressSync()
  })
  document.addEventListener('visibilitychange', onVisibilityOrUnload)
}
