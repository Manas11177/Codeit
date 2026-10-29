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
import { supabase } from './lib/supabase'
import {
  goTo,
  isProtectedPath,
  saveAuthRedirect,
} from './utils/navigation'
import { setProgressUserId } from './utils/lessonProgress'
import './App.css'

type AppPage =
  | 'dashboard'
  | 'login'
  | 'signup'
  | 'lessons'
  | 'virtual-editor'
  | 'progress'

function getCurrentPage(): AppPage {
  const path = window.location.pathname

  if (path === '/login') return 'login'
  if (path === '/signup') return 'signup'
  if (path === '/lessons') return 'lessons'
  if (path === '/virtual-editor') return 'virtual-editor'
  if (path === '/progress') return 'progress'
  if (path === '/' || path === '/dashboard') return 'dashboard'

  return 'dashboard'
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true)
  const [currentPage, setCurrentPage] = useState<AppPage>(getCurrentPage)
  const [authReady, setAuthReady] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const sessionRef = useRef<Session | null>(null)
  sessionRef.current = session

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
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setProgressUserId(data.session?.user?.id ?? null)
      setAuthReady(true)
      if (!guardProtectedRoute(data.session)) {
        setCurrentPage(getCurrentPage())
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setProgressUserId(nextSession?.user?.id ?? null)
      guardProtectedRoute(nextSession)
    })

    function handleNavigation() {
      const page = getCurrentPage()
      if (guardProtectedRoute(sessionRef.current)) {
        return
      }
      setCurrentPage(page)
    }

    window.addEventListener('popstate', handleNavigation)

    return () => {
      subscription.unsubscribe()
      window.removeEventListener('popstate', handleNavigation)
    }
  }, [guardProtectedRoute])

  const protectedPage =
    currentPage === 'lessons' ||
    currentPage === 'virtual-editor' ||
    currentPage === 'progress'

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
    return <Dashboard />
  }

  return (
    <>
      <div className="app-shell">
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
      </div>

      {showSplash ? <SplashScreen onComplete={handleSplashComplete} /> : null}
    </>
  )
}
