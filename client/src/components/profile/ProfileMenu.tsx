import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { useTheme } from '../../context/ThemeContext'
import { AVATAR_PRESETS } from '../../profile/avatarPresets'
import {
  ACCENT_THEMES,
  normalizeAccentThemeId,
  type AccentThemeId,
} from '../../rewards/accentThemes'
import {
  getGoodieProgress,
  getGoodieStatuses,
  REWARD_GOODIES,
} from '../../rewards/goodies'
import { supabase } from '../../lib/supabase'
import {
  STATS_UPDATED_EVENT,
  computeStreak,
  getAchievements,
  getActivityDates,
  getDisplayName,
  getProfile,
  getRewardsSelection,
  getTotalCompletedSubtopics,
  saveProfile,
  saveRewardsSelection,
} from '../../utils/lessonProgress'
import { flushProgressSync } from '../../sync/progressSync'
import { goTo, requireAuth } from '../../utils/navigation'
import { UserAvatar } from './UserAvatar'
import './ProfileMenu.css'

const FRAME_GOODIES = REWARD_GOODIES.filter((g) => g.id === 'avatar-frame')
const ACCENT_GOODIE = REWARD_GOODIES.find((g) => g.id === 'accent-theme')

type ProfileMenuProps = {
  email: string
}

export function ProfileMenu({ email }: ProfileMenuProps) {
  const { darkMode, toggleTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const [tick, setTick] = useState(0)
  const [nameDraft, setNameDraft] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    function refresh() {
      setTick((n) => n + 1)
    }
    window.addEventListener(STATS_UPDATED_EVENT, refresh)
    return () => window.removeEventListener(STATS_UPDATED_EVENT, refresh)
  }, [])

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null
      if (rootRef.current && target && !rootRef.current.contains(target)) {
        setOpen(false)
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    function onRouteChange() {
      setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('popstate', onRouteChange)

    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('popstate', onRouteChange)
    }
  }, [open])

  useEffect(() => {
    if (open) {
      setNameDraft(getDisplayName(email))
      setNameError(null)
    }
  }, [open, email, tick])

  void tick
  const displayName = getDisplayName(email)
  const profile = getProfile()
  const selection = getRewardsSelection()
  const progress = getGoodieProgress()
  const goodieStatuses = getGoodieStatuses()
  const unlockedById = new Map(goodieStatuses.map((g) => [g.id, g]))
  const quickStats = {
    streak: computeStreak(getActivityDates()),
    topics: getTotalCompletedSubtopics(),
    medals: getAchievements().filter((a) => a.unlocked).length,
  }

  function openMenu() {
    setOpen(true)
  }

  function closeMenu() {
    setOpen(false)
  }

  function toggleMenu() {
    setOpen((v) => !v)
  }

  function onTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' && !open) {
      event.preventDefault()
      openMenu()
    }
  }

  function saveDisplayName() {
    const trimmed = nameDraft.trim()
    if (trimmed.length < 2 || trimmed.length > 20) {
      setNameError('Name must be 2–20 characters')
      return
    }
    setNameError(null)
    saveProfile({ displayName: trimmed })
  }

  function pickAvatar(avatarId: string | null) {
    saveProfile({ avatarId })
  }

  function selectFrame(frameId: string | null) {
    saveRewardsSelection({ avatarFrameId: frameId })
  }

  function selectAccent(accentId: AccentThemeId | null) {
    saveRewardsSelection({ accentThemeId: accentId })
  }

  function openPreferences() {
    closeMenu()
    window.dispatchEvent(new CustomEvent('codementor-edit-preferences'))
  }

  async function handleLogout() {
    closeMenu()
    await flushProgressSync()
    await supabase.auth.signOut()
    goTo('/')
  }

  return (
    <div
      className={`pm ${darkMode ? 'pm--dark' : 'pm--light'}`}
      ref={rootRef}
    >
      <button
        type="button"
        className="pm__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Account menu for ${displayName}`}
        onClick={toggleMenu}
        onKeyDown={onTriggerKeyDown}
      >
        <UserAvatar email={email} size="md" decorative />
      </button>

      {open ? (
        <div
          id={menuId}
          className="pm__menu"
          role="dialog"
          aria-label="Account menu"
        >
          <div className="pm__scroll">
            <section className="pm__section pm__header-block">
              <UserAvatar email={email} size="lg" />
              <div className="pm__identity">
                <strong>{displayName}</strong>
                <span>{email}</span>
              </div>
              <ul className="pm__stats" aria-label="Quick stats">
                <li>
                  <em>{quickStats.streak}</em>
                  <span>Streak</span>
                </li>
                <li>
                  <em>{quickStats.topics}</em>
                  <span>Topics</span>
                </li>
                <li>
                  <em>{quickStats.medals}</em>
                  <span>Medals</span>
                </li>
              </ul>
            </section>

            <section className="pm__section">
              <h3 className="pm__label">Edit profile</h3>
              <label className="pm__field">
                <span>Display name</span>
                <div className="pm__name-row">
                  <input
                    type="text"
                    value={nameDraft}
                    maxLength={20}
                    minLength={2}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        saveDisplayName()
                      }
                    }}
                  />
                  <button type="button" onClick={saveDisplayName}>
                    Save
                  </button>
                </div>
              </label>
              {nameError ? <p className="pm__error">{nameError}</p> : null}

              <p className="pm__sublabel">Avatar</p>
              <div className="pm__grid" role="listbox" aria-label="Avatar options">
                <button
                  type="button"
                  role="option"
                  aria-selected={!profile?.avatarId}
                  className={`pm__chip ${!profile?.avatarId ? 'is-selected' : ''}`}
                  onClick={() => pickAvatar(null)}
                >
                  Aa
                </button>
                {AVATAR_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    role="option"
                    aria-selected={profile?.avatarId === preset.id}
                    aria-label={preset.label}
                    className={`pm__chip ${
                      profile?.avatarId === preset.id ? 'is-selected' : ''
                    }`}
                    onClick={() => pickAvatar(preset.id)}
                  >
                    {preset.emoji}
                  </button>
                ))}
              </div>
            </section>

            <section className="pm__section">
              <h3 className="pm__label">Frames</h3>
              <div className="pm__pickers">
                <button
                  type="button"
                  className={`pm__pick ${
                    !selection?.avatarFrameId ? 'is-selected' : ''
                  }`}
                  onClick={() => selectFrame(null)}
                >
                  <span>None</span>
                </button>
                {FRAME_GOODIES.map((frame) => {
                  const status = unlockedById.get(frame.id)
                  const unlocked = status?.unlocked ?? false
                  const selected = selection?.avatarFrameId === frame.id
                  return (
                    <button
                      key={frame.id}
                      type="button"
                      disabled={!unlocked}
                      className={`pm__pick ${selected ? 'is-selected' : ''} ${
                        unlocked ? '' : 'is-locked'
                      }`}
                      onClick={() => unlocked && selectFrame(frame.id)}
                    >
                      <span aria-hidden="true">{frame.icon}</span>
                      <span>{frame.name}</span>
                      {!unlocked ? (
                        <small>{frame.requirementLabel(progress)}</small>
                      ) : selected ? (
                        <small>In use ✓</small>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="pm__section">
              <h3 className="pm__label">Appearance</h3>
              <button
                type="button"
                className="pm__row-btn"
                onClick={toggleTheme}
              >
                <span>{darkMode ? 'Dark mode' : 'Light mode'}</span>
                <span aria-hidden="true">{darkMode ? '☀️ Light' : '🌙 Dark'}</span>
              </button>
              <p className="pm__sublabel">Accent theme</p>
              <div className="pm__pickers">
                <button
                  type="button"
                  className={`pm__pick ${
                    !normalizeAccentThemeId(selection?.accentThemeId)
                      ? 'is-selected'
                      : ''
                  }`}
                  onClick={() => selectAccent(null)}
                >
                  <span>Teal (default)</span>
                </button>
                {ACCENT_THEMES.map((theme) => {
                  const unlocked = unlockedById.get('accent-theme')?.unlocked ?? false
                  const selected =
                    normalizeAccentThemeId(selection?.accentThemeId) === theme.id
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      disabled={!unlocked}
                      className={`pm__pick ${selected ? 'is-selected' : ''} ${
                        unlocked ? '' : 'is-locked'
                      }`}
                      onClick={() => unlocked && selectAccent(theme.id)}
                    >
                      <span aria-hidden="true">{theme.icon}</span>
                      <span>{theme.name}</span>
                      {!unlocked && ACCENT_GOODIE ? (
                        <small>{ACCENT_GOODIE.requirementLabel(progress)}</small>
                      ) : selected ? (
                        <small>In use ✓</small>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="pm__section pm__links">
              <h3 className="pm__label">Links</h3>
              <button type="button" className="pm__row-btn" onClick={openPreferences}>
                Preferences
              </button>
              <button
                type="button"
                className="pm__row-btn"
                onClick={() => {
                  closeMenu()
                  void requireAuth('/streak')
                }}
              >
                Streak &amp; Medals
              </button>
              <button
                type="button"
                className="pm__row-btn"
                onClick={() => {
                  closeMenu()
                  void requireAuth('/rewards')
                }}
              >
                Rewards
              </button>
            </section>

            <section className="pm__section">
              <button
                type="button"
                className="pm__logout"
                onClick={() => void handleLogout()}
              >
                Logout
              </button>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  )
}
