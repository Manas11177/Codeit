/**
 * Cat speech lines. Pick at random; never the same line twice in a row.
 * Friendly and honest — no baby talk, no praise for a weak score.
 */

export type CatTriggerId =
  | 'streak3'
  | 'streak5'
  | 'topicComplete'
  | 'firstQuizOfDay'
  | 'dailyTarget'
  | 'returnAfterMiss'
  | 'quizHigh'
  | 'quizMid'
  | 'quizLow'

export type CatMood = 'happy' | 'sleepy' | 'excited'

export const CAT_TRIGGER_MOOD: Record<CatTriggerId, CatMood> = {
  streak3: 'excited',
  streak5: 'excited',
  topicComplete: 'happy',
  firstQuizOfDay: 'sleepy',
  dailyTarget: 'happy',
  returnAfterMiss: 'sleepy',
  quizHigh: 'excited',
  quizMid: 'happy',
  quizLow: 'sleepy',
}

export const CAT_MESSAGES: Record<CatTriggerId, string[]> = {
  streak3: [
    'Three in a row. Nice rhythm.',
    'Hot streak — keep that focus.',
    'The cat approves of this run.',
    'Clean answers. Quiet pride.',
    'Momentum looks good from here.',
  ],
  streak5: [
    'Five in a row. That is a real run.',
    'Five correct. Focus is holding.',
    'Fifth in a row. Same pace is fine.',
    'Five straight. Quietly impressive.',
    'Five correct answers back to back.',
  ],
  topicComplete: [
    'Topic done. Stretch, then the next one.',
    'Another topic in the bag.',
    'That chapter just got shorter.',
    'Solid finish. The map thanks you.',
    'Progress logged.',
  ],
  firstQuizOfDay: [
    'First quiz of the day. Good start.',
    'Back at it. The corner cat noticed.',
    'Daily warm-up complete. Carry on.',
    'Nice to see you again today.',
    'First question set of the day is done.',
  ],
  dailyTarget: [
    'Daily target reached. That was the goal for today.',
    'You hit today’s minutes. A fair place to pause.',
    'Target met. Anything more is extra.',
    'Today’s target is done.',
    'The minutes you set are in.',
  ],
  returnAfterMiss: [
    'Welcome back. Yesterday was a gap, and today counts.',
    'You missed a day. Starting again is the whole trick.',
    'Back after a break. The streak can rebuild from here.',
    'A day off happened. You are here now.',
    'Returned after a missed day.',
  ],
  quizHigh: [
    '90 or better. That topic is in good shape.',
    'Strong score. You knew this one.',
    'Clean run. Little left to patch here.',
    'High score. The work showed up.',
    '90% or above. This one is sticking.',
  ],
  quizMid: [
    'Solid middle. A few spots still need a look.',
    'Over half. The misses are the useful part.',
    'Decent set. The ones you missed are worth a replay.',
    'Halfway and up. Keep the weak spots on the list.',
    'A fair run. Review the misses when you can.',
  ],
  quizLow: [
    'Under half. The lesson is worth another look.',
    'This one did not land. Revisit the lesson, then try again.',
    'Below 50%. No rush — go back through the lesson.',
    'Tough set. The lesson covers what this quiz asked.',
    'Not there yet. A second pass of the lesson will help.',
  ],
}

const lastByTrigger: Partial<Record<CatTriggerId, string>> = {}

export function pickCatMessage(trigger: CatTriggerId): string {
  const pool = CAT_MESSAGES[trigger]
  const last = lastByTrigger[trigger]
  const choices = pool.length > 1 ? pool.filter((line) => line !== last) : pool
  const line = choices[Math.floor(Math.random() * choices.length)] ?? pool[0]
  lastByTrigger[trigger] = line
  return line
}
