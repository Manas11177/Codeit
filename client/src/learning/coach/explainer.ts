/**
 * Turns any Python program into four exam-style explanations:
 * word by word, section by section, the big picture and memory tricks.
 * Text uses `backticks` for code and **double stars** for bold.
 */
import { parseExpr, PyFloat, render, type Expr, type PyVal } from '../miniPython'
import {
  BUILTINS,
  HEADER_KINDS,
  analyzeLines,
  definedNameToken,
  isCodeLine,
  logicalLine,
  skeletonLine,
  stringContent,
  type CodeLine,
  type Token,
  type TokenKind,
} from './lexer'

/* ───────────── Types ───────────── */

export type WordInfo = { text: string; kind: TokenKind | 'indent'; meaning: string }
export type WordLine = {
  no: number
  code: string
  words: WordInfo[]
  sentence: string
  isComment: boolean
  /** Last line covered when a statement or a comment block spans several lines. */
  endNo?: number
}

export type SectionKind =
  | 'setup'
  | 'input'
  | 'output'
  | 'action'
  | 'call'
  | 'decision'
  | 'loop'
  | 'while'
  | 'function'
  | 'import'
  | 'class'
  | 'try'
  | 'with'
  | 'other'

export type SectionStep = { no: number; depth: number; text: string }

export type Section = {
  index: number
  kind: SectionKind
  icon: string
  title: string
  note: string | null
  start: number
  end: number
  code: string
  lines: CodeLine[]
  summary: string
  steps: SectionStep[]
  tip: string
  branches: string[]
  /** True when the part comes from a banner comment the author wrote (`# ==== PART A ====`). */
  banner?: boolean
}

export type OverviewStep = { icon: string; title: string; text: string; branches: string[]; repeats: boolean }
export type Overview = { inShort: string; steps: OverviewStep[]; flowNote: string }

export type MemoryHook = { icon: string; title: string; text: string }
export type RememberGuide = {
  hooks: MemoryHook[]
  skeleton: string
  chain: { words: string[]; acronym: string; silly: string }
  rules: string[]
  readAloud: { no: number; text: string }[]
  practice: string[]
}

export type CodeExplanation = {
  code: string
  lines: CodeLine[]
  words: WordLine[]
  sections: Section[]
  overview: Overview
  remember: RememberGuide
}

/* ───────────── What the program knows ───────────── */

type Ctx = {
  /** Variables made so far, keyed `scope|name` (scope = line of the enclosing def, 0 for the file). */
  created: Set<string>
  functions: Set<string>
  classes: Set<string>
  /** Module nickname → real module name (`np` → `numpy`). */
  modules: Map<string, string>
  /** Name brought in with `from … import` → the module it came from. */
  imported: Map<string, string>
}

const emptyCtx = (): Ctx => ({ created: new Set(), functions: new Set(), classes: new Set(), modules: new Map(), imported: new Map() })

/** Knowledge about the program being explained; set at the start of explainCode. */
let known: Ctx = emptyCtx()

/** Pieces the expression reader cannot parse (lambdas, comprehensions…), swapped for placeholder names. */
type Hole = { text: string; words: string; lambda?: { params: string[]; body: string } }
let holes = new Map<string, Hole>()

const isCreated = (ctx: Ctx, name: string, scope: number) => ctx.created.has(`${scope}|${name}`) || ctx.created.has(`0|${name}`)
const markCreated = (ctx: Ctx, name: string, scope: number) => ctx.created.add(`${scope}|${name}`)

/* ───────────── Saying expressions in words ───────────── */

const code = (s: string) => `\`${s.replace(/`/g, "'").replace(/\n/g, '\\n')}\``
const unhole = (s: string) => s.replace(/__h\d+__/g, (id) => holes.get(id)?.text ?? id)
const codeOf = (e: Expr) => code(unhole(render(e)))

function plural(n: number, word: string, many = `${word}s`) {
  return `${n} ${n === 1 ? word : many}`
}

function listWords(items: string[], max = 4, conj = 'and') {
  if (items.length <= 1) return items[0] ?? ''
  const shown = items.length > max ? [...items.slice(0, max - 1), `${items.length - max + 1} more`] : items
  return `${shown.slice(0, -1).join(', ')} ${conj} ${shown[shown.length - 1]}`
}

function joinAll(items: string[]) {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/** Joins clauses that may contain lists of their own, so the last one needs a clear ", and". */
function joinClauses(items: string[]) {
  if (items.length <= 2) return items.join(' and ')
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

/** Long values read better at the end of a sentence than squeezed into the middle of one. */
const isLong = (words: string) => words.length > 50 || words.includes(', ') || /\bit$/.test(words)

const article = (word: string) => (/^[`'"]?[AEIOUaeiou]/.test(word) ? 'an' : 'a')

function literal(v: PyVal): string {
  if (v === null) return code('None')
  if (v === true) return code('True')
  if (v === false) return code('False')
  if (typeof v === 'number') return code(String(v))
  if (typeof v === 'string') return code(`"${v}"`)
  if (v instanceof PyFloat) return code(Number.isInteger(v.v) ? `${v.v}.0` : String(v.v))
  return code('…')
}

const COMPARE_WORDS: Record<string, string> = {
  '==': 'is equal to',
  '!=': 'is not equal to',
  '<': 'is less than',
  '>': 'is more than',
  '<=': 'is less than or equal to',
  '>=': 'is more than or equal to',
  in: 'is inside',
  'not in': 'is not inside',
  is: 'is exactly',
  'is not': 'is not exactly',
}

const PRECEDENCE: Record<string, number> = {
  or: 1, and: 2, '|': 5, '^': 6, '&': 7, '+': 8, '-': 8, '*': 9, '/': 9, '//': 9, '%': 9, '**': 11,
}

function intValue(e: Expr | undefined): number | null {
  if (!e) return null
  if (e.k === 'val' && typeof e.v === 'number') return e.v
  if (e.k === 'un' && e.op === '-' && e.e.k === 'val' && typeof e.e.v === 'number') return -e.e.v
  return null
}

function rangeWords(args: Expr[], s: (e: Expr) => string) {
  const [a, b, c] = args.map(intValue)
  if (args.length === 1) {
    if (a !== null) return a <= 0 ? 'no numbers at all (the range is empty)' : `the numbers ${code('0')} to ${code(String(a - 1))}`
    return `the numbers from ${code('0')} up to ${s(args[0])} (not including it)`
  }
  if (args.length === 2) {
    if (a !== null && b !== null) return `the numbers ${code(String(a))} to ${code(String(b - 1))}`
    return `the numbers from ${s(args[0])} up to ${s(args[1])} (not including it)`
  }
  const step = c !== null ? code(String(c)) : s(args[2])
  return `the numbers from ${s(args[0])} up to ${s(args[1])} (not including it), jumping by ${step} each time`
}

type CallExpr = Extract<Expr, { k: 'call' }>

const kwExpr = (e: CallExpr, name: string) => e.kw.find(([k]) => k === name)?.[1]

function kwWords(e: CallExpr, s: (x: Expr) => string, skip: string[] = []) {
  const parts = e.kw.filter(([k]) => !skip.includes(k)).map(([k, v]) => `${code(k)} set to ${s(v)}`)
  return parts.length ? ` with ${listWords(parts, 5)}` : ''
}

const lambdaOf = (e: Expr | undefined) => (e?.k === 'name' ? holes.get(e.id)?.lambda : undefined)

/** How to describe the `key=` of sorted()/sort(): a lambda reads better as just its answer. */
function keyWords(key: Expr, s: (x: Expr) => string) {
  const lambda = lambdaOf(key)
  return lambda ? sayText(lambda.body) : s(key)
}

/** "sorted from smallest to biggest" / "sorted by `i.price` (biggest first)". */
function orderWords(e: CallExpr, s: (x: Expr) => string) {
  const rev = kwExpr(e, 'reverse')
  const key = kwExpr(e, 'key')
  const reversed = rev?.k === 'val' && rev.v === true
  if (key) return `by ${keyWords(key, s)} (${reversed ? 'biggest' : 'smallest'} first)`
  return reversed ? 'from biggest to smallest' : 'from smallest to biggest'
}

function openMode(e: CallExpr) {
  const mode = e.args[1] ?? kwExpr(e, 'mode')
  const m = mode?.k === 'val' && typeof mode.v === 'string' ? mode.v : 'r'
  if (m.includes('w')) return 'writing (anything already in it is replaced)'
  if (m.includes('a')) return 'adding to the end'
  if (m.includes('x')) return 'creating a brand-new file'
  return 'reading'
}

/** The module a call like `np.sum(…)` or `os.path.join(…)` belongs to. */
function moduleOf(fn: Expr) {
  const path: string[] = []
  let at = fn
  while (at.k === 'attr') {
    path.unshift(at.name)
    at = at.obj
  }
  if (at.k !== 'name' || !known.modules.has(at.id) || path.length === 0) return null
  const module = known.modules.get(at.id) ?? at.id
  return { module, alias: at.id, path: path.join('.'), label: module.split('.').pop() ?? module }
}

type Phrase = (a: string[], e: CallExpr, s: (x: Expr) => string) => string | undefined | ''

const MODULE_VALUES: Record<string, Phrase> = {
  'time.time': () => 'the current time (in seconds)',
  'time.perf_counter': () => 'the current time from a precise stopwatch',
  'numpy.sum': (a) => a[0] && `the total of ${a[0]}`,
  'numpy.mean': (a) => a[0] && `the average of ${a[0]}`,
  'numpy.median': (a) => a[0] && `the middle value of ${a[0]}`,
  'numpy.max': (a) => a[0] && `the biggest value in ${a[0]}`,
  'numpy.min': (a) => a[0] && `the smallest value in ${a[0]}`,
  'numpy.sqrt': (a) => a[0] && `the square root of ${a[0]}`,
  'numpy.cumsum': (a) => a[0] && `the running totals of ${a[0]}`,
  'numpy.array': (a) => a[0] && `a numpy array made from ${a[0]}`,
  'math.sqrt': (a) => a[0] && `the square root of ${a[0]}`,
  'math.floor': (a) => a[0] && `${a[0]} rounded down to a whole number`,
  'math.ceil': (a) => a[0] && `${a[0]} rounded up to a whole number`,
  'random.randint': (a) => a.length === 2 && `a random whole number from ${a[0]} to ${a[1]}`,
  'random.choice': (a) => a[0] && `a random item from ${a[0]}`,
  'random.random': () => `a random decimal number between ${code('0')} and ${code('1')}`,
  'os.path.join': (a) => a.length > 0 && `a file path made by joining ${listWords(a)}`,
  'os.path.exists': (a) => a[0] && `whether the file or folder ${a[0]} exists`,
  'json.load': (a) => a[0] && `the data read from the JSON file ${a[0]}`,
  'json.loads': (a) => a[0] && `the data inside the JSON text ${a[0]}`,
  'json.dumps': (a) => a[0] && `${a[0]} written as JSON text`,
}

const PLT = 'matplotlib.pyplot'
const MODULE_ACTIONS: Record<string, Phrase> = {
  [`${PLT}.figure`]: (_a, e, s) => {
    const size = kwExpr(e, 'figsize')
    return size?.k === 'tuple' && size.items.length === 2
      ? `Start a new, empty chart (a figure) that is ${s(size.items[0])} × ${s(size.items[1])} inches`
      : 'Start a new, empty chart (a figure)'
  },
  [`${PLT}.plot`]: (a) =>
    a.length >= 2 ? `Draw a line chart: ${a[0]} along the bottom (x-axis) and ${a[1]} up the side (y-axis)` : a[0] && `Draw a line chart of ${a[0]}`,
  [`${PLT}.scatter`]: (a) => a.length >= 2 && `Draw a scatter chart (one dot per point) of ${a[1]} against ${a[0]}`,
  [`${PLT}.bar`]: (a) => a.length >= 2 && `Draw a bar chart with bars at ${a[0]} and heights ${a[1]}`,
  [`${PLT}.hist`]: (a) => a[0] && `Draw a histogram (bars showing how often each value appears) of ${a[0]}`,
  [`${PLT}.xlabel`]: (a) => a[0] && `Write the label ${a[0]} under the x-axis (the bottom edge of the chart)`,
  [`${PLT}.ylabel`]: (a) => a[0] && `Write the label ${a[0]} beside the y-axis (the left edge of the chart)`,
  [`${PLT}.title`]: (a) => a[0] && `Give the chart the title ${a[0]}`,
  [`${PLT}.grid`]: () => 'Draw grid lines on the chart so the values are easier to read',
  [`${PLT}.legend`]: () => 'Add a legend (a small key that says what each line means)',
  [`${PLT}.tight_layout`]: () => 'Tidy the spacing so nothing on the chart overlaps',
  [`${PLT}.savefig`]: (a) => a[0] && `Save the chart as the image file ${a[0]}`,
  [`${PLT}.show`]: () => 'Show the finished chart in a window',
  [`${PLT}.close`]: () => 'Close the chart',
  'json.dump': (a) => a.length >= 2 && `Save ${a[0]} as JSON text into ${a[1]}`,
  'time.sleep': (a) => a[0] && `Pause the program for ${a[0]} seconds`,
  'random.shuffle': (a) => a[0] && `Shuffle ${a[0]} into a random order`,
  'random.seed': (a) => a[0] && `Fix the random numbers with the seed ${a[0]}, so every run gives the same “random” results`,
}

/** Phrases for well-known functions brought in with `from … import`. */
const IMPORTED_VALUES: Record<string, { say: Phrase; uses?: string[] }> = {
  train_test_split: { say: (a) => a.length > 0 && `${listWords(a)} split into training and testing parts` },
  accuracy_score: { say: (a) => a.length >= 2 && `the accuracy — the share of predictions in ${a[1]} that match the true answers in ${a[0]}` },
  field: {
    say: (_a, e) => {
      const make = kwExpr(e, 'default_factory')
      return make && `a new, empty ${codeOf(make)} (a fresh one for every object)`
    },
    uses: ['default_factory'],
  },
  defaultdict: { say: (a) => a[0] && `a dictionary that gives a new, empty ${a[0]} for any key it has not seen yet` },
}

function methodValue(name: string, obj: string, raw: string, args: string[], kw: string, e: CallExpr, s: (x: Expr) => string): string {
  const [a, b] = args
  switch (name) {
    case 'upper': return `${obj} in CAPITAL letters`
    case 'lower': return `${obj} in small letters`
    case 'title': return `${obj} with Each Word Capitalised`
    case 'capitalize': return `${obj} with the first letter capitalised`
    case 'strip': return `${obj} without the spaces at both ends`
    case 'split': return a ? `${obj} cut into a list at every ${a}` : `${obj} cut into a list of words`
    case 'join': if (a) return `the items of ${a} glued together with ${obj} between them`
      break
    case 'replace': if (b) return `${obj} with every ${a} replaced by ${b}`
      break
    case 'get': return b ? `the value for key ${a} in ${obj} (or ${b} if that key is missing)` : `the value for key ${a} in ${obj} (or ${code('None')} if it is missing)`
    case 'keys': return `all the keys of ${obj}`
    case 'values': return `all the values of ${obj}`
    case 'items': return `all the key–value pairs of ${obj}`
    case 'count': if (a) return `how many times ${a} appears in ${obj}`
      break
    case 'index': if (a) return `the position of ${a} in ${obj}`
      break
    case 'find': if (a) return `the position where ${a} starts in ${obj}`
      break
    case 'pop': return a ? `the item at position ${a}, taken out of ${obj}` : `the last item, taken out of ${obj}`
    case 'startswith': return `whether ${obj} starts with ${a}`
    case 'endswith': return `whether ${obj} ends with ${a}`
    case 'isdigit': return `whether ${obj} contains only digits`
    case 'format': return `${obj} with the {} gaps filled by ${listWords(args)}`
    case 'copy': return `a copy of ${obj}`
    case 'fit_transform': if (a) return `${a} after ${obj} learns from it and transforms it`
      break
    case 'transform': if (a) return `${a} transformed by ${obj}`
      break
    case 'predict': if (a) return `the predictions ${obj} makes for ${a}`
      break
    case 'predict_proba': if (a) return `the probabilities ${obj} predicts for ${a}`
      break
    case 'score': if (a) return `how well ${obj} scores on ${listWords(args)}`
      break
    case 'sorted':
    case 'sort': return `${obj} sorted ${orderWords(e, s)}`
  }
  return `the answer from ${code(`${raw}.${name}()`)}${args.length ? ` given ${listWords(args)}` : ''}${kw}`
}

function methodAction(name: string, obj: string, args: string[], e: CallExpr, s: (x: Expr) => string): string | null {
  const [a, b] = args
  switch (name) {
    case 'append': return a ? `Add ${a} to the end of the list ${obj}.` : null
    case 'insert': return b ? `Put ${b} into ${obj} at position ${a} (the other items move along).` : null
    case 'remove': return a ? `Remove the first ${a} from ${obj}.` : null
    case 'pop': return a ? `Take the item at position ${a} out of ${obj}.` : `Take the last item out of ${obj}.`
    case 'sort': return `Sort ${obj} ${orderWords(e, s)}. The list itself changes.`
    case 'reverse': return `Flip ${obj} so the last item comes first.`
    case 'clear': return `Empty ${obj} completely.`
    case 'extend': return a ? `Add every item of ${a} to the end of ${obj}.` : null
    case 'update': return a ? `Add (or overwrite) the pairs from ${a} in ${obj}.` : null
    case 'add': return a ? `Add ${a} to the set ${obj}.` : null
    case 'fit': return args.length ? `Train ${obj} on ${listWords(args)} — this is the step where the model learns from the data.` : null
    case 'write': return a ? `Write ${a} into ${obj}.` : null
    case 'close': return `Close ${obj}.`
    default: return null
  }
}

/** A short way to name the thing before a dot: `self.by_tag[tag]` reads better as code than as words. */
function subject(e: Expr, s: (x: Expr) => string) {
  const simple = (x: Expr): boolean =>
    x.k === 'name' ? !holes.has(x.id) : x.k === 'attr' ? simple(x.obj) : x.k === 'index' ? simple(x.obj) && (x.idx.k === 'name' || x.idx.k === 'val') : false
  return simple(e) ? codeOf(e) : s(e)
}

function namedCall(name: string, e: CallExpr, args: string[], s: (x: Expr) => string): string {
  const given = args.length ? ` given ${listWords(args)}` : ''
  if (known.functions.has(name)) return `the answer from your function ${code(name)}${given}${kwWords(e, s)}`
  const special = known.imported.has(name) ? IMPORTED_VALUES[name] : undefined
  const said = special?.say(args, e, s)
  if (said) return `${said}${kwWords(e, s, special?.uses)}`
  if (known.classes.has(name) || /^[A-Z]/.test(name)) {
    return `a new ${code(name)} object${args.length ? ` made from ${listWords(args)}` : ''}${kwWords(e, s)}`
  }
  return `the result of ${code(`${name}()`)}${given}${kwWords(e, s)}`
}

function say(e: Expr, depth = 0): string {
  if (depth > 3) return codeOf(e)
  const s = (x: Expr) => say(x, depth + 1)
  switch (e.k) {
    case 'val':
      return literal(e.v)
    case 'name':
      return holes.get(e.id)?.words ?? code(e.id)
    case 'list': {
      if (!e.items.length) return 'an empty list'
      const makers = [...new Set(e.items.map((x) => (x.k === 'call' && x.fn.k === 'name' ? x.fn.id : '')))]
      if (e.items.length > 1 && makers.length === 1 && /^[A-Z]/.test(makers[0])) return `a list of ${e.items.length} new ${code(makers[0])} objects`
      if (e.items.length > 2 && e.items.some((x) => ['call', 'list', 'dict', 'tuple'].includes(x.k))) return `a list of ${plural(e.items.length, 'item')}`
      return `a list of ${plural(e.items.length, 'item')} (${listWords(e.items.map(s))})`
    }
    case 'tuple':
      return e.items.length ? `a tuple of ${plural(e.items.length, 'item')} (${listWords(e.items.map(s))})` : 'an empty tuple'
    case 'dict':
      return e.entries.length
        ? `a dictionary with ${plural(e.entries.length, 'pair')} (${listWords(e.entries.map(([k, v]) => `${s(k)} → ${s(v)}`))})`
        : 'an empty dictionary'
    case 'bin': {
      const p = PRECEDENCE[e.op] ?? 4
      const part = (child: Expr, right: boolean) => {
        if (child.k !== 'bin' || p < 8) return s(child)
        const c = PRECEDENCE[child.op] ?? 4
        const wrap = c < p || (right && c === p && !['+', '*', '**'].includes(e.op))
        return wrap ? `(${s(child)})` : s(child)
      }
      const l = part(e.l, false)
      const r = part(e.r, true)
      if (COMPARE_WORDS[e.op]) return `${l} ${COMPARE_WORDS[e.op]} ${r}`
      switch (e.op) {
        case '+': {
          const isText = (x: Expr) => x.k === 'val' && typeof x.v === 'string'
          return isText(e.l) || isText(e.r) ? `${l} joined with ${r}` : `${l} plus ${r}`
        }
        case '-': return `${l} minus ${r}`
        case '*': return e.l.k === 'val' && typeof e.l.v === 'string' ? `${l} repeated ${r} times` : `${l} times ${r}`
        case '/': return `${l} divided by ${r}`
        case '//': return `${l} divided by ${r} (keeping only the whole number)`
        case '%': return `the remainder when ${l} is divided by ${r}`
        case '**': return `${l} to the power of ${r}`
        case 'and': return `${l} and ${r}`
        case 'or': return `${l} or ${r}`
        default: return codeOf(e)
      }
    }
    case 'un':
      if (e.op === 'not') return `not (${s(e.e)})`
      if (e.op === '-') return e.e.k === 'val' ? codeOf(e) : `minus ${s(e.e)}`
      return s(e.e)
    case 'if':
      return `${s(e.a)} if ${s(e.cond)}, otherwise ${s(e.b)}`
    case 'call': {
      const args = e.args.map(s)
      if (e.fn.k === 'attr') {
        const mod = moduleOf(e.fn)
        if (mod) {
          const said = MODULE_VALUES[`${mod.module}.${mod.path}`]?.(args, e, s)
          if (said) return `${said}${kwWords(e, s)}`
          return `the result of ${mod.label}'s ${code(mod.path)}${args.length ? ` given ${listWords(args)}` : ''}${kwWords(e, s)}`
        }
        return methodValue(e.fn.name, subject(e.fn.obj, s), unhole(render(e.fn.obj)), args, kwWords(e, s), e, s)
      }
      if (e.fn.k !== 'name' || holes.has(e.fn.id)) return codeOf(e)
      const name = e.fn.id
      const [a, b] = args
      if (known.functions.has(name) || known.classes.has(name)) return namedCall(name, e, args, s)
      switch (name) {
        case 'len': return `the length of ${a}`
        case 'input': return a ? `what the user types (after the screen shows ${a})` : 'what the user types'
        case 'int': return e.args[0]?.k === 'call' && e.args[0].fn.k === 'name' && e.args[0].fn.id === 'input'
          ? `${a}, turned into a whole number`
          : `${a} as a whole number`
        case 'float': return `${a} as a decimal number`
        case 'str': return `${a} as text`
        case 'bool': return `${a} as True/False`
        case 'range': return rangeWords(e.args, s)
        case 'sum': return `the total of ${a}`
        case 'max': return `the biggest of ${listWords(args)}`
        case 'min': return `the smallest of ${listWords(args)}`
        case 'abs': return `${a} without its minus sign`
        case 'round': return b ? `${a} rounded to ${b} decimal places` : `${a} rounded to a whole number`
        case 'sorted': return `${a} sorted ${orderWords(e, s)}`
        case 'reversed': return `${a} in reverse order`
        case 'map': {
          const lambda = lambdaOf(e.args[0])
          if (lambda && b) return `${sayText(lambda.body)} for each ${listWords(lambda.params.map(code))} in ${b}`
          return b ? `the result of applying ${a} to each item of ${b}` : namedCall(name, e, args, s)
        }
        case 'filter': {
          const lambda = lambdaOf(e.args[0])
          if (lambda && b) return `each ${listWords(lambda.params.map(code))} in ${b} where ${sayCondition(lambda.body)}`
          return b ? `the items of ${b} for which ${a} gives True` : namedCall(name, e, args, s)
        }
        case 'type': return `the type of ${a}`
        case 'list': return a ? `${a}, as a list` : 'an empty list'
        case 'set': return a ? `the items of ${a} as a set (no repeats)` : 'an empty set'
        case 'tuple': return a ? `${a} turned into a tuple` : 'an empty tuple'
        case 'dict': return a ? `${a} turned into a dictionary` : `an empty dictionary${kwWords(e, s)}`
        case 'enumerate': return `each item of ${a} together with its position`
        case 'zip': return `${listWords(args)} paired up item by item`
        case 'any': return `whether at least one item of ${a} is True`
        case 'all': return `whether every item of ${a} is True`
        case 'isinstance': return `whether ${a} is ${article(b ?? '')} ${b}`
        case 'open': return `the file ${a}, opened for ${openMode(e)}`
        case 'print': return `showing ${listWords(args)}`
        default:
          return namedCall(name, e, args, s)
      }
    }
    case 'index': {
      const obj = s(e.obj)
      const n = intValue(e.idx)
      if (e.obj.k === 'attr' && e.obj.name === 'shape' && (n === 0 || n === 1)) {
        return `the number of ${n === 0 ? 'rows' : 'columns'} in ${subject(e.obj.obj, s)}`
      }
      if (e.idx.k === 'val' && typeof e.idx.v === 'string') return `the value stored under ${literal(e.idx.v)} in ${obj}`
      if (n === -1) return `the last item of ${obj}`
      if (n !== null && n < 0) return `the item ${-n} places from the end of ${obj}`
      if (n !== null) return `item number ${code(String(n))} of ${obj} (counting from 0)`
      return `the item at position ${s(e.idx)} of ${obj}`
    }
    case 'slice': {
      const said = s(e.obj)
      const obj = said.includes(',') ? `(${said})` : said
      const lo = intValue(e.lo ?? undefined)
      const hi = intValue(e.hi ?? undefined)
      if (!e.lo && !e.hi) return `a copy of ${obj}`
      if (!e.lo && e.hi) return hi !== null && hi < 0 ? `all but the last ${code(String(-hi))} items of ${obj}` : `the first ${s(e.hi)} items of ${obj}`
      if (e.lo && !e.hi) return lo !== null && lo < 0 ? `the last ${code(String(-lo))} items of ${obj}` : `the items of ${obj} from position ${s(e.lo)} to the end`
      return `the items of ${obj} from position ${s(e.lo!)} up to (not including) position ${s(e.hi!)}`
    }
    case 'attr':
      return codeOf(e)
  }
}

/* ───────────── Reading code the expression parser can't ───────────── */

let holeCount = 0
function hole(text: string, words: string, lambda?: Hole['lambda']) {
  const id = `__h${holeCount++}__`
  holes.set(id, { text, words, lambda })
  return id
}

const OPENERS: Record<string, string> = { '(': ')', '[': ']', '{': '}' }

function tokensOf(text: string): Token[] | null {
  if (text.includes('\n')) return null
  return analyzeLines(text)[0]?.code ?? []
}

/** Index just after the expression that starts at `i` (stops at a comma or closing bracket of the same level). */
function extentEnd(toks: Token[], i: number) {
  const d = toks[i].depth
  for (let k = i + 1; k < toks.length; k += 1) {
    if (toks[k].depth < d) return k
    if (toks[k].depth === d && (toks[k].text === ',' || (toks[k].kind === 'keyword' && toks[k].text === 'for'))) return k
  }
  return toks.length
}

function matching(toks: Token[], i: number) {
  const close = OPENERS[toks[i].text]
  for (let k = i + 1; k < toks.length; k += 1) if (toks[k].text === close && toks[k].depth === toks[i].depth) return k
  return -1
}

function comprehensionWords(shape: 'list' | 'set' | 'dict' | 'gen', toks: Token[], text: string, d: number) {
  const slice = (a: number, b: number) => (a < b ? text.slice(toks[a].start, toks[b - 1].end) : '')
  const marks = toks
    .map((t, k) => (t.depth === d && t.kind === 'keyword' && (t.text === 'for' || t.text === 'if') ? k : -1))
    .filter((k) => k >= 0)
  const firstFor = marks.find((k) => toks[k].text === 'for') ?? toks.length
  const loops: string[] = []
  const conds: string[] = []
  marks
    .filter((k) => k >= firstFor)
    .forEach((k, n, all) => {
      const end = all[n + 1] ?? toks.length
      if (toks[k].text === 'for') {
        const inAt = toks.findIndex((t, j) => j > k && j < end && t.depth === d && t.text === 'in')
        if (inAt < 0) return
        loops.push(`each ${code(slice(k + 1, inAt))} in ${sayText(slice(inAt + 1, end))}`)
      } else {
        conds.push(sayCondition(slice(k + 1, end)))
      }
    })
  const keep = conds.length ? ` (keeping only those where ${joinAll(conds)})` : ''
  const each = joinAll(loops)
  if (shape === 'dict') {
    const colon = toks.findIndex((t, j) => j < firstFor && t.depth === d && t.text === ':')
    if (colon > 0) return `a new dictionary that links each ${sayText(slice(0, colon))} to ${sayText(slice(colon + 1, firstFor))}, for ${each}${keep}`
  }
  const elementText = slice(0, firstFor)
  const elementToks = tokensOf(elementText) ?? []
  const nested = shape === 'list' && elementToks[0]?.text === '[' && elementToks.some((x) => x.depth === 1 && x.kind === 'keyword' && x.text === 'for')
  if (nested) return `a new list of lists — for ${each}${keep}, ${sayText(elementText)}`
  const element = sayText(elementText)
  if (shape === 'gen') return `${element} for ${each}${keep}`
  return `a new ${shape} of ${element} for ${each}${keep}`
}

/** Swaps lambdas, comprehensions, `:=`, `*args` and prefixed strings for placeholders the parser accepts. */
function simplify(text: string): string {
  const toks = tokensOf(text)
  if (!toks) return text
  const swaps: { from: number; to: number; id: string }[] = []
  let i = 0
  while (i < toks.length) {
    const t = toks[i]
    if (t.kind === 'keyword' && t.text === 'lambda') {
      const j = extentEnd(toks, i)
      const colon = toks.findIndex((x, k) => k > i && k < j && x.text === ':' && x.depth === t.depth)
      const params = toks.slice(i + 1, colon < 0 ? j : colon).filter((x) => x.kind === 'name').map((x) => x.text)
      const body = colon >= 0 && colon + 1 < j ? text.slice(toks[colon + 1].start, toks[j - 1].end) : ''
      const whole = text.slice(t.start, toks[j - 1].end)
      const words = body ? `a tiny function that turns ${listWords(params.map(code)) || 'nothing'} into ${sayText(body)}` : `a tiny function ${code(whole)}`
      swaps.push({ from: t.start, to: toks[j - 1].end, id: hole(whole, words, body ? { params, body } : undefined) })
      i = j
      continue
    }
    if (t.kind === 'punct' && OPENERS[t.text]) {
      const close = matching(toks, i)
      const inner = close > 0 ? toks.slice(i + 1, close) : []
      const forAt = inner.findIndex((x) => x.depth === t.depth + 1 && x.kind === 'keyword' && x.text === 'for')
      if (close > 0 && forAt > 0) {
        const prev = toks[i - 1]
        const callArg = t.text === '(' && prev && (['name', 'builtin'].includes(prev.kind) || [')', ']'].includes(prev.text))
        const hasColon = inner.slice(0, forAt).some((x) => x.depth === t.depth + 1 && x.text === ':')
        const shape = t.text === '(' ? 'gen' : t.text === '[' ? 'list' : hasColon ? 'dict' : 'set'
        const words = comprehensionWords(shape, inner, text, t.depth + 1)
        const from = callArg ? inner[0].start : t.start
        const to = callArg ? inner[inner.length - 1].end : toks[close].end
        swaps.push({ from, to, id: hole(text.slice(from, to), words) })
        i = close + 1
        continue
      }
    }
    if (t.kind === 'op' && t.text === ':=' && toks[i - 1]?.kind === 'name' && i + 1 < toks.length) {
      const j = extentEnd(toks, i)
      const name = toks[i - 1]
      const value = text.slice(toks[i + 1].start, toks[j - 1].end)
      swaps.push({ from: name.start, to: toks[j - 1].end, id: hole(text.slice(name.start, toks[j - 1].end), `${sayText(value)} (also saved in ${code(name.text)})`) })
      i = j
      continue
    }
    const next = toks[i + 1]
    if (t.kind === 'op' && (t.text === '*' || t.text === '**') && (!toks[i - 1] || ['(', ','].includes(toks[i - 1].text)) && next && ['name', 'builtin'].includes(next.kind)) {
      const words = t.text === '*' ? `every item of ${code(next.text)}` : `every named option in ${code(next.text)}`
      swaps.push({ from: t.start, to: next.end, id: hole(`${t.text}${next.text}`, words) })
      i += 2
      continue
    }
    if (t.kind === 'string' && /^[a-zA-Z]/.test(t.text)) {
      const words = /^[rR]?[fF]|^[fF][rR]/.test(t.text) ? `the text ${code(t.text)} with each {…} gap filled in` : code(t.text)
      swaps.push({ from: t.start, to: t.end, id: hole(t.text, words) })
    }
    i += 1
  }
  if (!swaps.length) return text
  let out = ''
  let at = 0
  for (const swap of swaps) {
    out += text.slice(at, swap.from) + swap.id
    at = swap.to
  }
  return out + text.slice(at)
}

function exprOf(text: string): Expr | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  try {
    return parseExpr(simplify(trimmed))
  } catch {
    return null
  }
}

function sayText(text: string) {
  const e = exprOf(text)
  return e ? say(e) : code(text.trim())
}

function isComparison(e: Expr | null) {
  return Boolean(e && e.k === 'bin' && (COMPARE_WORDS[e.op] || e.op === 'and' || e.op === 'or'))
}

function sayCondition(text: string) {
  const e = exprOf(text)
  if (!e) return `${code(text.trim())} is True`
  if (e.k === 'un' && e.op === 'not') return `${say(e.e)} is False`
  return isComparison(e) ? say(e) : `${say(e)} is True`
}

/* ───────────── Line helpers ───────────── */

function codeText(line: CodeLine, from = 0, to = line.code.length) {
  const a = line.code[from]
  const b = line.code[to - 1]
  if (!a || !b || from >= to) return ''
  return line.raw.slice(a.start, b.end)
}

/** The part of a header between its keyword and the colon (`async` is skipped). */
function headerBody(line: CodeLine) {
  const first = line.code[0]?.text === 'async' ? 2 : 1
  const last = line.code[line.code.length - 1]
  const end = last?.text === ':' ? line.code.length - 1 : line.code.length
  return codeText(line, first, end)
}

function eqIndex(line: CodeLine) {
  return line.code.findIndex((t) => t.depth === 0 && t.kind === 'op' && (t.text === '=' || /^[-+*/%]{1,2}=$/.test(t.text) || t.text === '//='))
}

function assignedNames(line: CodeLine) {
  const eq = eqIndex(line)
  return line.code
    .slice(0, eq)
    .filter((t, i, arr) => t.kind === 'name' && t.depth === 0 && arr[i - 1]?.text !== '.' && !['.', '['].includes(arr[i + 1]?.text ?? ''))
    .map((t) => t.text)
}

const isDecorator = (line: CodeLine) => line.code[0]?.text === '@'
const isAnnotation = (line: CodeLine) =>
  (line.kind === 'expr' || line.kind === 'assign') &&
  line.code[0]?.kind === 'name' &&
  line.code[1]?.text === ':' &&
  line.code[1].depth === 0 &&
  line.code.length > 2
const isTextOnly = (line: CodeLine) => line.code.length > 0 && line.code.every((t) => t.kind === 'string')

type ImportItem = { name: string; alias: string | null }

function importParts(line: CodeLine): { source: string | null; items: ImportItem[] } {
  const t = line.code
  const importAt = t.findIndex((x) => x.text === 'import')
  const source = t[0]?.text === 'from' ? t.slice(1, importAt < 0 ? t.length : importAt).map((x) => x.text).join('') : null
  if (importAt < 0) return { source, items: [] }
  const items: ImportItem[] = []
  let group: Token[] = []
  const flush = () => {
    const asAt = group.findIndex((x) => x.text === 'as')
    const name = group.slice(0, asAt < 0 ? group.length : asAt).map((x) => x.text).join('')
    if (name) items.push({ name, alias: asAt >= 0 ? group[asAt + 1]?.text ?? null : null })
    group = []
  }
  for (const tok of t.slice(importAt + 1)) {
    if (tok.text === '(' || tok.text === ')') continue
    if (tok.text === ',') flush()
    else group.push(tok)
  }
  flush()
  return { source, items }
}

type Param = { name: string; index: number; star: string; fallback: string | null; hint: [number, number] | null }

/** The parameters of a def line, with their defaults and type hints. */
function defParams(line: CodeLine): { params: Param[]; returns: string | null; hintFrom: number } {
  const t = line.code
  const nameTok = definedNameToken(line)
  const open = nameTok ? t.indexOf(nameTok) + 1 : -1
  const params: Param[] = []
  if (open <= 0 || t[open]?.text !== '(') return { params, returns: null, hintFrom: -1 }
  const close = t.findIndex((x, k) => k > open && x.text === ')' && x.depth === 0)
  const end = close < 0 ? t.length : close
  let k = open + 1
  while (k < end) {
    let j = k
    while (j < end && !(t[j].text === ',' && t[j].depth === 1)) j += 1
    const group = t.slice(k, j)
    const star = group[0]?.text === '*' || group[0]?.text === '**' ? group[0].text : ''
    const nameAt = group.findIndex((x) => x.kind === 'name')
    if (nameAt >= 0 && nameAt <= (star ? 1 : 0)) {
      const colon = group.findIndex((x) => x.text === ':' && x.depth === 1)
      const eq = group.findIndex((x) => x.text === '=' && x.depth === 1)
      params.push({
        name: group[nameAt].text,
        index: k + nameAt,
        star,
        fallback: eq >= 0 ? codeText(line, k + eq + 1, j) : null,
        hint: colon >= 0 ? [k + colon + 1, eq >= 0 ? k + eq : j] : null,
      })
    }
    k = j + 1
  }
  const arrow = t.findIndex((x, i) => i > end && x.text === '->')
  const last = t[t.length - 1]?.text === ':' ? t.length - 1 : t.length
  return { params, returns: arrow >= 0 ? codeText(line, arrow + 1, last) : null, hintFrom: arrow >= 0 ? arrow + 1 : -1 }
}

/** Token positions that are type hints (`x: int`, `-> str`). */
function typeHintIndexes(line: CodeLine): Set<number> {
  const out = new Set<number>()
  if (line.kind === 'def') {
    const { params, hintFrom } = defParams(line)
    for (const p of params) if (p.hint) for (let k = p.hint[0]; k < p.hint[1]; k += 1) out.add(k)
    if (hintFrom >= 0) for (let k = hintFrom; k < line.code.length - 1; k += 1) out.add(k)
  } else if (isAnnotation(line)) {
    const eq = line.code.findIndex((x) => x.depth === 0 && x.text === '=')
    for (let k = 2; k < (eq < 0 ? line.code.length : eq); k += 1) out.add(k)
  }
  return out
}

const TYPE_WORDS: Record<string, string> = {
  str: `text (a ${code('str')})`,
  int: `a whole number (an ${code('int')})`,
  float: `a decimal number (a ${code('float')})`,
  bool: `True or False (a ${code('bool')})`,
}

function typeWords(type: string) {
  const t = type.trim()
  if (TYPE_WORDS[t]) return TYPE_WORDS[t]
  const base = /^(list|dict|set|tuple)\b/.exec(t)?.[1]
  if (base) return `${base === 'dict' ? 'a dictionary' : `${article(base)} ${base}`} (${code(t)})`
  return `${article(t)} ${code(t)}`
}

/* ───────────── One sentence per statement ───────────── */

type LineInfo = {
  /** Nearest header (def, class, if, for…) the statement sits inside. */
  parent: CodeLine | undefined
  /** Previous statement. */
  prev: CodeLine | undefined
  /** Next statement that is not a decorator. */
  next: CodeLine | undefined
  /** Previous statement at the same indent (for else / except). */
  sibling: CodeLine | undefined
  /** Line of the enclosing def (0 for the file) — where new variables live. */
  scope: number
  /** Whether the enclosing def is a plain function or a method of a class. */
  owner: 'function' | 'method'
}

const DUNDER: Record<string, string> = {
  __len__: `when you use ${code('len()')} on the object`,
  __str__: 'when the object is printed or turned into text',
  __repr__: 'when Python needs a developer-friendly description of the object',
  __eq__: `when two objects are compared with ${code('==')}`,
  __lt__: `when two objects are compared with ${code('<')}`,
  __iter__: `when the object is used in a ${code('for')} loop`,
  __getitem__: `when you use ${code('[ ]')} on the object`,
  __call__: 'when the object is called like a function',
  __enter__: `at the start of a ${code('with')} block`,
  __exit__: `at the end of a ${code('with')} block`,
  __add__: `when you use ${code('+')} with the object`,
  __contains__: `when you use ${code('in')} with the object`,
}

function defSentence(L: CodeLine, ctx: Ctx, info: LineInfo): string {
  const name = definedNameToken(L)?.text ?? '?'
  const isAsync = L.code[0]?.text === 'async'
  const isMethod = info.parent?.kind === 'class'
  const { params, returns } = defParams(L)
  params.forEach((p) => markCreated(ctx, p.name, L.no))
  const shown = params.filter((p, k) => !(isMethod && k === 0 && (p.name === 'self' || p.name === 'cls')))
  const paramWords = shown.map((p) =>
    p.star === '*'
      ? `any number of extra values (collected in ${code(p.name)})`
      : p.star === '**'
        ? `any named options (collected in ${code(p.name)})`
        : `${code(p.name)}${p.fallback ? ` (default ${code(p.fallback)})` : ''}`,
  )
  const takes = paramWords.length ? ` that takes ${listWords(paramWords, 5)}` : ''
  const gives = returns ? ` ${takes ? 'and' : 'that'} gives back ${typeWords(returns)}` : ''
  const asyncNote = isAsync ? ` It is ${code('async')}: it can pause while it waits (for example for the internet) and let other work run.` : ''
  if (name === '__init__') {
    return `Create the special ${code('__init__')} method — Python runs it automatically every time a new object is made${paramWords.length ? `, to set it up with ${listWords(paramWords, 5)}` : ''}.`
  }
  if (/^__\w+__$/.test(name)) {
    return `Create the special method ${code(name)} — Python calls it by itself ${DUNDER[name] ?? 'at a special moment'}.${asyncNote}`
  }
  const what = isMethod ? 'method (a function that belongs to the class)' : 'function (a reusable recipe)'
  return `Create ${isAsync ? 'an async' : 'a'} ${what} called ${code(name)}${takes}${gives}. The indented lines are its steps — they only run when the ${isMethod ? 'method' : 'function'} is called.${asyncNote}`
}

function importSentence(L: CodeLine): string {
  const { source, items } = importParts(L)
  if (source === null) {
    const aliased = items.filter((i) => i.alias)
    if (items.length === 1 && aliased.length === 1) {
      return `Bring in ${code(items[0].name)} and call it ${code(items[0].alias ?? '')} — a short nickname used in the rest of the code.`
    }
    const names = items.map((i) => (i.alias ? `${code(i.name)} (as ${code(i.alias)})` : code(i.name)))
    return items.length === 1
      ? `Bring in the ${names[0]} module (a ready-made toolbox) so the code can use its tools.`
      : `Bring in the ${listWords(names, 6)} modules so the code can use their tools.`
  }
  if (source === '__future__') return `Switch on a newer Python feature (${listWords(items.map((i) => code(i.name)))}) before the rest of the code runs.`
  if (items.some((i) => i.name === '*')) return `Bring in everything from ${code(source)} so it can all be used directly by name.`
  const names = items.map((i) => (i.alias ? `${code(i.name)} (called ${code(i.alias)} here)` : code(i.name)))
  return `From ${code(source)}, bring in ${listWords(names, 6)} so ${items.length === 1 ? 'it' : 'they'} can be used directly by name.`
}

function decoratorSentence(L: CodeLine, info: LineInfo): string {
  const text = codeText(L, 1).trim()
  const name = text.replace(/\(.*$/s, '')
  const deco = code(`@${text}`)
  const target = info.next?.kind === 'class' ? 'class' : info.parent?.kind === 'class' ? 'method' : 'function'
  switch (name) {
    case 'dataclass':
    case 'dataclasses.dataclass':
      return `A decorator: ${deco} writes the boring set-up code (like ${code('__init__')}) for the class below automatically, using the fields listed inside it.`
    case 'property':
      return `A decorator: ${deco} lets you read the method below like a plain value — no brackets needed.`
    case 'staticmethod':
      return `A decorator: ${deco} makes the method below work without an object — it does not receive ${code('self')}.`
    case 'classmethod':
      return `A decorator: ${deco} makes the method below receive the class itself (${code('cls')}) instead of one object.`
    case 'cache':
    case 'lru_cache':
    case 'functools.cache':
    case 'functools.lru_cache':
      return `A decorator: ${deco} remembers the answers of the ${target} below, so repeated calls with the same inputs are instant.`
  }
  if (name.endsWith('.setter')) return `A decorator: ${deco} makes the method below run whenever a new value is assigned to ${code(name.split('.')[0])}.`
  if (known.functions.has(name)) return `A decorator: wrap the ${target} below with your function ${code(name)}, so every call to it goes through ${code(name)} first.`
  return `A decorator: ${deco} wraps the ${target} below and adds extra behaviour to it.`
}

function textSentence(L: CodeLine, info: LineInfo): string {
  const owner = info.parent && ['def', 'class'].includes(info.parent.kind) && info.prev === info.parent ? info.parent : null
  if (!info.prev || owner) {
    const of = owner ? `the ${owner.kind === 'class' ? 'class' : 'function'} ${code(definedNameToken(owner)?.text ?? '?')}` : 'the whole file'
    const quotes = /^[a-zA-Z]*("""|''')/.test(L.code[0].text) ? 'triple quotes' : 'quotes'
    return `A docstring: a description of ${of}, written in ${quotes}. Python keeps it as help text — it does not change what the code does.`
  }
  return 'A piece of text on its own line — it does nothing (sometimes it is used as a note).'
}

function annotationSentence(L: CodeLine, ctx: Ctx, info: LineInfo): string {
  const t = L.code
  const name = t[0].text
  const eq = t.findIndex((x) => x.depth === 0 && x.text === '=')
  const type = typeWords(codeText(L, 2, eq < 0 ? t.length : eq))
  const value = eq < 0 ? null : codeText(L, eq + 1).trim()
  if (info.parent?.kind === 'class') {
    const cls = definedNameToken(info.parent)?.text ?? '?'
    return `Every ${code(cls)} object has a field called ${code(name)}, which should hold ${type}.${value ? ` If none is given, it starts as ${sayText(value)}.` : ''}`
  }
  markCreated(ctx, name, info.scope)
  return value
    ? `Create a variable called ${code(name)} (it should hold ${type}) and store ${sayText(value)} in it.`
    : `Announce a variable called ${code(name)} that will hold ${type} — no value is stored yet.`
}

function keywordStatement(L: CodeLine, ctx: Ctx, info: LineInfo): string | null {
  const lead = L.code[0]
  if (lead?.kind !== 'keyword') return null
  const rest = codeText(L, 1).trim()
  switch (lead.text) {
    case 'raise': {
      if (!rest) return 'Raise the same error again, so it is not hidden.'
      const e = exprOf(rest.replace(/\s+from\s+.*$/, ''))
      if (e?.k === 'call' && e.fn.k === 'name') {
        const msg = e.args[0] ? ` with the message ${say(e.args[0])}` : ''
        return `Stop with ${article(e.fn.id)} ${code(e.fn.id)} error${msg} on purpose — the program stops here unless an except catches it.`
      }
      return `Stop with the error ${sayText(rest)} on purpose — the program stops here unless an except catches it.`
    }
    case 'assert': {
      const comma = L.code.findIndex((x) => x.depth === 0 && x.text === ',')
      const cond = comma > 0 ? codeText(L, 1, comma) : rest
      return `Check that ${sayCondition(cond)} — if not, stop with an ${code('AssertionError')}.`
    }
    case 'del':
      return `Delete ${sayText(rest)}.`
    case 'global':
    case 'nonlocal': {
      const names = L.code.slice(1).filter((x) => x.kind === 'name').map((x) => x.text)
      names.forEach((n) => markCreated(ctx, n, info.scope))
      return `Let this function change the outer variable${names.length === 1 ? '' : 's'} ${listWords(names.map(code))} instead of making a new local one.`
    }
    case 'yield':
      return rest ? `Hand out ${sayText(rest)} and pause here until the next value is asked for.` : 'Pause here until the next value is asked for.'
    case 'await':
      return `Wait for ${sayText(rest)} to finish before going on.`
    default:
      return null
  }
}

function withSentence(L: CodeLine): string {
  const t = L.code
  const from = t[0]?.text === 'async' ? 2 : 1
  const end = t[t.length - 1]?.text === ':' ? t.length - 1 : t.length
  const items: { expr: string; name: string | null }[] = []
  let k = from
  while (k < end) {
    let j = k
    while (j < end && !(t[j].text === ',' && t[j].depth === 0)) j += 1
    const asAt = t.findIndex((x, n) => n >= k && n < j && x.text === 'as' && x.depth === 0)
    items.push({ expr: codeText(L, k, asAt >= 0 ? asAt : j), name: asAt >= 0 ? t[asAt + 1]?.text ?? null : null })
    k = j + 1
  }
  const opened = items.map(({ expr, name }) => {
    const e = exprOf(expr)
    const as = name ? ` as ${code(name)}` : ''
    if (e?.k === 'call' && e.fn.k === 'name' && e.fn.id === 'open' && e.args[0]) return { file: true, text: `the file ${say(e.args[0])}${as} for ${openMode(e)}` }
    return { file: false, text: `${sayText(expr)}${as}` }
  })
  if (opened.length && opened.every((o) => o.file)) {
    return `Open ${joinAll(opened.map((o) => o.text))}, and use it in the indented lines below. It is closed automatically afterwards, even if an error happens.`
  }
  return `Use ${joinAll(opened.map((o) => o.text))} in the indented lines below; it is cleaned up automatically afterwards, even if an error happens.`
}

function exceptSentence(L: CodeLine): string {
  const t = L.code
  const asAt = t.findIndex((x) => x.text === 'as' && x.depth === 0)
  const end = asAt >= 0 ? asAt : t[t.length - 1]?.text === ':' ? t.length - 1 : t.length
  const types = t.slice(1, end).filter((x) => x.kind === 'name' || x.kind === 'builtin').map((x) => x.text)
  const name = asAt >= 0 ? t[asAt + 1]?.text : null
  const kept = name ? ` (the error is kept in ${code(name)})` : ''
  if (!types.length || types.every((x) => x === 'Exception' || x === 'BaseException')) {
    return `If any error happened in the try block, run these lines instead${kept}.`
  }
  const which = listWords(types.map((x) => `${article(x)} ${code(x)}`), 4, 'or')
  return `If ${which} happened in the try block, run these lines instead${kept}.`
}

function caseSentence(L: CodeLine): string {
  const t = L.code
  const end = t[t.length - 1]?.text === ':' ? t.length - 1 : t.length
  const ifAt = t.findIndex((x, k) => k > 0 && x.text === 'if' && x.depth === 0)
  const pattern = codeText(L, 1, ifAt > 0 ? ifAt : end).trim()
  const guard = ifAt > 0 ? codeText(L, ifAt + 1, end) : null
  if (pattern === '_') {
    return guard
      ? `For any other value, if ${sayCondition(guard)}, run the indented lines below.`
      : `Otherwise — if no pattern above fitted (${code('_')} matches anything) — run the indented lines below.`
  }
  if (/^[a-z_]\w*$/.test(pattern)) {
    return guard
      ? `Call the value ${code(pattern)}; if ${sayCondition(guard)}, run the indented lines below.`
      : `Catch any value, call it ${code(pattern)}, and run the indented lines below.`
  }
  return `If the value matches ${code(pattern)}${guard ? ` and also ${sayCondition(guard)}` : ''}, run the indented lines below.`
}

function printSentence(L: CodeLine): string {
  const t = L.code
  const e = exprOf(codeText(L))
  if (!e || e.k !== 'call') return `Show ${code(codeText(L, 2, t.length - 1))} on the screen.`
  const only = e.args.length === 1 && e.args[0].k === 'val' && typeof e.args[0].v === 'string' ? e.args[0].v : null
  if (only !== null && /^\n+$/.test(only)) return `Print a blank gap (${code('\\n')} means “new line”).`
  if (only !== null && /^(.)\1{2,}$/.test(only.trim()) && /^[-=*_~#.+]/.test(only.trim())) {
    return `Show a line of ${code(only.trim()[0])} characters on the screen — a simple underline that makes the output tidy.`
  }
  const args = e.args.map((a) => say(a))
  let text = args.length ? `Show ${listWords(args, 5)} on the screen.` : 'Print an empty line.'
  for (const [key, value] of e.kw) {
    if (key === 'sep') text += ` Put ${say(value)} between the values instead of a space.`
    if (key === 'end') text += ` Finish with ${say(value)} instead of moving to a new line.`
  }
  if (args.length > 1 && !e.kw.some(([k]) => k === 'sep')) text += ' The commas put a space between them.'
  return text
}

function callSentence(L: CodeLine): string {
  const e = exprOf(codeText(L))
  if (e?.k === 'call') {
    const s = (x: Expr) => say(x, 1)
    const args = e.args.map(s)
    if (e.fn.k === 'attr') {
      const mod = moduleOf(e.fn)
      if (mod) {
        const key = `${mod.module}.${mod.path}`
        const action = MODULE_ACTIONS[key]?.(args, e, s)
        if (action) {
          const kw = kwWords(e, s, ['figsize'])
          return `${action}${kw ? `,${kw}` : ''}.`
        }
        const value = MODULE_VALUES[key]?.(args, e, s)
        if (value) return `Work out ${value}${kwWords(e, s)}.`
        return `Use ${mod.label}'s ${code(mod.path)}${args.length ? ` with ${listWords(args)}` : ''}${kwWords(e, s)}.`
      }
      const obj = subject(e.fn.obj, s)
      const action = methodAction(e.fn.name, obj, args, e, s)
      if (action) return action
      return `Run ${code(`${unhole(render(e.fn.obj))}.${e.fn.name}()`)}${args.length ? ` with ${listWords(args)}` : ''}${kwWords(e, s)}.`
    }
    if (e.fn.k === 'name') {
      const name = e.fn.id
      if (known.functions.has(name)) {
        return `Run your function ${code(name)}${args.length ? ` with ${listWords(args)}` : ''}${kwWords(e, s)} — Python jumps into its steps and comes back here afterwards.`
      }
      if (known.classes.has(name) || /^[A-Z]/.test(name)) return `Create a new ${code(name)} object${args.length ? ` from ${listWords(args)}` : ''}${kwWords(e, s)} (it is not stored anywhere).`
      return `Use ${code(`${name}()`)}${args.length ? ` with ${listWords(args)}` : ''}${kwWords(e, s)}.`
    }
  }
  return e ? `Work out ${say(e)}.` : `Python runs ${code(L.text)}.`
}

function assignSentence(L: CodeLine, ctx: Ctx, info: LineInfo): string {
  const t = L.code
  const eq = eqIndex(L)
  const left = codeText(L, 0, eq).trim()
  const right = codeText(L, eq + 1).trim()
  const rightExpr = exprOf(right)
  const names = assignedNames(L)
  const target = names.length === 1 && left === names[0] ? names[0] : null
  const promptOf = (call: Expr | undefined) => (call?.k === 'call' && call.args[0] ? ` (the screen shows ${say(call.args[0])})` : '')
  const mark = () => names.forEach((n) => markCreated(ctx, n, info.scope))
  if (rightExpr?.k === 'call' && rightExpr.fn.k === 'name') {
    const fn = rightExpr.fn.id
    const inner = rightExpr.args[0]
    if (fn === 'input') {
      mark()
      return `Ask the user to type something${promptOf(rightExpr)} and store their answer, as text, in ${code(left)}.`
    }
    if ((fn === 'int' || fn === 'float') && inner?.k === 'call' && inner.fn.k === 'name' && inner.fn.id === 'input') {
      mark()
      return `Ask the user to type something${promptOf(inner)}, turn the answer into a ${fn === 'int' ? 'whole' : 'decimal'} number, and store it in ${code(left)}.`
    }
  }
  const value = rightExpr ? say(rightExpr) : sayText(right)
  if (!target) {
    if (names.length > 1) {
      mark()
      const star = t.findIndex((x, k) => k < eq && x.depth === 0 && x.text === '*')
      if (star >= 0) {
        const rest = t[star + 1]?.text
        const parts = names.map((n) => (n === rest ? `${code(n)} (which collects all the leftover items as a list)` : code(n)))
        return `Unpack ${value} into ${listWords(parts, 6)}.`
      }
      const split = rightExpr?.k === 'call' && rightExpr.fn.k === 'name' && rightExpr.fn.id === 'train_test_split' ? rightExpr : null
      if (split) {
        const s = (x: Expr) => say(x, 1)
        const kw = kwWords(split, s)
        return `Split ${listWords(split.args.map(s))} into training and testing parts${kw ? ` (${kw.trim()})` : ''}, and store the pieces in ${listWords(names.map(code), 6)} — one each.`
      }
      return `Work out ${value}, then unpack it into ${listWords(names.map(code), 6)} — one value each.`
    }
    if (left.startsWith('self.')) return `Set ${code(left)} (a value kept inside the object) to ${value}.`
    const leftExpr = exprOf(left)
    return `Change ${leftExpr ? say(leftExpr) : code(left)} to ${value}.`
  }
  const existed = isCreated(ctx, target, info.scope)
  markCreated(ctx, target, info.scope)
  const maker = rightExpr?.k === 'call' && rightExpr.fn.k === 'name' ? rightExpr.fn.id : null
  const knownValue = maker !== null && known.imported.has(maker) && IMPORTED_VALUES[maker]
  if (rightExpr?.k === 'call' && maker && !knownValue && (known.classes.has(maker) || /^[A-Z]/.test(maker)) && !known.functions.has(maker)) {
    const s = (x: Expr) => say(x, 1)
    const args = rightExpr.args.map(s)
    const made = `${args.length ? ` from ${listWords(args)}` : ''}${kwWords(rightExpr, s)}`
    return `Create a new ${code(maker)} object${made}${isLong(made) ? ',' : ''} and store it in ${code(target)}${existed ? ' (replacing the old value)' : ''}.`
  }
  if (existed) return `Change the value of ${code(target)} to ${value}.`
  return isLong(value)
    ? `Create a variable called ${code(target)}. It holds ${value}.`
    : `Create a variable called ${code(target)} and store ${value} in it.`
}

function sentenceFor(L: CodeLine, ctx: Ctx, info: LineInfo): string {
  const t = L.code
  if (isDecorator(L)) return decoratorSentence(L, info)
  if (isTextOnly(L)) return textSentence(L, info)
  if (isAnnotation(L)) return annotationSentence(L, ctx, info)
  const keyword = keywordStatement(L, ctx, info)
  if (keyword) return keyword
  switch (L.kind) {
    case 'assign':
      return assignSentence(L, ctx, info)
    case 'aug': {
      const eq = eqIndex(L)
      const left = codeText(L, 0, eq).trim()
      const right = codeText(L, eq + 1).trim()
      const op = t[eq].text
      const value = sayText(right)
      const same = `(same as ${code(`${left} = ${left} ${op.slice(0, -1)} ${right}`)})`
      switch (op) {
        case '+=': return `Add ${value} to ${code(left)} ${same}.`
        case '-=': return `Take ${value} away from ${code(left)} ${same}.`
        case '*=': return `Multiply ${code(left)} by ${value} ${same}.`
        case '/=': return `Divide ${code(left)} by ${value} ${same}.`
        default: return `Update ${code(left)} using ${code(op)} and ${value} ${same}.`
      }
    }
    case 'print':
      return printSentence(L)
    case 'call':
    case 'expr':
      return callSentence(L)
    case 'if':
      return `Check whether ${sayCondition(headerBody(L))}. If yes, run the indented lines below it.`
    case 'elif':
      return `Otherwise, check whether ${sayCondition(headerBody(L))}. If yes, run the indented lines below it.`
    case 'else':
      switch (info.sibling?.kind) {
        case 'for':
        case 'while':
          return 'When the loop finishes normally (without break), run the indented lines below.'
        case 'try':
        case 'except':
          return 'If no error happened in the try block, run the indented lines below.'
        default:
          return 'Otherwise — if none of the checks above were True — run the indented lines below.'
      }
    case 'for': {
      const from = t[0]?.text === 'async' ? 1 : 0
      const inAt = t.findIndex((x) => x.text === 'in')
      const targets = t.slice(from + 1, inAt).filter((x) => x.kind === 'name').map((x) => x.text)
      targets.forEach((n) => markCreated(ctx, n, info.scope))
      const iterText = codeText(L, inAt + 1, t[t.length - 1]?.text === ':' ? t.length - 1 : t.length)
      const iter = exprOf(iterText)
      const isRange = iter?.k === 'call' && iter.fn.k === 'name' && iter.fn.id === 'range'
      const holder = targets.length > 1 ? `${listWords(targets.map(code))} hold the current pair` : `${code(targets[0] ?? '?')} holds the current ${isRange ? 'number' : 'item'}`
      if (iter?.k === 'call' && isRange) {
        return `Repeat the indented lines once for each of ${rangeWords(iter.args, (x) => say(x))}. Each round, ${holder}.`
      }
      const group = iter ? say(iter) : code(iterText)
      return `Go through ${group}${group.length > 40 ? ',' : ''} one item at a time. Each round, ${holder} and the indented lines run.`
    }
    case 'while': {
      const cond = headerBody(L)
      return cond.trim() === 'True'
        ? 'Repeat the indented lines forever — until something inside uses break to stop it.'
        : `Keep repeating the indented lines as long as ${sayCondition(cond)}.`
    }
    case 'def':
      return defSentence(L, ctx, info)
    case 'return': {
      const rest = codeText(L, 1)
      return rest ? `Hand back the ${info.owner}'s answer: ${sayText(rest)}. The ${info.owner} ends here.` : `Leave the ${info.owner} right here.`
    }
    case 'break':
      return 'Stop the loop right now and jump to the line after it.'
    case 'continue':
      return 'Skip the rest of this round and start the next round of the loop.'
    case 'pass':
      return 'Do nothing — pass just fills a space where Python needs a line.'
    case 'import':
      return importSentence(L)
    case 'class': {
      const name = definedNameToken(L)?.text ?? '?'
      const open = t.findIndex((x) => x.text === '(')
      const bases = open >= 0 ? t.slice(open + 1).filter((x) => x.depth === 1 && (x.kind === 'name' || x.kind === 'builtin')).map((x) => code(x.text)) : []
      return `Create a class (a blueprint for objects) called ${code(name)}${bases.length ? ` that builds on ${listWords(bases)}` : ''}. The indented lines describe what every ${code(name)} object has and can do.`
    }
    case 'try':
      return 'Try the indented lines — if an error happens, jump to except instead of crashing.'
    case 'except':
      return exceptSentence(L)
    case 'finally':
      return 'Always run these lines at the end, error or not.'
    case 'with':
      return withSentence(L)
    case 'match':
      return `Look at ${sayText(headerBody(L))} and compare it with each ${code('case')} below, from top to bottom — only the first pattern that fits runs.`
    case 'case':
      return caseSentence(L)
    default:
      return `Python runs ${code(L.text)}.`
  }
}

/* ───────────── Word by word ───────────── */

const KEYWORD_MEANING: Record<string, string> = {
  if: 'asks a question (a condition). The lines under it run only when the answer is True.',
  elif: 'short for “else if”: when the checks above were False, ask this new question.',
  else: '“otherwise”: these lines run when no check above was True.',
  for: 'starts a loop that repeats once for every item in a group.',
  while: 'starts a loop that keeps repeating while its condition stays True.',
  def: 'defines (creates) a new function — a named, reusable set of steps.',
  return: 'sends a value back out of the function and ends the function.',
  True: 'the “yes / on” value.',
  False: 'the “no / off” value.',
  None: 'means “nothing here” — no value at all.',
  and: 'joins two checks: BOTH must be True.',
  or: 'joins two checks: at least ONE must be True.',
  not: 'flips the answer: True becomes False, False becomes True.',
  break: 'stops the loop immediately.',
  continue: 'skips to the next round of the loop.',
  pass: 'does nothing — a placeholder line.',
  import: 'brings in a ready-made module (a toolbox of code).',
  from: 'says which module to take tools from.',
  as: 'gives something a shorter / second name.',
  class: 'creates a class — a blueprint for making objects.',
  try: 'starts a block that might cause an error.',
  except: 'catches the error from the try block.',
  finally: 'runs at the end no matter what.',
  with: 'opens something and closes it automatically afterwards.',
  lambda: 'makes a tiny one-line function.',
  is: 'checks whether two things are the very same object.',
  global: 'lets a function change a variable from outside it.',
  nonlocal: 'lets an inner function change a variable of the function around it.',
  del: 'deletes a name or an item.',
  raise: 'causes an error on purpose.',
  assert: 'checks that something is True and stops with an error if it is not.',
  yield: 'hands out one value and pauses the function until the next value is wanted.',
  async: 'marks something that can pause while it waits (for example for the internet).',
  await: 'waits here until the async work on its right has finished.',
}

const BUILTIN_MEANING: Record<string, string> = {
  print: 'shows something on the screen.',
  input: 'pauses, lets the user type, and gives back what they typed — always as text.',
  len: 'counts how many items (or letters) something has.',
  range: 'makes a run of numbers, e.g. range(3) gives 0, 1, 2.',
  int: 'turns a value into a whole number.',
  float: 'turns a value into a decimal number.',
  str: 'turns a value into text.',
  bool: 'turns a value into True or False.',
  list: 'makes a list.',
  dict: 'makes a dictionary.',
  tuple: 'makes a tuple (a list that cannot change).',
  set: 'makes a set (a group with no repeats).',
  type: 'tells you what kind of value something is.',
  sum: 'adds up all the numbers in a group.',
  max: 'picks the biggest value.',
  min: 'picks the smallest value.',
  abs: 'removes the minus sign from a number.',
  round: 'rounds a number.',
  sorted: 'gives a sorted copy, smallest first.',
  reversed: 'goes through the items backwards.',
  enumerate: 'gives each item together with its position number.',
  zip: 'pairs up items from two groups.',
  map: 'applies a function to every item of a group.',
  filter: 'keeps only the items a function says yes to.',
  isinstance: 'checks whether a value is of a certain type.',
  open: 'opens a file.',
  super: 'reaches the parent class, so its version of a method can run.',
  property: 'turns a method into a value you can read without brackets.',
}

const METHOD_MEANING: Record<string, string> = {
  append: 'adds one item to the end of a list.',
  insert: 'puts an item at a chosen position in a list.',
  remove: 'removes the first matching item from a list.',
  pop: 'takes an item out (the last one, unless you give a position).',
  sort: 'sorts the list itself, smallest first.',
  reverse: 'flips the order of the list.',
  clear: 'empties the whole thing.',
  extend: 'adds every item of another list.',
  count: 'counts how many times something appears.',
  index: 'finds the position of an item.',
  copy: 'makes a copy.',
  upper: 'gives the text in CAPITAL letters.',
  lower: 'gives the text in small letters.',
  strip: 'removes spaces from both ends of the text.',
  title: 'Capitalises Each Word.',
  capitalize: 'capitalises the first letter.',
  split: 'cuts text into a list of pieces.',
  join: 'glues a list of texts together.',
  replace: 'swaps one piece of text for another.',
  find: 'finds where a piece of text starts.',
  startswith: 'checks how the text begins.',
  endswith: 'checks how the text ends.',
  isdigit: 'checks if the text is only digits.',
  format: 'fills the {} gaps in the text.',
  keys: 'gives all the keys of a dictionary.',
  values: 'gives all the values of a dictionary.',
  items: 'gives all key–value pairs of a dictionary.',
  get: 'reads a key safely (no error if it is missing).',
  update: 'adds or changes several pairs at once.',
  add: 'adds an item to a set.',
  fit: 'trains the model — it learns from the data you give it.',
  fit_transform: 'learns from the data and transforms it in one step.',
  transform: 'changes the data using what was learned earlier.',
  predict: 'makes predictions for new data.',
}

const MODULE_FN_MEANING: Record<string, string> = {
  sum: 'adds up all the values.',
  mean: 'works out the average.',
  cumsum: 'gives running totals: each value added to all the ones before it.',
  array: 'makes a numpy array (a fast list of numbers).',
  time: 'gives the current time in seconds.',
  sleep: 'pauses the program for a while.',
  figure: 'starts a new chart.',
  plot: 'draws a line chart.',
  scatter: 'draws a scatter chart.',
  xlabel: 'writes the label under the x-axis.',
  ylabel: 'writes the label beside the y-axis.',
  title: 'gives the chart a title.',
  grid: 'draws grid lines on the chart.',
  legend: 'adds a key that explains each line.',
  show: 'shows the finished chart.',
  join: 'joins pieces into one file path.',
  dump: 'saves data into a file as JSON text.',
  load: 'reads data from a file.',
  randint: 'picks a random whole number.',
  choice: 'picks a random item.',
  sqrt: 'works out the square root.',
}

const OP_MEANING: Record<string, string> = {
  '=': 'stores the value on the right into the name on the left.',
  '==': 'asks: are these two equal?',
  '!=': 'asks: are these two different?',
  '<': 'asks: is the left side smaller?',
  '>': 'asks: is the left side bigger?',
  '<=': 'asks: is the left side smaller or equal?',
  '>=': 'asks: is the left side bigger or equal?',
  '+': 'adds numbers (or joins two texts).',
  '-': 'subtracts.',
  '*': 'multiplies.',
  '/': 'divides (the answer is a decimal).',
  '//': 'divides and keeps only the whole-number part.',
  '%': 'gives the remainder after dividing.',
  '**': 'raises to the power (2 ** 3 = 2 × 2 × 2).',
  '+=': 'adds to the value already stored.',
  '-=': 'subtracts from the value already stored.',
  '*=': 'multiplies the value already stored.',
  '/=': 'divides the value already stored.',
  ':=': 'the walrus operator: stores a value in a name AND hands it on, right inside the expression.',
  '->': 'points to the type of value the function gives back.',
  '@': 'starts a decorator — it wraps the function or class below with extra behaviour.',
}

type WordCtx = { ctx: Ctx; scope: number; hints: Set<number>; params: Set<number>; method: boolean; inlineLoopVars: Set<string> }

/** Names that comprehensions in this line loop over: `n` in `[n * 2 for n in nums]`. */
function inlineLoopVars(t: Token[]) {
  const out = new Set<string>()
  t.forEach((x, k) => {
    if (k === 0 || x.kind !== 'keyword' || x.text !== 'for') return
    for (let j = k + 1; j < t.length && t[j].text !== 'in'; j += 1) if (t[j].kind === 'name') out.add(t[j].text)
  })
  return out
}

/** Is token `i` inside a comprehension or generator (a `for` earlier at the same bracket depth)? */
function afterInlineFor(t: Token[], i: number) {
  for (let k = i - 1; k >= 0; k -= 1) {
    if (t[k].depth < t[i].depth) return false
    if (t[k].depth === t[i].depth && t[k].kind === 'keyword' && t[k].text === 'for' && k > 0) return true
  }
  return false
}

function colonMeaning(line: CodeLine, i: number, w: WordCtx): string {
  const t = line.code
  const tok = t[i]
  if (i === t.length - 1 && HEADER_KINDS.has(line.kind)) return 'the colon ends the header — the indented lines below belong to it.'
  if (w.hints.has(i + 1) || (isAnnotation(line) && i === 1)) return 'separates a name from its type hint.'
  for (let k = i - 1; k >= 0; k -= 1) {
    if (t[k].depth === tok.depth && t[k].text === ':') break
    if (t[k].depth === tok.depth && t[k].text === 'lambda') return 'separates the lambda’s inputs from the value it gives back.'
    if (t[k].depth < tok.depth) break
  }
  for (let k = i - 1; k >= 0; k -= 1) {
    if (t[k].depth === tok.depth - 1 && OPENERS[t[k].text]) {
      if (t[k].text === '{') return 'separates a key from its value.'
      if (t[k].text === '[') return 'separates the start and end of a slice.'
      break
    }
  }
  return 'a colon.'
}

function wordMeaning(line: CodeLine, i: number, w: WordCtx): string {
  const { ctx } = w
  const t = line.code
  const tok = t[i]
  const prev = t[i - 1]
  const next = t[i + 1]
  const eq = eqIndex(line)
  if (w.hints.has(i) && ['name', 'builtin'].includes(tok.kind)) return 'part of a type hint — it says what kind of value is expected (Python does not check it).'
  switch (tok.kind) {
    case 'keyword': {
      if (tok.text === 'in') {
        if (line.kind === 'for' && t.findIndex((x) => x.text === 'in') === i) return 'means “taken from” — it tells the loop which group to walk through.'
        if (afterInlineFor(t, i) && !t.slice(0, i).some((x) => x.depth === tok.depth && x.text === 'if')) return 'means “taken from” — it says which group to walk through.'
        return 'asks: is the left side inside the right side?'
      }
      if (tok.text === 'not' && next?.text === 'in') return 'together with “in”: is it NOT inside?'
      if (i > 0 && tok.text === 'for') return 'inside brackets, for builds the new collection by walking through a group.'
      if (i > 0 && tok.text === 'if' && line.kind !== 'elif' && line.kind !== 'case') {
        return afterInlineFor(t, i) ? 'keeps only the items for which this check is True.' : 'a one-line choice: value_if_true if condition else value_if_false.'
      }
      if (i > 0 && tok.text === 'if' && line.kind === 'case') return 'a guard: the pattern only counts if this check is also True.'
      if (i > 0 && tok.text === 'else') return 'gives the value to use when the condition is False.'
      if (tok.text === 'as' && line.kind === 'with') return 'gives the opened thing a name to use inside the block.'
      if (tok.text === 'as' && line.kind === 'except') return 'keeps the error in a name, so you can look at it.'
      if (tok.text === 'as' && line.kind === 'import') return 'gives the module or tool a shorter nickname.'
      return KEYWORD_MEANING[tok.text] ?? 'a Python keyword (a word with a special job).'
    }
    case 'builtin':
      return `a built-in function that ${BUILTIN_MEANING[tok.text] ?? 'Python already knows.'}`
    case 'name': {
      if (prev?.text === '.') {
        if (line.kind === 'import') return 'part of the module name — the dot points to a smaller module inside a bigger package.'
        const module = ctx.modules.get(t[i - 2]?.text ?? '')
        if (module && next?.text === '(') return `a function from the ${module} module. It ${MODULE_FN_MEANING[tok.text] ?? 'does one ready-made job.'}`
        if (next?.text === '(') return `a method (an action that belongs to the value before the dot). It ${METHOD_MEANING[tok.text] ?? 'does a job for that value.'}`
        return 'an attribute — a value stored inside the thing before the dot.'
      }
      if (line.kind === 'import') {
        if (prev?.text === 'as') return 'the short nickname used for it in the rest of the code.'
        const importAt = t.findIndex((x) => x.text === 'import')
        if (t[0].text === 'from') return i < importAt ? 'the module (toolbox) to take things from.' : 'a tool (a function, class or value) taken from that module.'
        return 'the module (toolbox) to bring in.'
      }
      if (tok === definedNameToken(line) && (line.kind === 'def' || line.kind === 'class')) {
        if (line.kind === 'class') return 'the name of the new class — calling it, like Name(), makes a new object.'
        return w.method ? 'the name of the new method — you call it on an object, like obj.name().' : 'the name of the new function — you use this name to call it later.'
      }
      if (line.kind === 'class' && tok.depth === 1) return 'a class this one builds on — it inherits its abilities.'
      if (w.params.has(i)) {
        return tok.text === 'self'
          ? 'a parameter: self is the object itself — every method receives it first.'
          : 'a parameter — a placeholder that receives the value you pass in when you call the function.'
      }
      if (tok.text === 'self') return 'the object itself — inside a method, self means “this object”.'
      if (line.kind === 'match' && i === 0) return 'starts a match: compare one value against several patterns.'
      if (line.kind === 'case' && i === 0) return 'one pattern to try — its lines run if the value fits.'
      if (line.kind === 'case' && tok.text === '_') return 'the wildcard: it matches anything (like else).'
      if (isDecorator(line) && i === 1) return 'the decorator — the function that wraps the definition below.'
      if (line.kind === 'for' && i < t.findIndex((x) => x.text === 'in')) return 'the loop variable — each round it holds the current item.'
      if (prev?.kind === 'keyword' && prev.text === 'for') return 'the loop variable — it holds each item in turn.'
      if (tok.depth > 0 && w.inlineLoopVars.has(tok.text)) return 'the loop variable of the comprehension — it holds each item in turn.'
      if (next?.text === ':=') return 'a name that receives a value right inside the expression (with :=).'
      if (prev?.text === 'lambda' || (prev?.text === ',' && t.slice(0, i).some((x) => x.text === 'lambda') && t.slice(t.findIndex((x) => x.text === 'lambda'), i).every((x) => x.text !== ':'))) {
        return 'the input of the tiny lambda function.'
      }
      if (isAnnotation(line) && i === 0) return 'the name being declared — the part after the colon is its type hint.'
      if (tok.depth > 0 && next?.text === '=') return 'the name of an option (a keyword argument) — the value after = is passed in under this name.'
      if (eq >= 0 && i < eq && tok.depth === 0 && !['.', '['].includes(next?.text ?? '')) {
        return isCreated(ctx, tok.text, w.scope) ? 'the variable that receives a new value.' : 'a new variable — a labelled box that will keep the value.'
      }
      if (ctx.modules.has(tok.text) && next?.text === '.') {
        const module = ctx.modules.get(tok.text)
        return `the ${module} module${module !== tok.text ? ` (nicknamed ${tok.text})` : ''} — the dot picks a tool from it.`
      }
      if (ctx.classes.has(tok.text)) return next?.text === '(' ? 'your class — calling it makes a new object.' : 'your class.'
      if (ctx.imported.has(tok.text)) return `a tool imported from ${ctx.imported.get(tok.text)}${next?.text === '(' ? ' — the brackets call it.' : '.'}`
      if (next?.text === '(') return ctx.functions.has(tok.text) ? 'calls your own function (runs its steps).' : 'calls a function with this name.'
      return isCreated(ctx, tok.text, w.scope) ? 'reads the value stored in this variable.' : 'a name that Python must already know.'
    }
    case 'number':
      return /[.eE]/.test(tok.text) ? 'a decimal number (a float).' : 'a whole number (an int).'
    case 'string': {
      if (/^[rR]?[fF]|^[fF][rR]/.test(tok.text)) return 'an f-string: text where every {…} gap is filled with a value.'
      if (/^[a-zA-Z]*("""|''')/.test(tok.text)) return 'text in triple quotes — it can run over several lines (often used as a docstring).'
      return stringContent(tok.text) ? 'text (a string). The quotes mark where the text starts and ends.' : 'an empty text — nothing between the quotes.'
    }
    case 'op': {
      if (tok.text === '=' && tok.depth > 0) return line.kind === 'def' ? 'gives the parameter a default value, used when nothing is passed in.' : 'connects the option name to its value.'
      if (tok.text === '-' && (!prev || prev.kind === 'op' || ['(', '[', ',', '='].includes(prev.text))) return 'makes the number negative.'
      if ((tok.text === '*' || tok.text === '**') && (!prev || ['(', ','].includes(prev.text))) {
        if (line.kind === 'def') {
          if (next?.text === ',' || next?.text === ')') return 'everything after this must be passed by name (keyword-only).'
          return tok.text === '*' ? 'collects any number of extra values into one tuple.' : 'collects any extra named options into a dictionary.'
        }
        if (eq >= 0 && i < eq) return 'collects all the leftover items into a list.'
        return tok.text === '*' ? 'unpacks: passes every item along separately.' : 'unpacks: passes every key–value pair along as a named option.'
      }
      if (tok.text === '@' && i > 0) return 'multiplies matrices.'
      return OP_MEANING[tok.text] ?? 'an operator.'
    }
    case 'punct':
      switch (tok.text) {
        case '(':
          if (line.kind === 'def' && prev === definedNameToken(line)) return 'opens the list of parameters.'
          if (line.kind === 'class') return 'opens the list of classes this one builds on.'
          return prev && (['name', 'builtin'].includes(prev.kind) || [')', ']'].includes(prev.text)) ? 'opens the brackets — the inputs for the function go inside.' : 'groups things together (worked out first).'
        case ')':
          return 'closes the round brackets.'
        case '[':
          if (w.hints.has(i)) return 'part of the type hint — the brackets say what is inside (list[str] means a list of texts).'
          return prev && (['name', 'builtin', 'string'].includes(prev.kind) || [')', ']'].includes(prev.text))
            ? 'picks one item by its position (index) or key.'
            : 'starts a list.'
        case ']':
          return 'closes the square brackets.'
        case '{':
          return t.slice(i + 1).find((x) => x.depth === tok.depth + 1 && (x.text === ':' || x.text === ',' || x.text === 'for'))?.text === ':' || t[i + 1]?.text === '}'
            ? 'starts a dictionary — pairs of key: value.'
            : 'starts a set — a group with no repeats.'
        case '}':
          return 'closes the curly brackets.'
        case ':':
          return colonMeaning(line, i, w)
        case ',':
          return 'separates one item from the next.'
        case '.':
          return line.kind === 'import' ? 'separates a package from a smaller module inside it.' : 'the dot means “use something that belongs to” the value on its left.'
        case '\\':
          return 'the backslash says: this statement continues on the next line.'
        default:
          return 'punctuation.'
      }
    default:
      return 'a symbol Python does not understand here.'
  }
}

function wordsForStatement(L: CodeLine, physical: CodeLine[], ctx: Ctx, scope: number, method: boolean): WordInfo[] {
  const words: WordInfo[] = []
  if (L.indent > 0) {
    words.push({ text: '⇥', kind: 'indent', meaning: `${L.indent} spaces of indent — this line belongs inside the block above it.` })
  }
  const w: WordCtx = {
    ctx,
    scope,
    hints: typeHintIndexes(L),
    params: new Set(L.kind === 'def' ? defParams(L).params.map((p) => p.index) : []),
    method,
    inlineLoopVars: inlineLoopVars(L.code),
  }
  L.code.forEach((tok, i) => words.push({ text: tok.text, kind: tok.kind, meaning: wordMeaning(L, i, w) }))
  if (physical.length > 1 && physical.some((l) => l.code[l.code.length - 1]?.text === '\\')) {
    words.push({ text: '\\', kind: 'punct', meaning: 'the backslash says: this statement continues on the next line.' })
  }
  for (const l of physical) if (l.comment) words.push({ text: l.comment, kind: 'comment', meaning: 'a comment — Python ignores everything after #.' })
  return words
}

/* ───────────── Banner comments ───────────── */

const SEPARATOR = /^[-=*#_~]{5,}$/
const isSeparator = (line: CodeLine) => line.kind === 'comment' && SEPARATOR.test((line.comment ?? '').replace(/^#/, '').trim())
const commentText = (line: CodeLine) => (line.comment ?? '').replace(/^#+/, '').trim()

const ACRONYMS = new Set([
  'I', 'AI', 'ML', 'PCA', 'API', 'CSV', 'JSON', 'SQL', 'HTTP', 'URL', 'ID', 'UI', 'CPU', 'GPU', 'KNN', 'SVM', 'LDA', 'NLP', 'CNN',
  'RNN', 'OS', 'IO', 'PDF', 'XML', 'HTML', 'SVD', 'MSE', 'RMSE', 'MAE', 'ROC', 'AUC', 'EDA', 'OOP', 'GUI', 'CLI',
])

function sentenceCase(text: string, acronyms: Set<string>) {
  const fixed = /[a-z]/.test(text) ? text : text.toLowerCase().replace(/[a-z0-9_]+/g, (w) => (acronyms.has(w.toUpperCase()) ? w.toUpperCase() : w))
  return fixed.charAt(0).toUpperCase() + fixed.slice(1)
}

const LABEL = /^(part|step|section|chapter|stage|phase|task)\s*(\d+|[ivx]+|[a-z])\b\s*[:.)\-–—]?\s*/i
const NUMBERING = /^(\d+(\.\d+)*[.):\-–—]|[a-z][.)])\s+/i

function cleanTitle(texts: string[], acronyms: Set<string>) {
  let parts = texts.map((x) => x.trim()).filter(Boolean)
  if (parts.length > 1) parts = parts.filter((p) => p.replace(LABEL, '').trim() !== '')
  parts = parts.map((p) => p.replace(LABEL, '').replace(NUMBERING, '').trim() || p)
  if (!parts.length) return { title: null, subtitle: null }
  return {
    title: sentenceCase(parts[0], acronyms),
    subtitle: parts.length > 1 ? sentenceCase(parts.slice(1).join(' '), acronyms) : null,
  }
}

type Banner = { start: number; end: number; title: string | null; note: string | null }

/** Comment boxes such as `# =====` / `# PART A: Train` / `# =====` that split a long program into parts. */
function findBanners(lines: CodeLine[], base: number, acronyms: Set<string>): Banner[] {
  const banners: Banner[] = []
  let i = 0
  while (i < lines.length) {
    const first = lines[i]
    if (first.kind !== 'comment' || first.continuation || first.indent > base) {
      i += 1
      continue
    }
    let j = i
    while (j < lines.length && lines[j].kind === 'comment' && !lines[j].continuation) j += 1
    const run = lines.slice(i, j)
    const seps = run.map((l, k) => (isSeparator(l) ? k : -1)).filter((k) => k >= 0)
    if (seps.length) {
      const a = seps[0]
      const b = seps[seps.length - 1]
      const titleLines = seps.length >= 2 ? run.slice(a + 1, b) : a > 0 ? run.slice(0, a) : run.slice(1)
      const noteLines = seps.length >= 2 || a > 0 ? run.slice(b + 1) : []
      const { title, subtitle } = cleanTitle(titleLines.filter((l) => !isSeparator(l)).map(commentText), acronyms)
      const note = [subtitle, ...noteLines.map(commentText)].filter(Boolean).join(' ')
      banners.push({ start: run[0].no, end: run[run.length - 1].no, title, note: note || null })
    }
    i = j
  }
  return banners
}

/* ───────────── Sections ───────────── */

const SECTION_LOOK: Record<SectionKind, { icon: string; title: string; chain: string; tip: string }> = {
  setup: { icon: '📦', title: 'Store the values', chain: 'Store', tip: 'The name is always on the LEFT of =, the value on the RIGHT.' },
  input: { icon: '⌨️', title: 'Ask the user', chain: 'Ask', tip: 'input() always gives text. Wrap it in int() or float() before doing maths.' },
  output: { icon: '🖥️', title: 'Show the result', chain: 'Show', tip: 'print() shows values on the screen. Commas inside print() add a space between values.' },
  action: { icon: '⚙️', title: 'Change the data', chain: 'Change', tip: 'A method is called with a dot and brackets: thing.method().' },
  call: { icon: '📞', title: 'Use the function', chain: 'Call', tip: 'Calling a function = its name + round brackets, with the inputs inside.' },
  decision: { icon: '🚦', title: 'Make a decision', chain: 'Decide', tip: 'Python checks from top to bottom and runs only the FIRST block whose answer is True.' },
  loop: { icon: '🔁', title: 'Repeat for each item', chain: 'Repeat', tip: 'The loop variable changes by itself every round — you never update it.' },
  while: { icon: '🔄', title: 'Repeat while true', chain: 'Repeat', tip: 'Something inside a while loop must change, otherwise it never stops.' },
  function: { icon: '🧰', title: 'Define a function', chain: 'Define', tip: 'def only writes the recipe. Nothing runs until you call the function.' },
  import: { icon: '📥', title: 'Bring in tools', chain: 'Import', tip: 'Imports go at the very top of the program.' },
  class: { icon: '🏗️', title: 'Define a class', chain: 'Build', tip: 'A class is a blueprint; objects are made from it.' },
  try: { icon: '🛟', title: 'Try safely', chain: 'Try', tip: 'try/except stops an error from crashing the whole program.' },
  with: { icon: '📂', title: 'Open and use', chain: 'Open', tip: 'with closes things automatically for you.' },
  other: { icon: '✳️', title: 'Extra step', chain: 'Do', tip: 'Read the line slowly, word by word.' },
}

const FOLLOWERS: Partial<Record<string, string[]>> = {
  if: ['elif', 'else'],
  elif: ['elif', 'else'],
  for: ['else'],
  while: ['else'],
  try: ['except', 'else', 'finally'],
  except: ['except', 'else', 'finally'],
}

/** Most simple parts hold at most this many statements, so each part stays easy to learn. */
const GROUP_CAP = 6

function headerSectionKind(line: CodeLine): SectionKind {
  switch (line.kind) {
    case 'if':
    case 'match':
      return 'decision'
    case 'for': return 'loop'
    case 'while': return 'while'
    case 'def': return 'function'
    case 'class': return 'class'
    case 'try': return 'try'
    case 'with': return 'with'
    default: return 'other'
  }
}

function simpleSectionKind(line: CodeLine, functions: Set<string>): SectionKind {
  if (isTextOnly(line) || isDecorator(line)) return 'other'
  switch (line.kind) {
    case 'assign':
    case 'aug':
      return line.code.some((t) => t.text === 'input') ? 'input' : 'setup'
    case 'print':
      return 'output'
    case 'import':
      return 'import'
    case 'call':
    case 'expr':
      return line.code[0] && functions.has(line.code[0].text) ? 'call' : 'action'
    default:
      return 'other'
  }
}

const statementKind = (line: CodeLine, functions: Set<string>) =>
  HEADER_KINDS.has(line.kind) ? headerSectionKind(line) : simpleSectionKind(line, functions)

function namesOf(lines: CodeLine[], kind: 'assign' | 'aug') {
  return [...new Set(lines.filter((l) => l.kind === kind && !l.continuation && !isAnnotation(l)).flatMap(assignedNames))]
}

/** The thing a statement calls, e.g. `model.fit` or `plt.show`. */
function calleeOf(line: CodeLine) {
  const open = line.code.findIndex((t) => t.text === '(')
  return open > 0 ? line.code.slice(0, open).map((t) => t.text).join('') : null
}

function sectionTitle(kind: SectionKind, lines: CodeLine[], ctx: Ctx): string {
  const heads = lines.filter((l) => isCodeLine(l) && !l.continuation)
  const first = heads.find((l) => !isDecorator(l))
  if (!first) return SECTION_LOOK[kind].title
  switch (kind) {
    case 'setup': {
      const created = namesOf(heads, 'assign')
      const updated = namesOf(heads, 'aug')
      const store = created.length === 1 ? `Store a value in ${code(created[0])}` : `Store values in ${listWords(created.map(code))}`
      if (created.length && updated.length) return `${store} and update ${listWords(updated.map(code))}`
      if (updated.length) return `Update ${listWords(updated.map(code))}`
      return created.length ? store : SECTION_LOOK.setup.title
    }
    case 'input': {
      const names = namesOf(heads, 'assign')
      return `Ask the user for ${listWords(names.map(code)) || 'input'}`
    }
    case 'function':
      return `Define the function ${code(definedNameToken(first)?.text ?? '?')}`
    case 'class':
      return `Define the class ${code(definedNameToken(first)?.text ?? '?')}`
    case 'call':
      return `Run the function ${code(first.code[0]?.text ?? '?')}`
    case 'loop': {
      const inAt = first.code.findIndex((t) => t.text === 'in')
      const from = first.code[0]?.text === 'async' ? 2 : 1
      return `Repeat for each ${code(first.code.slice(from, inAt).map((t) => t.text).join(''))}`
    }
    case 'decision':
      return first.kind === 'match' ? `Match ${code(headerBody(first))} against patterns` : SECTION_LOOK.decision.title
    case 'action': {
      const roots = [...new Set(heads.map((l) => l.code[0]?.text))]
      if (roots.length === 1 && roots[0] && heads.every((l) => l.code[1]?.text === '.')) {
        return ctx.modules.get(roots[0]) === PLT ? 'Draw the chart' : `Work with ${code(roots[0])}`
      }
      return SECTION_LOOK.action.title
    }
    case 'other':
      return isTextOnly(first) ? 'Describe the code (docstring)' : SECTION_LOOK.other.title
    default:
      return SECTION_LOOK[kind].title
  }
}

/** The names an import section makes available (`np`, `load_breast_cancer`…); `__future__` switches are not tools. */
function importedTools(heads: CodeLine[], lines: CodeLine[]) {
  return heads
    .filter((l) => l.kind === 'import')
    .flatMap((l) => {
      const { source, items } = importParts(logicalLine(lines, l))
      return source === '__future__' ? [] : items.map((i) => code(i.alias ?? i.name))
    })
}

function sectionSummary(kind: SectionKind, heads: CodeLine[], sentences: Map<number, string>, lines: CodeLine[]): string {
  const head = heads.find((l) => !isDecorator(l)) ?? heads[0]
  if (!head) return ''
  const names = namesOf(heads, 'assign')
  switch (kind) {
    case 'setup':
      return heads.length <= 2 || heads.some((l) => l.kind !== 'assign')
        ? heads.map((l) => sentences.get(l.no)).join(' ')
        : `Make ${plural(names.length, 'labelled box', 'labelled boxes')} (${listWords(names.map(code))}) and put a value in each one, so the program can use them later.`
    case 'input':
      return `The program pauses and lets the user type. Their answer is kept in ${listWords(names.map(code)) || 'a variable'}.`
    case 'output':
      return heads.length === 1 ? sentences.get(head.no) ?? '' : `Show ${plural(heads.length, 'line')} of results on the screen with print().`
    case 'import': {
      if (heads.length <= 2) return heads.map((l) => sentences.get(l.no)).join(' ')
      return `Bring in ready-made tools — ${listWords(importedTools(heads, lines), 8)} — so the rest of the program can use them.`
    }
    case 'decision': {
      if (head.kind === 'match') {
        const cases = heads.filter((l) => l.kind === 'case' && l.indent === Math.min(...heads.filter((h) => h.kind === 'case').map((h) => h.indent))).length
        return `Compare one value with ${plural(cases, 'pattern')} (the case lines). Only the first pattern that fits runs.`
      }
      const count = heads.filter((l) => l.indent === head.indent && ['if', 'elif', 'else'].includes(l.kind)).length
      if (count === 1) return 'Ask one yes/no question. If the answer is True, the indented lines run; if it is False, Python skips them.'
      return `Choose between ${plural(count, 'path')}. Python asks the questions from top to bottom and runs only the first path whose answer is True${heads.some((l) => l.kind === 'else' && l.indent === head.indent) ? ' — or the else path if none are' : ''}.`
    }
    case 'loop':
    case 'while':
      return sentences.get(head.no) ?? ''
    case 'function':
      return `${sentences.get(head.no) ?? ''} It has ${plural(heads.filter((l) => l.no > head.no).length, 'step')} inside.`
    case 'class': {
      const inside = heads.filter((l) => l.no > head.no && l.indent > head.indent)
      const body = inside.length ? Math.min(...inside.map((l) => l.indent)) : 0
      const fields = inside.filter((l) => l.indent === body && isAnnotation(l)).map((l) => code(l.code[0].text))
      const methods = inside.filter((l) => l.indent === body && l.kind === 'def').map((l) => code(definedNameToken(l)?.text ?? '?'))
      const parts = [
        fields.length ? `${plural(fields.length, 'field')} (${listWords(fields)})` : '',
        methods.length ? `${plural(methods.length, 'method')} (${listWords(methods)})` : '',
      ].filter(Boolean)
      return `${sentences.get(head.no) ?? ''}${parts.length ? ` It has ${joinAll(parts)}.` : ''}`
    }
    default:
      return heads.map((l) => sentences.get(l.no)).filter(Boolean).slice(0, 2).join(' ')
  }
}

/** A few clauses that sum up a long part (used for banner parts). */
function partSummary(heads: CodeLine[], base: number, lines: CodeLine[], ctx: Ctx): string {
  const top = heads.filter((l) => l.indent <= base)
  const clauses: string[] = []
  const add = (when: unknown, text: string) => {
    if (when) clauses.push(text)
  }
  const names = (group: CodeLine[]) => listWords(group.map((l) => code(definedNameToken(l)?.text ?? '?')))

  const tools = importedTools(top, lines)
  add(tools.length, `brings in ${listWords(tools, 10)}`)
  const defs = top.filter((l) => l.kind === 'def')
  add(defs.length, `defines ${defs.length === 1 ? 'the function' : 'the functions'} ${names(defs)}`)
  const classes = top.filter((l) => l.kind === 'class')
  add(classes.length, `builds ${classes.length === 1 ? 'the class' : 'the classes'} ${names(classes)}`)

  const objects: string[] = []
  const made = new Set<string>()
  const stored: string[] = []
  for (const l of top.filter((x) => (x.kind === 'assign' || x.kind === 'aug') && !isAnnotation(x))) {
    const L = logicalLine(lines, l)
    const targets = assignedNames(L)
    const value = exprOf(codeText(L, eqIndex(L) + 1))
    const maker = value?.k === 'call' && value.fn.k === 'name' ? value.fn.id : null
    if (L.kind === 'assign' && targets.length === 1 && maker && (ctx.classes.has(maker) || /^[A-Z]/.test(maker))) {
      objects.push(`a new ${code(maker)} object (${code(targets[0])})`)
      made.add(targets[0])
    } else stored.push(...targets)
  }
  add(objects.length, `creates ${listWords(objects, 3)}`)

  const calls = top.filter((l) => (l.kind === 'call' || l.kind === 'expr') && !isDecorator(l) && !isTextOnly(l))
  const trained = calls.filter((l) => /\.fit$/.test(calleeOf(l) ?? ''))
  add(trained.length, `trains ${listWords([...new Set(trained.map((l) => code(l.code[0].text)))])}`)
  const unique = [...new Set(stored)].filter((n) => !made.has(n))
  add(unique.length, `stores values in ${listWords(unique.map(code), 5)}`)
  const charts = calls.filter((l) => ctx.modules.get(l.code[0]?.text ?? '') === PLT)
  const others = calls.filter((l) => !charts.includes(l) && !trained.includes(l))
  const callees = [...new Set(others.map(calleeOf).filter((c): c is string => Boolean(c)))]
  add(callees.length, `runs ${listWords(callees.map((c) => code(`${c}()`)), 4)}`)
  add(charts.length, `draws a chart in ${plural(charts.length, 'step')}`)
  const decisions = top.filter((l) => l.kind === 'if' || l.kind === 'match')
  add(decisions.length, decisions.length === 1 ? 'makes a decision' : `makes ${decisions.length} decisions`)
  const loops = top.filter((l) => l.kind === 'for' || l.kind === 'while')
  add(loops.length, loops.length === 1 ? 'repeats some steps in a loop' : `repeats steps in ${loops.length} loops`)
  add(top.some((l) => l.kind === 'try'), 'guards against errors with try/except')
  add(top.some((l) => l.kind === 'with'), 'opens and uses something with a with block')
  const prints = top.filter((l) => l.kind === 'print')
  add(prints.length, `shows ${prints.length === 1 ? 'one line' : `${prints.length} lines`} on the screen`)
  return clauses.length ? `This part ${joinClauses(clauses)}.` : ''
}

type RawSection = { kind: SectionKind; start: number; end: number; note: string | null; title?: string; banner?: boolean }

function appendNote(note: string | null, text: string) {
  if (!text) return note
  const joined = note ? `${note} · ${text}` : text
  return joined.length > 200 ? `${joined.slice(0, 197)}…` : joined
}

/** Splits a stretch of code into small parts: one per block (if, for, def…) and runs of similar lines. */
function groupLines(lines: CodeLine[], from: number, to: number, base: number, ctx: Ctx): RawSection[] {
  const raw: RawSection[] = []
  const range = lines.filter((l) => l.no >= from && l.no <= to)
  let note: { text: string; start: number } | null = null
  let decoStart: number | null = null
  let group: (RawSection & { size: number; root: string | null }) | null = null
  const close = () => {
    if (group) raw.push({ kind: group.kind, start: group.start, end: group.end, note: group.note })
    group = null
  }
  const takeNote = () => {
    const taken = note
    note = null
    return taken
  }

  let i = 0
  while (i < range.length) {
    const line = range[i]
    if (line.kind === 'blank' || line.continuation) {
      i += 1
      continue
    }
    if (line.kind === 'comment') {
      if (line.indent <= base && !isSeparator(line)) {
        const text = commentText(line)
        note = note ? { text: appendNote(note.text, text) ?? '', start: note.start } : { text, start: line.no }
      }
      i += 1
      continue
    }
    if (isDecorator(line) && line.indent <= base) {
      close()
      decoStart ??= takeNote()?.start ?? line.no
      i += 1
      continue
    }
    if (HEADER_KINDS.has(line.kind) && line.indent <= base) {
      close()
      let j = i + 1
      let lastKind = line.kind as string
      while (j < range.length) {
        const next = range[j]
        if (next.kind === 'blank' || next.kind === 'comment' || next.continuation || next.indent > base) {
          j += 1
          continue
        }
        if (FOLLOWERS[lastKind]?.includes(next.kind)) {
          lastKind = next.kind
          j += 1
          continue
        }
        break
      }
      let end = j
      while (end > i + 1 && !isCodeLine(range[end - 1])) end -= 1
      const pending = takeNote()
      raw.push({ kind: headerSectionKind(line), start: decoStart ?? pending?.start ?? line.no, end: range[end - 1].endNo, note: pending?.text || null })
      decoStart = null
      i = end
      continue
    }
    const kind = simpleSectionKind(line, ctx.functions)
    const root = line.code[1]?.text === '.' ? line.code[0].text : null
    const pending = takeNote()
    const g = group as (RawSection & { size: number; root: string | null }) | null
    // Imports and runs of calls on one object (plt.…, model.…) stay together however long they are.
    const roomy = kind === 'import' || (root !== null && g?.root === root)
    if (g && g.kind === kind && (roomy || g.size < GROUP_CAP) && decoStart === null) {
      g.end = line.endNo
      g.size += 1
      g.note = appendNote(g.note, pending?.text ?? '')
      if (g.root !== root) g.root = null
    } else {
      close()
      group = { kind, start: decoStart ?? pending?.start ?? line.no, end: line.endNo, size: 1, note: pending?.text || null, root }
      decoStart = null
    }
    i += 1
  }
  close()
  return raw
}

function dominantKind(heads: CodeLine[], base: number, functions: Set<string>): SectionKind {
  const score = new Map<SectionKind, number>()
  for (const l of heads) {
    if (l.indent > base || isDecorator(l)) continue
    const kind = statementKind(l, functions)
    score.set(kind, (score.get(kind) ?? 0) + (kind === 'output' ? 0.5 : 1))
  }
  let best: SectionKind = 'other'
  let top = 0
  for (const [kind, n] of score) {
    if (n > top) {
      best = kind
      top = n
    }
  }
  return best
}

function buildSections(lines: CodeLine[], sentences: Map<number, string>, ctx: Ctx): { sections: Section[]; programTitle: string | null } {
  const heads = lines.filter((l) => isCodeLine(l) && !l.continuation)
  if (heads.length === 0) return { sections: [], programTitle: null }
  const base = Math.min(...heads.map((l) => l.indent))
  const acronyms = new Set([...ACRONYMS, ...heads.flatMap((l) => l.code.filter((t) => /^[A-Z][A-Z0-9]+$/.test(t.text)).map((t) => t.text))])
  const banners = findBanners(lines, base, acronyms)
  let raw: RawSection[] = []
  let programTitle: string | null = null

  if (banners.filter((b) => b.title).length >= 2) {
    raw = groupLines(lines, 1, banners[0].start - 1, base, ctx)
    banners.forEach((banner, k) => {
      const to = k + 1 < banners.length ? banners[k + 1].start - 1 : lines.length
      const body = heads.filter((l) => l.no > banner.end && l.no <= to)
      if (!body.length) {
        if (k === 0 && raw.length === 0 && banner.title) programTitle = banner.title
        return
      }
      raw.push({
        kind: dominantKind(body, base, ctx.functions),
        start: banner.start,
        end: Math.max(...body.map((l) => l.endNo)),
        note: banner.note,
        title: banner.title ?? undefined,
        banner: true,
      })
    })
  } else {
    raw = groupLines(lines, 1, lines.length, base, ctx)
  }

  const sections = raw.map((r, index): Section => {
    const sectionLines = lines.filter((l) => l.no >= r.start && l.no <= r.end)
    const look = SECTION_LOOK[r.kind]
    const sectionHeads = sectionLines.filter((l) => isCodeLine(l) && !l.continuation)
    const head = sectionHeads.find((l) => !isDecorator(l)) ?? sectionHeads[0]
    const summary = (r.banner && partSummary(sectionHeads, base, lines, ctx)) || sectionSummary(r.kind, sectionHeads, sentences, lines)
    const steps = sectionHeads
      .map((l) => ({ no: l.no, depth: Math.max(0, Math.round((l.indent - base) / 4)), text: sentences.get(l.no) ?? '' }))
      .filter((step, i) => !(i === 0 && sectionHeads.length > 1 && summary.startsWith(step.text)))
    const branchLines =
      r.kind !== 'decision' || !head
        ? []
        : head.kind === 'match'
          ? sectionHeads.filter((l) => l.kind === 'case')
          : sectionHeads.filter((l) => l.indent === head.indent && ['if', 'elif', 'else'].includes(l.kind))
    return {
      index,
      kind: r.kind,
      icon: look.icon,
      title: r.title ?? sectionTitle(r.kind, sectionLines, ctx),
      note: r.note,
      start: r.start,
      end: r.end,
      code: sectionLines.map((l) => l.raw).join('\n'),
      lines: sectionLines,
      summary,
      steps,
      tip: look.tip,
      branches: branchLines.map((l) => logicalLine(lines, l).text.replace(/:\s*(#.*)?$/, '')),
      ...(r.banner ? { banner: true } : {}),
    }
  })
  return { sections, programTitle }
}

/* ───────────── Big picture ───────────── */

const CONNECTORS = ['Then', 'Next', 'After that']

const IN_SHORT: Record<SectionKind, string> = {
  setup: 'stores some values',
  input: 'asks the user to type something',
  output: 'shows results on the screen',
  action: 'changes the data',
  call: 'runs a function',
  decision: 'makes a decision',
  loop: 'repeats some steps',
  while: 'repeats some steps',
  function: 'creates a reusable function',
  import: 'brings in some tools',
  class: 'builds a class',
  try: 'protects itself from errors',
  with: 'opens and uses a resource',
  other: 'does an extra step',
}

function processText(section: Section): string {
  if (section.banner) return section.summary
  const heads = section.lines.filter((l) => isCodeLine(l) && !l.continuation)
  const names = namesOf(heads, 'assign')
  switch (section.kind) {
    case 'setup': {
      const updated = namesOf(heads, 'aug')
      const make = names.length
        ? `Python makes ${names.length === 1 ? 'a box' : `${names.length} boxes`} (${listWords(names.map(code))}) in memory and stores a value in ${names.length === 1 ? 'it' : 'each one'}.`
        : ''
      const update = updated.length ? ` It updates the value in ${listWords(updated.map(code))}.` : ''
      return (make + update).trim() || section.summary
    }
    case 'input':
      return `The program stops and waits. The user types an answer and presses Enter. Python saves it in ${listWords(names.map(code)) || 'a variable'}.`
    case 'output':
      return `Python works out what is inside print() and shows it on the screen${heads.length > 1 ? `, one line for each of the ${heads.length} prints` : ''}.`
    case 'call':
      return `Python jumps into the recipe ${code(heads[0]?.code[0]?.text ?? '?')}, runs its steps with the values given, and then comes back to continue.`
    case 'decision':
      return 'Python checks the conditions one by one from the top. As soon as one is True, it runs that path and skips all the others.'
    case 'loop':
      return `${section.summary} When there are no items left, the loop ends and Python moves on.`
    case 'while':
      return 'Python checks the condition. If it is True, it runs the inner steps and goes back up to check again. When it becomes False, the loop ends.'
    case 'function': {
      const head = heads.find((l) => l.kind === 'def')
      return `Python reads the recipe ${code(head ? definedNameToken(head)?.text ?? '?' : '?')} and remembers it for later. Nothing inside runs yet.`
    }
    case 'class': {
      const head = heads.find((l) => l.kind === 'class')
      return `Python reads the blueprint ${code(head ? definedNameToken(head)?.text ?? '?' : '?')} and remembers it. Objects are only made later, when the class is called.`
    }
    default:
      return section.summary
  }
}

function buildOverview(sections: Section[], programTitle: string | null): Overview {
  let inShort: string
  if (!sections.length) {
    inShort = 'This code has no instructions yet.'
  } else if (sections.some((s) => s.banner)) {
    const titles = sections.map((s, i) => `(${i + 1}) ${s.title.replace(/[.?!:]+$/, '')}`)
    const shown = titles.length > 12 ? [...titles.slice(0, 11), `and ${titles.length - 11} more`] : titles
    inShort = `In short, this program works in ${sections.length} parts: ${shown.join(', ')}.`
  } else {
    const isDocstring = (s: Section) => s.lines.filter(isCodeLine).every(isTextOnly)
    const parts = [...new Set(sections.filter((s) => !isDocstring(s)).map((s) => IN_SHORT[s.kind]))]
    const shown = parts.length > 5 ? [...parts.slice(0, 4), 'does a few more things'] : parts
    inShort = `In short, this program ${joinAll(shown)}.`
  }
  if (programTitle) inShort = `**${programTitle.replace(/[.:]+$/, '')}.** ${inShort}`

  // Long programs without banners: fold neighbouring parts of the same kind into one step.
  const merge = !sections.some((s) => s.banner) && sections.length > 12
  const groups: Section[][] = []
  for (const section of sections) {
    const last = groups[groups.length - 1]
    if (merge && last && last[0].kind === section.kind) last.push(section)
    else groups.push([section])
  }
  const steps: OverviewStep[] = groups.map((group, i) => {
    const [section] = group
    const connector = i === 0 ? 'First' : i === groups.length - 1 && groups.length > 2 ? 'Finally' : CONNECTORS[(i - 1) % CONNECTORS.length]
    const more = group.length > 1 ? ` (and ${plural(group.length - 1, 'similar part')})` : ''
    return {
      icon: section.icon,
      title: `${connector}: ${section.title}${more}`,
      text: processText(section),
      branches: section.branches,
      repeats: section.kind === 'loop' || section.kind === 'while',
    }
  })
  steps.push({ icon: '🏁', title: 'The end', text: 'Python reaches the last line and the program finishes.', branches: [], repeats: false })
  return {
    inShort,
    steps,
    flowNote:
      'Python always reads from the top line to the bottom line, one line at a time — except when an if skips some lines, a loop jumps back up, or a function is called.',
  }
}

/* ───────────── How to remember ───────────── */

const HOOKS: Record<string, MemoryHook> = {
  import: { icon: '🧰', title: 'import borrows a toolbox', text: 'import numpy as np = borrow the numpy toolbox and stick the short label np on it.' },
  variable: { icon: '📦', title: 'A variable is a labelled box', text: 'name = value → write the label, drop the value inside. The label always goes on the LEFT.' },
  print: { icon: '📢', title: 'print() is a loudspeaker', text: 'Whatever you put inside print( ) gets announced on the screen.' },
  input: { icon: '🎤', title: 'input() is a microphone', text: 'It listens to the user and always hands you TEXT. Numbers need int( ) around it.' },
  method: { icon: '🛎️', title: 'The dot asks an object to do a job', text: 'model.fit(...) means “model, please fit”. The thing before the dot does the work.' },
  multiline: { icon: '🧵', title: 'Open brackets keep the line going', text: 'Python keeps reading the next lines until every ( [ { is closed — one statement can span many lines.' },
  if: { icon: '🚦', title: 'if is a traffic light', text: 'Green (True) → drive into the block. Red (False) → skip it. elif and else are the next lights on the road.' },
  for: { icon: '🎵', title: 'for is a playlist', text: 'It plays every song (item) one after another. The loop variable is the song playing right now.' },
  range: { icon: '✋', title: 'range stops one early', text: 'range(5) counts fingers from 0: 0, 1, 2, 3, 4. Five numbers — but never 5 itself.' },
  while: { icon: '🧺', title: 'while is a washing machine', text: 'It keeps spinning WHILE the clothes are dirty. Something inside must change, or it spins forever.' },
  def: { icon: '🧾', title: 'def writes a recipe card', text: 'Writing a recipe does not cook anything. Calling name() is when the cooking happens.' },
  class: { icon: '🍪', title: 'A class is a cookie cutter', text: 'The class is the cutter; every object made with ClassName() is a cookie with its own values.' },
  return: { icon: '🎁', title: 'return hands back a gift', text: 'The function wraps up its answer and hands it back to whoever called it.' },
  list: { icon: '🚃', title: 'A list is a train', text: 'Each carriage holds one item. Carriages are numbered from 0, and [ ] are the tracks.' },
  dict: { icon: '📒', title: 'A dictionary is a phone book', text: 'Look up a name (the key) to find the number (the value): { key: value }.' },
  comment: { icon: '🗒️', title: '# is a sticky note', text: 'Notes for humans. Python never reads them.' },
  fstring: { icon: '📝', title: 'An f-string is a form with blanks', text: 'f"Hi {name}" — Python fills every {blank} with the value of that name.' },
  compare: { icon: '⚖️', title: '= stores, == asks', text: 'One = is an instruction ("put this here"). Two == is a question ("are these equal?").' },
  math: { icon: '🧮', title: 'Python is a calculator', text: '+ - * / work like maths. // keeps the whole part, % gives the remainder.' },
  block: { icon: '🚪', title: 'The colon opens a door', text: 'A line ending in : opens a door. The indented lines below are the room behind that door.' },
  stop: { icon: '🛑', title: 'break = exit, continue = skip', text: 'break walks out of the loop. continue skips to the next round.' },
}

const SILLY_NOUNS: Record<string, string[]> = {
  A: ['Ants', 'Astronauts'], B: ['Bears', 'Bunnies'], C: ['Cats', 'Cows'], D: ['Dogs', 'Ducks'],
  I: ['Iguanas', 'Insects'], O: ['Owls', 'Otters'], R: ['Rabbits', 'Robots'], S: ['Snakes', 'Squirrels'],
  T: ['Tigers', 'Turtles'],
}
const SILLY_VERBS: Record<string, string[]> = {
  A: ['Admire', 'Avoid'], B: ['Bake', 'Borrow'], C: ['Chase', 'Cook'], D: ['Draw', 'Dance'],
  I: ['Invite', 'Ignore'], O: ['Order', 'Open'], R: ['Ride', 'Read'], S: ['Sing', 'Steal'],
  T: ['Tickle', 'Teach'],
}

function sillySentence(words: string[]) {
  const used: Record<string, number> = {}
  return words
    .map((w, i) => {
      const letter = w[0].toUpperCase()
      const options = (i % 2 === 0 ? SILLY_NOUNS : SILLY_VERBS)[letter]
      const n = used[letter] ?? 0
      used[letter] = n + 1
      return options ? options[n % options.length] : w
    })
    .join(' ')
}

const MAX_HOOKS = 8
const MAX_CHAIN = 8
const MAX_SKELETON = 60
const MAX_READ_ALOUD = 30

function buildRemember(lines: CodeLine[], sections: Section[], sentences: Map<number, string>, logical: Map<number, CodeLine>): RememberGuide {
  const codeLines = lines.filter(isCodeLine)
  const heads = codeLines.filter((l) => !l.continuation)
  const tokens = codeLines.flatMap((l) => l.code)
  const has = (text: string) => tokens.some((t) => t.text === text)
  const kinds = new Set(heads.map((l) => l.kind))
  const multiline = heads.some((l) => l.endNo > l.no)
  const hookKeys: string[] = []
  if (kinds.has('import')) hookKeys.push('import')
  if (kinds.has('assign')) hookKeys.push('variable')
  if (has('input')) hookKeys.push('input')
  if (has('print')) hookKeys.push('print')
  if (kinds.has('class')) hookKeys.push('class')
  if (kinds.has('def')) hookKeys.push('def')
  if (kinds.has('if')) hookKeys.push('if')
  if (kinds.has('for')) hookKeys.push('for')
  if (kinds.has('while')) hookKeys.push('while')
  if (heads.some((l) => l.kind === 'call' && l.code[1]?.text === '.')) hookKeys.push('method')
  if (multiline) hookKeys.push('multiline')
  if (tokens.some((t) => ['==', '!='].includes(t.text)) || kinds.has('if')) hookKeys.push('compare')
  if (has('range')) hookKeys.push('range')
  if (kinds.has('return')) hookKeys.push('return')
  if (kinds.has('break') || kinds.has('continue')) hookKeys.push('stop')
  if (tokens.some((t) => t.text === '[') || codeLines.some((l) => l.code.some((t) => ['append', 'insert', 'pop'].includes(t.text)))) hookKeys.push('list')
  if (tokens.some((t) => t.text === '{') || has('items') || has('keys') || has('get')) hookKeys.push('dict')
  if (tokens.some((t) => t.kind === 'string' && /^[rR]?[fF]/.test(t.text))) hookKeys.push('fstring')
  if (tokens.some((t) => t.kind === 'op' && ['+', '-', '*', '/', '//', '%', '**'].includes(t.text))) hookKeys.push('math')
  if (heads.some((l) => HEADER_KINDS.has(l.kind))) hookKeys.push('block')
  if (lines.some((l) => l.kind === 'comment' || l.comment)) hookKeys.push('comment')

  let chainWords: string[] = []
  for (const section of sections) {
    const word = SECTION_LOOK[section.kind].chain
    if (chainWords[chainWords.length - 1] !== word) chainWords.push(word)
  }
  if (chainWords.length > MAX_CHAIN) chainWords = [...new Set(chainWords)].slice(0, MAX_CHAIN)

  const rules: string[] = []
  if (heads.some((l) => HEADER_KINDS.has(l.kind))) rules.push('Every line that ends with a colon ( : ) opens a block — indent the lines inside it by 4 spaces.')
  if (tokens.some((t) => t.kind === 'string')) rules.push('Text always sits inside matching quotes: "like this" or \'like this\'.')
  if (kinds.has('if') || has('==')) rules.push('One = stores a value. Two == compare values.')
  if (has('input')) rules.push('input() gives text — use int(input()) when you need a number.')
  if (has('range')) rules.push('range(n) gives n numbers, starting from 0 and stopping before n.')
  if (kinds.has('def')) rules.push('Define a function (def) before the line that calls it.')
  if (kinds.has('import')) rules.push('Import a tool before you use it — imports usually sit at the very top.')
  if (multiline) rules.push('A statement may continue over several lines while a bracket is still open — close every ( [ { you open.')
  if (tokens.some((t) => t.text === '[')) rules.push('List positions start at 0, not 1.')
  if (tokens.some((t) => t.text === '{')) rules.push('In a dictionary the key comes before the colon and the value after it.')
  rules.push('Python is case-sensitive: print is correct, Print is not.')

  const skeletonRows = heads.map((l) => skeletonLine(logical.get(l.no) ?? l))
  const skeleton =
    skeletonRows.length > MAX_SKELETON
      ? [...skeletonRows.slice(0, MAX_SKELETON), `# … ${plural(skeletonRows.length - MAX_SKELETON, 'more statement')} — see “Section by section” for each part`].join('\n')
      : skeletonRows.join('\n')

  const readAloud =
    heads.length > MAX_READ_ALOUD && sections.length > 1
      ? sections.map((s) => ({ no: s.start, text: `**${s.title}** — ${s.summary}` }))
      : heads.map((l) => ({ no: l.no, text: sentences.get(l.no) ?? '' }))

  const practice = [
    chainWords.length > 1 ? `Say the memory chain out loud: ${chainWords.join(' → ')}.` : 'Say out loud what the code does in one sentence.',
    ...(sections.length > 6 ? ['Learn one part at a time — master it, then add the next part.'] : []),
    'Cover the code and write only the skeleton — the shape with blanks.',
    'Fill the blanks with the names, numbers and text.',
    'Compare with the original section by section and fix what is different.',
  ]

  return {
    hooks: hookKeys.slice(0, MAX_HOOKS).map((k) => HOOKS[k]),
    skeleton,
    chain: {
      words: chainWords,
      acronym: chainWords.map((w) => w[0]).join(''),
      silly: sillySentence(chainWords),
    },
    rules: rules.slice(0, 7),
    readAloud,
    practice,
  }
}

/* ───────────── Entry point ───────────── */

function computeParents(lines: CodeLine[]) {
  const parents = new Map<number, CodeLine>()
  const stack: CodeLine[] = []
  for (const l of lines) {
    if (l.continuation || !isCodeLine(l)) continue
    while (stack.length && stack[stack.length - 1].indent >= l.indent) stack.pop()
    if (stack.length) parents.set(l.no, stack[stack.length - 1])
    if (HEADER_KINDS.has(l.kind)) stack.push(l)
  }
  return parents
}

function learnProgram(lines: CodeLine[], parents: Map<number, CodeLine>): Ctx {
  const ctx = emptyCtx()
  for (const l of lines) {
    if (l.continuation || !isCodeLine(l)) continue
    if (l.kind === 'def' || l.kind === 'class') {
      const name = definedNameToken(l)?.text
      // Methods are called with a dot, so only plain functions count as "your function".
      if (name && l.kind === 'class') ctx.classes.add(name)
      else if (name && parents.get(l.no)?.kind !== 'class') ctx.functions.add(name)
    }
    if (l.kind === 'import') {
      const { source, items } = importParts(logicalLine(lines, l))
      for (const item of items) {
        if (item.name === '*') continue
        if (source !== null) ctx.imported.set(item.alias ?? item.name, source)
        else if (item.alias) ctx.modules.set(item.alias, item.name)
        else ctx.modules.set(item.name.split('.')[0], item.name.split('.')[0])
      }
    }
  }
  return ctx
}

/** The source lines of a statement or comment block, without the indent of its first line. */
function shownCode(block: CodeLine[]) {
  const pad = block[0]?.indent ?? 0
  return block.map((l) => (l.raw.slice(0, pad).trim() === '' ? l.raw.slice(pad) : l.raw.trimStart())).join('\n')
}

function commentWordLine(block: CodeLine[]): WordLine {
  const titles = block.filter((l) => !isSeparator(l)).map(commentText).filter(Boolean)
  const separator = block.find(isSeparator)
  const sentence = separator
    ? titles.length
      ? `A banner comment — a decorated note that marks the start of a new part: “${titles.join(' — ')}”. Python skips comments.`
      : `A divider line made of ${code(commentText(separator)[0] ?? '-')} characters — it only helps humans see where parts start and end. Python skips it.`
    : `A note for humans: “${titles.join(' ')}”. Python skips it.`
  return {
    no: block[0].no,
    code: shownCode(block),
    words: block.map((l) => ({
      text: l.comment ?? '#',
      kind: 'comment' as const,
      meaning: isSeparator(l)
        ? 'a divider line — decoration that makes the note stand out.'
        : commentText(l)
          ? 'a comment — Python ignores everything after #.'
          : 'an empty comment line — just spacing.',
    })),
    sentence,
    isComment: true,
    ...(block.length > 1 ? { endNo: block[block.length - 1].no } : {}),
  }
}

export function explainCode(source: string): CodeExplanation {
  const lines = analyzeLines(source)
  const parents = computeParents(lines)
  const ctx = learnProgram(lines, parents)
  known = ctx
  holes = new Map()
  holeCount = 0

  const heads = lines.filter((l) => isCodeLine(l) && !l.continuation)
  const logical = new Map(heads.map((h) => [h.no, logicalLine(lines, h)] as const))
  const scopeOf = (line: CodeLine) => {
    let p = parents.get(line.no)
    while (p && p.kind !== 'def') p = parents.get(p.no)
    return p?.no ?? 0
  }

  const sentences = new Map<number, string>()
  const words: WordLine[] = []
  let headAt = 0
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.kind === 'blank' || line.continuation) {
      i += 1
      continue
    }
    if (line.kind === 'comment') {
      let j = i + 1
      while (j < lines.length && lines[j].kind === 'comment' && !lines[j].continuation && lines[j].indent === line.indent) j += 1
      words.push(commentWordLine(lines.slice(i, j)))
      i = j
      continue
    }
    const L = logical.get(line.no) ?? line
    const prev = heads[headAt - 1]
    const next = heads.slice(headAt + 1).find((h) => !isDecorator(h))
    const sibling = heads.slice(0, headAt).reverse().find((h) => h.indent <= line.indent)
    headAt += 1
    const scope = scopeOf(line)
    const owner = scope && parents.get(scope)?.kind === 'class' ? 'method' : 'function'
    const info: LineInfo = { parent: parents.get(line.no), prev, next, sibling: sibling?.indent === line.indent ? sibling : undefined, scope, owner }
    const physical = lines.filter((l) => l.no >= line.no && l.no <= line.endNo)
    const wordCtx: Ctx = { ...ctx, created: new Set(ctx.created) }
    const sentence = sentenceFor(L, ctx, info)
    sentences.set(line.no, sentence)
    words.push({
      no: line.no,
      code: shownCode(physical),
      words: wordsForStatement(L, physical, wordCtx, L.kind === 'def' ? line.no : scope, info.parent?.kind === 'class'),
      sentence,
      isComment: false,
      ...(line.endNo > line.no ? { endNo: line.endNo } : {}),
    })
    i += 1
  }

  const { sections, programTitle } = buildSections(lines, sentences, ctx)
  return {
    code: source,
    lines,
    words,
    sections,
    overview: buildOverview(sections, programTitle),
    remember: buildRemember(lines, sections, sentences, logical),
  }
}

/* ───────────── Hints for retyping ───────────── */

export type SectionHint = { label: string; text: string; isCode: boolean }

export function sectionHints(section: Section): SectionHint[] {
  const codeOnly = section.lines.filter(isCodeLine)
  const firstWords = codeOnly
    .map((l) => {
      const shown = l.code.slice(0, Math.min(2, l.code.length)).map((t) => t.text).join(' ')
      return `${' '.repeat(l.indent)}${shown} …`
    })
    .join('\n')
  return [
    { label: 'What it does', text: section.summary, isCode: false },
    { label: 'The shape', text: codeOnly.map((l) => skeletonLine(l)).join('\n'), isCode: true },
    { label: 'First words', text: firstWords, isCode: true },
    { label: 'Show me this part', text: codeOnly.map((l) => l.raw).join('\n'), isCode: true },
  ]
}

export function tokenMeaning(text: string): string | null {
  if (KEYWORD_MEANING[text]) return `${code(text)} ${KEYWORD_MEANING[text]}`
  if (BUILTIN_MEANING[text]) return `${code(`${text}()`)} ${BUILTIN_MEANING[text]}`
  if (METHOD_MEANING[text]) return `${code(`.${text}()`)} ${METHOD_MEANING[text]}`
  if (OP_MEANING[text]) return `${code(text)} ${OP_MEANING[text]}`
  return null
}
