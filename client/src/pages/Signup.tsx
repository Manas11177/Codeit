import { useState } from 'react'
import { supabase } from '../lib/supabase'
import './Auth.css'

function goTo(path: string) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export default function Signup() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSignup() {
    if (!firstName || !lastName || !email || !password) {
      setError('Please fill in all required fields.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    setError('')

    const { error: signupError } =
      await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
          },
        },
      })

    if (signupError) {
      setError(signupError.message)
      setLoading(false)
      return
    }

    alert(
      'Account created! Check your email to confirm your account, or try logging in.',
    )

    goTo('/login')
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

          <p className="auth-eyebrow">GET STARTED</p>

          <h1>Create your account</h1>

          <p>
            Join Code Mentor and start learning,
            practicing, and building.
          </p>
        </div>

        <div className="auth-form auth-form--signup">
          <div className="auth-row">
            <div>
              <label htmlFor="signup-first-name">
                First name
              </label>

              <input
                id="signup-first-name"
                type="text"
                placeholder="First name"
                value={firstName}
                onChange={(event) =>
                  setFirstName(event.target.value)
                }
              />
            </div>

            <div>
              <label htmlFor="signup-last-name">
                Last name
              </label>

              <input
                id="signup-last-name"
                type="text"
                placeholder="Last name"
                value={lastName}
                onChange={(event) =>
                  setLastName(event.target.value)
                }
              />
            </div>
          </div>

          <label htmlFor="signup-email">
            Email
          </label>

          <input
            id="signup-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
          />

          <label htmlFor="signup-password">
            Password
          </label>

          <input
            id="signup-password"
            type="password"
            placeholder="Create a password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
          />

          <label htmlFor="signup-confirm-password">
            Confirm password
          </label>

          <input
            id="signup-confirm-password"
            type="password"
            placeholder="Confirm your password"
            value={confirmPassword}
            onChange={(event) =>
              setConfirmPassword(event.target.value)
            }
          />

          {error ? (
            <p className="auth-error">{error}</p>
          ) : null}

          <button
            type="button"
            className="auth-submit"
            onClick={handleSignup}
            disabled={loading}
          >
            {loading
              ? 'Creating account...'
              : 'Create Account'}
          </button>
        </div>

        <div className="auth-footer">
          <span>Already have an account?</span>

          <button
            type="button"
            onClick={() => goTo('/login')}
          >
            Log in
          </button>
        </div>
      </section>
    </main>
  )
}
