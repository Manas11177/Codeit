/**
 * Compares the learner's retyped program with the program they studied.
 * Mistakes are pointed at gently — the answer itself is never revealed here.
 */
import { checkCode, type Issue } from './checker'
import type { CodeExplanation } from './explainer'
import { analyzeLines, isCodeLine, normalizeLine, stringContent, type CodeLine, type Token } from './lexer'

export type LineCheck = { no: number; ok: boolean; typedNo: number | null; message: string | null }
export type SectionCheck = { index: number; ok: boolean; total: number; matched: number; lines: LineCheck[] }
export type RetypeResult = {
  empty: boolean
  perfect: boolean
  score: number
  sections: SectionCheck[]
  extraLines: number[]
  issues: Issue[]
}

type Row = { line: CodeLine; key: string; norm: string; level: number }

function rows(lines: CodeLine[]): Row[] {
  const code = lines.filter((l) => isCodeLine(l))
  const indents = [...new Set(code.filter((l) => !l.continuation).map((l) => l.indent))].sort((a, b) => a - b)
  return code.map((line) => {
    const norm = normalizeLine(line)
    const level = line.continuation ? -1 : indents.indexOf(line.indent)
    return { line, norm, level, key: `${level}|${norm}` }
  })
}

function lcsPairs(a: Row[], b: Row[]): [number, number][] {
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i].key === b[j].key ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const pairs: [number, number][] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i].key === b[j].key) {
      pairs.push([i, j])
      i += 1
      j += 1
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i += 1
    else j += 1
  }
  return pairs
}

function tokenKey(t: Token) {
  return t.kind === 'string' ? `"${stringContent(t.text)}"` : t.text
}

const SYMBOL_NAMES: Record<string, string> = {
  ':': 'colon ( : )',
  '(': 'round bracket',
  ')': 'round bracket',
  '[': 'square bracket',
  ']': 'square bracket',
  '{': 'curly bracket',
  '}': 'curly bracket',
  ',': 'comma',
  '.': 'dot',
}

function describeDifference(original: Row, typed: Row | null): string {
  if (!typed) return 'This line is missing.'
  if (original.norm === typed.norm) return 'The words are right, but the indentation (the spaces at the start) is different.'
  const want = original.line.code
  const got = typed.line.code
  let k = 0
  while (k < want.length && k < got.length && tokenKey(want[k]) === tokenKey(got[k])) k += 1
  if (k >= got.length) return 'The line stops too early — something is missing at the end.'
  if (k >= want.length) return `There is something extra at the end, starting at \`${got[k].text}\`.`
  const expected = want[k]
  const near = `\`${got[k].text}\``
  switch (expected.kind) {
    case 'punct':
      return `Look near ${near} — check the ${SYMBOL_NAMES[expected.text] ?? 'symbol'} there.`
    case 'op':
      return `Look near ${near} — the operator (like =, ==, +, <) is different.`
    case 'string':
      return 'Check the text inside the quotes — every letter and space must match.'
    case 'number':
      return `Look near ${near} — a number is different.`
    case 'keyword':
    case 'builtin':
      return `Look near ${near} — a Python word is different or misspelt.`
    default:
      return `Look near ${near} — a name is different. Names must match exactly, even big and small letters.`
  }
}

export function compareRetype(explanation: CodeExplanation, typedCode: string): RetypeResult {
  const original = rows(explanation.lines)
  const typed = rows(analyzeLines(typedCode))
  const issues = typed.length ? checkCode(typedCode) : []
  const pairs = lcsPairs(original, typed)

  const matchOf = new Map<number, number>()
  const candidateOf = new Map<number, number | null>()
  const extra: number[] = []
  const anchors: [number, number][] = [[-1, -1], ...pairs, [original.length, typed.length]]
  for (let p = 0; p < anchors.length - 1; p += 1) {
    const [ai, bi] = anchors[p]
    const [aj, bj] = anchors[p + 1]
    if (p > 0) matchOf.set(ai, bi)
    const missing = Array.from({ length: aj - ai - 1 }, (_, k) => ai + 1 + k)
    const spare = Array.from({ length: bj - bi - 1 }, (_, k) => bi + 1 + k)
    missing.forEach((o, k) => candidateOf.set(o, spare[k] ?? null))
    spare.slice(missing.length).forEach((t) => extra.push(typed[t].line.no))
  }

  const sections: SectionCheck[] = explanation.sections.map((section) => {
    const lines: LineCheck[] = []
    original.forEach((row, i) => {
      if (row.line.no < section.start || row.line.no > section.end) return
      const match = matchOf.get(i)
      if (match !== undefined) {
        lines.push({ no: row.line.no, ok: true, typedNo: typed[match].line.no, message: null })
        return
      }
      const candidate = candidateOf.get(i) ?? null
      lines.push({
        no: row.line.no,
        ok: false,
        typedNo: candidate === null ? null : typed[candidate].line.no,
        message: describeDifference(row, candidate === null ? null : typed[candidate]),
      })
    })
    const matched = lines.filter((l) => l.ok).length
    return { index: section.index, ok: matched === lines.length, total: lines.length, matched, lines }
  })

  const total = original.length || 1
  const score = Math.round((pairs.length / Math.max(total, typed.length || 1)) * 100)
  return {
    empty: typed.length === 0,
    perfect: original.length > 0 && pairs.length === original.length && typed.length === original.length,
    score,
    sections,
    extraLines: extra,
    issues,
  }
}
