/**
 * A tiny, safe Python simulator for the short lesson examples.
 * It never touches the network or the real Python runtime. It records what
 * happens while the code runs (values, decisions, loop rounds, function calls)
 * so the Learn page can draw a picture of it.
 */

export class PyFloat {
  v: number
  constructor(v: number) {
    this.v = v
  }
}

export type PyList = { kind: 'list' | 'tuple'; items: PyVal[] }
export type PyDict = { kind: 'dict'; map: Map<string | number, PyVal> }
export type PyFunc = { kind: 'func'; name: string; params: Param[]; body: Stmt[]; signature: string }
export type PyVal = null | boolean | number | string | PyFloat | PyList | PyDict | PyFunc

type Param = { name: string; def: Expr | null }

export type Expr =
  | { k: 'val'; v: PyVal }
  | { k: 'name'; id: string }
  | { k: 'list' | 'tuple'; items: Expr[] }
  | { k: 'dict'; entries: [Expr, Expr][] }
  | { k: 'bin'; op: string; l: Expr; r: Expr }
  | { k: 'un'; op: string; e: Expr }
  | { k: 'if'; cond: Expr; a: Expr; b: Expr }
  | { k: 'call'; fn: Expr; args: Expr[]; kw: [string, Expr][] }
  | { k: 'attr'; obj: Expr; name: string }
  | { k: 'index'; obj: Expr; idx: Expr }
  | { k: 'slice'; obj: Expr; lo: Expr | null; hi: Expr | null }

type Base = { src: string }
export type Stmt = Base &
  (
    | { k: 'expr'; e: Expr }
    | { k: 'assign'; target: Expr; e: Expr }
    | { k: 'aug'; target: Expr; op: string; e: Expr }
    | { k: 'if'; branches: { cond: Expr; src: string; body: Stmt[] }[]; orelse: Stmt[] | null }
    | { k: 'while'; cond: Expr; body: Stmt[] }
    | { k: 'for'; targets: string[]; iter: Expr; body: Stmt[] }
    | { k: 'def'; name: string; params: Param[]; body: Stmt[] }
    | { k: 'return'; e: Expr | null }
    | { k: 'break' }
    | { k: 'continue' }
    | { k: 'pass' }
  )

/* ───────────── Tokenizer ───────────── */

type Tok = { t: 'num' | 'str' | 'name' | 'op'; v: string }

const OPS = [
  '**', '//', '==', '!=', '<=', '>=', '+=', '-=', '*=', '/=',
  '+', '-', '*', '/', '%', '<', '>', '=', '(', ')', '[', ']', '{', '}', ',', ':', '.', '&', '|', '^',
]

function tokenize(src: string): Tok[] {
  const toks: Tok[] = []
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (c === ' ' || c === '\t') {
      i++
      continue
    }
    if (c === '#') break
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      let j = i
      while (j < src.length && /[0-9._]/.test(src[j])) j++
      toks.push({ t: 'num', v: src.slice(i, j) })
      i = j
      continue
    }
    if (c === '"' || c === "'") {
      let j = i + 1
      let s = ''
      while (j < src.length && src[j] !== c) {
        if (src[j] === '\\') {
          const n = src[j + 1]
          s += n === 'n' ? '\n' : n === 't' ? '\t' : n
          j += 2
        } else {
          s += src[j++]
        }
      }
      toks.push({ t: 'str', v: s })
      i = j + 1
      continue
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i
      while (j < src.length && /\w/.test(src[j])) j++
      toks.push({ t: 'name', v: src.slice(i, j) })
      i = j
      continue
    }
    const op = OPS.find((o) => src.startsWith(o, i))
    if (!op) throw new Error(`Unsupported character ${c}`)
    toks.push({ t: 'op', v: op })
    i += op.length
  }
  return toks
}

/* ───────────── Expression parser ───────────── */

class ExprParser {
  pos = 0
  private toks: Tok[]
  constructor(toks: Tok[]) {
    this.toks = toks
  }

  peek(offset = 0) {
    return this.toks[this.pos + offset]
  }
  isOp(v: string) {
    const t = this.peek()
    return t?.t === 'op' && t.v === v
  }
  isName(v: string) {
    const t = this.peek()
    return t?.t === 'name' && t.v === v
  }
  eat(v: string) {
    if (this.isOp(v) || this.isName(v)) {
      this.pos++
      return true
    }
    return false
  }
  expect(v: string) {
    if (!this.eat(v)) throw new Error(`Expected ${v}`)
  }
  done() {
    return this.pos >= this.toks.length
  }

  expr(): Expr {
    const a = this.or()
    if (this.isName('if')) {
      this.pos++
      const cond = this.or()
      this.expect('else')
      return { k: 'if', cond, a, b: this.expr() }
    }
    return a
  }
  or(): Expr {
    let l = this.and()
    while (this.eat('or')) l = { k: 'bin', op: 'or', l, r: this.and() }
    return l
  }
  and(): Expr {
    let l = this.not()
    while (this.eat('and')) l = { k: 'bin', op: 'and', l, r: this.not() }
    return l
  }
  not(): Expr {
    if (this.eat('not')) return { k: 'un', op: 'not', e: this.not() }
    return this.cmp()
  }
  cmp(): Expr {
    let l = this.bitor()
    for (;;) {
      const t = this.peek()
      let op: string | null = null
      if (t?.t === 'op' && ['<', '>', '==', '!=', '<=', '>='].includes(t.v)) {
        op = t.v
        this.pos++
      } else if (this.isName('in')) {
        op = 'in'
        this.pos++
      } else if (this.isName('not') && this.peek(1)?.v === 'in') {
        op = 'not in'
        this.pos += 2
      } else if (this.isName('is')) {
        this.pos++
        op = this.eat('not') ? 'is not' : 'is'
      }
      if (!op) return l
      l = { k: 'bin', op, l, r: this.bitor() }
    }
  }
  bitor(): Expr {
    let l = this.bitxor()
    while (this.eat('|')) l = { k: 'bin', op: '|', l, r: this.bitxor() }
    return l
  }
  bitxor(): Expr {
    let l = this.bitand()
    while (this.eat('^')) l = { k: 'bin', op: '^', l, r: this.bitand() }
    return l
  }
  bitand(): Expr {
    let l = this.add()
    while (this.eat('&')) l = { k: 'bin', op: '&', l, r: this.add() }
    return l
  }
  add(): Expr {
    let l = this.mul()
    while (this.isOp('+') || this.isOp('-')) {
      const op = this.toks[this.pos++].v
      l = { k: 'bin', op, l, r: this.mul() }
    }
    return l
  }
  mul(): Expr {
    let l = this.unary()
    while (this.isOp('*') || this.isOp('/') || this.isOp('//') || this.isOp('%')) {
      const op = this.toks[this.pos++].v
      l = { k: 'bin', op, l, r: this.unary() }
    }
    return l
  }
  unary(): Expr {
    if (this.isOp('-') || this.isOp('+')) {
      const op = this.toks[this.pos++].v
      return { k: 'un', op, e: this.unary() }
    }
    return this.power()
  }
  power(): Expr {
    const base = this.postfix()
    if (this.eat('**')) return { k: 'bin', op: '**', l: base, r: this.unary() }
    return base
  }
  postfix(): Expr {
    let e = this.atom()
    for (;;) {
      if (this.eat('(')) {
        const args: Expr[] = []
        const kw: [string, Expr][] = []
        while (!this.isOp(')')) {
          if (this.peek()?.t === 'name' && this.peek(1)?.t === 'op' && this.peek(1)?.v === '=') {
            const name = this.toks[this.pos].v
            this.pos += 2
            kw.push([name, this.expr()])
          } else {
            args.push(this.expr())
          }
          if (!this.eat(',')) break
        }
        this.expect(')')
        e = { k: 'call', fn: e, args, kw }
      } else if (this.eat('[')) {
        let lo: Expr | null = null
        if (!this.isOp(':')) lo = this.expr()
        if (this.eat(':')) {
          const hi = this.isOp(']') ? null : this.expr()
          this.expect(']')
          e = { k: 'slice', obj: e, lo, hi }
        } else {
          this.expect(']')
          e = { k: 'index', obj: e, idx: lo! }
        }
      } else if (this.eat('.')) {
        e = { k: 'attr', obj: e, name: this.toks[this.pos++].v }
      } else {
        return e
      }
    }
  }
  atom(): Expr {
    const t = this.toks[this.pos++]
    if (!t) throw new Error('Unexpected end of line')
    if (t.t === 'num') {
      return {
        k: 'val',
        v: t.v.includes('.') ? new PyFloat(parseFloat(t.v)) : parseInt(t.v.replace(/_/g, ''), 10),
      }
    }
    if (t.t === 'str') {
      let s = t.v
      while (this.peek()?.t === 'str') s += this.toks[this.pos++].v
      return { k: 'val', v: s }
    }
    if (t.t === 'name') {
      if (t.v === 'True') return { k: 'val', v: true }
      if (t.v === 'False') return { k: 'val', v: false }
      if (t.v === 'None') return { k: 'val', v: null }
      return { k: 'name', id: t.v }
    }
    if (t.v === '(') {
      if (this.eat(')')) return { k: 'tuple', items: [] }
      const first = this.expr()
      if (this.isOp(',')) {
        const items = [first]
        while (this.eat(',')) {
          if (this.isOp(')')) break
          items.push(this.expr())
        }
        this.expect(')')
        return { k: 'tuple', items }
      }
      this.expect(')')
      return first
    }
    if (t.v === '[') {
      const items: Expr[] = []
      while (!this.isOp(']')) {
        items.push(this.expr())
        if (!this.eat(',')) break
      }
      this.expect(']')
      return { k: 'list', items }
    }
    if (t.v === '{') {
      const entries: [Expr, Expr][] = []
      while (!this.isOp('}')) {
        const key = this.expr()
        this.expect(':')
        entries.push([key, this.expr()])
        if (!this.eat(',')) break
      }
      this.expect('}')
      return { k: 'dict', entries }
    }
    throw new Error(`Unexpected ${t.v}`)
  }
}

export function parseExpr(src: string): Expr {
  const p = new ExprParser(tokenize(src))
  const e = p.expr()
  if (!p.done()) throw new Error(`Could not read: ${src}`)
  return e
}

/* ───────────── Statement parser ───────────── */

type Line = { indent: number; text: string }

function splitTopLevel(src: string, sep: string): string[] {
  const parts: string[] = []
  let depth = 0
  let quote: string | null = null
  let cur = ''
  for (const ch of src) {
    if (quote) {
      if (ch === quote) quote = null
    } else if (ch === '"' || ch === "'") {
      quote = ch
    } else if ('([{'.includes(ch)) {
      depth++
    } else if (')]}'.includes(ch)) {
      depth--
    } else if (ch === sep && depth === 0) {
      parts.push(cur.trim())
      cur = ''
      continue
    }
    cur += ch
  }
  if (cur.trim()) parts.push(cur.trim())
  return parts
}

function headerExpr(text: string, keyword: string) {
  return text.slice(keyword.length).replace(/:\s*$/, '').trim()
}

function parseSimple(text: string): Stmt {
  if (text === 'break') return { k: 'break', src: text }
  if (text === 'continue') return { k: 'continue', src: text }
  if (text === 'pass') return { k: 'pass', src: text }
  if (/^return\b/.test(text)) {
    const rest = text.slice(6).trim()
    return { k: 'return', e: rest ? parseExpr(rest) : null, src: text }
  }
  const toks = tokenize(text)
  let depth = 0
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]
    if (t.t !== 'op') continue
    if ('([{'.includes(t.v)) depth++
    else if (')]}'.includes(t.v)) depth--
    else if (depth === 0 && ['=', '+=', '-=', '*=', '/='].includes(t.v)) {
      const left = new ExprParser(toks.slice(0, i)).expr()
      const rightParser = new ExprParser(toks.slice(i + 1))
      const right = rightParser.expr()
      if (!rightParser.done()) throw new Error(`Could not read: ${text}`)
      if (t.v === '=') return { k: 'assign', target: left, e: right, src: text }
      return { k: 'aug', target: left, op: t.v.slice(0, -1), e: right, src: text }
    }
  }
  return { k: 'expr', e: parseExpr(text), src: text }
}

function parseBlock(lines: Line[], start: number, indent: number): [Stmt[], number] {
  const out: Stmt[] = []
  let i = start
  const body = (at: number): [Stmt[], number] => {
    const next = lines[at + 1]
    if (!next || next.indent <= lines[at].indent) throw new Error('Expected an indented block')
    return parseBlock(lines, at + 1, next.indent)
  }

  while (i < lines.length && lines[i].indent === indent) {
    const { text } = lines[i]
    if (/^if\b/.test(text)) {
      const branches: { cond: Expr; src: string; body: Stmt[] }[] = []
      const [first, after] = body(i)
      branches.push({ cond: parseExpr(headerExpr(text, 'if')), src: text, body: first })
      i = after
      let orelse: Stmt[] | null = null
      while (i < lines.length && lines[i].indent === indent && /^elif\b/.test(lines[i].text)) {
        const [b, next] = body(i)
        branches.push({ cond: parseExpr(headerExpr(lines[i].text, 'elif')), src: lines[i].text, body: b })
        i = next
      }
      if (i < lines.length && lines[i].indent === indent && /^else\s*:/.test(lines[i].text)) {
        const [b, next] = body(i)
        orelse = b
        i = next
      }
      out.push({ k: 'if', branches, orelse, src: text })
      continue
    }
    if (/^while\b/.test(text)) {
      const [b, next] = body(i)
      out.push({ k: 'while', cond: parseExpr(headerExpr(text, 'while')), body: b, src: text })
      i = next
      continue
    }
    const forMatch = text.match(/^for\s+(.+?)\s+in\s+(.+):$/)
    if (forMatch) {
      const [b, next] = body(i)
      out.push({
        k: 'for',
        targets: forMatch[1].split(',').map((s) => s.trim()),
        iter: parseExpr(forMatch[2]),
        body: b,
        src: text,
      })
      i = next
      continue
    }
    const defMatch = text.match(/^def\s+(\w+)\((.*)\)\s*:$/)
    if (defMatch) {
      const [b, next] = body(i)
      const params = splitTopLevel(defMatch[2], ',').map((p) => {
        const [name, def] = p.split('=').map((s) => s.trim())
        return { name, def: def ? parseExpr(def) : null }
      })
      out.push({ k: 'def', name: defMatch[1], params, body: b, src: text })
      i = next
      continue
    }
    out.push(parseSimple(text))
    i++
  }
  return [out, i]
}

export function parseProgram(code: string): { program: Stmt[]; comments: string[] } {
  const comments: string[] = []
  const lines: Line[] = []
  for (const raw of code.split('\n')) {
    const text = raw.trim()
    if (!text) continue
    if (text.startsWith('#')) {
      comments.push(text)
      continue
    }
    lines.push({ indent: raw.length - raw.trimStart().length, text })
  }
  if (!lines.length) return { program: [], comments }
  const [program, end] = parseBlock(lines, 0, lines[0].indent)
  if (end !== lines.length) throw new Error('Unexpected indentation')
  return { program, comments }
}

/* ───────────── Values ───────────── */

export function isNum(v: PyVal): v is number | PyFloat | boolean {
  return typeof v === 'number' || v instanceof PyFloat || typeof v === 'boolean'
}

function num(v: PyVal): number {
  if (typeof v === 'number') return v
  if (v instanceof PyFloat) return v.v
  if (typeof v === 'boolean') return v ? 1 : 0
  throw new Error('Expected a number')
}

function isFloat(v: PyVal) {
  return v instanceof PyFloat
}

function isSeq(v: PyVal): v is PyList {
  return typeof v === 'object' && v !== null && 'kind' in v && (v.kind === 'list' || v.kind === 'tuple')
}

function isDict(v: PyVal): v is PyDict {
  return typeof v === 'object' && v !== null && 'kind' in v && v.kind === 'dict'
}

export function truthy(v: PyVal): boolean {
  if (v === null) return false
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  if (v instanceof PyFloat) return v.v !== 0
  if (typeof v === 'string') return v.length > 0
  if (isSeq(v)) return v.items.length > 0
  if (isDict(v)) return v.map.size > 0
  return true
}

function floatText(n: number) {
  if (Number.isInteger(n)) return `${n}.0`
  return String(n)
}

/** Text the way Python shows it: `str()` at the top, `repr()` inside containers. */
export function pyStr(v: PyVal, nested = false, quote: '"' | "'" = "'"): string {
  if (v === null) return 'None'
  if (typeof v === 'boolean') return v ? 'True' : 'False'
  if (typeof v === 'number') return String(v)
  if (v instanceof PyFloat) return floatText(v.v)
  if (typeof v === 'string') {
    if (!nested) return v
    const q = quote === "'" && v.includes("'") && !v.includes('"') ? '"' : quote
    return `${q}${v.replace(/\n/g, '\\n')}${q}`
  }
  if (v.kind === 'list') return `[${v.items.map((x) => pyStr(x, true, quote)).join(', ')}]`
  if (v.kind === 'tuple') {
    const inner = v.items.map((x) => pyStr(x, true, quote))
    return inner.length === 1 ? `(${inner[0]},)` : `(${inner.join(', ')})`
  }
  if (v.kind === 'dict') {
    const parts = [...v.map.entries()].map(([k, x]) => `${pyStr(k, true, quote)}: ${pyStr(x, true, quote)}`)
    return `{${parts.join(', ')}}`
  }
  return `<function ${(v as PyFunc).name}>`
}

export function clone(v: PyVal): PyVal {
  if (isSeq(v)) return { kind: v.kind, items: v.items.map(clone) }
  if (isDict(v)) return { kind: 'dict', map: new Map([...v.map.entries()].map(([k, x]) => [k, clone(x)])) }
  return v
}

function eq(a: PyVal, b: PyVal): boolean {
  if (isNum(a) && isNum(b)) return num(a) === num(b)
  if (isSeq(a) && isSeq(b)) return a.kind === b.kind && a.items.length === b.items.length && a.items.every((x, i) => eq(x, b.items[i]))
  if (isDict(a) && isDict(b)) {
    if (a.map.size !== b.map.size) return false
    return [...a.map.entries()].every(([k, x]) => b.map.has(k) && eq(x, b.map.get(k)!))
  }
  return a === b
}

function dictKey(v: PyVal): string | number {
  if (typeof v === 'string' || typeof v === 'number') return v
  if (typeof v === 'boolean') return v ? 1 : 0
  throw new Error('Unsupported dictionary key')
}

function iterate(v: PyVal): PyVal[] {
  if (isSeq(v)) return v.items
  if (typeof v === 'string') return [...v]
  if (isDict(v)) return [...v.map.keys()]
  throw new Error('Not iterable')
}

function numResult(a: PyVal, b: PyVal, n: number): PyVal {
  return isFloat(a) || isFloat(b) ? new PyFloat(n) : n
}

function binary(op: string, a: PyVal, b: PyVal): PyVal {
  switch (op) {
    case '+':
      if (typeof a === 'string' && typeof b === 'string') return a + b
      if (isSeq(a) && isSeq(b) && a.kind === b.kind) return { kind: a.kind, items: [...a.items, ...b.items] }
      if (isNum(a) && isNum(b)) return numResult(a, b, num(a) + num(b))
      throw new Error('TypeError: cannot add these values')
    case '-':
      return numResult(a, b, num(a) - num(b))
    case '*':
      if (typeof a === 'string' && typeof b === 'number') return a.repeat(Math.max(0, b))
      if (isSeq(a) && typeof b === 'number') return { kind: a.kind, items: Array.from({ length: Math.max(0, b) }, () => a.items).flat() }
      return numResult(a, b, num(a) * num(b))
    case '/':
      if (num(b) === 0) throw new Error('ZeroDivisionError')
      return new PyFloat(num(a) / num(b))
    case '//':
      if (num(b) === 0) throw new Error('ZeroDivisionError')
      return numResult(a, b, Math.floor(num(a) / num(b)))
    case '%': {
      const m = num(b)
      if (m === 0) throw new Error('ZeroDivisionError')
      return numResult(a, b, ((num(a) % m) + m) % m)
    }
    case '**': {
      const r = num(a) ** num(b)
      return typeof a === 'number' && typeof b === 'number' && b >= 0 ? r : new PyFloat(r)
    }
    case '&':
      return num(a) & num(b)
    case '|':
      return num(a) | num(b)
    case '^':
      return num(a) ^ num(b)
    case '==':
      return eq(a, b)
    case '!=':
      return !eq(a, b)
    case '<':
    case '>':
    case '<=':
    case '>=': {
      const x = typeof a === 'string' && typeof b === 'string' ? a.localeCompare(b) : num(a) - num(b)
      return op === '<' ? x < 0 : op === '>' ? x > 0 : op === '<=' ? x <= 0 : x >= 0
    }
    case 'in':
    case 'not in': {
      let found: boolean
      if (typeof b === 'string') found = typeof a === 'string' && b.includes(a)
      else if (isDict(b)) found = b.map.has(dictKey(a))
      else found = iterate(b).some((x) => eq(x, a))
      return op === 'in' ? found : !found
    }
    case 'is':
      return a === b || (a === null && b === null)
    case 'is not':
      return !(a === b || (a === null && b === null))
  }
  throw new Error(`Unsupported operator ${op}`)
}

/* ───────────── Recording types ───────────── */

export type Round = {
  label: string
  check?: string
  passed?: boolean
  prints: string[]
  changes: string[]
  event?: 'break' | 'continue' | 'end'
  inner?: LoopRecord
}

export type LoopRecord = {
  header: string
  kind: 'for' | 'while'
  iterText: string
  rounds: Round[]
  notReached: string[]
}

export type BranchCheck = {
  question: string
  substituted: string
  result: boolean | null
  action: string[]
  nested: DecisionRecord | null
}

export type DecisionRecord = {
  checks: BranchCheck[]
  elseAction: string[] | null
  elseTaken: boolean
}

export type TernaryRecord = {
  target: string
  question: string
  substituted: string
  result: boolean
  yes: string
  no: string
}

export type CallRecord = {
  name: string
  signature: string
  body: string[]
  inputs: { name: string; value: string; isDefault: boolean }[]
  result: string | null
  prints: string[]
}

export type ExprSteps = { label: string; steps: string[] }

export type RunResult = {
  output: string[]
  comments: string[]
  program: Stmt[]
  firstValues: Map<string, PyVal>
  finalValues: Map<string, PyVal>
  loops: LoopRecord[]
  decisions: DecisionRecord[]
  ternaries: TernaryRecord[]
  calls: CallRecord[]
  exprSteps: ExprSteps[]
}

/* ───────────── Rendering expressions back to code ───────────── */

const PREC: Record<string, number> = {
  or: 1, and: 2, not: 3,
  in: 4, 'not in': 4, is: 4, 'is not': 4, '<': 4, '>': 4, '==': 4, '!=': 4, '<=': 4, '>=': 4,
  '|': 5, '^': 6, '&': 7, '+': 8, '-': 8, '*': 9, '/': 9, '//': 9, '%': 9, '**': 11,
}

function precOf(e: Expr): number {
  if (e.k === 'if') return 0
  if (e.k === 'bin') return PREC[e.op] ?? 4
  if (e.k === 'un') return e.op === 'not' ? 3 : 10
  return 13
}

export function render(e: Expr): string {
  const wrap = (child: Expr, min: number) => (precOf(child) < min ? `(${render(child)})` : render(child))
  switch (e.k) {
    case 'val':
      return pyStr(e.v, true, '"')
    case 'name':
      return e.id
    case 'list':
      return `[${e.items.map(render).join(', ')}]`
    case 'tuple':
      return e.items.length === 1 ? `(${render(e.items[0])},)` : `(${e.items.map(render).join(', ')})`
    case 'dict':
      return `{${e.entries.map(([k, v]) => `${render(k)}: ${render(v)}`).join(', ')}}`
    case 'bin': {
      const p = PREC[e.op] ?? 4
      const right = e.op === '**' ? p : p + 1
      const left = e.op === '**' ? p + 1 : p
      return `${wrap(e.l, left)} ${e.op} ${wrap(e.r, right)}`
    }
    case 'un':
      return e.op === 'not' ? `not ${wrap(e.e, 3)}` : `${e.op}${wrap(e.e, 10)}`
    case 'if':
      return `${wrap(e.a, 1)} if ${wrap(e.cond, 1)} else ${render(e.b)}`
    case 'call': {
      const args = [...e.args.map(render), ...e.kw.map(([k, v]) => `${k}=${render(v)}`)]
      return `${wrap(e.fn, 12)}(${args.join(', ')})`
    }
    case 'attr':
      return `${wrap(e.obj, 12)}.${e.name}`
    case 'index':
      return `${wrap(e.obj, 12)}[${render(e.idx)}]`
    case 'slice':
      return `${wrap(e.obj, 12)}[${e.lo ? render(e.lo) : ''}:${e.hi ? render(e.hi) : ''}]`
  }
}

/* ───────────── Interpreter ───────────── */

type LineError = Error & { pySrc?: string }

class Signal {
  kind: 'break' | 'continue' | 'return'
  value: PyVal
  constructor(kind: 'break' | 'continue' | 'return', value: PyVal = null) {
    this.kind = kind
    this.value = value
  }
}

const PURE_CALLS = new Set([
  'str', 'int', 'float', 'len', 'list', 'range', 'sum', 'max', 'min', 'abs', 'bool', 'round',
  'get', 'count', 'keys', 'values', 'items', 'upper', 'lower', 'strip', 'title', 'index',
])

const MAX_STEPS = 3000

class Interpreter {
  globals = new Map<string, PyVal>()
  locals: Map<string, PyVal> | null = null
  steps = 0
  depth = { loop: 0, call: 0, decision: 0 }
  rounds: Round[] = []
  callPrints: string[][] = []

  result: RunResult

  constructor(program: Stmt[], comments: string[]) {
    this.result = {
      output: [],
      comments,
      program,
      firstValues: new Map(),
      finalValues: this.globals,
      loops: [],
      decisions: [],
      ternaries: [],
      calls: [],
      exprSteps: [],
    }
  }

  tick() {
    if (++this.steps > MAX_STEPS) throw new Error('Too many steps')
  }

  lookup(id: string): PyVal {
    if (this.locals?.has(id)) return this.locals.get(id)!
    if (this.globals.has(id)) return this.globals.get(id)!
    throw new Error(`NameError: ${id}`)
  }

  has(id: string) {
    return Boolean(this.locals?.has(id) || this.globals.has(id))
  }

  setName(id: string, v: PyVal) {
    if (this.locals) {
      this.locals.set(id, v)
      return
    }
    if (!this.globals.has(id) && !this.result.firstValues.has(id)) this.result.firstValues.set(id, clone(v))
    this.globals.set(id, v)
  }

  print(text: string) {
    this.result.output.push(text)
    const round = this.rounds[this.rounds.length - 1]
    if (round) round.prints.push(text)
    const call = this.callPrints[this.callPrints.length - 1]
    if (call) call.push(text)
  }

  noteChange(text: string) {
    const round = this.rounds[this.rounds.length - 1]
    if (round && this.depth.call === 0) round.changes.push(text)
  }

  /* expressions */

  eval(e: Expr): PyVal {
    this.tick()
    switch (e.k) {
      case 'val':
        return e.v
      case 'name':
        return this.lookup(e.id)
      case 'list':
      case 'tuple':
        return { kind: e.k, items: e.items.map((x) => this.eval(x)) }
      case 'dict': {
        const map = new Map<string | number, PyVal>()
        for (const [k, v] of e.entries) map.set(dictKey(this.eval(k)), this.eval(v))
        return { kind: 'dict', map }
      }
      case 'bin': {
        if (e.op === 'and') {
          const l = this.eval(e.l)
          return truthy(l) ? this.eval(e.r) : l
        }
        if (e.op === 'or') {
          const l = this.eval(e.l)
          return truthy(l) ? l : this.eval(e.r)
        }
        return binary(e.op, this.eval(e.l), this.eval(e.r))
      }
      case 'un': {
        const v = this.eval(e.e)
        if (e.op === 'not') return !truthy(v)
        if (e.op === '-') return isFloat(v) ? new PyFloat(-num(v)) : -num(v)
        return v
      }
      case 'if':
        return truthy(this.eval(e.cond)) ? this.eval(e.a) : this.eval(e.b)
      case 'index': {
        const obj = this.eval(e.obj)
        const idx = this.eval(e.idx)
        if (isDict(obj)) {
          const key = dictKey(idx)
          if (!obj.map.has(key)) throw new Error(`KeyError: ${pyStr(idx, true)}`)
          return obj.map.get(key)!
        }
        const items = typeof obj === 'string' ? [...obj] : iterate(obj)
        let i = num(idx)
        if (i < 0) i += items.length
        if (i < 0 || i >= items.length) throw new Error('IndexError')
        return items[i]
      }
      case 'slice': {
        const obj = this.eval(e.obj)
        const lo = e.lo ? num(this.eval(e.lo)) : undefined
        const hi = e.hi ? num(this.eval(e.hi)) : undefined
        if (typeof obj === 'string') return obj.slice(lo, hi)
        if (isSeq(obj)) return { kind: obj.kind, items: obj.items.slice(lo, hi) }
        throw new Error('Cannot slice')
      }
      case 'attr':
        throw new Error('Attributes are only supported as method calls')
      case 'call':
        return this.call(e)
    }
  }

  call(e: Extract<Expr, { k: 'call' }>): PyVal {
    if (e.fn.k === 'attr') return this.method(this.eval(e.fn.obj), e.fn.name, e.args.map((a) => this.eval(a)))
    if (e.fn.k !== 'name') throw new Error('Unsupported call')
    const name = e.fn.id
    const args = e.args.map((a) => this.eval(a))
    const kw = e.kw.map(([k, v]) => [k, this.eval(v)] as const)

    if (this.has(name)) {
      const fn = this.lookup(name)
      if (typeof fn === 'object' && fn !== null && 'kind' in fn && fn.kind === 'func') return this.callUser(fn, args, kw)
    }

    switch (name) {
      case 'print': {
        const sepEntry = kw.find(([k]) => k === 'sep')
        const sep = sepEntry ? pyStr(sepEntry[1]) : ' '
        this.print(args.map((a) => pyStr(a)).join(sep))
        return null
      }
      case 'str':
        return args.length ? pyStr(args[0]) : ''
      case 'int':
        return typeof args[0] === 'string' ? parseInt(args[0], 10) : Math.trunc(num(args[0]))
      case 'float':
        return new PyFloat(typeof args[0] === 'string' ? parseFloat(args[0]) : num(args[0]))
      case 'bool':
        return truthy(args[0])
      case 'len':
        return typeof args[0] === 'string' ? args[0].length : isDict(args[0]) ? args[0].map.size : iterate(args[0]).length
      case 'list':
        return { kind: 'list', items: args.length ? [...iterate(args[0])] : [] }
      case 'range': {
        const [a, b, s] = args.map(num)
        const start = args.length > 1 ? a : 0
        const stop = args.length > 1 ? b : a
        const step = args.length > 2 ? s : 1
        if (step === 0) throw new Error('range step cannot be 0')
        const items: PyVal[] = []
        for (let i = start; step > 0 ? i < stop : i > stop; i += step) {
          items.push(i)
          if (items.length > 500) throw new Error('range too long')
        }
        return { kind: 'list', items }
      }
      case 'sum':
        return iterate(args[0]).reduce<PyVal>((acc, x) => binary('+', acc, x), 0)
      case 'max':
      case 'min': {
        const items = args.length === 1 ? iterate(args[0]) : args
        return items.reduce((best, x) => (binary(name === 'max' ? '>' : '<', x, best) ? x : best))
      }
      case 'abs':
        return isFloat(args[0]) ? new PyFloat(Math.abs(num(args[0]))) : Math.abs(num(args[0]))
      case 'round':
        return Math.round(num(args[0]))
      case 'input':
        return ''
    }
    throw new Error(`Unknown function ${name}`)
  }

  method(obj: PyVal, name: string, args: PyVal[]): PyVal {
    if (isSeq(obj)) {
      switch (name) {
        case 'append':
          obj.items.push(args[0])
          return null
        case 'count':
          return obj.items.filter((x) => eq(x, args[0])).length
        case 'index':
          return obj.items.findIndex((x) => eq(x, args[0]))
        case 'pop': {
          let i = args.length ? num(args[0]) : obj.items.length - 1
          if (i < 0) i += obj.items.length
          return obj.items.splice(i, 1)[0] ?? null
        }
        case 'remove': {
          const i = obj.items.findIndex((x) => eq(x, args[0]))
          if (i < 0) throw new Error('ValueError')
          obj.items.splice(i, 1)
          return null
        }
        case 'insert':
          obj.items.splice(num(args[0]), 0, args[1])
          return null
        case 'sort':
          obj.items.sort((a, b) => (binary('<', a, b) ? -1 : binary('>', a, b) ? 1 : 0))
          return null
        case 'reverse':
          obj.items.reverse()
          return null
      }
    }
    if (isDict(obj)) {
      switch (name) {
        case 'get': {
          const key = dictKey(args[0])
          return obj.map.has(key) ? obj.map.get(key)! : (args[1] ?? null)
        }
        case 'keys':
          return { kind: 'list', items: [...obj.map.keys()] }
        case 'values':
          return { kind: 'list', items: [...obj.map.values()] }
        case 'items':
          return { kind: 'list', items: [...obj.map.entries()].map(([k, v]) => ({ kind: 'tuple', items: [k, v] }) as PyList) }
        case 'pop': {
          const key = dictKey(args[0])
          if (!obj.map.has(key)) {
            if (args.length > 1) return args[1]
            throw new Error('KeyError')
          }
          const v = obj.map.get(key)!
          obj.map.delete(key)
          return v
        }
      }
    }
    if (typeof obj === 'string') {
      switch (name) {
        case 'upper':
          return obj.toUpperCase()
        case 'lower':
          return obj.toLowerCase()
        case 'strip':
          return obj.trim()
        case 'title':
          return obj.replace(/\b\w/g, (c) => c.toUpperCase())
      }
    }
    throw new Error(`Unsupported method ${name}`)
  }

  callUser(fn: PyFunc, args: PyVal[], kw: (readonly [string, PyVal])[]): PyVal {
    const scope = new Map<string, PyVal>()
    const inputs: CallRecord['inputs'] = []
    fn.params.forEach((p, i) => {
      const named = kw.find(([k]) => k === p.name)
      let value: PyVal
      let isDefault = false
      if (i < args.length) value = args[i]
      else if (named) value = named[1]
      else if (p.def) {
        value = this.eval(p.def)
        isDefault = true
      } else throw new Error(`Missing argument ${p.name}`)
      scope.set(p.name, value)
      inputs.push({ name: p.name, value: pyStr(value, true, '"'), isDefault })
    })

    const recordCall = this.depth.call === 0
    const prints: string[] = []
    const savedLocals = this.locals
    const savedRounds = this.rounds
    this.locals = scope
    this.rounds = []
    this.depth.call++
    if (recordCall) this.callPrints.push(prints)
    let value: PyVal = null
    try {
      this.block(fn.body)
    } catch (s) {
      if (s instanceof Signal && s.kind === 'return') value = s.value
      else throw s
    } finally {
      this.locals = savedLocals
      this.rounds = savedRounds
      this.depth.call--
      if (recordCall) this.callPrints.pop()
    }
    if (recordCall) {
      this.result.calls.push({
        name: fn.name,
        signature: fn.signature,
        body: fn.body.map((s) => s.src),
        inputs,
        result: value === null ? null : pyStr(value, true, '"'),
        prints,
      })
    }
    return value
  }

  /* statements */

  topLevel() {
    return this.depth.loop === 0 && this.depth.call === 0 && this.depth.decision === 0
  }

  block(stmts: Stmt[]) {
    for (const s of stmts) this.stmt(s)
  }

  assign(target: Expr, value: PyVal) {
    if (target.k === 'name') {
      this.setName(target.id, value)
      this.noteChange(`${target.id} = ${pyStr(value, true, '"')}`)
      return
    }
    if (target.k === 'index') {
      const obj = this.eval(target.obj)
      const idx = this.eval(target.idx)
      if (isDict(obj)) obj.map.set(dictKey(idx), value)
      else if (isSeq(obj) && obj.kind === 'list') {
        let i = num(idx)
        if (i < 0) i += obj.items.length
        obj.items[i] = value
      } else throw new Error('Cannot assign here')
      this.noteChange(`${render(target)} = ${pyStr(value, true, '"')}`)
      return
    }
    if (target.k === 'tuple') {
      const values = iterate(value)
      target.items.forEach((t, i) => this.assign(t, values[i]))
      return
    }
    throw new Error('Unsupported assignment')
  }

  stmt(s: Stmt) {
    try {
      this.runStmt(s)
    } catch (err) {
      // Remember the innermost statement that failed so errors can point at a line.
      if (err instanceof Error && !(err as LineError).pySrc) (err as LineError).pySrc = s.src
      throw err
    }
  }

  runStmt(s: Stmt) {
    this.tick()
    switch (s.k) {
      case 'expr': {
        if (this.topLevel()) this.recordSteps(s.e, s.src)
        this.eval(s.e)
        return
      }
      case 'assign': {
        if (this.topLevel()) {
          if (s.e.k === 'if' && s.target.k === 'name') this.recordTernary(s.target.id, s.e)
          else if (!isLiteral(s.e)) this.recordSteps(s.e, s.src, true)
        }
        this.assign(s.target, this.eval(s.e))
        return
      }
      case 'aug': {
        const combined: Expr = { k: 'bin', op: s.op, l: s.target, r: s.e }
        if (this.topLevel()) this.recordSteps(combined, s.src, true)
        this.assign(s.target, this.eval(combined))
        return
      }
      case 'if':
        this.runIf(s)
        return
      case 'while':
        this.runWhile(s)
        return
      case 'for':
        this.runFor(s)
        return
      case 'def':
        this.setName(s.name, { kind: 'func', name: s.name, params: s.params, body: s.body, signature: s.src })
        return
      case 'return':
        throw new Signal('return', s.e ? this.eval(s.e) : null)
      case 'break':
        throw new Signal('break')
      case 'continue':
        throw new Signal('continue')
      case 'pass':
        return
    }
  }

  recordSteps(e: Expr, label: string, force = false) {
    const target = e.k === 'call' && e.fn.k === 'name' && e.fn.id === 'print' && e.args.length === 1 ? e.args[0] : force ? e : null
    if (!target || isLiteral(target) || target.k === 'name') return
    const steps = this.reduceSteps(target)
    if (steps.length > 1) this.result.exprSteps.push({ label, steps })
  }

  recordTernary(target: string, e: Extract<Expr, { k: 'if' }>) {
    const result = truthy(this.eval(e.cond))
    this.result.ternaries.push({
      target,
      question: question(e.cond),
      substituted: `${render(this.substitute(e.cond))}`,
      result,
      yes: render(e.a),
      no: render(e.b),
    })
  }

  runIf(s: Extract<Stmt, { k: 'if' }>) {
    const record = this.depth.loop === 0 && this.depth.call === 0
    const decision: DecisionRecord | null = record
      ? {
          checks: s.branches.map((b) => ({
            question: question(b.cond),
            substituted: '',
            result: null,
            action: b.body.map((x) => x.src),
            nested: null,
          })),
          elseAction: s.orelse ? s.orelse.map((x) => x.src) : null,
          elseTaken: false,
        }
      : null

    if (decision) {
      const holder = this.nestedHolders[this.nestedHolders.length - 1]
      if (this.depth.decision === 0) this.result.decisions.push(decision)
      else if (holder && !holder.rec) holder.rec = decision
    }

    for (let i = 0; i < s.branches.length; i++) {
      const b = s.branches[i]
      const result = truthy(this.eval(b.cond))
      if (decision) {
        decision.checks[i].result = result
        decision.checks[i].substituted = render(this.substitute(b.cond))
      }
      if (result) {
        this.runDecisionBody(b.body, decision ? decision.checks[i] : null)
        return
      }
    }
    if (s.orelse) {
      if (decision) decision.elseTaken = true
      this.runDecisionBody(s.orelse, null)
    }
  }

  nestedHolders: { rec: DecisionRecord | null }[] = []

  runDecisionBody(body: Stmt[], check: BranchCheck | null) {
    const holder: { rec: DecisionRecord | null } = { rec: null }
    this.depth.decision++
    this.nestedHolders.push(holder)
    try {
      this.block(body)
    } finally {
      this.depth.decision--
      this.nestedHolders.pop()
      if (check && holder.rec) check.nested = holder.rec
    }
  }

  startLoop(header: string, kind: 'for' | 'while', iterText: string): LoopRecord | null {
    if (this.depth.call > 0) return null
    const rec: LoopRecord = { header, kind, iterText, rounds: [], notReached: [] }
    const parent = this.rounds[this.rounds.length - 1]
    if (parent) {
      if (!parent.inner) parent.inner = rec
    } else if (this.depth.loop === 0) {
      this.result.loops.push(rec)
    }
    return rec
  }

  runFor(s: Extract<Stmt, { k: 'for' }>) {
    const iterValue = this.eval(s.iter)
    const items = iterate(iterValue)
    const iterText = items.map((x) => pyStr(x, true, '"')).join(', ')
    const rec = this.startLoop(s.src, 'for', iterText)
    const label = (item: PyVal) => {
      if (s.targets.length === 1) return `${s.targets[0]} = ${pyStr(item, true, '"')}`
      const parts = iterate(item)
      return s.targets.map((t, i) => `${t} = ${pyStr(parts[i], true, '"')}`).join(', ')
    }

    this.depth.loop++
    try {
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (s.targets.length === 1) this.setLoopVar(s.targets[0], item)
        else {
          const parts = iterate(item)
          s.targets.forEach((t, j) => this.setLoopVar(t, parts[j]))
        }
        const round: Round = { label: label(item), prints: [], changes: [] }
        rec?.rounds.push(round)
        if (rec) this.rounds.push(round)
        try {
          this.block(s.body)
        } catch (sig) {
          if (!(sig instanceof Signal) || sig.kind === 'return') throw sig
          round.event = sig.kind
          if (sig.kind === 'break') {
            if (rec) rec.notReached = items.slice(i + 1).map(label)
            break
          }
        } finally {
          if (rec) this.rounds.pop()
        }
      }
    } finally {
      this.depth.loop--
    }
  }

  setLoopVar(id: string, v: PyVal) {
    if (this.locals) this.locals.set(id, v)
    else this.globals.set(id, v)
  }

  runWhile(s: Extract<Stmt, { k: 'while' }>) {
    const rec = this.startLoop(s.src, 'while', render(s.cond))
    const names = collectNames(s.cond).filter((n) => this.has(n))
    const snapshot = () => names.map((n) => `${n} = ${pyStr(this.lookup(n), true, '"')}`).join(', ')

    this.depth.loop++
    try {
      for (let guard = 0; ; guard++) {
        if (guard > 60) throw new Error('Loop runs too long')
        const passed = truthy(this.eval(s.cond))
        const round: Round = {
          label: snapshot(),
          check: render(this.substitute(s.cond)),
          passed,
          prints: [],
          changes: [],
        }
        if (!passed) {
          round.event = 'end'
          rec?.rounds.push(round)
          break
        }
        rec?.rounds.push(round)
        if (rec) this.rounds.push(round)
        try {
          this.block(s.body)
        } catch (sig) {
          if (!(sig instanceof Signal) || sig.kind === 'return') throw sig
          round.event = sig.kind
          if (sig.kind === 'break') break
        } finally {
          if (rec) this.rounds.pop()
        }
      }
    } finally {
      this.depth.loop--
    }
  }

  /* step-by-step reduction of one expression */

  substitute(e: Expr): Expr {
    const sub = (x: Expr): Expr => {
      switch (x.k) {
        case 'name': {
          if (!this.has(x.id)) return x
          const v = this.lookup(x.id)
          if (typeof v === 'object' && v !== null && 'kind' in v && v.kind === 'func') return x
          return { k: 'val', v: clone(v) }
        }
        case 'list':
        case 'tuple':
          return { k: x.k, items: x.items.map(sub) }
        case 'dict':
          return { k: 'dict', entries: x.entries.map(([a, b]) => [sub(a), sub(b)]) }
        case 'bin':
          return { ...x, l: sub(x.l), r: sub(x.r) }
        case 'un':
          return { ...x, e: sub(x.e) }
        case 'if':
          return { ...x, cond: sub(x.cond), a: sub(x.a), b: sub(x.b) }
        case 'call':
          return { ...x, fn: x.fn.k === 'attr' ? { ...x.fn, obj: sub(x.fn.obj) } : x.fn, args: x.args.map(sub), kw: x.kw.map(([k, v]) => [k, sub(v)]) }
        case 'attr':
          return { ...x, obj: sub(x.obj) }
        case 'index':
          return { ...x, obj: sub(x.obj), idx: sub(x.idx) }
        case 'slice':
          return { ...x, obj: sub(x.obj), lo: x.lo && sub(x.lo), hi: x.hi && sub(x.hi) }
        default:
          return x
      }
    }
    return sub(e)
  }

  reduceSteps(e: Expr): string[] {
    if (!isPure(e)) return []
    const steps = [render(e)]
    let cur = this.substitute(e)
    steps.push(render(cur))
    for (let n = 0; n < 12 && cur.k !== 'val'; n++) {
      const next = this.reduceOnce(cur)
      if (!next) return []
      cur = next
      steps.push(render(cur))
    }
    if (cur.k !== 'val') return []
    return steps.filter((s, i) => i === 0 || s !== steps[i - 1])
  }

  reduceOnce(e: Expr): Expr | null {
    const allVals = (xs: Expr[]) => xs.every((x) => x.k === 'val')
    const evalHere = (x: Expr): Expr => ({ k: 'val', v: this.eval(x) })
    switch (e.k) {
      case 'val':
        return null
      case 'bin': {
        if (e.l.k !== 'val') return { ...e, l: this.reduceOnce(e.l)! }
        if (e.r.k !== 'val') return { ...e, r: this.reduceOnce(e.r)! }
        return evalHere(e)
      }
      case 'un':
        return e.e.k !== 'val' ? { ...e, e: this.reduceOnce(e.e)! } : evalHere(e)
      case 'if':
        if (e.cond.k !== 'val') return { ...e, cond: this.reduceOnce(e.cond)! }
        return truthy(e.cond.v) ? e.a : e.b
      case 'list':
      case 'tuple': {
        const i = e.items.findIndex((x) => x.k !== 'val')
        if (i >= 0) return { ...e, items: e.items.map((x, j) => (j === i ? this.reduceOnce(x)! : x)) }
        return evalHere(e)
      }
      case 'dict':
        return allVals(e.entries.flat()) ? evalHere(e) : null
      case 'index': {
        if (e.obj.k !== 'val') return { ...e, obj: this.reduceOnce(e.obj)! }
        if (e.idx.k !== 'val') return { ...e, idx: this.reduceOnce(e.idx)! }
        return evalHere(e)
      }
      case 'slice':
        return e.obj.k === 'val' && (!e.lo || e.lo.k === 'val') && (!e.hi || e.hi.k === 'val') ? evalHere(e) : null
      case 'call': {
        if (e.fn.k === 'attr' && e.fn.obj.k !== 'val') return { ...e, fn: { ...e.fn, obj: this.reduceOnce(e.fn.obj)! } }
        const i = e.args.findIndex((x) => x.k !== 'val')
        if (i >= 0) return { ...e, args: e.args.map((x, j) => (j === i ? this.reduceOnce(x)! : x)) }
        return evalHere(e)
      }
      default:
        return null
    }
  }
}

function isLiteral(e: Expr): boolean {
  if (e.k === 'val') return true
  if (e.k === 'list' || e.k === 'tuple') return e.items.every(isLiteral)
  if (e.k === 'dict') return e.entries.every(([k, v]) => isLiteral(k) && isLiteral(v))
  if (e.k === 'un' && e.op === '-') return e.e.k === 'val'
  return false
}

function isPure(e: Expr): boolean {
  switch (e.k) {
    case 'call': {
      const name = e.fn.k === 'name' ? e.fn.id : e.fn.k === 'attr' ? e.fn.name : ''
      if (!PURE_CALLS.has(name)) return false
      return (e.fn.k !== 'attr' || isPure(e.fn.obj)) && e.args.every(isPure) && e.kw.every(([, v]) => isPure(v))
    }
    case 'list':
    case 'tuple':
      return e.items.every(isPure)
    case 'dict':
      return e.entries.every(([k, v]) => isPure(k) && isPure(v))
    case 'bin':
      return isPure(e.l) && isPure(e.r)
    case 'un':
      return isPure(e.e)
    case 'if':
      return isPure(e.cond) && isPure(e.a) && isPure(e.b)
    case 'index':
      return isPure(e.obj) && isPure(e.idx)
    case 'slice':
      return isPure(e.obj)
    case 'attr':
      return false
    default:
      return true
  }
}

export function collectNames(e: Expr): string[] {
  const out = new Set<string>()
  const walk = (x: Expr) => {
    switch (x.k) {
      case 'name':
        out.add(x.id)
        break
      case 'list':
      case 'tuple':
        x.items.forEach(walk)
        break
      case 'dict':
        x.entries.forEach(([a, b]) => (walk(a), walk(b)))
        break
      case 'bin':
        walk(x.l)
        walk(x.r)
        break
      case 'un':
        walk(x.e)
        break
      case 'if':
        walk(x.cond)
        walk(x.a)
        walk(x.b)
        break
      case 'call':
        if (x.fn.k === 'attr') walk(x.fn.obj)
        x.args.forEach(walk)
        x.kw.forEach(([, v]) => walk(v))
        break
      case 'attr':
        walk(x.obj)
        break
      case 'index':
        walk(x.obj)
        walk(x.idx)
        break
      case 'slice':
        walk(x.obj)
        if (x.lo) walk(x.lo)
        if (x.hi) walk(x.hi)
        break
    }
  }
  walk(e)
  return [...out]
}

function question(cond: Expr): string {
  if (cond.k === 'name') return `Is ${cond.id} True?`
  return `Is ${render(cond)}?`
}

/** Runs a short lesson example. Returns null if the code uses something the simulator can't handle. */
export function simulate(code: string): RunResult | null {
  try {
    const { program, comments } = parseProgram(code)
    const interp = new Interpreter(program, comments)
    interp.block(program)
    return interp.result
  } catch {
    return null
  }
}

export type SimulationError = { message: string; src: string | null }

/** Runs the code in the simulator and returns the first error it hits (with the failing line's text). */
export function findSimulationError(code: string): SimulationError | null {
  try {
    const { program, comments } = parseProgram(code)
    new Interpreter(program, comments).block(program)
    return null
  } catch (err) {
    if (!(err instanceof Error)) return null
    return { message: err.message, src: (err as LineError).pySrc ?? null }
  }
}

/** Walks every expression in a program (used to find which list slots / dict keys the code touches). */
export function forEachExpr(program: Stmt[], visit: (e: Expr) => void) {
  const walk = (e: Expr) => {
    visit(e)
    switch (e.k) {
      case 'list':
      case 'tuple':
        e.items.forEach(walk)
        break
      case 'dict':
        e.entries.forEach(([a, b]) => (walk(a), walk(b)))
        break
      case 'bin':
        walk(e.l)
        walk(e.r)
        break
      case 'un':
        walk(e.e)
        break
      case 'if':
        walk(e.cond)
        walk(e.a)
        walk(e.b)
        break
      case 'call':
        walk(e.fn)
        e.args.forEach(walk)
        e.kw.forEach(([, v]) => walk(v))
        break
      case 'attr':
        walk(e.obj)
        break
      case 'index':
        walk(e.obj)
        walk(e.idx)
        break
      case 'slice':
        walk(e.obj)
        if (e.lo) walk(e.lo)
        if (e.hi) walk(e.hi)
        break
    }
  }
  const stmts = (list: Stmt[]) => {
    for (const s of list) {
      switch (s.k) {
        case 'expr':
          walk(s.e)
          break
        case 'assign':
        case 'aug':
          walk(s.target)
          walk(s.e)
          break
        case 'if':
          s.branches.forEach((b) => (walk(b.cond), stmts(b.body)))
          if (s.orelse) stmts(s.orelse)
          break
        case 'while':
          walk(s.cond)
          stmts(s.body)
          break
        case 'for':
          walk(s.iter)
          stmts(s.body)
          break
        case 'def':
          stmts(s.body)
          break
        case 'return':
          if (s.e) walk(s.e)
          break
      }
    }
  }
  stmts(program)
}

export function typeLabel(v: PyVal): string {
  if (v === null) return 'nothing (None)'
  if (typeof v === 'boolean') return 'yes/no (bool)'
  if (typeof v === 'number') return 'whole number (int)'
  if (v instanceof PyFloat) return 'decimal (float)'
  if (typeof v === 'string') return 'text (str)'
  if (v.kind === 'list') return 'list'
  if (v.kind === 'tuple') return 'tuple'
  if (v.kind === 'dict') return 'dictionary'
  return 'function'
}

export function typeKey(v: PyVal): string {
  if (v === null) return 'none'
  if (typeof v === 'boolean') return 'bool'
  if (typeof v === 'number' || v instanceof PyFloat) return 'num'
  if (typeof v === 'string') return 'str'
  return v.kind
}

export { isDict, isSeq }
