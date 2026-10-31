import { useEffect, useState } from 'react'
import {
  colorFromUserId,
  getAvatarPreset,
  initialsFromDisplayName,
} from '../../profile/avatarPresets'
import {
  STATS_UPDATED_EVENT,
  getDisplayName,
  getProfile,
  getProgressUserId,
  getRewardsSelection,
} from '../../utils/lessonProgress'
import './UserAvatar.css'

type UserAvatarProps = {
  email?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
  /** Decorative only when nested inside a button that already names the control. */
  decorative?: boolean
}

export function UserAvatar({
  email = null,
  size = 'md',
  className = '',
  decorative = false,
}: UserAvatarProps) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    function refresh() {
      setTick((n) => n + 1)
    }
    window.addEventListener(STATS_UPDATED_EVENT, refresh)
    return () => window.removeEventListener(STATS_UPDATED_EVENT, refresh)
  }, [])

  void tick
  const profile = getProfile()
  const displayName = getDisplayName(email)
  const preset = getAvatarPreset(profile?.avatarId)
  const frameOn = getRewardsSelection()?.avatarFrameId === 'avatar-frame'
  const bg = colorFromUserId(getProgressUserId())
  const savedName = profile?.displayName?.trim()
  const label = preset
    ? preset.emoji
    : savedName
      ? initialsFromDisplayName(savedName)
      : (email?.trim()?.[0] ?? displayName[0] ?? '?').toUpperCase()

  return (
    <span
      className={`ua ${frameOn ? 'ua--framed' : ''} ua--${size} ${className}`.trim()}
      style={{ backgroundColor: bg }}
      aria-hidden={decorative ? true : undefined}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : `Avatar for ${displayName}`}
    >
      <span className={`ua__face ${preset ? 'ua__face--emoji' : ''}`}>{label}</span>
    </span>
  )
}
