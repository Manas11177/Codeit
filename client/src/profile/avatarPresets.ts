export type AvatarPreset = {
  id: string
  emoji: string
  label: string
}

/** Preset avatar icons — pick one or fall back to initials. */
export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'seedling', emoji: '🌱', label: 'Seedling' },
  { id: 'rocket', emoji: '🚀', label: 'Rocket' },
  { id: 'laptop', emoji: '💻', label: 'Laptop' },
  { id: 'snake', emoji: '🐍', label: 'Python' },
  { id: 'star', emoji: '⭐', label: 'Star' },
  { id: 'fire', emoji: '🔥', label: 'Fire' },
  { id: 'target', emoji: '🎯', label: 'Target' },
  { id: 'brain', emoji: '🧠', label: 'Brain' },
  { id: 'books', emoji: '📚', label: 'Books' },
  { id: 'fox', emoji: '🦊', label: 'Fox' },
  { id: 'cat', emoji: '🐱', label: 'Cat' },
  { id: 'moon', emoji: '🌙', label: 'Moon' },
]

export function getAvatarPreset(id: string | null | undefined) {
  if (!id) return null
  return AVATAR_PRESETS.find((item) => item.id === id) ?? null
}

const AVATAR_COLORS = [
  '#0d9488',
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#ea580c',
  '#ca8a04',
  '#059669',
  '#4f46e5',
]

export function colorFromUserId(userId: string | null | undefined) {
  if (!userId) return AVATAR_COLORS[0]
  let hash = 0
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

export function initialsFromDisplayName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) {
    const word = parts[0]
    return (word.slice(0, 2) || '?').toUpperCase()
  }
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase() || '?'
}
