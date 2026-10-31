import { useState } from 'react'
import { useTheme } from '../../context/ThemeContext'
import {
  getPreferences,
  savePreferences,
  skipPreferences,
  type PreferenceDailyMinutes,
  type PreferenceExperience,
  type PreferenceGoal,
} from '../../utils/lessonProgress'
import './PreferencesOnboarding.css'

type PreferencesOnboardingProps = {
  mode?: 'onboarding' | 'edit'
  onDone: () => void
}

const GOALS: { id: PreferenceGoal; label: string; hint: string }[] = [
  { id: 'job', label: 'Get a job', hint: 'Build career-ready skills' },
  { id: 'college', label: 'College / school', hint: 'Keep up with coursework' },
  { id: 'hobby', label: 'Hobby', hint: 'Learn for fun' },
]

const EXPERIENCE: { id: PreferenceExperience; label: string; hint: string }[] = [
  { id: 'never', label: 'Never coded', hint: 'Start from absolute basics' },
  { id: 'some', label: 'Some experience', hint: 'I know a little already' },
  { id: 'comfortable', label: 'Comfortable', hint: 'I can write simple programs' },
]

const DAILY: { id: PreferenceDailyMinutes; label: string; hint: string }[] = [
  { id: 10, label: '10 min', hint: 'A quick daily habit' },
  { id: 20, label: '20 min', hint: 'Steady progress' },
  { id: 30, label: '30+ min', hint: 'Go deep when you can' },
]

export function PreferencesOnboarding({
  mode = 'onboarding',
  onDone,
}: PreferencesOnboardingProps) {
  const { darkMode } = useTheme()
  const existing = getPreferences()
  const [step, setStep] = useState(0)
  const [goal, setGoal] = useState<PreferenceGoal | null>(existing?.goal ?? null)
  const [experience, setExperience] = useState<PreferenceExperience | null>(
    existing?.experience ?? null,
  )
  const [dailyMinutes, setDailyMinutes] = useState<PreferenceDailyMinutes | null>(
    existing?.dailyMinutes ?? null,
  )

  function finish() {
    if (!goal || !experience || !dailyMinutes) return
    savePreferences({ goal, experience, dailyMinutes })
    onDone()
  }

  function handleSkip() {
    skipPreferences()
    onDone()
  }

  const canNext =
    (step === 0 && goal) || (step === 1 && experience) || (step === 2 && dailyMinutes)

  return (
    <div className={`prefs ${darkMode ? 'prefs--dark' : 'prefs--light'}`} role="dialog" aria-modal="true">
      <div className="prefs__backdrop" />
      <div className="prefs__card">
        <p className="prefs__eyebrow">
          {mode === 'edit' ? 'Edit preferences' : 'Quick setup'} · Step {step + 1} of 3
        </p>
        <h2>
          {step === 0 && 'What brings you here?'}
          {step === 1 && 'How much coding have you done?'}
          {step === 2 && 'How much time can you spare daily?'}
        </h2>
        <p className="prefs__sub">
          {step === 0 && 'We’ll tailor your home screen — you can change this later.'}
          {step === 1 && 'This only nudges your starting chapter, not the whole course.'}
          {step === 2 && 'Shown as a gentle daily target on your dashboard.'}
        </p>

        <div className="prefs__options" role="listbox">
          {step === 0
            ? GOALS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`prefs__option ${goal === item.id ? 'is-selected' : ''}`}
                  onClick={() => setGoal(item.id)}
                >
                  <strong>{item.label}</strong>
                  <span>{item.hint}</span>
                </button>
              ))
            : null}
          {step === 1
            ? EXPERIENCE.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`prefs__option ${experience === item.id ? 'is-selected' : ''}`}
                  onClick={() => setExperience(item.id)}
                >
                  <strong>{item.label}</strong>
                  <span>{item.hint}</span>
                </button>
              ))
            : null}
          {step === 2
            ? DAILY.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`prefs__option ${dailyMinutes === item.id ? 'is-selected' : ''}`}
                  onClick={() => setDailyMinutes(item.id)}
                >
                  <strong>{item.label}</strong>
                  <span>{item.hint}</span>
                </button>
              ))
            : null}
        </div>

        <div className="prefs__actions">
          {mode === 'onboarding' ? (
            <button type="button" className="prefs__ghost" onClick={handleSkip}>
              Skip for now
            </button>
          ) : (
            <button type="button" className="prefs__ghost" onClick={onDone}>
              Cancel
            </button>
          )}
          <div className="prefs__nav">
            {step > 0 ? (
              <button type="button" className="prefs__secondary" onClick={() => setStep((s) => s - 1)}>
                Back
              </button>
            ) : null}
            {step < 2 ? (
              <button
                type="button"
                className="prefs__primary"
                disabled={!canNext}
                onClick={() => setStep((s) => s + 1)}
              >
                Next
              </button>
            ) : (
              <button type="button" className="prefs__primary" disabled={!canNext} onClick={finish}>
                Save
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
