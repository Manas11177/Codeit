/**
 * Line-by-line reader for the Code Coach. Unlike the lesson simulator it keeps
 * line numbers and copes with broken code, so mistakes can be pointed at.
 */

export type TokenKind =
  | 'keyword'
  | 'builtin'
  | 'name'
  | 'number'
  | 'string'
  | 'op'
  | 'punct'
  | 'comment'
  | 'unknown'

export type Token = {
  kind: TokenKind
  text: string
  start: number
  end: number
  /** Bracket depth just before this token. */
  depth: number
}

export type LineKind =
  | 'blank'
  | 'comment'
  | 'if'
  | 'elif'
  | 'else'
  | 'for'
  | 'while'
  | 'def'
  | 'class'
  | 'try'
  | 'except'
  | 'finally'
  | 'with'
  | 'match'
  | 'case'
  | 'return'
  | 'break'
  | 'continue'
  | 'pass'
  | 'import'
  | 'assign'
  | 'aug'
  | 'print'
  | 'call'
  | 'expr'

export type CodeLine = {
  no: number
  raw: string
  text: string
  indent: number
  hasTab: boolean
  tokens: Token[]
  /** Tokens without the trailing comment. */
  code: Token[]
  comment: string | null
  kind: LineKind
  unclosedQuote: string | null
  /** Brackets still open at the end of the line. */
  openAtEnd: string[]
  /** True when this line continues a statement started on an earlier line. */
  continuation: boolean
  /** Brackets already open when this line starts. */
  openAtStart: string[]
  /** Line number where the statement containing this line ends. */
  endNo: number
}

export const KEYWORDS = new Set([
  'False', 'None', 'True', 'and', 'as', 'assert', 'break', 'class', 'continue', 'def', 'del',
  'elif', 'else', 'except', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is',
  'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield',
  'async', 'await',
])

export const BUILTINS = new Set([
  'print', 'input', 'len', 'range', 'int', 'str', 'float', 'bool', 'list', 'dict', 'tuple', 'set',
  'type', 'sum', 'max', 'min', 'abs', 'round', 'sorted', 'reversed', 'enumerate', 'zip', 'map',
  'filter', 'any', 'all', 'open', 'isinstance', 'chr', 'ord', 'divmod', 'pow', 'help', 'id',
  'iter', 'next', 'format', 'repr', 'exit', 'quit', 'object', 'super', 'property', 'staticmethod',
  'classmethod', 'callable', 'getattr', 'setattr', 'hasattr', 'delattr', 'vars', 'dir', 'hash',
  'frozenset', 'bytes', 'bytearray', 'complex', 'slice', 'issubclass', 'eval', 'exec', 'globals',
  'locals', 'bin', 'hex', 'oct', 'ascii', 'memoryview', 'aiter', 'anext', 'breakpoint',
  'NotImplemented', 'Ellipsis',
])

export const HEADER_KINDS = new Set<LineKind>([
  'if', 'elif', 'else', 'for', 'while', 'def', 'class', 'try', 'except', 'finally', 'with',
  'match', 'case',
])

const OPS = [
  '**=', '//=', '===', '==', '!=', '<=', '>=', '=>', '=<', '=!', '<>', '+=', '-=', '*=', '/=',
  '%=', '**', '//', '->', '&&', '||', '++', '--',
  '+', '-', '*', '/', '%', '<', '>', '=', '&', '|', '^', '~', '@', '!',
]
const PUNCT = '()[]{}:,.;'
const OPENERS: Record<string, string> = { '(': ')', '[': ']', '{': '}' }
const CLOSERS: Record<string, string> = { ')': '(', ']': '[', '}': '{' }

export const AUG_OPS = new Set(['+=', '-=', '*=', '/=', '//=', '%=', '**='])

function indentOf(raw: string) {
  let width = 0
  let hasTab = false
  for (const ch of raw) {
    if (ch === ' ') width += 1
    else if (ch === '\t') {
      width += 4
      hasTab = true
    } else break
  }
  return { width, hasTab }
}

function lexLine(raw: string, carried: string[], openTriple: string | null = null) {
  const tokens: Token[] = []
  const stack = [...carried]
  let unclosedQuote: string | null = null
  let tripleLeftOpen: string | null = null
  let i = 0
  if (openTriple) {
    const close = raw.indexOf(openTriple)
    const end = close < 0 ? raw.length : close + openTriple.length
    tokens.push({ kind: 'string', text: raw.slice(0, end), start: 0, end, depth: stack.length })
    if (close < 0) return { tokens, stack, unclosedQuote, tripleLeftOpen: openTriple }
    i = end
  }
  while (i < raw.length) {
    const c = raw[i]
    if (c === ' ' || c === '\t' || c === '\r') {
      i += 1
      continue
    }
    const depth = stack.length
    if (c === '#') {
      tokens.push({ kind: 'comment', text: raw.slice(i).trimEnd(), start: i, end: raw.length, depth })
      break
    }
    const prefix = /^[fFrRbBuU]{1,2}(?=["'])/.exec(raw.slice(i))
    const q = prefix ? raw[i + prefix[0].length] : c
    if (q === '"' || q === "'") {
      const begin = i
      let j = i + (prefix ? prefix[0].length : 0)
      const triple = raw.startsWith(q.repeat(3), j)
      const quote = triple ? q.repeat(3) : q
      j += quote.length
      let closed = false
      while (j < raw.length) {
        if (raw[j] === '\\') {
          j += 2
          continue
        }
        if (raw.startsWith(quote, j)) {
          j += quote.length
          closed = true
          break
        }
        j += 1
      }
      if (!closed && triple) tripleLeftOpen = quote
      else if (!closed) unclosedQuote = q
      tokens.push({ kind: 'string', text: raw.slice(begin, j), start: begin, end: j, depth })
      i = j
      continue
    }
    const num = /^(\d[\d_]*(\.\d*)?([eE][+-]?\d+)?|\.\d+)/.exec(raw.slice(i))
    if (num) {
      tokens.push({ kind: 'number', text: num[0], start: i, end: i + num[0].length, depth })
      i += num[0].length
      continue
    }
    const word = /^[A-Za-z_]\w*/.exec(raw.slice(i))
    if (word) {
      const text = word[0]
      const kind: TokenKind = KEYWORDS.has(text) ? 'keyword' : BUILTINS.has(text) ? 'builtin' : 'name'
      tokens.push({ kind, text, start: i, end: i + text.length, depth })
      i += text.length
      continue
    }
    if (c === '\\' && raw.slice(i + 1).trim() === '') {
      tokens.push({ kind: 'punct', text: c, start: i, end: i + 1, depth })
      break
    }
    if (raw.startsWith(':=', i)) {
      tokens.push({ kind: 'op', text: ':=', start: i, end: i + 2, depth })
      i += 2
      continue
    }
    if (PUNCT.includes(c)) {
      if (OPENERS[c]) stack.push(c)
      else if (CLOSERS[c] && stack[stack.length - 1] === CLOSERS[c]) stack.pop()
      tokens.push({
        kind: 'punct',
        text: c,
        start: i,
        end: i + 1,
        depth: CLOSERS[c] ? stack.length : depth,
      })
      i += 1
      continue
    }
    const op = OPS.find((o) => raw.startsWith(o, i))
    if (op) {
      tokens.push({ kind: 'op', text: op, start: i, end: i + op.length, depth })
      i += op.length
      continue
    }
    tokens.push({ kind: 'unknown', text: c, start: i, end: i + 1, depth })
    i += 1
  }
  return { tokens, stack, unclosedQuote, tripleLeftOpen }
}

function kindOf(allTokens: Token[]): LineKind {
  const code = allTokens.filter((t) => t.kind !== 'comment')
  if (code.length === 0) return 'blank'
  if (code[0].text === 'async' && code.length > 1) return kindOf(code.slice(1))
  const first = code[0].text
  const last = code[code.length - 1].text
  if ((first === 'match' || first === 'case') && code.length > 2 && last === ':' && code[1].text !== '=' && code[1].text !== '.' && code[1].text !== '(') {
    return first as LineKind
  }
  const keywordKinds: Record<string, LineKind> = {
    if: 'if', elif: 'elif', else: 'else', for: 'for', while: 'while', def: 'def', class: 'class',
    try: 'try', except: 'except', finally: 'finally', with: 'with', return: 'return',
    break: 'break', continue: 'continue', pass: 'pass', import: 'import', from: 'import',
  }
  if (keywordKinds[first]) return keywordKinds[first]
  if (code.some((t) => t.depth === 0 && t.kind === 'op' && AUG_OPS.has(t.text))) return 'aug'
  if (code.some((t) => t.depth === 0 && t.kind === 'op' && t.text === '=')) return 'assign'
  if (first === 'print') return 'print'
  if (code.some((t, i) => t.text === '(' && i > 0 && ['name', 'builtin'].includes(code[i - 1].kind))) return 'call'
  return 'expr'
}

const CONTINUING_WORDS = new Set(['and', 'or', 'not', 'in', 'is', 'if', 'else', 'for', 'lambda'])

/** Does a line ending with this token clearly carry on onto the next line? */
function endsOpen(last: Token | undefined) {
  if (!last) return false
  if (OPENERS[last.text] || last.text === ',' || last.text === '.' || last.text === '\\') return true
  if (last.kind === 'op' && last.text !== '++' && last.text !== '--') return true
  return last.kind === 'keyword' && CONTINUING_WORDS.has(last.text)
}

type Pending = { stack: string[]; strong: boolean; headIndent: number; triple: string | null; explicit: boolean }

/**
 * Decides whether a line continues the statement above. Inside open brackets Python always
 * continues, but a learner's forgotten ")" must not swallow the rest of the program, so a
 * line only joins when it clearly belongs: the line above ends open, this one starts with a
 * closer or operator, or it is indented deeper than the statement's first line.
 */
function continuesStatement(raw: string, pending: Pending | null) {
  if (!pending) return false
  if (pending.triple || pending.explicit) return true
  if (pending.stack.length === 0) return false
  const text = raw.trim()
  if (text === '' || text.startsWith('#')) return true
  if (pending.strong) return true
  if (/^[)\]}]/.test(text)) return true
  if (/^(\.|[-+*/%@&|^<>=!]|and\b|or\b|not\b|in\b|if\b|else\b|for\b)/.test(text)) return true
  return indentOf(raw).width > pending.headIndent
}

export function analyzeLines(source: string): CodeLine[] {
  const rawLines = source.replace(/\r\n?/g, '\n').split('\n')
  const lines: CodeLine[] = []
  let pending: Pending | null = null
  rawLines.forEach((raw, index) => {
    const continuation = continuesStatement(raw, pending)
    const carried = continuation && pending ? pending.stack : []
    const { tokens, stack, unclosedQuote, tripleLeftOpen } = lexLine(raw, carried, continuation ? pending?.triple ?? null : null)
    const comment = tokens.find((t) => t.kind === 'comment')?.text ?? null
    const code = tokens.filter((t) => t.kind !== 'comment')
    const { width, hasTab } = indentOf(raw)
    const last = code[code.length - 1]
    const headIndent = continuation && pending ? pending.headIndent : width
    const blankInside = continuation && code.length === 0
    if (tripleLeftOpen || stack.length > 0 || last?.text === '\\') {
      pending = {
        stack,
        strong: blankInside ? (pending?.strong ?? false) : endsOpen(last),
        headIndent,
        triple: tripleLeftOpen,
        explicit: last?.text === '\\',
      }
    } else if (!blankInside) {
      pending = null
    }
    lines.push({
      no: index + 1,
      raw,
      text: raw.trim(),
      indent: width,
      hasTab,
      tokens,
      code,
      comment,
      kind: code.length === 0 ? (comment ? 'comment' : 'blank') : continuation ? 'expr' : kindOf(code),
      unclosedQuote,
      openAtEnd: stack,
      continuation,
      openAtStart: carried,
      endNo: index + 1,
    })
  })
  for (let i = lines.length - 1, end = lines.length; i >= 0; i -= 1) {
    const next = lines[i + 1]
    if (!next || !next.continuation) end = lines[i].no
    lines[i].endNo = end
  }
  return lines
}

/**
 * Joins a statement that spans several lines into one line (comments dropped), so it can be
 * read as a whole. Positions in the result refer to its own `raw` text.
 */
export function logicalLine(lines: CodeLine[], head: CodeLine): CodeLine {
  if (head.endNo === head.no) return head
  const parts = lines
    .filter((l) => l.no >= head.no && l.no <= head.endNo)
    .map((l, i) => {
      const end = l.code[l.code.length - 1]
      const text = end ? l.raw.slice(0, end.end) : ''
      return (i === 0 ? text : text.trim()).replace(/\\$/, '')
    })
    .filter(Boolean)
  const raw = parts.reduce((joined, part) => {
    if (!joined) return part
    const glue = /[([{]$/.test(joined) || /^[)\]}]/.test(part) ? '' : ' '
    return joined.trimEnd() + glue + part
  }, '')
  const { tokens, stack, unclosedQuote } = lexLine(raw, [])
  return {
    ...head,
    raw,
    text: raw.trim(),
    tokens,
    code: tokens.filter((t) => t.kind !== 'comment'),
    comment: null,
    kind: kindOf(tokens),
    unclosedQuote,
    openAtEnd: stack,
  }
}

export function isCodeLine(line: CodeLine) {
  return line.kind !== 'blank' && line.kind !== 'comment'
}

/** Damerau–Levenshtein distance (with swaps) for spotting typos like "pritn". */
export function editDistance(a: string, b: string) {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
      }
    }
  }
  return d[a.length][b.length]
}

export function closest(word: string, candidates: Iterable<string>, maxDistance = 2) {
  let best: string | null = null
  let bestScore = Infinity
  for (const candidate of candidates) {
    if (candidate === word) continue
    const limit = Math.min(maxDistance, candidate.length <= 3 ? 1 : maxDistance)
    const score = editDistance(word.toLowerCase(), candidate.toLowerCase())
    if (score <= limit && score < bestScore) {
      best = candidate
      bestScore = score
    }
  }
  return best
}

export function replaceToken(line: CodeLine, token: Token, text: string) {
  return line.raw.slice(0, token.start) + text + line.raw.slice(token.end)
}

/** Content of a string token without its prefix and quotes. */
/** The function or class name token on a def/class line (handles `async def`). */
export function definedNameToken(line: CodeLine): Token | undefined {
  const at = line.code.findIndex((t) => t.text === 'def' || t.text === 'class')
  return at >= 0 ? line.code[at + 1] : undefined
}

export function stringContent(text: string) {
  if (!/["']/.test(text)) return text
  const body = text.replace(/^[fFrRbBuU]{0,2}/, '')
  const quote = body.startsWith('"""') || body.startsWith("'''") ? body.slice(0, 3) : body[0]
  return body.slice(quote.length, body.endsWith(quote) && body.length >= quote.length * 2 ? -quote.length : undefined)
}

function isWordToken(t: Token) {
  return t.kind === 'keyword' || t.kind === 'builtin' || t.kind === 'name' || t.kind === 'number'
}

/** Spacing- and quote-insensitive form of a line, used to compare retyped code. */
export function normalizeLine(line: CodeLine) {
  let out = ''
  let prev: Token | null = null
  for (const t of line.code) {
    const text =
      t.kind === 'string'
        ? `${/^[fFrRbBuU]{0,2}/.exec(t.text)?.[0].toLowerCase() ?? ''}"${stringContent(t.text)}"`
        : t.text
    if (prev && isWordToken(prev) && isWordToken(t)) out += ' '
    out += text
    prev = t
  }
  return out
}

const KEEP_IN_SKELETON = new Set<TokenKind>(['keyword', 'builtin', 'op', 'punct'])

/** The line with names, numbers and text blanked out — the "shape" to remember. */
export function skeletonLine(line: CodeLine, keepNames: Set<string> = new Set()) {
  let out = ''
  let at = 0
  line.code.forEach((t, i) => {
    out += line.raw.slice(at, t.start)
    const afterDot = line.code[i - 1]?.text === '.'
    if (KEEP_IN_SKELETON.has(t.kind) || afterDot || keepNames.has(t.text)) out += t.text
    else if (t.kind === 'string') out += `${/^[fFrRbBuU]{0,2}/.exec(t.text)?.[0] ?? ''}"___"`
    else out += '___'
    at = t.end
  })
  return out.trimEnd()
}
