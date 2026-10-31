import { useEffect, useMemo, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import {
  ACCENT_THEMES,
  normalizeAccentThemeId,
  type AccentThemeId,
} from '../rewards/accentThemes'
import {
  getCheatSheetContent,
  getCheatSheetKind,
  getGoodieProgress,
  getGoodieStatuses,
  type GoodieId,
  type GoodieStatus,
} from '../rewards/goodies'
import { UserAvatar } from '../components/profile/UserAvatar'
import {
  STATS_UPDATED_EVENT,
  getDisplayName,
  getRewardsSelection,
  saveRewardsSelection,
} from '../utils/lessonProgress'
import { goTo } from '../utils/navigation'
import { supabase } from '../lib/supabase'
import './Rewards.css'

type RewardsView = 'list' | 'cheat-sheet' | 'voucher' | 'certificate'

export function Rewards() {
  const { darkMode } = useTheme()
  const [tick, setTick] = useState(0)
  const [view, setView] = useState<RewardsView>('list')
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    function refresh() {
      setTick((n) => n + 1)
    }
    window.addEventListener(STATS_UPDATED_EVENT, refresh)
    return () => window.removeEventListener(STATS_UPDATED_EVENT, refresh)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserEmail(data.session?.user?.email ?? null)
    })
  }, [])

  void tick
  const progress = useMemo(() => getGoodieProgress(), [tick])
  const goodies = useMemo(() => getGoodieStatuses(), [tick])
  const selection = getRewardsSelection()
  const unlockedCount = goodies.filter((g) => g.unlocked).length
  const studentName = getDisplayName(userEmail)
  const certificateDate = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const cheat = getCheatSheetContent(getCheatSheetKind())

  const activeAccent = normalizeAccentThemeId(selection?.accentThemeId)

  function handleUse(goodie: GoodieStatus) {
    if (goodie.id === 'avatar-frame') {
      const next =
        selection?.avatarFrameId === 'avatar-frame' ? null : 'avatar-frame'
      saveRewardsSelection({ avatarFrameId: next })
    }
  }

  function selectAccent(id: AccentThemeId | null) {
    saveRewardsSelection({ accentThemeId: id })
  }

  function handleView(id: GoodieId) {
    if (id === 'cheat-sheet') setView('cheat-sheet')
    if (id === 'voucher') setView('voucher')
    if (id === 'certificate') setView('certificate')
  }

  function actionLabel(goodie: GoodieStatus) {
    if (goodie.action === 'view') return 'View'
    if (goodie.id === 'avatar-frame') {
      return selection?.avatarFrameId === 'avatar-frame' ? 'In use ✓' : 'Use'
    }
    return 'Use'
  }

  if (view === 'cheat-sheet') {
    return (
      <div className={`rw ${darkMode ? 'rw--dark' : 'rw--light'}`}>
        <div className="rw__shell">
          <div className="rw-nav">
            <button type="button" onClick={() => setView('list')}>
              ← Rewards
            </button>
            <button type="button" onClick={() => goTo('/')}>
              Dashboard
            </button>
          </div>
          <article className="rw-sheet">
            <p className="rw-eyebrow">Cheat sheet</p>
            <h1>{cheat.title}</h1>
            <p className="rw-lead">{cheat.subtitle}</p>
            {cheat.sections.map((section) => (
              <section key={section.heading} className="rw-sheet__section">
                <h2>{section.heading}</h2>
                <ul>
                  {section.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </section>
            ))}
          </article>
        </div>
      </div>
    )
  }

  if (view === 'voucher') {
    return (
      <div className={`rw ${darkMode ? 'rw--dark' : 'rw--light'}`}>
        <div className="rw__shell">
          <div className="rw-nav">
            <button type="button" onClick={() => setView('list')}>
              ← Rewards
            </button>
            <button type="button" onClick={() => goTo('/')}>
              Dashboard
            </button>
          </div>
          <article className="rw-voucher">
            <p className="rw-eyebrow">Reward voucher</p>
            <h1>Halfway hero</h1>
            <p className="rw-lead">
              You&apos;ve completed at least 50% of all topics. This voucher is
              display-only for now.
            </p>
            <div className="rw-voucher__card">
              <strong>CODEMENTOR · 50%</strong>
              <span>Redeemable at launch</span>
            </div>
          </article>
        </div>
      </div>
    )
  }

  if (view === 'certificate') {
    return (
      <div className={`rw ${darkMode ? 'rw--dark' : 'rw--light'}`}>
        <div className="rw__shell">
          <div className="rw-nav">
            <button type="button" onClick={() => setView('list')}>
              ← Rewards
            </button>
            <button type="button" onClick={() => goTo('/')}>
              Dashboard
            </button>
          </div>
          <article className="rw-cert">
            <p className="rw-eyebrow">Certificate of completion</p>
            <div className="rw-cert__avatar">
              <UserAvatar email={userEmail} size="lg" />
            </div>
            <h1>Python pathway complete</h1>
            <p className="rw-cert__name">{studentName}</p>
            <p className="rw-lead">
              has completed every topic in CodeMentor.
            </p>
            <p className="rw-cert__date">{certificateDate}</p>
          </article>
        </div>
      </div>
    )
  }

  return (
    <div className={`rw ${darkMode ? 'rw--dark' : 'rw--light'}`}>
      <div className="rw__glow" aria-hidden="true" />
      <div className="rw__shell">
        <div className="rw-nav">
          <button type="button" onClick={() => goTo('/')}>
            ← Dashboard
          </button>
          <button type="button" onClick={() => goTo('/streak')}>
            Streak & Medals
          </button>
          <span className="rw-nav__avatar" title="Your avatar">
            <UserAvatar email={userEmail} size="md" />
          </span>
        </div>

        <header className="rw-hero">
          <p className="rw-eyebrow">Rewards</p>
          <h1>Goodies unlocked by progress</h1>
          <p>
            {unlockedCount} of {goodies.length} unlocked. Cosmetic picks sync
            with your account; unlocks are computed from topics completed.
          </p>
        </header>

        {unlockedCount === 0 ? (
          <div className="rw-empty">
            <p>Complete your first topic to unlock your first goodie.</p>
            <button type="button" onClick={() => goTo('/lessons')}>
              Start a lesson →
            </button>
          </div>
        ) : null}

        <ul className="rw-grid">
          {goodies.map((goodie) => {
            const pct =
              goodie.target === 0
                ? 0
                : Math.min(100, Math.round((goodie.current / goodie.target) * 100))
            const using =
              goodie.id === 'avatar-frame' &&
              selection?.avatarFrameId === 'avatar-frame'

            return (
              <li
                key={goodie.id}
                className={`rw-card ${goodie.unlocked ? 'is-unlocked' : 'is-locked'}`}
              >
                <div className="rw-card__icon" aria-hidden="true">
                  {goodie.icon}
                </div>
                <div className="rw-card__body">
                  <h2>{goodie.name}</h2>
                  <p>{goodie.description}</p>
                  {goodie.unlocked ? (
                    goodie.id === 'accent-theme' ? (
                      <div className="rw-accent-picks">
                        <button
                          type="button"
                          className={`rw-accent-pick ${!activeAccent ? 'is-selected' : ''}`}
                          onClick={() => selectAccent(null)}
                        >
                          Teal
                        </button>
                        {ACCENT_THEMES.map((theme) => (
                          <button
                            key={theme.id}
                            type="button"
                            className={`rw-accent-pick ${
                              activeAccent === theme.id ? 'is-selected' : ''
                            }`}
                            style={{ ['--pick' as string]: theme.accent }}
                            onClick={() => selectAccent(theme.id)}
                          >
                            <span aria-hidden="true">{theme.icon}</span>
                            {theme.name}
                            {activeAccent === theme.id ? ' ✓' : ''}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <button
                        type="button"
                        className={`rw-card__action ${using ? 'is-active' : ''}`}
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          if (goodie.action === 'use') {
                            handleUse(goodie)
                            return
                          }
                          handleView(goodie.id)
                        }}
                      >
                        {actionLabel(goodie)}
                      </button>
                    )
                  ) : (
                    <div className="rw-card__lock">
                      <p>{goodie.requirementLabel(progress)}</p>
                      <div className="rw-bar" aria-hidden="true">
                        <div className="rw-bar__fill" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="rw-card__progress">
                        {goodie.id === 'voucher' || goodie.id === 'certificate'
                          ? `${goodie.current}/${goodie.target}%`
                          : `${goodie.current}/${goodie.target} topics`}
                      </span>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>

        <p className="rw-tip">Change anytime from your profile menu.</p>
      </div>
    </div>
  )
}
