import { LESSON_DATA } from '../carousel/lessonData'
import {
  getSubtopicExercise,
  type SubtopicExercise,
} from '../data/subtopicContent'
import { normalizeCode } from '../utils/codeCompare'
import {
  getPracticeHistory,
  type ActivityKind,
  type Difficulty,
  type ErrorCategory,
  type PracticeSource,
  type WarmupHistory,
} from '../utils/lessonProgress'
import type { LearningInsights, TopicInsight } from './adaptiveEngine'
import { simulate } from './miniPython'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type QuestionBase = {
  id: string
  baseId: string
  kind: ActivityKind
  lessonId: string
  lessonTitle: string
  subtopic: string
  difficulty: Difficulty
  prompt: string
  focus: string
  explanation: string
}

export type McqQuestion = QuestionBase & {
  kind: 'mcq'
  style: 'concept' | 'output' | 'code'
  code?: string
  options: string[]
  optionNotes: (string | null)[]
  answerIndex: number
  optionsAreCode: boolean
}

export type FillQuestion = QuestionBase & {
  kind: 'fill'
  template: string
  answers: string[]
  wordBank: string[] | null
  solution: string
}

export type OrderQuestion = QuestionBase & {
  kind: 'order'
  /** lines: whole code lines; pieces: parts of short code, read top to bottom. */
  mode: 'lines' | 'pieces'
  lines: string[]
  shuffledOrder: number[]
  blocks: number[][]
}

export type CodeQuestion = QuestionBase & {
  kind: 'code'
  challenge: string
  starterCode: string
  referenceSolution: string
  expectedOutput: string | null
  hints: string[]
  isVariant: boolean
}

export type PracticeQuestion =
  | McqQuestion
  | FillQuestion
  | OrderQuestion
  | CodeQuestion

export const ACTIVITY_LABELS: Record<ActivityKind, string> = {
  mcq: 'Multiple choice',
  fill: 'Fill in the blanks',
  order: 'Arrange in order',
  code: 'Practice problem',
}

/* ------------------------------------------------------------------ */
/* Seeded randomness                                                   */
/* ------------------------------------------------------------------ */

type Rng = () => number

function createRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function weightedPick<T>(items: T[], weights: number[], rng: Rng): T {
  const total = weights.reduce((sum, w) => sum + w, 0)
  let roll = rng() * total
  for (let i = 0; i < items.length; i += 1) {
    roll -= weights[i]
    if (roll <= 0) return items[i]
  }
  return items[items.length - 1]
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

type Candidate = { text: string; note: string | null }

/**
 * challenge: questions are built from the challenge solution (practice sets).
 * example: questions are built from the example code, so they don't reveal
 * the challenge answer (used inside lessons, before the practice problem).
 */
export type QuestionTarget = 'challenge' | 'example'

type GenContext = {
  exercise: SubtopicExercise
  siblings: SubtopicExercise[]
  difficulty: Difficulty
  focus: ErrorCategory[]
  focusText: string
  rng: Rng
  usedIds: Set<string>
  target: QuestionTarget
  /** What the example code prints (example target only). */
  exampleOutput: string | null
  /** True when the example values were changed for this visit. */
  varied: boolean
  mcqStyles?: McqQuestion['style'][]
}

function exampleLabel(ctx: GenContext) {
  return ctx.varied
    ? `this version of the "${ctx.exercise.subtopic}" example`
    : `the "${ctx.exercise.subtopic}" example`
}

function exampleExplanation(ctx: GenContext, code: string) {
  if (ctx.varied && ctx.exampleOutput) {
    return `The correct code:\n${code}\n\nIt prints:\n${ctx.exampleOutput}`
  }
  return `The correct code:\n${code}\n\n${ctx.exercise.exampleNote}`
}

function targetCode(ctx: GenContext) {
  return ctx.target === 'example' ? ctx.exercise.exampleCode : ctx.exercise.solution
}

function targetSuffix(ctx: GenContext) {
  return ctx.target === 'example' ? ':example' : ''
}

const SYNTAX_FOCUS: ErrorCategory[] = ['SyntaxError', 'IndentationError']
const NAME_FOCUS: ErrorCategory[] = ['NameError', 'AttributeError']
const TYPE_FOCUS: ErrorCategory[] = ['TypeError', 'ValueError']
const LOGIC_FOCUS: ErrorCategory[] = [
  'WrongOutput',
  'ZeroDivisionError',
  'IndexError',
  'KeyError',
]

function hasFocus(ctx: GenContext, group: ErrorCategory[]) {
  return ctx.focus.some((f) => group.includes(f))
}

function pickDistinct(
  correct: string,
  candidates: Candidate[],
  count: number,
): Candidate[] {
  const seen = new Set([normalizeCode(correct)])
  const result: Candidate[] = []
  for (const candidate of candidates) {
    const key = normalizeCode(candidate.text)
    if (!candidate.text.trim() || seen.has(key)) continue
    seen.add(key)
    result.push(candidate)
    if (result.length === count) break
  }
  return result
}

function buildOptions(
  correct: string,
  distractors: Candidate[],
  rng: Rng,
) {
  const entries = shuffle(
    [{ text: correct, note: null, correct: true }, ...distractors.map((d) => ({ ...d, correct: false }))],
    rng,
  )
  return {
    options: entries.map((e) => e.text),
    optionNotes: entries.map((e) => e.note),
    answerIndex: entries.findIndex((e) => e.correct),
  }
}

function isOutsideString(line: string, index: number) {
  const before = line.slice(0, index)
  const doubles = (before.match(/"/g) ?? []).length
  const singles = (before.match(/'/g) ?? []).length
  return doubles % 2 === 0 && singles % 2 === 0
}

function replaceFirstOutsideString(
  code: string,
  pattern: RegExp,
  replacer: (match: RegExpExecArray) => string,
): string | null {
  const lines = code.split('\n')
  for (let i = 0; i < lines.length; i += 1) {
    const regex = new RegExp(pattern.source, pattern.flags.replace('g', '') + 'g')
    let match: RegExpExecArray | null
    while ((match = regex.exec(lines[i])) !== null) {
      if (isOutsideString(lines[i], match.index)) {
        lines[i] =
          lines[i].slice(0, match.index) +
          replacer(match) +
          lines[i].slice(match.index + match[0].length)
        return lines.join('\n')
      }
      if (match[0].length === 0) regex.lastIndex += 1
    }
  }
  return null
}

function baseQuestion(
  ctx: GenContext,
  kind: ActivityKind,
  baseId: string,
  id: string,
) {
  const ex = ctx.exercise
  return {
    id,
    baseId,
    kind,
    lessonId: ex.lessonId,
    lessonTitle: ex.lessonTitle,
    subtopic: ex.subtopic,
    difficulty: ctx.difficulty,
    focus: ctx.focusText,
  }
}

/* ------------------------------------------------------------------ */
/* MCQ                                                                 */
/* ------------------------------------------------------------------ */

function conceptMcq(ctx: GenContext): McqQuestion | null {
  const ex = ctx.exercise
  const pool: Candidate[] = shuffle(
    ctx.siblings.map((s) => ({
      text: s.concept,
      note: `That statement describes "${s.subtopic}".`,
    })),
    ctx.rng,
  )
  const distractors = pickDistinct(ex.concept, pool, 3)
  if (distractors.length < 2) return null
  const key = `${ex.lessonId}:${ex.subtopic}`
  return {
    ...baseQuestion(ctx, 'mcq', `mcq:concept:${key}`, `mcq:concept:${key}`),
    kind: 'mcq',
    style: 'concept',
    prompt: `Which statement best describes "${ex.subtopic}"?`,
    ...buildOptions(ex.concept, distractors, ctx.rng),
    optionsAreCode: false,
    explanation: ctx.varied ? ex.concept : `${ex.concept} ${ex.exampleNote}`,
  }
}

function mutateOutput(output: string): Candidate[] {
  const lines = output.split('\n')
  const result: Candidate[] = []

  if (lines.length > 1) {
    result.push({
      text: lines.slice(0, -1).join('\n'),
      note: 'Count the repetitions carefully — the last value is printed too.',
    })
    const last = Number(lines[lines.length - 1])
    if (!Number.isNaN(last)) {
      result.push({
        text: [...lines, String(last + 1)].join('\n'),
        note: 'This prints one value too many. Check where the loop stops.',
      })
    } else {
      result.push({
        text: [...lines, lines[lines.length - 1]].join('\n'),
        note: 'This repeats one time too many. Check the loop condition.',
      })
    }
    result.push({
      text: [...lines].reverse().join('\n'),
      note: 'Lines print in the order the code runs, top to bottom.',
    })
    result.push({
      text: lines.join(' '),
      note: 'Each print() call starts a new line.',
    })
    return result
  }

  const value = output.trim()
  const num = Number(value)
  if (value !== '' && !Number.isNaN(num)) {
    if (value.includes('.')) {
      result.push({
        text: String(Math.floor(num)),
        note: 'The / operator always produces a decimal (float) result.',
      })
    } else {
      result.push({
        text: `${value}.0`,
        note: 'Whole-number math here stays an integer — no decimal point.',
      })
    }
    result.push({ text: String(num + 1), note: 'Recalculate step by step.' })
    result.push({ text: String(num - 1), note: 'Recalculate step by step.' })
    result.push({ text: String(num * 2), note: 'Check which operator is used.' })
    return result
  }

  if (value === 'True' || value === 'False') {
    result.push({
      text: value === 'True' ? 'False' : 'True',
      note: 'Evaluate the condition again with the actual values.',
    })
    result.push({
      text: value.toLowerCase(),
      note: 'Python booleans are written True and False with a capital letter.',
    })
    result.push({ text: 'None', note: 'The expression produces a boolean, not None.' })
    return result
  }

  result.push({
    text: `"${value}"`,
    note: 'print() shows text without the quotes.',
  })
  if (value.toLowerCase() !== value) {
    result.push({ text: value.toLowerCase(), note: 'Python keeps the exact capitalization.' })
  }
  if (value.toUpperCase() !== value) {
    result.push({ text: value.toUpperCase(), note: 'Python keeps the exact capitalization.' })
  }
  const words = value.split(' ')
  if (words.length > 1) {
    result.push({
      text: [...words].reverse().join(' '),
      note: 'Values print in the order they appear in the code.',
    })
    result.push({
      text: words.join(''),
      note: 'print() with commas adds a space between values.',
    })
  }
  return result
}

function outputMcq(ctx: GenContext): McqQuestion | null {
  const ex = ctx.exercise
  const fromExample = ctx.target === 'example'
  const correct = (fromExample ? (ctx.exampleOutput ?? '') : ex.expectedOutput).trim()
  if (!correct) return null
  const siblingOutputs: Candidate[] = ctx.siblings
    .map((s) => ({
      text: s.expectedOutput.trim(),
      note: 'That is the output of a different program.',
    }))
  const distractors = pickDistinct(
    correct,
    [...shuffle(mutateOutput(correct), ctx.rng), ...shuffle(siblingOutputs, ctx.rng)],
    3,
  )
  if (distractors.length < 2) return null
  const key = `${ex.lessonId}:${ex.subtopic}${targetSuffix(ctx)}`
  return {
    ...baseQuestion(ctx, 'mcq', `mcq:output:${key}`, `mcq:output:${key}`),
    kind: 'mcq',
    style: 'output',
    prompt: 'What will this code print?',
    code: targetCode(ctx),
    ...buildOptions(correct, distractors, ctx.rng),
    optionsAreCode: true,
    explanation:
      fromExample && ctx.varied
        ? `Running the code prints:\n${correct}`
        : `Running the code prints:\n${correct}\n\n${ex.exampleNote}`,
  }
}

type BugRule = {
  category: ErrorCategory
  note: string
  apply: (code: string) => string | null
}

const BUG_RULES: BugRule[] = [
  {
    category: 'SyntaxError',
    note: 'Missing the colon (:) at the end of the block header.',
    apply: (code) =>
      replaceFirstOutsideString(code, /:(?=[ \t]*$)/, () => ''),
  },
  {
    category: 'IndentationError',
    note: 'The block body is not indented, so Python raises an IndentationError.',
    apply: (code) => {
      const lines = code.split('\n')
      const index = lines.findIndex(
        (line, i) => i > 0 && /^\s+\S/.test(line) && /:\s*$/.test(lines[i - 1]),
      )
      if (index === -1) return null
      lines[index] = lines[index].trimStart()
      return lines.join('\n')
    },
  },
  {
    category: 'SyntaxError',
    note: '= assigns a value; == compares two values.',
    apply: (code) => replaceFirstOutsideString(code, /==/, () => '='),
  },
  {
    category: 'NameError',
    note: 'Python is case-sensitive — Print is not defined.',
    apply: (code) => replaceFirstOutsideString(code, /\bprint\(/, () => 'Print('),
  },
  {
    category: 'NameError',
    note: 'Text values need quotes; without them Python looks for a variable with that name.',
    apply: (code) => {
      const match = /(["'])([A-Za-z_]\w*)\1/.exec(code)
      if (!match) return null
      return code.replace(match[0], match[2])
    },
  },
  {
    category: 'WrongOutput',
    note: 'Quoting the variable name prints the word itself, not the stored value.',
    apply: (code) =>
      replaceFirstOutsideString(
        code,
        /\bprint\(([A-Za-z_]\w*)\)/,
        (m) =>
          ['True', 'False', 'None'].includes(m[1]) ? m[0] : `print("${m[1]}")`,
      ),
  },
  {
    category: 'WrongOutput',
    note: 'range() stops before its end value — this version stops one step early.',
    apply: (code) =>
      replaceFirstOutsideString(
        code,
        /range\(([^()]*?)(\d+)\)/,
        (m) => `range(${m[1]}${Number(m[2]) - 1})`,
      ),
  },
  {
    category: 'WrongOutput',
    note: 'Uses the wrong operator, so the result changes.',
    apply: (code) => {
      const swaps: Record<string, string> = {
        '>=': '>',
        '<=': '<',
        '//': '/',
        '**': '*',
        '*': '+',
        '+': '-',
        '-': '+',
        '/': '//',
        '%': '//',
        '>': '<',
        '<': '>',
      }
      return replaceFirstOutsideString(
        code,
        /(>=|<=|\/\/|\*\*|(?<![=!<>])[*+\-/%<>](?!=))/,
        (m) => swaps[m[0]] ?? m[0],
      )
    },
  },
  {
    category: 'SyntaxError',
    note: 'In Python 3, print is a function and needs parentheses.',
    apply: (code) =>
      replaceFirstOutsideString(
        code,
        /\bprint\(([^()\n]*)\)\s*$/,
        (m) => `print ${m[1]}`,
      ),
  },
  {
    category: 'TypeError',
    note: 'Removing the conversion mixes text and numbers, which raises a TypeError.',
    apply: (code) =>
      replaceFirstOutsideString(code, /\b(str|int|float)\(([A-Za-z_]\w*)\)/, (m) => m[2]),
  },
  {
    category: 'AttributeError',
    note: 'Lists use append(), not add().',
    apply: (code) => replaceFirstOutsideString(code, /\.append\(/, () => '.add('),
  },
  {
    category: 'WrongOutput',
    note: 'Without return the function gives back None.',
    apply: (code) =>
      replaceFirstOutsideString(code, /\breturn\s+/, () => ''),
  },
]

function buggyVariants(ctx: GenContext): Candidate[] {
  const preferred = BUG_RULES.filter((r) => ctx.focus.includes(r.category))
  const others = shuffle(
    BUG_RULES.filter((r) => !ctx.focus.includes(r.category)),
    ctx.rng,
  )
  const result: Candidate[] = []
  const code = targetCode(ctx)
  for (const rule of [...shuffle(preferred, ctx.rng), ...others]) {
    const mutated = rule.apply(code)
    if (mutated && mutated !== code) {
      result.push({ text: mutated, note: rule.note })
    }
  }
  return result
}

function codeMcq(ctx: GenContext): McqQuestion | null {
  const ex = ctx.exercise
  const code = targetCode(ctx)
  const distractors = pickDistinct(code, buggyVariants(ctx), 3)
  if (distractors.length < 2) return null
  const key = `${ex.lessonId}:${ex.subtopic}${targetSuffix(ctx)}`
  const fromExample = ctx.target === 'example'
  return {
    ...baseQuestion(ctx, 'mcq', `mcq:code:${key}`, `mcq:code:${key}`),
    kind: 'mcq',
    style: 'code',
    prompt: fromExample
      ? `Which "${ex.subtopic}" code is written correctly?`
      : `Which program correctly solves this?\n“${ex.challenge}”`,
    ...buildOptions(code, distractors, ctx.rng),
    optionsAreCode: true,
    explanation: fromExample
      ? exampleExplanation(ctx, code)
      : `The correct program:\n${code}\n\nIt prints: ${ex.expectedOutput}`,
  }
}

function generateMcq(ctx: GenContext): McqQuestion | null {
  type Style = McqQuestion['style']
  let styles: Style[]
  if (hasFocus(ctx, [...SYNTAX_FOCUS, ...NAME_FOCUS, ...TYPE_FOCUS])) {
    styles = ['code', 'output', 'concept']
  } else if (hasFocus(ctx, LOGIC_FOCUS)) {
    styles = ['output', 'code', 'concept']
  } else if (ctx.difficulty === 'easy') {
    styles = ['concept', 'code', 'output']
  } else if (ctx.difficulty === 'medium') {
    styles = ['code', 'output', 'concept']
  } else {
    styles = ['output', 'code', 'concept']
  }
  if (ctx.mcqStyles) styles = ctx.mcqStyles
  else if (ctx.rng() < 0.3) styles = [...styles.slice(1), styles[0]]

  const builders: Record<Style, (c: GenContext) => McqQuestion | null> = {
    concept: conceptMcq,
    output: outputMcq,
    code: codeMcq,
  }
  for (const style of styles) {
    const question = builders[style](ctx)
    if (question && !ctx.usedIds.has(question.id)) return question
  }
  return null
}

/* ------------------------------------------------------------------ */
/* Fill in the blanks                                                  */
/* ------------------------------------------------------------------ */

const TOKEN_PATTERN =
  /\b(print|input|def|return|if|elif|else|for|while|in|range|len|int|str|float|True|False|and|or|not|break|continue|append|items|keys|values|get|None|lambda|is|pop|insert|remove|sort|split|join|upper|lower|sum|max|min|round|abs|type|list|dict|tuple)\b|==|!=|>=|<=|\+=|-=|\*\*|\/\/|(?<![=!<>+\-*/%])=(?!=)|[+\-*/%<>]|:(?=[ \t]*$)/gm

const SYNTAX_TOKENS = new Set([':', '==', '=', 'def', 'if', 'elif', 'else', 'for', 'while', 'in', 'return'])
const NAME_TOKENS = new Set(['print', 'input', 'len', 'range', 'True', 'False', 'None', 'append', 'items', 'keys', 'values', 'get', 'pop', 'insert', 'remove', 'sort', 'split', 'join', 'upper', 'lower', 'sum', 'max', 'min', 'round', 'abs'])
const TYPE_TOKENS = new Set(['int', 'str', 'float', 'list', 'dict', 'tuple', 'type'])
const OPERATOR_TOKENS = new Set(['+', '-', '*', '/', '//', '%', '**', '<', '>', '<=', '>=', '==', '!=', '+=', '-='])

const CONFUSABLES: Record<string, string[]> = {
  print: ['Print', 'echo', 'show'],
  input: ['read', 'scan'],
  def: ['function', 'func'],
  return: ['yield', 'give'],
  if: ['when', 'elif'],
  elif: ['else if', 'elseif'],
  else: ['elif', 'otherwise'],
  for: ['foreach', 'while'],
  while: ['for', 'loop'],
  in: ['of', 'on'],
  range: ['len', 'list'],
  len: ['size', 'count'],
  int: ['str', 'float'],
  str: ['int', 'text'],
  float: ['int', 'double'],
  True: ['true', 'TRUE'],
  False: ['false', 'FALSE'],
  None: ['null', 'nil'],
  and: ['&&', '&'],
  or: ['||', '|'],
  not: ['!', '~'],
  break: ['stop', 'exit'],
  continue: ['skip', 'pass'],
  append: ['add', 'push'],
  items: ['pairs', 'entries'],
  keys: ['names', 'labels'],
  values: ['vals', 'data'],
  get: ['fetch', 'find'],
  '==': ['=', '==='],
  '!=': ['<>', '=!'],
  '=': ['==', ':='],
  ':': [';', '.'],
  '+': ['-', '*'],
  '-': ['+', '/'],
  '*': ['x', '+'],
  '/': ['//', '%'],
  '//': ['/', '%'],
  '%': ['/', '//'],
  '**': ['^', '*'],
  '>': ['<', '>='],
  '<': ['>', '<='],
  '>=': ['>', '=>'],
  '<=': ['<', '=<'],
  '+=': ['=+', '++'],
  '-=': ['=-', '--'],
}

type TokenMatch = { token: string; index: number }

function findTokens(code: string): TokenMatch[] {
  const stringRanges: [number, number][] = []
  const stringPattern = /"[^"\n]*"|'[^'\n]*'|#.*$/gm
  let s: RegExpExecArray | null
  while ((s = stringPattern.exec(code)) !== null) {
    stringRanges.push([s.index, s.index + s[0].length])
  }
  const tokens: TokenMatch[] = []
  const pattern = new RegExp(TOKEN_PATTERN.source, 'gm')
  let m: RegExpExecArray | null
  while ((m = pattern.exec(code)) !== null) {
    const index = m.index
    if (stringRanges.some(([a, b]) => index >= a && index < b)) continue
    tokens.push({ token: m[0], index })
  }
  return tokens
}

function tokenWeight(token: string, ctx: GenContext) {
  let weight = 1
  if (hasFocus(ctx, SYNTAX_FOCUS) && SYNTAX_TOKENS.has(token)) weight += 3
  if (hasFocus(ctx, NAME_FOCUS) && NAME_TOKENS.has(token)) weight += 3
  if (hasFocus(ctx, TYPE_FOCUS) && TYPE_TOKENS.has(token)) weight += 3
  if (hasFocus(ctx, LOGIC_FOCUS) && OPERATOR_TOKENS.has(token)) weight += 3
  if (token === '=' && ctx.difficulty !== 'easy') weight *= 0.5
  return weight
}

function generateFill(ctx: GenContext): FillQuestion | null {
  const ex = ctx.exercise
  const code = targetCode(ctx)
  const tokens = findTokens(code)
  if (tokens.length === 0) return null

  const blankCount = Math.min(
    tokens.length,
    ctx.difficulty === 'easy' ? 1 : ctx.difficulty === 'medium' ? 2 : 3,
  )
  const chosen: TokenMatch[] = []
  const remaining = [...tokens]
  while (chosen.length < blankCount && remaining.length > 0) {
    const pick = weightedPick(
      remaining,
      remaining.map((t) => tokenWeight(t.token, ctx)),
      ctx.rng,
    )
    chosen.push(pick)
    remaining.splice(remaining.indexOf(pick), 1)
  }
  chosen.sort((a, b) => a.index - b.index)

  let template = code
  for (let i = chosen.length - 1; i >= 0; i -= 1) {
    const { token, index } = chosen[i]
    template = `${template.slice(0, index)}{{${i}}}${template.slice(index + token.length)}`
  }

  const answers = chosen.map((c) => c.token)
  const key = `${ex.lessonId}:${ex.subtopic}${targetSuffix(ctx)}`
  const id = `fill:${key}:${chosen.map((c) => `${c.token}@${tokens.indexOf(c)}`).join('-')}`
  if (ctx.usedIds.has(id)) return null

  let wordBank: string[] | null = null
  if (ctx.difficulty !== 'hard') {
    const extras = answers.flatMap((a) => CONFUSABLES[a] ?? []).slice(0, answers.length + 2)
    wordBank = shuffle([...new Set([...answers, ...extras])], ctx.rng)
  }

  return {
    ...baseQuestion(ctx, 'fill', `fill:${key}`, id),
    kind: 'fill',
    prompt:
      ctx.target === 'example'
        ? `Fill in the blank${answers.length > 1 ? 's' : ''} to complete ${exampleLabel(ctx)}:`
        : `Fill in the blank${answers.length > 1 ? 's' : ''} to complete the solution:\n“${ex.challenge}”`,
    template,
    answers,
    wordBank,
    solution: code,
    explanation:
      ctx.varied && ctx.exampleOutput
        ? `Complete code:\n${code}\n\nIt prints:\n${ctx.exampleOutput}`
        : `Complete code:\n${code}`,
  }
}

export function checkFillAnswers(question: FillQuestion, inputs: string[]) {
  return question.answers.map((answer, i) => (inputs[i] ?? '').trim() === answer)
}

/* ------------------------------------------------------------------ */
/* Arrange in order                                                    */
/* ------------------------------------------------------------------ */

const SIMPLE_ASSIGN = /^(\s*)([A-Za-z_]\w*)\s*=(?!=)\s*(.+)$/

function buildBlocks(lines: string[]): number[][] {
  const blocks: number[][] = []
  let i = 0
  while (i < lines.length) {
    const first = SIMPLE_ASSIGN.exec(lines[i])
    if (!first || /input\(/.test(lines[i])) {
      blocks.push([i])
      i += 1
      continue
    }
    const group = [i]
    const names = new Set([first[2]])
    let j = i + 1
    while (j < lines.length) {
      const next = SIMPLE_ASSIGN.exec(lines[j])
      if (!next || next[1] !== first[1] || /input\(/.test(lines[j])) break
      const rhs = next[3]
      const dependsOnGroup = [...names].some((n) =>
        new RegExp(`\\b${n}\\b`).test(rhs),
      )
      if (dependsOnGroup || names.has(next[2])) break
      group.push(j)
      names.add(next[2])
      j += 1
    }
    blocks.push(group)
    i = j
  }
  return blocks
}

export function isOrderCorrect(question: OrderQuestion, order: number[]) {
  let position = 0
  for (const block of question.blocks) {
    const actual = order
      .slice(position, position + block.length)
      .map((i) => question.lines[i])
      .sort()
    const expected = block.map((i) => question.lines[i]).sort()
    if (actual.join('\n') !== expected.join('\n')) return false
    position += block.length
  }
  return true
}

const PIECE_TOKEN =
  /"[^"\n]*"|'[^'\n]*'|[A-Za-z_]\w*|\d+(?:\.\d+)?|==|!=|<=|>=|\+=|-=|\*\*|\/\/|\S/g
const MAX_PIECES = 6

function codeLines(code: string) {
  return code.split('\n').filter((line) => line.trim() && !line.trim().startsWith('#'))
}

/** Splits short code into 3–6 readable pieces, keeping the original spacing. */
function splitIntoPieces(code: string): string[] | null {
  type Piece = { line: number; start: number; end: number }
  const lines = codeLines(code)
  const pieces: Piece[] = []
  lines.forEach((line, lineIndex) => {
    for (const match of line.matchAll(PIECE_TOKEN)) {
      const start = match.index ?? 0
      pieces.push({ line: lineIndex, start, end: start + match[0].length })
    }
  })

  const text = (p: Piece) => lines[p.line].slice(p.start, p.end)
  const mergeScore = (left: Piece, right: Piece) => {
    if (left.line !== right.line) return Infinity
    const l = text(left)
    const r = text(right)
    if (/^[)\],:]/.test(r)) return 0
    if (/[([.]$/.test(l) || /^[([.]/.test(r)) return 1
    return 2 + l.length + r.length
  }

  while (pieces.length > MAX_PIECES) {
    let best = -1
    let bestScore = Infinity
    for (let i = 0; i < pieces.length - 1; i += 1) {
      const score = mergeScore(pieces[i], pieces[i + 1])
      if (score < bestScore) {
        bestScore = score
        best = i
      }
    }
    if (best === -1) break
    pieces.splice(best, 2, { ...pieces[best], end: pieces[best + 1].end })
  }

  if (pieces.length < 3 || pieces.length > MAX_PIECES + 2) return null
  return pieces.map(text)
}

function generateOrder(ctx: GenContext): OrderQuestion | null {
  const ex = ctx.exercise
  const fromExample = ctx.target === 'example'
  const label = exampleLabel(ctx)

  type Source = {
    key: string
    mode: OrderQuestion['mode']
    lines: string[]
    blocks: number[][]
    prompt: string
    code: string
  }
  const lineSource = (key: string, code: string, prompt: string): Source | null => {
    const lines = codeLines(code)
    if (lines.length < 3) return null
    const blocks = buildBlocks(lines)
    if (blocks.length < 2) return null
    return { key, mode: 'lines', lines, blocks, prompt, code: lines.join('\n') }
  }
  const pieceSource = (key: string, code: string, label: string): Source | null => {
    const pieces = splitIntoPieces(code)
    if (!pieces) return null
    return {
      key: `${key}-pieces`,
      mode: 'pieces',
      lines: pieces,
      blocks: pieces.map((_, i) => [i]),
      prompt: `Put the code pieces in order (top piece first) to build ${label}.`,
      code: codeLines(code).join('\n'),
    }
  }

  const challengeLabel = `the solution for:\n“${ex.challenge}”`
  const sources = (
    fromExample
      ? [
          lineSource('example', ex.exampleCode, `Arrange the lines of ${label} in the order they must run.`),
          pieceSource('example', ex.exampleCode, label),
        ]
      : [
          lineSource('solution', ex.solution, `Arrange the lines in the correct order to solve:\n“${ex.challenge}”`),
          lineSource('example', ex.exampleCode, `Arrange the lines of ${label} in the order they must run.`),
          pieceSource('solution', ex.solution, challengeLabel),
        ]
  ).filter((s): s is Source => s !== null)

  const topicKeyValue = `${ex.lessonId}:${ex.subtopic}`
  for (const source of sources) {
    const id = `order:${topicKeyValue}:${source.key}`
    if (ctx.usedIds.has(id)) continue

    const question: OrderQuestion = {
      ...baseQuestion(ctx, 'order', `order:${topicKeyValue}${targetSuffix(ctx)}`, id),
      kind: 'order',
      mode: source.mode,
      prompt: source.prompt,
      lines: source.lines,
      shuffledOrder: [],
      blocks: source.blocks,
      explanation:
        fromExample && ctx.varied && ctx.exampleOutput
          ? `Correct code:\n${source.code}\n\nIt prints:\n${ctx.exampleOutput}`
          : `Correct code:\n${source.code}\n\n${ex.exampleNote}`,
    }
    const indices = source.lines.map((_, i) => i)
    let shuffled = shuffle(indices, ctx.rng)
    for (let tries = 0; tries < 8 && isOrderCorrect(question, shuffled); tries += 1) {
      shuffled = shuffle(indices, ctx.rng)
    }
    if (isOrderCorrect(question, shuffled)) continue
    question.shuffledOrder = shuffled
    return question
  }
  return null
}

/* ------------------------------------------------------------------ */
/* Practice problem                                                    */
/* ------------------------------------------------------------------ */

const NUMBER_WORDS =
  /\b(one|two|three|four|five|six|seven|eight|nine|ten|once|twice)\b/i

function makeNumberVariant(ex: SubtopicExercise, rng: Rng) {
  if (NUMBER_WORDS.test(ex.challenge)) return null
  const solutionNumbers = new Set(
    [...ex.solution.matchAll(/(?<![\w.])(\d+)(?![\w.])/g)].map((m) => m[1]),
  )
  const swappable = [...solutionNumbers].filter(
    (n) =>
      Number(n) >= 2 &&
      new RegExp(`(?<![\\w.])${n}(?![\\w.])`).test(ex.challenge),
  )
  if (swappable.length === 0) return null

  const mapping = new Map<string, string>()
  const taken = new Set(solutionNumbers)
  for (const n of swappable) {
    let next = Number(n) + 2 + Math.floor(rng() * 7)
    while (taken.has(String(next))) next += 1
    taken.add(String(next))
    mapping.set(n, String(next))
  }
  const pattern = new RegExp(
    `(?<![\\w.])(${swappable.join('|')})(?![\\w.])`,
    'g',
  )
  const apply = (text: string) => text.replace(pattern, (n) => mapping.get(n) ?? n)
  return {
    challenge: apply(ex.challenge),
    starterCode: apply(ex.starterCode),
    solution: apply(ex.solution),
    hints: ex.hints.map(apply),
    tag: [...mapping.values()].join('-'),
  }
}

function generateCode(ctx: GenContext): CodeQuestion | null {
  const ex = ctx.exercise
  const key = `${ex.lessonId}:${ex.subtopic}`
  const variant = ctx.difficulty === 'easy' ? null : makeNumberVariant(ex, ctx.rng)
  const id = variant ? `code:${key}:${variant.tag}` : `code:${key}:original`
  if (ctx.usedIds.has(id)) return null

  const starter =
    ctx.difficulty === 'hard'
      ? '# Write your solution from scratch\n'
      : (variant?.starterCode ?? ex.starterCode)

  return {
    ...baseQuestion(ctx, 'code', `code:${key}`, id),
    kind: 'code',
    prompt: variant
      ? 'Solve this new variation of the challenge:'
      : 'Solve this challenge again — this time without looking at the answer:',
    challenge: variant?.challenge ?? ex.challenge,
    starterCode: starter,
    referenceSolution: variant?.solution ?? ex.solution,
    expectedOutput: variant ? null : ex.expectedOutput,
    hints: variant?.hints ?? ex.hints,
    isVariant: Boolean(variant),
    explanation: `One correct solution:\n${variant?.solution ?? ex.solution}`,
  }
}

/* ------------------------------------------------------------------ */
/* Practice set builder                                                */
/* ------------------------------------------------------------------ */

function lessonExercises(lessonId: string): SubtopicExercise[] {
  const lesson = LESSON_DATA.find((l) => l.id === lessonId)
  if (!lesson) return []
  return lesson.subtopics.map((s) => getSubtopicExercise(lesson.id, lesson.title, s))
}

function focusTextFor(topic: TopicInsight) {
  if (topic.reasons.length > 0) {
    return `Targets "${topic.subtopic}" — ${topic.reasons[0].toLowerCase()}.`
  }
  if (topic.status === 'mastered') {
    return `Challenge mode — you have mastered "${topic.subtopic}".`
  }
  if (topic.status === 'developing') {
    return `Reinforces "${topic.subtopic}", which you are still building.`
  }
  return `Reviews "${topic.subtopic}".`
}

type ExampleOverride = {
  code: string
  output: string | null
  varied: boolean
  mcqStyles?: McqQuestion['style'][]
}

function generateQuestion(
  kind: ActivityKind,
  topic: TopicInsight,
  rng: Rng,
  usedIds: Set<string>,
  target: QuestionTarget = 'challenge',
  example?: ExampleOverride,
): PracticeQuestion | null {
  const lesson = LESSON_DATA.find((l) => l.id === topic.lessonId)
  if (!lesson) return null
  const original = getSubtopicExercise(lesson.id, lesson.title, topic.subtopic)
  const useOverride = target === 'example' && example !== undefined
  const exercise = useOverride ? { ...original, exampleCode: example.code } : original
  const ctx: GenContext = {
    exercise,
    siblings: lessonExercises(lesson.id).filter((e) => e.subtopic !== topic.subtopic),
    difficulty: topic.difficulty,
    focus: topic.topErrors.map((e) => e.category),
    focusText: focusTextFor(topic),
    rng,
    usedIds,
    target,
    exampleOutput: useOverride ? example.output : null,
    varied: useOverride && example.varied,
    mcqStyles: useOverride ? example.mcqStyles : undefined,
  }
  if (kind === 'mcq') return generateMcq(ctx)
  if (kind === 'fill') return generateFill(ctx)
  if (kind === 'order') return generateOrder(ctx)
  return generateCode(ctx)
}

const availabilityCache = new Map<string, boolean>()

/** Whether at least one question of this kind can be built for the topic. */
export function canGenerate(topic: TopicInsight, kind: ActivityKind): boolean {
  const cacheKey = `${topic.key}|${kind}|${topic.difficulty}`
  const cached = availabilityCache.get(cacheKey)
  if (cached !== undefined) return cached
  const available = generateQuestion(kind, topic, createRng(1), new Set()) !== null
  availabilityCache.set(cacheKey, available)
  return available
}

export function availableKinds(topic: TopicInsight): ActivityKind[] {
  return (['mcq', 'fill', 'order', 'code'] as ActivityKind[]).filter((kind) =>
    canGenerate(topic, kind),
  )
}

export type SectionQuestions = {
  mcq: McqQuestion | null
  fill: FillQuestion | null
  order: OrderQuestion | null
}

/* ------------------------------------------------------------------ */
/* Example variations (new values on every visit)                      */
/* ------------------------------------------------------------------ */

const NAME_POOL = ['Asha', 'Ravi', 'Alex', 'Sam', 'Riya', 'Ana', 'Maya', 'Leo', 'Zara', 'Kabir', 'Nina', 'Omar', 'Mira', 'Arjun']
const LITERAL = /"[^"\n]*"|'[^'\n]*'|#.*$|(?<![\w.])\d+(?![\w.])/gm
const MAX_VARIANT_LINES = 8

/** Numbers used as positions (items[1], nums[1:3]) stay unchanged so the code can't go out of range. */
function isSubscriptNumber(code: string, index: number) {
  const before = code.slice(0, index)
  const open = before.lastIndexOf('[')
  if (open <= before.lastIndexOf(']')) return false
  return /^[-\d:\s]*$/.test(before.slice(open + 1))
}

function pickNear(n: number, rng: Rng) {
  const low = Math.max(2, Math.round(n * 0.4))
  const high = Math.max(low + 3, Math.round(n * 1.6) + 2)
  let next = n
  for (let tries = 0; tries < 10 && next === n; tries += 1) {
    next = low + Math.floor(rng() * (high - low + 1))
  }
  return next
}

function runOutput(code: string) {
  const result = simulate(code)
  if (!result) return null
  return result.output.join('\n')
}

/**
 * Rewrites the example with different numbers and names (the same value is
 * always replaced the same way), then runs it to get the new output.
 */
function makeExampleVariant(code: string, rng: Rng): { code: string; output: string } | null {
  const originalOutput = runOutput(code)
  if (originalOutput === null) return null

  const numbers = new Set<string>()
  const thresholds = new Set<string>()
  const names = new Set<string>()
  for (const match of code.matchAll(LITERAL)) {
    const text = match[0]
    if (/^\d+$/.test(text)) {
      if (Number(text) < 2 || isSubscriptNumber(code, match.index)) continue
      numbers.add(text)
      if (/(<|>|==|!=)=?\s*$/.test(code.slice(0, match.index))) thresholds.add(text)
    } else if (/^["']/.test(text) && NAME_POOL.includes(text.slice(1, -1))) {
      names.add(text.slice(1, -1))
    }
  }
  if (numbers.size === 0 && names.size === 0) return null
  // Comparison limits keep their order (90 stays above 60) so if/elif chains still make sense.
  const sortedThresholds = [...thresholds].sort((a, b) => Number(a) - Number(b))

  let fallback: { code: string; output: string } | null = null
  for (let tries = 0; tries < 10; tries += 1) {
    const numberMap = new Map([...numbers].map((n) => [n, String(pickNear(Number(n), rng))]))
    const picked = sortedThresholds.map((n) => pickNear(Number(n), rng)).sort((a, b) => a - b)
    if (new Set(picked).size !== picked.length) continue
    sortedThresholds.forEach((n, i) => numberMap.set(n, String(picked[i])))
    const nameMap = new Map(
      [...names].map((n) => {
        const others = NAME_POOL.filter((p) => p !== n && !names.has(p))
        return [n, others[Math.floor(rng() * others.length)]]
      }),
    )
    const next = code.replace(LITERAL, (text: string, offset: number) => {
      if (/^\d+$/.test(text)) {
        return isSubscriptNumber(code, offset) ? text : (numberMap.get(text) ?? text)
      }
      if (/^["']/.test(text)) {
        const swapped = nameMap.get(text.slice(1, -1))
        return swapped ? `${text[0]}${swapped}${text[0]}` : text
      }
      return text
    })
    if (next === code) continue
    const output = runOutput(next)
    if (!output || !output.trim() || output.split('\n').length > MAX_VARIANT_LINES) continue
    if (output !== originalOutput) return { code: next, output }
    fallback ??= { code: next, output }
  }
  return fallback
}

const MCQ_ROTATION: McqQuestion['style'][] = ['output', 'code', 'concept']

/**
 * The three warm-up questions shown inside a lesson section, in order:
 * multiple choice → fill in the blanks → arrange in order.
 * Built from the example code first so the practice problem stays unsolved.
 * Each visit uses new example values, a different MCQ style and avoids the
 * questions shown last time (history.recent).
 */
export function buildSectionQuestions(
  insights: LearningInsights,
  lessonId: string,
  subtopic: string,
  seed: number,
  history: WarmupHistory = { attempt: 0, recent: [] },
): SectionQuestions {
  const topic = insights.topics.find(
    (t) => t.lessonId === lessonId && t.subtopic === subtopic,
  )
  const empty: SectionQuestions = { mcq: null, fill: null, order: null }
  if (!topic) return empty
  const lesson = LESSON_DATA.find((l) => l.id === lessonId)
  if (!lesson) return empty

  const rng = createRng(seed)
  const usedIds = new Set<string>()
  const avoidIds = new Set(history.recent)
  const difficulties = [...new Set<Difficulty>([topic.difficulty, 'medium', 'easy'])]

  const exampleCode = getSubtopicExercise(lesson.id, lesson.title, subtopic).exampleCode
  const variant = history.attempt > 0 ? makeExampleVariant(exampleCode, rng) : null
  const shift = history.attempt % MCQ_ROTATION.length
  const example: ExampleOverride = {
    code: variant?.code ?? exampleCode,
    output: variant?.output ?? runOutput(exampleCode),
    varied: variant !== null,
    mcqStyles: [...MCQ_ROTATION.slice(shift), ...MCQ_ROTATION.slice(0, shift)],
  }

  const build = (kind: 'mcq' | 'fill' | 'order') => {
    // Prefer something not shown last visit; repeat only if nothing else fits.
    for (const avoid of [avoidIds, usedIds]) {
      for (const difficulty of difficulties) {
        for (let tries = 0; tries < 4; tries += 1) {
          const question = generateQuestion(kind, { ...topic, difficulty }, rng, avoid, 'example', example)
          if (question) return question
        }
      }
    }
    for (const difficulty of difficulties) {
      const question = generateQuestion(kind, { ...topic, difficulty }, rng, usedIds, 'challenge')
      if (question) return question
    }
    return null
  }

  return {
    mcq: build('mcq') as McqQuestion | null,
    fill: build('fill') as FillQuestion | null,
    order: build('order') as OrderQuestion | null,
  }
}

function recentlyMasteredBaseIds(): Set<string> {
  const byBase = new Map<string, boolean[]>()
  for (const record of getPracticeHistory()) {
    byBase.set(record.questionId, [
      ...(byBase.get(record.questionId) ?? []),
      record.correct,
    ])
  }
  const mastered = new Set<string>()
  for (const [base, results] of byBase) {
    const lastTwo = results.slice(-2)
    if (lastTwo.length === 2 && lastTwo.every(Boolean)) mastered.add(base)
  }
  return mastered
}

export type PracticeSetOptions = {
  insights: LearningInsights
  source: PracticeSource
  count: number
  lessonId?: string
  subtopic?: string
  kinds?: ActivityKind[]
  seed?: number
}

function candidateTopics(options: PracticeSetOptions): TopicInsight[] {
  const { insights, lessonId, subtopic } = options
  if (lessonId && subtopic) {
    return insights.topics.filter(
      (t) => t.lessonId === lessonId && t.subtopic === subtopic,
    )
  }
  if (lessonId) {
    const lessonTopics = insights.topics.filter((t) => t.lessonId === lessonId)
    const touched = lessonTopics.filter((t) => t.status !== 'not-started')
    return touched.length > 0 ? touched : lessonTopics
  }
  if (insights.recommendations.length > 0) return insights.recommendations
  const tracked = insights.topics.filter((t) => t.status !== 'not-started')
  if (tracked.length > 0) return tracked
  return insights.topics.filter((t) => t.lessonId === LESSON_DATA[0].id)
}

export function buildPracticeSet(options: PracticeSetOptions): PracticeQuestion[] {
  const rng = createRng(options.seed ?? Date.now())
  const requested = options.kinds
  const supports = (t: TopicInsight) =>
    requested?.length ? requested.some((k) => canGenerate(t, k)) : true
  let topics = candidateTopics(options).filter(supports)
  if (topics.length === 0 && options.lessonId && !options.subtopic) {
    topics = options.insights.topics.filter(
      (t) => t.lessonId === options.lessonId && supports(t),
    )
  }
  if (topics.length === 0) return []

  const weights = topics.map((t) => 1 + (100 - (t.mastery ?? 50)) / 25)
  const mastered = recentlyMasteredBaseIds()
  const questions: PracticeQuestion[] = []
  const usedIds = new Set<string>()
  const kindCounts: Partial<Record<ActivityKind, number>> = {}
  const deferred: PracticeQuestion[] = []
  let lastKey = ''

  for (let attempt = 0; questions.length < options.count && attempt < options.count * 10; attempt += 1) {
    let topic = weightedPick(topics, weights, rng)
    if (topics.length > 1 && topic.key === lastKey) {
      topic = weightedPick(topics, weights, rng)
    }
    lastKey = topic.key

    const allowed = (options.kinds?.length ? options.kinds : topic.suggestedKinds).filter(
      (kind) => canGenerate(topic, kind),
    )
    const kindOrder = [...allowed].sort(
      (a, b) =>
        (kindCounts[a] ?? 0) - (kindCounts[b] ?? 0) ||
        topic.suggestedKinds.indexOf(a) - topic.suggestedKinds.indexOf(b),
    )

    for (const kind of kindOrder) {
      if (kind === 'code' && allowed.length > 1 && (kindCounts.code ?? 0) >= 2) continue
      const question = generateQuestion(kind, topic, rng, usedIds)
      if (!question || usedIds.has(question.id)) continue
      usedIds.add(question.id)
      if (mastered.has(question.baseId)) {
        deferred.push(question)
        continue
      }
      questions.push(question)
      kindCounts[kind] = (kindCounts[kind] ?? 0) + 1
      break
    }
  }

  while (questions.length < options.count && deferred.length > 0) {
    questions.push(deferred.shift()!)
  }
  return questions
}
