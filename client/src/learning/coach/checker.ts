import type { ErrorCategory } from '../../utils/lessonProgress'
import { findSimulationError } from '../miniPython'
import {
  BUILTINS,
  HEADER_KINDS,
  KEYWORDS,
  analyzeLines,
  closest,
  definedNameToken,
  isCodeLine,
  logicalLine,
  replaceToken,
  type CodeLine,
  type LineKind,
  type Token,
} from './lexer'

export type Issue = {
  id: string
  line: number
  category: ErrorCategory
  title: string
  explain: string
  before: string
  /** Replacement for the whole line (may add lines), or null when only a person can fix it. */
  after: string | null
}

export const KNOWN_METHODS = new Set([
  'append', 'insert', 'remove', 'pop', 'sort', 'reverse', 'clear', 'extend', 'count', 'index',
  'copy', 'upper', 'lower', 'strip', 'lstrip', 'rstrip', 'title', 'capitalize', 'split', 'join',
  'replace', 'find', 'startswith', 'endswith', 'isdigit', 'isalpha', 'format', 'keys', 'values',
  'items', 'get', 'update', 'setdefault', 'add', 'discard',
])

const NAME_FIXES: Record<string, string> = { true: 'True', false: 'False', none: 'None', null: 'None' }
const OPERATOR_FIXES: Record<string, { to: string; why: string }> = {
  '=>': { to: '>=', why: 'In Python "greater than or equal" is written >= (the > comes first).' },
  '=<': { to: '<=', why: 'In Python "less than or equal" is written <= (the < comes first).' },
  '=!': { to: '!=', why: 'In Python "not equal" is written != (the ! comes first).' },
  '<>': { to: '!=', why: 'Python 3 writes "not equal" as !=.' },
  '===': { to: '==', why: 'Python compares with two equals signs: ==.' },
  '&&': { to: 'and', why: 'Python uses the word and instead of &&.' },
  '||': { to: 'or', why: 'Python uses the word or instead of ||.' },
}
const HEADER_WORDS = ['if', 'elif', 'else', 'for', 'while', 'def', 'class', 'try', 'except', 'finally', 'with']
const STATEMENT_WORDS = [...HEADER_WORDS, 'return', 'import', 'print', 'break', 'continue', 'pass']
const ARITH = new Set(['+', '-', '*', '/', '//', '%', '**'])
const COMPARE = new Set(['<', '>', '<=', '>='])

type VarType = 'number' | 'text' | 'list' | 'dict' | 'bool' | 'unknown'

function lastCode(line: CodeLine): Token | undefined {
  return line.code[line.code.length - 1]
}

function withCodeEnd(line: CodeLine, insert: string) {
  const last = lastCode(line)
  if (!last) return line.raw
  return line.raw.slice(0, last.end) + insert + line.raw.slice(last.end)
}

function setIndent(line: CodeLine, width: number) {
  return ' '.repeat(width) + line.raw.trimStart()
}

function topLevelEquals(line: CodeLine) {
  return line.code.findIndex((t) => t.depth === 0 && t.kind === 'op' && t.text === '=')
}

/* ───────────── Names ───────────── */

function definedNames(lines: CodeLine[]) {
  const defined = new Map<string, number>()
  const define = (name: string, line: number) => {
    if (!defined.has(name)) defined.set(name, line)
  }
  for (const line of lines) {
    const t = line.code
    if (isAnnotation(line)) define(t[0].text, line.no)
    if (line.kind === 'case') t.forEach((tok) => tok.kind === 'name' && t.indexOf(tok) > 0 && define(tok.text, line.no))
    t.forEach((tok, i) => t[i + 1]?.text === ':=' && tok.kind === 'name' && define(tok.text, line.no))
    if (line.kind === 'assign') {
      const eq = topLevelEquals(line)
      t.slice(0, eq).forEach((tok, i) => {
        const next = t[i + 1]?.text
        if (tok.kind === 'name' && tok.depth === 0 && t[i - 1]?.text !== '.' && next !== '.' && next !== '[') {
          define(tok.text, line.no)
        }
      })
    }
    if (line.kind === 'import') t.forEach((tok) => tok.kind !== 'keyword' && tok.kind !== 'punct' && define(tok.text, line.no))
    t.forEach((tok, i) => {
      if (tok.text === 'for' && tok.kind === 'keyword') {
        for (let j = i + 1; j < t.length && t[j].text !== 'in'; j += 1) {
          if (t[j].kind === 'name') define(t[j].text, line.no)
        }
      }
      if ((tok.text === 'def' || tok.text === 'class') && t[i + 1]) define(t[i + 1].text, line.no)
      if (tok.text === 'as' && t[i + 1]?.kind === 'name') define(t[i + 1].text, line.no)
      if (tok.text === 'global' || tok.text === 'nonlocal') {
        t.slice(i + 1).forEach((n) => n.kind === 'name' && define(n.text, line.no))
      }
      if (tok.text === 'lambda') {
        for (let j = i + 1; j < t.length && t[j].text !== ':'; j += 1) {
          if (t[j].kind === 'name') define(t[j].text, line.no)
        }
      }
    })
    if (line.kind === 'def') {
      const whole = line.endNo > line.no ? logicalLine(lines, line).code : t
      const open = whole.findIndex((tok) => tok.text === '(')
      whole.forEach((tok, i) => {
        if (i > open && open >= 0 && tok.kind === 'name' && tok.depth === 1 && whole[i - 1]?.text !== '=') {
          define(tok.text, line.no)
        }
      })
    }
  }
  return defined
}

/** `name: type` with no value, e.g. a field in a class. */
function isAnnotation(line: CodeLine) {
  const t = line.code
  return line.kind === 'expr' && t[0]?.kind === 'name' && t[1]?.text === ':' && t.length > 2 && t[t.length - 1].text !== ':'
}

function isUse(line: CodeLine, i: number) {
  const t = line.code
  const tok = t[i]
  if (tok.kind !== 'name') return false
  if (t[i - 1]?.text === '.' || t[i - 1]?.text === 'as') return false
  if (line.kind === 'case' || (line.kind === 'match' && i === 0)) return false
  if (t[i + 1]?.text === ':=' || (i === 0 && isAnnotation(line))) return false
  if (line.kind === 'import' || line.kind === 'def' || line.kind === 'class') return false
  if (tok.depth > 0 && t[i + 1]?.text === '=' ) return false
  if (line.kind === 'assign' && i < topLevelEquals(line) && tok.depth === 0 && !['.', '['].includes(t[i + 1]?.text ?? '')) return false
  const forAt = t.findIndex((x, j) => j < i && x.text === 'for')
  if (forAt >= 0) {
    const inAt = t.findIndex((x, j) => j > forAt && x.text === 'in')
    if (inAt > i) return false
  }
  const lambdaAt = t.findIndex((x, j) => j < i && x.text === 'lambda')
  if (lambdaAt >= 0 && t.findIndex((x, j) => j > lambdaAt && x.text === ':') > i) return false
  return true
}

function isAllowedName(name: string) {
  return (
    BUILTINS.has(name) ||
    KEYWORDS.has(name) ||
    /(Error|Exception|Warning)$/.test(name) ||
    name.startsWith('__')
  )
}

/* ───────────── Value types (for TypeError checks) ───────────── */

function typeOfValue(tokens: Token[], types: Map<string, VarType>): VarType {
  if (tokens.length === 0) return 'unknown'
  const first = tokens[0]
  if (tokens.length === 1) {
    if (first.kind === 'number') return 'number'
    if (first.kind === 'string') return 'text'
    if (first.text === 'True' || first.text === 'False') return 'bool'
    if (first.kind === 'name') return types.get(first.text) ?? 'unknown'
  }
  if (['int', 'float', 'len', 'sum', 'round', 'abs'].includes(first.text) && tokens[1]?.text === '(') {
    const close = tokens.findIndex((t, i) => i > 1 && t.text === ')' && t.depth === first.depth)
    if (close === tokens.length - 1) return 'number'
  }
  if (['str', 'input'].includes(first.text) && tokens[1]?.text === '(') {
    const close = tokens.findIndex((t, i) => i > 1 && t.text === ')' && t.depth === first.depth)
    if (close === tokens.length - 1) return 'text'
  }
  if (first.text === '[' && tokens[tokens.length - 1].text === ']') return 'list'
  if (first.text === '{' && tokens[tokens.length - 1].text === '}') return 'dict'
  const mathOnly = tokens.every(
    (t) =>
      t.kind === 'number' ||
      (t.kind === 'op' && ARITH.has(t.text)) ||
      t.text === '(' ||
      t.text === ')' ||
      (t.kind === 'name' && types.get(t.text) === 'number'),
  )
  return mathOnly ? 'number' : 'unknown'
}

/* ───────────── Checks ───────────── */

type Ctx = {
  lines: CodeLine[]
  defined: Map<string, number>
  issues: Issue[]
  flagged: Set<number>
}

function add(ctx: Ctx, line: CodeLine, issue: Omit<Issue, 'id' | 'line' | 'before'>) {
  if (ctx.flagged.has(line.no)) return
  ctx.flagged.add(line.no)
  ctx.issues.push({ ...issue, id: `${line.no}:${issue.title}`, line: line.no, before: line.raw })
}

function checkQuotes(ctx: Ctx, line: CodeLine) {
  if (!line.unclosedQuote) return
  const q = line.unclosedQuote
  const str = line.tokens.find((t) => t.kind === 'string' && t.end === line.raw.length)
  if (!str) return
  const body = line.raw.slice(str.start)
  const other = q === '"' ? "'" : '"'
  const otherAt = body.lastIndexOf(other)
  let fixed: string
  if (otherAt > 0) {
    fixed = line.raw.slice(0, str.start) + body.slice(0, otherAt) + q + body.slice(otherAt + 1)
  } else {
    const tail = /[)\]}:,\s]*$/.exec(body)?.[0] ?? ''
    fixed = line.raw.slice(0, str.start) + body.slice(0, body.length - tail.length) + q + tail
  }
  add(ctx, line, {
    category: 'SyntaxError',
    title: 'The text is not closed',
    explain:
      otherAt > 0
        ? `This text starts with ${q} but ends with ${other}. Both quotes around a text must be the same kind.`
        : `This text starts with ${q} but never ends. Text (a string) needs a quote at the start AND at the end.`,
    after: fixed,
  })
}

function checkBrackets(ctx: Ctx, line: CodeLine, nextLine: CodeLine | undefined) {
  const pairs: Record<string, string> = { ')': '(', ']': '[', '}': '{' }
  const stack: string[] = [...line.openAtStart]
  for (const t of line.code) {
    if (t.kind !== 'punct') continue
    if ('([{'.includes(t.text)) stack.push(t.text)
    else if (pairs[t.text]) {
      if (stack.length && stack[stack.length - 1] === pairs[t.text]) stack.pop()
      else {
        add(ctx, line, {
          category: 'SyntaxError',
          title: `An extra "${t.text}"`,
          explain: `There is a closing ${t.text} without a matching opening bracket before it. Every bracket that closes must have been opened first.`,
          after: line.raw.slice(0, t.start) + line.raw.slice(t.end),
        })
        return
      }
    }
  }
  const continues = nextLine?.continuation
  if (line.openAtEnd.length && !continues) {
    const closers = [...line.openAtEnd].reverse().map((o) => ({ '(': ')', '[': ']', '{': '}' })[o] ?? '').join('')
    const last = lastCode(line)
    const fixed =
      last?.text === ':' && HEADER_KINDS.has(line.kind)
        ? line.raw.slice(0, last.start).trimEnd() + closers + line.raw.slice(last.start)
        : withCodeEnd(line, closers)
    add(ctx, line, {
      category: 'SyntaxError',
      title: `A bracket is never closed`,
      explain: `You opened ${line.openAtEnd.map((o) => `"${o}"`).join(' and ')} but did not close it. Every opening bracket needs its partner: ( ), [ ], { }.`,
      after: fixed,
    })
  }
}

function checkPrintStatement(ctx: Ctx, line: CodeLine) {
  const [first, second] = line.code
  if (first?.text !== 'print' || !second || second.text === '(' || second.text === '=' || second.text === '.') return
  const rest = line.raw.slice(second.start, lastCode(line)!.end)
  add(ctx, line, {
    category: 'SyntaxError',
    title: 'print needs brackets',
    explain: 'In Python 3, print is a function. What you want to show goes inside round brackets: print(...).',
    after: line.raw.slice(0, first.start) + `print(${rest})` + line.raw.slice(lastCode(line)!.end),
  })
}

function checkElseIf(ctx: Ctx, line: CodeLine) {
  const [a, b] = line.code
  const elseIf = a?.text === 'else' && b?.text === 'if'
  const oneWord = a && ['elseif', 'elsif'].includes(a.text)
  if (!elseIf && !oneWord) return
  const fixedStart = line.raw.slice(0, a.start) + 'elif' + line.raw.slice(elseIf ? b.end : a.end)
  const fixed = fixedStart.trimEnd().endsWith(':') ? fixedStart : fixedStart.trimEnd() + ':'
  add(ctx, line, {
    category: 'SyntaxError',
    title: 'Use elif, not "else if"',
    explain: 'Python joins "else if" into one short word: elif. It means "otherwise, if…".',
    after: fixed,
  })
}

function checkKeywordTypos(ctx: Ctx, line: CodeLine) {
  const first = line.code[0]
  if (!first || first.kind !== 'name' || ctx.defined.has(first.text)) return
  if (line.kind === 'match' || line.kind === 'case' || isAnnotation(line)) return
  const endsWithColon = lastCode(line)?.text === ':'
  const candidates = endsWithColon ? HEADER_WORDS : STATEMENT_WORDS.filter((w) => !HEADER_WORDS.includes(w))
  const lower = first.text.toLowerCase()
  const guess = HEADER_WORDS.includes(lower) || STATEMENT_WORDS.includes(lower) ? lower : closest(first.text, candidates, first.text.length >= 5 ? 2 : 1)
  if (!guess || guess === first.text) return
  if (!endsWithColon && line.code[1]?.text === '=') return
  add(ctx, line, {
    category: 'SyntaxError',
    title: `"${first.text}" should be "${guess}"`,
    explain:
      guess === lower
        ? `Python is case-sensitive: keywords are written in small letters, so ${first.text} must be ${guess}.`
        : `"${first.text}" looks like a typing mistake. The Python word is ${guess}.`,
    after: replaceToken(line, first, guess),
  })
}

function checkMissingColon(ctx: Ctx, line: CodeLine) {
  if (!HEADER_KINDS.has(line.kind)) return
  const t = line.code
  if (line.kind === 'def') {
    const name = definedNameToken(line)
    const afterName = name ? t[t.indexOf(name) + 1] : undefined
    if (name && afterName?.text !== '(') {
      const colon = lastCode(line)?.text === ':' ? lastCode(line)! : null
      const params = afterName && afterName !== colon ? line.raw.slice(afterName.start, colon ? colon.start : lastCode(line)!.end).trim() : ''
      add(ctx, line, {
        category: 'SyntaxError',
        title: 'A function needs ( ) after its name',
        explain: 'Every function name is followed by round brackets, even when it takes nothing: def name():',
        after: line.raw.slice(0, name.end) + `(${params}):` + (line.comment ? `  ${line.comment}` : ''),
      })
      return
    }
  }
  if (line.kind === 'for') {
    const inAt = t.findIndex((x) => x.text === 'in')
    const iter = t[inAt + 1]
    const afterIter = t[inAt + 2]
    if (iter?.text === 'range' && afterIter && afterIter.text !== '(') {
      const end = lastCode(line)!.text === ':' ? lastCode(line)!.start : lastCode(line)!.end
      const inner = line.raw.slice(afterIter.start, end).trim()
      add(ctx, line, {
        category: 'SyntaxError',
        title: 'range needs brackets',
        explain: 'range is a function, so the numbers go inside round brackets: range(5).',
        after: line.raw.slice(0, iter.end) + `(${inner}):` + (line.comment ? `  ${line.comment}` : ''),
      })
      return
    }
    if (iter?.kind === 'number' && afterIter?.text === ':' ) {
      add(ctx, line, {
        category: 'TypeError',
        title: 'A number cannot be looped over',
        explain: `A for loop needs a group of items. To repeat ${iter.text} times, use range(${iter.text}), which makes the numbers 0 to ${Number(iter.text) - 1}.`,
        after: replaceToken(line, iter, `range(${iter.text})`),
      })
      return
    }
  }
  const tail = ctx.lines[line.endNo - 1] ?? line
  if (lastCode(tail)?.text === ':') return
  add(ctx, tail, {
    category: 'SyntaxError',
    title: 'Missing colon (:)',
    explain: `A line that starts with "${line.code[0].text}" must end with a colon. The colon says "the indented lines below belong to me".`,
    after: withCodeEnd(tail, ':'),
  })
}

function checkOperators(ctx: Ctx, line: CodeLine) {
  for (const [i, t] of line.code.entries()) {
    if (t.kind !== 'op') continue
    const fix = OPERATOR_FIXES[t.text]
    if (fix) {
      const before = line.raw.slice(0, t.start)
      const after = line.raw.slice(t.end)
      const padLeft = /\s$/.test(before) ? '' : ' '
      const padRight = /^\s/.test(after) ? '' : ' '
      add(ctx, line, {
        category: 'SyntaxError',
        title: `Use ${fix.to} instead of ${t.text}`,
        explain: fix.why,
        after: before + padLeft + fix.to + padRight + after,
      })
      return
    }
    if (t.text === '!' && line.code[i + 1]?.kind === 'name') {
      add(ctx, line, {
        category: 'SyntaxError',
        title: 'Use not instead of !',
        explain: 'Python flips True/False with the word not, for example: not done.',
        after: line.raw.slice(0, t.start) + 'not ' + line.raw.slice(t.end),
      })
      return
    }
    if ((t.text === '++' || t.text === '--') && line.code[i - 1]?.kind === 'name') {
      add(ctx, line, {
        category: 'SyntaxError',
        title: `Python has no ${t.text}`,
        explain: `To ${t.text === '++' ? 'add 1 to' : 'take 1 from'} a variable, write ${line.code[i - 1].text} ${t.text[0]}= 1.`,
        after: line.raw.slice(0, t.start).trimEnd() + ` ${t.text[0]}= 1` + line.raw.slice(t.end),
      })
      return
    }
    if (t.text === '=' && t.depth === 0 && ['if', 'elif', 'while'].includes(line.kind)) {
      add(ctx, line, {
        category: 'SyntaxError',
        title: 'Use == to compare',
        explain: 'One = stores a value. Two == ask "are these equal?". Inside a condition you want the question: ==.',
        after: line.raw.slice(0, t.start) + '==' + line.raw.slice(t.end),
      })
      return
    }
    if (t.text === '==' && t.depth === 0 && i === 1 && line.kind === 'expr' && line.code[0].kind === 'name') {
      add(ctx, line, {
        category: 'SyntaxError',
        title: 'Use = to store a value',
        explain: `== only asks "are these equal?" and the answer is thrown away. To put a value into ${line.code[0].text}, use one =.`,
        after: line.raw.slice(0, t.start) + '=' + line.raw.slice(t.end),
      })
      return
    }
  }
}

function checkAssignment(ctx: Ctx, line: CodeLine) {
  if (line.kind !== 'assign') return
  const eq = topLevelEquals(line)
  const left = line.code.slice(0, eq)
  const right = line.code.slice(eq + 1)
  if (right.length === 0) {
    add(ctx, line, {
      category: 'SyntaxError',
      title: 'Nothing after =',
      explain: 'The = sign stores the value on its right side into the name on its left. Put a value after the =.',
      after: null,
    })
    return
  }
  if (left.length === 1 && (left[0].kind === 'number' || left[0].kind === 'string') && right.length === 1 && right[0].kind === 'name') {
    add(ctx, line, {
      category: 'SyntaxError',
      title: 'The name goes on the left',
      explain: 'With =, the variable name is on the left and the value is on the right: name = value.',
      after: line.raw.slice(0, left[0].start) + `${right[0].text} = ${left[0].text}` + line.raw.slice(right[0].end),
    })
  }
}

function checkNameCase(ctx: Ctx, line: CodeLine) {
  for (const t of line.code) {
    if (t.kind !== 'name' || ctx.defined.has(t.text)) continue
    const lower = t.text.toLowerCase()
    const fixed = NAME_FIXES[lower] ?? (BUILTINS.has(lower) || KEYWORDS.has(lower) ? lower : null)
    if (!fixed || fixed === t.text) continue
    add(ctx, line, {
      category: 'NameError',
      title: `"${t.text}" should be "${fixed}"`,
      explain: `Python is case-sensitive: big and small letters matter. The correct spelling is ${fixed}.`,
      after: replaceToken(line, t, fixed),
    })
    return
  }
}

function checkUndefinedNames(ctx: Ctx, line: CodeLine, insideDef: boolean) {
  for (const [i, t] of line.code.entries()) {
    if (!isUse(line, i) || isAllowedName(t.text)) continue
    const firstDefined = ctx.defined.get(t.text)
    if (firstDefined !== undefined) {
      if (!insideDef && line.indent === 0 && firstDefined > line.no && line.kind !== 'def') {
        add(ctx, line, {
          category: 'NameError',
          title: `"${t.text}" is used before it is created`,
          explain: `Python reads from top to bottom. On line ${line.no} you use ${t.text}, but it is only created on line ${firstDefined}. Create it first, then use it.`,
          after: null,
        })
        return
      }
      continue
    }
    const isCall = line.code[i + 1]?.text === '('
    const pool = isCall ? [...BUILTINS, ...ctx.defined.keys()] : [...ctx.defined.keys(), ...BUILTINS]
    const guess = t.text.length >= 3 ? closest(t.text, pool, t.text.length >= 5 ? 2 : 1) : null
    if (guess) {
      add(ctx, line, {
        category: 'NameError',
        title: `Did you mean "${guess}"?`,
        explain: `Python does not know "${t.text}". It looks like a typing mistake for ${guess}${ctx.defined.has(guess) ? `, which you created on line ${ctx.defined.get(guess)}` : ''}.`,
        after: replaceToken(line, t, guess),
      })
      return
    }
    const prev = line.code[i - 1]?.text
    const next = line.code[i + 1]?.text
    const insidePrint = line.code[0]?.text === 'print' && (prev === '(' || prev === ',') && (next === ')' || next === ',')
    add(ctx, line, {
      category: 'NameError',
      title: `Python does not know "${t.text}"`,
      explain: insidePrint
        ? `${t.text} has no quotes, so Python looks for a variable with that name and cannot find one. If you want to show the word itself, put it in quotes.`
        : `There is no variable or function called ${t.text} yet. Create it first (for example ${t.text} = ...), or check the spelling.`,
      after: insidePrint ? replaceToken(line, t, `"${t.text}"`) : null,
    })
    return
  }
}

function checkMethodWithoutCall(ctx: Ctx, line: CodeLine) {
  const t = line.code
  if (line.kind !== 'expr' || t.length !== 3 || t[1].text !== '.' || !KNOWN_METHODS.has(t[2].text)) return
  add(ctx, line, {
    category: 'OtherError',
    title: 'The method is never run',
    explain: `${t[0].text}.${t[2].text} only names the action. Add round brackets to actually run it: ${t[0].text}.${t[2].text}().`,
    after: withCodeEnd(line, '()'),
  })
}

function checkTypes(ctx: Ctx, codeLines: CodeLine[]) {
  const types = new Map<string, VarType>()
  const inputLines = new Map<string, CodeLine>()
  for (const line of codeLines) {
    const t = line.code
    // input() text used like a number
    t.forEach((tok, i) => {
      const source = tok.kind === 'name' ? inputLines.get(tok.text) : undefined
      if (!source || types.get(tok.text) !== 'text') return
      const neighbours = [
        [t[i + 1], t[i + 2]],
        [t[i - 1], t[i - 2]],
      ] as const
      for (const [op, other] of neighbours) {
        if (!op || op.kind !== 'op' || !other) continue
        const otherIsNumber = other.kind === 'number' || types.get(other.text) === 'number'
        const isMath = ARITH.has(op.text) && otherIsNumber
        const isCompare = COMPARE.has(op.text) && otherIsNumber
        if (!isMath && !isCompare) continue
        const inputTok = source.code.find((x) => x.text === 'input')
        if (!inputTok) return
        const close = source.code.findIndex((x, k) => k > source.code.indexOf(inputTok) && x.text === ')' && x.depth === inputTok.depth)
        if (close < 0) return
        const wrapper = other.text.includes('.') ? 'float' : 'int'
        const fixed =
          source.raw.slice(0, inputTok.start) +
          `${wrapper}(` +
          source.raw.slice(inputTok.start, source.code[close].end) +
          ')' +
          source.raw.slice(source.code[close].end)
        add(ctx, source, {
          category: 'TypeError',
          title: 'input() gives text, not a number',
          explain: `On line ${line.no} you ${isMath ? 'do maths with' : 'compare'} ${tok.text} and a number. But input() always gives text, even when the user types digits. Wrap it in ${wrapper}() to turn it into a number.`,
          after: fixed,
        })
        types.set(tok.text, 'number')
        return
      }
    })
    // text + number
    t.forEach((tok, i) => {
      if (tok.kind !== 'op' || tok.text !== '+') return
      const a = t[i - 1]
      const b = t[i + 1]
      if (!a || !b) return
      const typeA = a.kind === 'string' ? 'text' : a.kind === 'number' ? 'number' : types.get(a.text)
      const typeB = b.kind === 'string' ? 'text' : b.kind === 'number' ? 'number' : types.get(b.text)
      const numberSide = typeA === 'text' && typeB === 'number' ? b : typeA === 'number' && typeB === 'text' ? a : null
      if (!numberSide || (numberSide.kind !== 'name' && numberSide.kind !== 'number')) return
      const nextAfter = t[t.indexOf(numberSide) + 1]?.text
      const prevBefore = t[t.indexOf(numberSide) - 1]?.text
      if (nextAfter === '(' || nextAfter === '.' || nextAfter === '[' || prevBefore === '.') return
      add(ctx, line, {
        category: 'TypeError',
        title: 'Text and a number cannot be added',
        explain: `+ can join two texts or add two numbers, but not mix them. Turn the number into text first with str(${numberSide.text}).`,
        after: replaceToken(line, numberSide, `str(${numberSide.text})`),
      })
    })
    if (line.kind === 'assign') {
      const eq = topLevelEquals(line)
      const left = t.slice(0, eq)
      const right = t.slice(eq + 1)
      if (left.length === 1 && left[0].kind === 'name') {
        types.set(left[0].text, typeOfValue(right, types))
        if (right[0]?.text === 'input') inputLines.set(left[0].text, line)
        else inputLines.delete(left[0].text)
      }
    }
    if (line.kind === 'for') {
      const inAt = t.findIndex((x) => x.text === 'in')
      if (t[inAt + 1]?.text === 'range') t.slice(1, inAt).forEach((x) => x.kind === 'name' && types.set(x.text, 'number'))
    }
  }
}

function checkStructure(ctx: Ctx, codeLines: CodeLine[]) {
  const usesTabs = codeLines.some((l) => l.hasTab)
  const usesSpaces = codeLines.some((l) => l.indent > 0 && !l.hasTab)
  const base = codeLines[0]?.indent ?? 0
  const stack = [base]
  const lastKindAt = new Map<number, LineKind>()
  const blocks: { kind: LineKind; indent: number }[] = []

  codeLines.forEach((line, index) => {
    if (line.continuation) return
    if (usesTabs && usesSpaces && line.hasTab) {
      add(ctx, line, {
        category: 'IndentationError',
        title: 'Tabs and spaces are mixed',
        explain: 'This line is pushed in with a Tab, but other lines use spaces. Python gets confused by the mix — use 4 spaces everywhere.',
        after: line.raw.replace(/^[ \t]+/, (ws) => ws.replace(/\t/g, '    ')),
      })
    }
    const prev = codeLines.slice(0, index).reverse().find((l) => !l.continuation)
    let indent = line.indent
    const top = stack[stack.length - 1]
    if (prev && HEADER_KINDS.has(prev.kind)) {
      if (indent <= prev.indent) {
        const target = prev.indent + 4
        add(ctx, line, {
          category: 'IndentationError',
          title: 'This line must be pushed in',
          explain: `Line ${prev.no} ends with a colon, so the line after it belongs inside it and must be indented (4 spaces further right).`,
          after: setIndent(line, target),
        })
        indent = target
      }
      stack.push(indent)
    } else if (indent > top) {
      add(ctx, line, {
        category: 'IndentationError',
        title: 'Unexpected indent',
        explain: 'This line is pushed in, but the line above is not a block header (no colon). Line it up with the line above.',
        after: setIndent(line, top),
      })
      indent = top
    } else if (indent < top) {
      while (stack.length > 1 && stack[stack.length - 1] > indent) stack.pop()
      const level = stack[stack.length - 1]
      if (level !== indent) {
        add(ctx, line, {
          category: 'IndentationError',
          title: 'The indent does not line up',
          explain: 'When a block ends, the next line must line up exactly with an earlier line. This one stops in between.',
          after: setIndent(line, level),
        })
        indent = level
      }
    }

    while (blocks.length && blocks[blocks.length - 1].indent >= indent) blocks.pop()
    const inside = (kinds: LineKind[]) => blocks.some((b) => kinds.includes(b.kind))
    const sibling = lastKindAt.get(indent)
    if (line.kind === 'elif' && sibling !== 'if' && sibling !== 'elif') {
      add(ctx, line, {
        category: 'SyntaxError',
        title: 'elif without an if',
        explain: 'elif must come right after an if (or another elif) block, lined up with it.',
        after: null,
      })
    }
    if (line.kind === 'else' && !['if', 'elif', 'for', 'while', 'try', 'except'].includes(sibling ?? '')) {
      add(ctx, line, {
        category: 'SyntaxError',
        title: 'else without an if',
        explain: 'else must come right after an if/elif block and line up with it.',
        after: null,
      })
    }
    if (line.kind === 'return' && !inside(['def'])) {
      add(ctx, line, {
        category: 'SyntaxError',
        title: 'return outside a function',
        explain: 'return sends a value back from a function, so it can only be used inside a def block.',
        after: null,
      })
    }
    if ((line.kind === 'break' || line.kind === 'continue') && !inside(['for', 'while'])) {
      add(ctx, line, {
        category: 'SyntaxError',
        title: `${line.kind} outside a loop`,
        explain: `${line.kind} only works inside a for or while loop.`,
        after: null,
      })
    }
    lastKindAt.set(indent, line.kind)
    for (const key of [...lastKindAt.keys()]) if (key > indent) lastKindAt.delete(key)
    if (HEADER_KINDS.has(line.kind)) blocks.push({ kind: line.kind, indent })

    if (index === codeLines.length - 1 && HEADER_KINDS.has(line.kind)) {
      add(ctx, line, {
        category: 'IndentationError',
        title: 'The block is empty',
        explain: 'A line ending with a colon needs at least one indented line under it. Add the steps, or write pass for "do nothing".',
        after: `${line.raw}\n${' '.repeat(indent + 4)}pass`,
      })
    }
  })
}

const RUNTIME_MESSAGES: { match: RegExp; category: ErrorCategory; title: string; explain: string }[] = [
  {
    match: /ZeroDivisionError/,
    category: 'ZeroDivisionError',
    title: 'Dividing by zero',
    explain: 'When this line runs, it divides by 0. Nothing can be divided by zero, so Python stops with a ZeroDivisionError.',
  },
  {
    match: /IndexError/,
    category: 'IndexError',
    title: 'That position does not exist',
    explain: 'This line asks for a list position that is not there. Positions start at 0, and the last one is len(list) - 1.',
  },
  {
    match: /KeyError/,
    category: 'KeyError',
    title: 'That key is not in the dictionary',
    explain: 'This line reads a key the dictionary does not have. Check the spelling, or use .get(key) to be safe.',
  },
  {
    match: /TypeError/,
    category: 'TypeError',
    title: 'These values cannot be combined',
    explain: 'This line mixes values that do not go together, such as text and a number with +. Convert one of them first (str() or int()).',
  },
  {
    match: /NameError/,
    category: 'NameError',
    title: 'A name is not created yet',
    explain: 'When Python reaches this line, one of the names in it does not exist yet. Create it before this line.',
  },
]

function checkRuntime(ctx: Ctx, code: string) {
  const error = findSimulationError(code)
  if (!error) return
  const rule = RUNTIME_MESSAGES.find((r) => r.match.test(error.message))
  if (!rule) return
  const line = ctx.lines.find((l) => isCodeLine(l) && l.text === error.src) ?? ctx.lines.find(isCodeLine)
  if (!line) return
  add(ctx, line, { category: rule.category, title: rule.title, explain: rule.explain, after: null })
}

/** Finds mistakes the way a teacher would mark them, with a suggested corrected line. */
export function checkCode(code: string): Issue[] {
  const lines = analyzeLines(code)
  const codeLines = lines.filter(isCodeLine)
  const ctx: Ctx = { lines, defined: definedNames(codeLines), issues: [], flagged: new Set() }

  let defIndent: number | null = null
  codeLines.forEach((line) => {
    if (defIndent !== null && !line.continuation && line.indent <= defIndent) defIndent = null
    checkQuotes(ctx, line)
    checkBrackets(ctx, line, lines[line.no])
    if (line.continuation) return
    checkPrintStatement(ctx, line)
    checkElseIf(ctx, line)
    checkKeywordTypos(ctx, line)
    checkMissingColon(ctx, line)
    checkOperators(ctx, line)
    checkAssignment(ctx, line)
    checkNameCase(ctx, line)
    checkMethodWithoutCall(ctx, line)
    checkUndefinedNames(ctx, line, defIndent !== null)
    if (line.kind === 'def' && defIndent === null) defIndent = line.indent
  })
  checkStructure(ctx, codeLines)
  checkTypes(ctx, codeLines.filter((l) => !l.continuation))
  if (ctx.issues.length === 0) checkRuntime(ctx, code)

  return ctx.issues.sort((a, b) => a.line - b.line)
}

export function applyFix(code: string, issue: Issue): string {
  if (issue.after === null) return code
  const lines = code.replace(/\r\n?/g, '\n').split('\n')
  lines[issue.line - 1] = issue.after
  return lines.join('\n')
}

/** Applies every automatic fix, one at a time (fixing one mistake can reveal the next). */
export function fixAll(code: string): { code: string; fixed: number; remaining: Issue[] } {
  let current = code
  let fixed = 0
  for (let round = 0; round < 25; round += 1) {
    const next = checkCode(current).find((issue) => issue.after !== null)
    if (!next) break
    const updated = applyFix(current, next)
    if (updated === current) break
    current = updated
    fixed += 1
  }
  return { code: current, fixed, remaining: checkCode(current) }
}
