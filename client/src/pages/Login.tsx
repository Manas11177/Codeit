import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { consumeAuthRedirect, goTo } from '../utils/navigation'
import './Auth.css'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin() {
    if (!email || !password) {
      setError('Please enter your email and password.')
      return
    }

    setLoading(true)
    setError('')

    const { error: loginError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      })

    if (loginError) {
      setError(loginError.message)
      setLoading(false)
      return
    }

    goTo(consumeAuthRedirect('/dashboard'))
    setLoading(false)
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-header">
          <button
            type="button"
            className="auth-back"
            onClick={() => goTo('/')}
          >
            ← Back
          </button>

          <div className="auth-brand">
            Code<span>Mentor</span>
          </div>

          <p className="auth-eyebrow">WELCOME BACK</p>

          <h1>Log in to Code Mentor</h1>

          <p>
            Continue your coding journey and pick up where
            you left off.
          </p>
        </div>

        <div className="auth-form">
          <label htmlFor="login-email">
            Email
          </label>

          <input
            id="login-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
          />

          <label htmlFor="login-password">
            Password
          </label>

          <input
            id="login-password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                handleLogin()
              }
            }}
          />

          {error ? (
            <p className="auth-error">{error}</p>
          ) : null}

          <button
            type="button"
            className="auth-submit"
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </div>

        <div className="auth-footer">
          <span>Don't have an account?</span>

          <button
            type="button"
            onClick={() => goTo('/signup')}
          >
            Create an account
          </button>
        </div>
      </section>
    </main>
  )
}
