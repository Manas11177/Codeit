import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { SplashScreen } from './components/splash/SplashScreen'
import { AppNavigation } from './components/navigation/AppNavigation'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Signup from './pages/Signup'
import { Lessons } from './pages/Lessons'
import { VirtualEditor } from './pages/VirtualEditor'
import { ProgressTracker } from './pages/ProgressTracker'
import { StreakMedals } from './pages/StreakMedals'
import { Rewards } from './pages/Rewards'
import { CourseMap } from './pages/CourseMap'
import { ConstellationPage } from './pages/ConstellationPage'
import { LegalDoc } from './pages/LegalDoc'
import { SiteFooter } from './components/layout/SiteFooter'
import { supabase } from './lib/supabase'
import {
  goTo,
  isProtectedPath,
  saveAuthRedirect,
} from './utils/navigation'
import { PreferencesOnboarding } from './components/preferences/PreferencesOnboarding'
import { RewardsApply } from './components/rewards/RewardsApply'
import {
  flushProgressSync,
  initProgressSync,
  stopProgressSync,
  waitForInitialSync,
} from './sync/progressSync'
import {
  hasPreferencesDecision,
  setProgressUserId,
} from './utils/lessonProgress'
import { installPreferencesDevHelper } from './utils/preferencesDev'
import { installRewardsDevHelper } from './utils/rewardsDev'
import './App.css'

type AppPage =
  | 'dashboard'
  | 'login'
  | 'signup'
  | 'lessons'
  | 'virtual-editor'
  | 'progress'
  | 'streak'
  | 'rewards'
  | 'course-map'
  | 'constellation'
  | 'terms'
  | 'privacy'
  | 'license'

function getCurrentPage(): AppPage {
  const path = window.location.pathname

  if (path === '/login') return 'login'
  if (path === '/signup') return 'signup'
  if (path === '/lessons') return 'lessons'
  if (path === '/virtual-editor') return 'virtual-editor'
  if (path === '/progress') return 'progress'
  if (path === '/streak') return 'streak'
  if (path === '/rewards') return 'rewards'
  if (path === '/course-map') return 'course-map'
  if (path === '/constellation') return 'constellation'
  if (path === '/terms') return 'terms'
  if (path === '/privacy') return 'privacy'
  if (path === '/license') return 'license'
  if (path === '/' || path === '/dashboard') return 'dashboard'

  return 'dashboard'
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true)
  const [currentPage, setCurrentPage] = useState<AppPage>(getCurrentPage)
  const [authReady, setAuthReady] = useState(false)
  const [syncReady, setSyncReady] = useState(false)
  const [prefsTick, setPrefsTick] = useState(0)
  const [editingPrefs, setEditingPrefs] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const sessionRef = useRef<Session | null>(null)
  sessionRef.current = session

  const needsOnboarding =
    Boolean(session) &&
    syncReady &&
    !hasPreferencesDecision() &&
    currentPage !== 'login' &&
    currentPage !== 'signup'

  const showPreferences = needsOnboarding || editingPrefs
  void prefsTick

  const guardProtectedRoute = useCallback((activeSession: Session | null) => {
    const path = window.location.pathname
    if (isProtectedPath(path) && !activeSession) {
      saveAuthRedirect(path)
      if (window.location.pathname !== '/login') {
        goTo('/login')
      }
      setCurrentPage('login')
      return true
    }
    return false
  }, [])

  useEffect(() => {
    initProgressSync()
    installPreferencesDevHelper()
    installRewardsDevHelper()

    async function bootWithSync(userId: string | null) {
      setSyncReady(false)
      setEditingPrefs(false)
      if (!userId) {
        setSyncReady(true)
        setPrefsTick((n) => n + 1)
        return
      }
      await waitForInitialSync(userId)
      setSyncReady(true)
      setPrefsTick((n) => n + 1)
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setProgressUserId(data.session?.user?.id ?? null)
      setAuthReady(true)
      void bootWithSync(data.session?.user?.id ?? null)
      if (!guardProtectedRoute(data.session)) {
        setCurrentPage(getCurrentPage())
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      const nextId = nextSession?.user?.id ?? null
      const prevId = sessionRef.current?.user?.id ?? null

      if (!nextId && prevId) {
        void flushProgressSync().finally(() => {
          stopProgressSync()
          setProgressUserId(null)
          setSyncReady(true)
          setEditingPrefs(false)
          setPrefsTick((n) => n + 1)
        })
      } else {
        setProgressUserId(nextId)
        if (nextId && nextId !== prevId) {
          void bootWithSync(nextId)
        }
      }

      setSession(nextSession)
      guardProtectedRoute(nextSession)
    })

    function handleNavigation() {
      const page = getCurrentPage()
      if (guardProtectedRoute(sessionRef.current)) {
        return
      }
      setCurrentPage(page)
    }

    function openPrefsEditor() {
      setEditingPrefs(true)
    }

    window.addEventListener('popstate', handleNavigation)
    window.addEventListener('codementor-edit-preferences', openPrefsEditor)

    return () => {
      subscription.unsubscribe()
      window.removeEventListener('popstate', handleNavigation)
      window.removeEventListener('codementor-edit-preferences', openPrefsEditor)
    }
  }, [guardProtectedRoute])

  const protectedPage =
    currentPage === 'lessons' ||
    currentPage === 'virtual-editor' ||
    currentPage === 'progress' ||
    currentPage === 'streak' ||
    currentPage === 'rewards' ||
    currentPage === 'course-map' ||
    currentPage === 'constellation'

  const showAppNavigation =
    currentPage === 'virtual-editor' &&
    authReady &&
    !(protectedPage && !session)

  function handleSplashComplete() {
    setShowSplash(false)
  }

  function renderPage() {
    if (!authReady && protectedPage) {
      return (
        <div className="app-shell app-shell--loading">
          <p>Loading…</p>
        </div>
      )
    }

    if (authReady && protectedPage && !session) {
      return <Login />
    }

    if (currentPage === 'login') return <Login />
    if (currentPage === 'signup') return <Signup />
    if (currentPage === 'virtual-editor') return <VirtualEditor />
    if (currentPage === 'lessons') return <Lessons />
    if (currentPage === 'progress') return <ProgressTracker />
    if (currentPage === 'streak') return <StreakMedals />
    if (currentPage === 'rewards') return <Rewards />
    if (currentPage === 'course-map') return <CourseMap />
    if (currentPage === 'constellation') return <ConstellationPage />
    if (currentPage === 'terms') return <LegalDoc kind="terms" />
    if (currentPage === 'privacy') return <LegalDoc kind="privacy" />
    if (currentPage === 'license') return <LegalDoc kind="license" />
    return <Dashboard />
  }

  return (
    <>
      <div className="app-shell app-shell--with-footer">
        {showAppNavigation ? (
          <AppNavigation
            currentPage={
              currentPage === 'virtual-editor'
                ? 'virtual-editor'
                : 'lessons'
            }
          />
        ) : null}

        {renderPage()}
        <SiteFooter />
        <RewardsApply />
      </div>

      {showSplash ? <SplashScreen onComplete={handleSplashComplete} /> : null}

      {showPreferences ? (
        <PreferencesOnboarding
          mode={editingPrefs || hasPreferencesDecision() ? 'edit' : 'onboarding'}
          onDone={() => {
            setEditingPrefs(false)
            setPrefsTick((n) => n + 1)
          }}
        />
      ) : null}
    </>
  )
}
