import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  initCatDailyWatch,
  initCatTopicWatcher,
  isCompanionCatOn,
  isReactionsCatOn,
  registerCatToastShower,
  type CatToastPayload,
} from '../cat/catEngine'
import { installCelebrationBusyCapture } from '../cat/celebrationGate'
import type { CatMood } from '../cat/catMessages'
import { CatToast } from '../components/cat/CatToast'
import { CompanionCat } from '../components/cat/CompanionCat'
import { STATS_UPDATED_EVENT } from '../utils/lessonProgress'

type ShowCatToastInput = {
  message: string
  mood?: CatMood
}

type CatToastContextValue = {
  showCatToast: (input: ShowCatToastInput) => void
}

const CatToastContext = createContext<CatToastContextValue | null>(null)

const AUTO_DISMISS_MS = 4000
const LEAVE_MS = 280

function useCatFlags() {
  const [flags, setFlags] = useState(() => ({
    reactions: isReactionsCatOn(),
    companion: isCompanionCatOn(),
  }))

  useEffect(() => {
    const refresh = () =>
      setFlags({
        reactions: isReactionsCatOn(),
        companion: isCompanionCatOn(),
      })
    refresh()
    window.addEventListener(STATS_UPDATED_EVENT, refresh)
    return () => window.removeEventListener(STATS_UPDATED_EVENT, refresh)
  }, [])

  return flags
}

export function CatToastProvider({ children }: { children: ReactNode }) {
  const { reactions, companion } = useCatFlags()
  const [toast, setToast] = useState<CatToastPayload | null>(null)
  const [phrase, setPhrase] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)
  const leaveTimer = useRef<number | null>(null)
  const autoTimer = useRef<number | null>(null)

  const clearTimers = useCallback(() => {
    if (leaveTimer.current != null) {
      window.clearTimeout(leaveTimer.current)
      leaveTimer.current = null
    }
    if (autoTimer.current != null) {
      window.clearTimeout(autoTimer.current)
      autoTimer.current = null
    }
  }, [])

  const dismiss = useCallback(() => {
    setLeaving((already) => {
      if (already) return already
      return true
    })
  }, [])

  const showCatToast = useCallback((input: ShowCatToastInput) => {
    if (isCompanionCatOn()) return
    clearTimers()
    setLeaving(false)
    setToast({
      message: input.message,
      mood: input.mood ?? 'happy',
      trigger: 'topicComplete',
    })
  }, [clearTimers])

  const onPhraseDone = useCallback(() => {
    setPhrase(null)
  }, [])

  useEffect(() => {
    installCelebrationBusyCapture()
    registerCatToastShower((payload) => {
      if (isCompanionCatOn()) {
        clearTimers()
        setToast(null)
        setLeaving(false)
        setPhrase(payload.message)
        return
      }
      if (!isReactionsCatOn()) return
      setPhrase(null)
      clearTimers()
      setLeaving(false)
      setToast(payload)
    })
    return () => registerCatToastShower(null)
  }, [clearTimers])

  useEffect(() => initCatTopicWatcher(), [])
  useEffect(() => initCatDailyWatch(), [])

  useEffect(() => {
    if (companion) {
      clearTimers()
      setToast(null)
      setLeaving(false)
      return
    }
    setPhrase(null)
  }, [companion, clearTimers])

  useEffect(() => {
    if (!toast || leaving || companion) return
    autoTimer.current = window.setTimeout(() => {
      setLeaving(true)
    }, AUTO_DISMISS_MS)
    return () => {
      if (autoTimer.current != null) window.clearTimeout(autoTimer.current)
    }
  }, [toast, leaving, companion])

  useEffect(() => {
    if (!leaving || !toast) return
    leaveTimer.current = window.setTimeout(() => {
      setToast(null)
      setLeaving(false)
    }, LEAVE_MS)
    return () => {
      if (leaveTimer.current != null) window.clearTimeout(leaveTimer.current)
    }
  }, [leaving, toast])

  useEffect(() => {
    if (!toast || companion) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toast, dismiss, companion])

  const value = useMemo(() => ({ showCatToast }), [showCatToast])

  return (
    <CatToastContext.Provider value={value}>
      {children}
      {reactions && toast ? (
        <CatToast
          message={toast.message}
          mood={toast.mood}
          leaving={leaving}
          onDismiss={dismiss}
        />
      ) : null}
      <CompanionCat active={companion} phrase={phrase} onPhraseDone={onPhraseDone} />
    </CatToastContext.Provider>
  )
}

export function useCatToast() {
  const ctx = useContext(CatToastContext)
  if (!ctx) {
    throw new Error('useCatToast must be used inside CatToastProvider')
  }
  return ctx
}
