import { supabase } from '../lib/supabase'

export const AUTH_REDIRECT_KEY = 'codementor_auth_redirect'

const PROTECTED_PATHS = [
  '/lessons',
  '/virtual-editor',
  '/progress',
  '/streak',
  '/rewards',
  '/course-map',
  '/constellation',
] as const

export type ProtectedPath = (typeof PROTECTED_PATHS)[number]

export function goTo(path: string) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function isProtectedPath(path: string): path is ProtectedPath {
  return PROTECTED_PATHS.includes(path as ProtectedPath)
}

export function saveAuthRedirect(path: string) {
  sessionStorage.setItem(AUTH_REDIRECT_KEY, path)
}

export function consumeAuthRedirect(fallback = '/dashboard'): string {
  const path = sessionStorage.getItem(AUTH_REDIRECT_KEY)
  sessionStorage.removeItem(AUTH_REDIRECT_KEY)
  if (path && isProtectedPath(path)) {
    return path
  }
  return fallback
}

export async function hasActiveSession(): Promise<boolean> {
  const { data } = await supabase.auth.getSession()
  return Boolean(data.session)
}

/** Navigate to target if logged in; otherwise save target and open login. */
export async function requireAuth(targetPath: ProtectedPath): Promise<void> {
  if (await hasActiveSession()) {
    goTo(targetPath)
    return
  }
  saveAuthRedirect(targetPath)
  goTo('/login')
}
