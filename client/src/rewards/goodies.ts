import {
  getPreferences,
  getTotalCompletedSubtopics,
  getTotalSubtopicCount,
  type PreferenceGoal,
} from '../utils/lessonProgress'

export type GoodieId =
  | 'avatar-frame'
  | 'cat-mode'
  | 'accent-theme'
  | 'cheat-sheet'
  | 'voucher'
  | 'certificate'

export type GoodieAction = 'use' | 'view'

export type GoodieDef = {
  id: GoodieId
  name: string
  icon: string
  description: string
  /** Human-readable requirement for locked cards */
  requirementLabel: (ctx: GoodieProgress) => string
  /** Current / target for progress bar */
  progress: (ctx: GoodieProgress) => { current: number; target: number }
  isUnlocked: (ctx: GoodieProgress) => boolean
  action: GoodieAction
}

export type GoodieProgress = {
  topicsCompleted: number
  topicsTotal: number
  progressPct: number
}

export type GoodieStatus = GoodieDef & {
  unlocked: boolean
  current: number
  target: number
}

export const REWARD_GOODIES: GoodieDef[] = [
  {
    id: 'avatar-frame',
    name: 'Avatar frame',
    icon: '🖼️',
    description: 'A glowing frame for your learner badge across the app.',
    requirementLabel: () => 'Complete 1 topic',
    progress: (ctx) => ({ current: Math.min(ctx.topicsCompleted, 1), target: 1 }),
    isUnlocked: (ctx) => ctx.topicsCompleted >= 1,
    action: 'use',
  },
  {
    id: 'cat-mode',
    name: 'Cat mode',
    icon: '🐱',
    description:
      'A corner cat for quiz reactions, or a companion that stays on the page. Pick one in your profile menu.',
    requirementLabel: () => 'Complete 10 topics',
    progress: (ctx) => ({ current: Math.min(ctx.topicsCompleted, 10), target: 10 }),
    isUnlocked: (ctx) => ctx.topicsCompleted >= 10,
    action: 'use',
  },
  {
    id: 'accent-theme',
    name: 'Accent colour themes',
    icon: '🎨',
    description:
      'Unlock Rose, Violet, Amber and Emerald accents you can apply across CodeMentor.',
    requirementLabel: () => 'Complete 3 topics',
    progress: (ctx) => ({ current: Math.min(ctx.topicsCompleted, 3), target: 3 }),
    isUnlocked: (ctx) => ctx.topicsCompleted >= 3,
    action: 'use',
  },
  {
    id: 'cheat-sheet',
    name: 'Python cheat sheet',
    icon: '📋',
    description: 'A printable sheet tailored to your learning goal.',
    requirementLabel: () => 'Complete 5 topics',
    progress: (ctx) => ({ current: Math.min(ctx.topicsCompleted, 5), target: 5 }),
    isUnlocked: (ctx) => ctx.topicsCompleted >= 5,
    action: 'view',
  },
  {
    id: 'voucher',
    name: 'Reward voucher',
    icon: '🎟️',
    description: 'A thank-you voucher — redeemable at launch.',
    requirementLabel: (ctx) => `Reach 50% of all topics (${Math.ceil(ctx.topicsTotal * 0.5)} topics)`,
    progress: (ctx) => ({
      current: Math.min(ctx.progressPct, 50),
      target: 50,
    }),
    isUnlocked: (ctx) => ctx.progressPct >= 50,
    action: 'view',
  },
  {
    id: 'certificate',
    name: 'Completion certificate',
    icon: '📜',
    description: 'A certificate with your name when you finish every topic.',
    requirementLabel: () => 'Complete 100% of topics',
    progress: (ctx) => ({
      current: Math.min(ctx.progressPct, 100),
      target: 100,
    }),
    isUnlocked: (ctx) => ctx.progressPct >= 100 && ctx.topicsTotal > 0,
    action: 'view',
  },
]

export function getGoodieProgress(): GoodieProgress {
  const topicsCompleted = getTotalCompletedSubtopics()
  const topicsTotal = getTotalSubtopicCount()
  const progressPct =
    topicsTotal === 0 ? 0 : Math.round((topicsCompleted / topicsTotal) * 100)
  return { topicsCompleted, topicsTotal, progressPct }
}

export function getGoodieStatuses(): GoodieStatus[] {
  const ctx = getGoodieProgress()
  return REWARD_GOODIES.map((def) => {
    const { current, target } = def.progress(ctx)
    return {
      ...def,
      unlocked: def.isUnlocked(ctx),
      current,
      target,
    }
  })
}

export function getUnlockedGoodieCount() {
  return getGoodieStatuses().filter((g) => g.unlocked).length
}

export function getNextGoodie(): GoodieStatus | null {
  return getGoodieStatuses().find((g) => !g.unlocked) ?? null
}

export type CheatSheetKind = PreferenceGoal | 'general'

export function getCheatSheetKind(): CheatSheetKind {
  const goal = getPreferences()?.goal
  if (goal === 'job' || goal === 'college' || goal === 'hobby') return goal
  return 'general'
}

export type CheatSheetContent = {
  title: string
  subtitle: string
  sections: { heading: string; bullets: string[] }[]
}

export function getCheatSheetContent(kind: CheatSheetKind = getCheatSheetKind()): CheatSheetContent {
  if (kind === 'job') {
    return {
      title: 'Interview prep cheat sheet',
      subtitle: 'Python essentials hiring managers like to hear.',
      sections: [
        {
          heading: 'Talking points',
          bullets: [
            'Explain a bug you fixed with prints / asserts',
            'Walk through time vs space for a simple loop',
            'Name mutable vs immutable types (list vs tuple)',
          ],
        },
        {
          heading: 'Quick syntax',
          bullets: [
            'def greet(name: str) -> str: return f"Hi {name}"',
            'for i, item in enumerate(items): ...',
            'd.get(key, default)  ·  sorted(xs, key=...)',
          ],
        },
        {
          heading: 'Practice prompts',
          bullets: [
            'Reverse a string without slicing',
            'Count word frequencies in a paragraph',
            'Find the first duplicate in a list',
          ],
        },
      ],
    }
  }
  if (kind === 'college') {
    return {
      title: 'Exam revision cheat sheet',
      subtitle: 'Core Python for coursework and quizzes.',
      sections: [
        {
          heading: 'Must-know concepts',
          bullets: [
            'Variables, types, and type conversion',
            'if / elif / else and comparison operators',
            'for / while, range, break, continue',
          ],
        },
        {
          heading: 'Functions & data',
          bullets: [
            'Parameters, return, scope',
            'Lists: append, slice, list comprehensions',
            'Dicts: keys, values, items',
          ],
        },
        {
          heading: 'Exam tips',
          bullets: [
            'Trace code on paper before writing',
            'Watch off-by-one errors in range()',
            'Indentation errors fail the whole block',
          ],
        },
      ],
    }
  }
  if (kind === 'hobby') {
    return {
      title: 'Mini project ideas',
      subtitle: 'Fun builds that stretch what you already know.',
      sections: [
        {
          heading: 'Starter projects',
          bullets: [
            'Number guessing game with attempt counter',
            'Personal to-do list in the terminal',
            'Mad-libs story generator from user input',
          ],
        },
        {
          heading: 'Level up',
          bullets: [
            'Quiz app with a score at the end',
            'Simple password strength checker',
            'CSV expense logger (open + append)',
          ],
        },
        {
          heading: 'Stretch goals',
          bullets: [
            'Text-based adventure with rooms as dicts',
            'Flashcard trainer for vocabulary',
            'Random recipe picker from a list',
          ],
        },
      ],
    }
  }
  return {
    title: 'General Python cheat sheet',
    subtitle: 'A pocket reference while you learn.',
    sections: [
      {
        heading: 'Basics',
        bullets: [
          'print(), input(), int(), str(), len()',
          'if / elif / else',
          'for x in seq:  ·  while condition:',
        ],
      },
      {
        heading: 'Data structures',
        bullets: [
          'list[i], append, slice[a:b]',
          'dict[key], .get(), .keys()',
          'tuple unpacking: a, b = pair',
        ],
      },
      {
        heading: 'Functions',
        bullets: [
          'def name(args): ...',
          'return value',
          'Default args: def f(x=0): ...',
        ],
      },
    ],
  }
}
