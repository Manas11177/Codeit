/**
 * Built-in answers for the Code Coach help chat, used when the AI tutor is not
 * configured. Answers stay about the learner's own code and never reveal output.
 */
import type { Issue } from './checker'
import { sectionHints, tokenMeaning, type CodeExplanation, type Section } from './explainer'

export type CoachStage = 'write' | 'explain' | 'retype'

export type HelpContext = {
  explanation: CodeExplanation
  stage: CoachStage
  issues: Issue[]
  /** During retyping: the section the learner is stuck on, if known. */
  focusSection: Section | null
}

const OTHER_LANGUAGES = /\b(java(?!script)|javascript|c\+\+|c#|golang|rust|php|ruby|kotlin|swift|html|css|sql)\b/i
const GENERAL_CHAT = /\b(weather|movie|song|joke|news|cricket|football|recipe|girlfriend|boyfriend|politics|who are you|your name)\b/i
const BUILD_REQUEST = /\b(build|make|create|write|code)\b.*\b(app|game|website|program for me|project|bot)\b/i
const OUTPUT_QUESTION = /\b(output|print(s|ed)? out|result|what (will|does|would) (it|this|the code|the program) (show|print|display|give)|run it)\b/i

const CONCEPTS: [RegExp, string][] = [
  [/\bcolon\b|:/, 'The **colon** `:` ends a header line (if, for, while, def…). It means “the indented lines below belong to me”.'],
  [/\bindent|spaces?\b|tab\b/, '**Indentation** is the spaces at the start of a line. Lines pushed in by 4 spaces belong to the block above them. Same depth = same block.'],
  [/\bquotes?\b|string/, 'Quotes mark **text** (a string). Everything between matching quotes is just letters to Python, not code.'],
  [/\bbrackets?\b|parenthes/, 'Round brackets `( )` hold the inputs of a function, like `print("hi")`. Square brackets `[ ]` make a list or pick an item. Curly brackets `{ }` make a dictionary.'],
  [/\bvariable/, 'A **variable** is a labelled box. `name = value` puts the value in the box; later, writing the name reads the value back.'],
  [/\bloop/, 'A **loop** repeats lines. `for` repeats once per item; `while` repeats as long as its condition is True.'],
  [/\bfunction|\bdef\b/, 'A **function** is a named recipe. `def` writes the recipe; writing its name with brackets, like `greet()`, runs it.'],
  [/\bcondition|\bif\b/, 'A **condition** is a yes/no question like `age > 18`. `if` runs its block only when the answer is True.'],
  [/\bcomment|#/, 'A **comment** starts with `#`. It is a note for humans — Python skips it.'],
]

function firstSentence(text: string) {
  const match = /^.*?[.!?](\s|$)/.exec(text)
  return match ? match[0].trim() : text
}

function lineAnswer(explanation: CodeExplanation, no: number): string {
  const line = explanation.words.find((w) => w.no <= no && no <= (w.endNo ?? w.no))
  if (!line) {
    const last = explanation.words[explanation.words.length - 1]?.no ?? 0
    return `Line ${no} is empty or does not exist. Your code has lines 1 to ${last}.`
  }
  if (line.isComment) return `Line ${no} is a comment. ${line.sentence}`
  const keyWords = line.words
    .filter((w) => ['keyword', 'builtin'].includes(w.kind) || (w.kind === 'name' && /method/.test(w.meaning)))
    .slice(0, 3)
    .map((w) => `• \`${w.text}\` ${w.meaning}`)
  return [`**Line ${no}:** \`${line.code.trim()}\``, line.sentence, ...keyWords].join('\n')
}

function hintAnswer(ctx: HelpContext): string {
  const section = ctx.focusSection ?? ctx.explanation.sections[0]
  if (!section) return 'Type a little code first, then I can give you hints for each part.'
  const [purpose, shape] = sectionHints(section)
  return [
    `**Hint for “${section.title.replace(/`/g, '')}”**`,
    purpose.text,
    'Here is its shape — fill in the blanks:',
    '```python',
    shape.text,
    '```',
  ].join('\n')
}

function nameAnswer(explanation: CodeExplanation, name: string): string | null {
  const created = explanation.words.find((w) =>
    w.words.some((x) => x.text === name && /new variable|loop variable|parameter|name of the new function|name of the new method|name of the new class/.test(x.meaning)),
  )
  if (!created) return null
  const word = created.words.find((x) => x.text === name)
  return `\`${name}\` is ${word?.meaning.replace(/\.$/, '') ?? 'a name'} — it is created on **line ${created.no}**: ${created.sentence}`
}

/** Returns a polite refusal when the question is not about the learner's code. */
export function guardCodeQuestion(question: string): string | null {
  if (OTHER_LANGUAGES.test(question) || GENERAL_CHAT.test(question) || BUILD_REQUEST.test(question)) {
    return 'I can only help with **the code on this page**. Try “What does line 2 do?”, “What is append?” or “Give me a hint”.'
  }
  return null
}

export function offlineCodeHelp(rawQuestion: string, ctx: HelpContext): string {
  const question = rawQuestion.trim()
  const lower = question.toLowerCase()
  const { explanation } = ctx

  if (!explanation.words.some((w) => !w.isComment)) {
    return 'Write some Python code first — then ask me about any line, word or section of it.'
  }
  const refusal = guardCodeQuestion(question)
  if (refusal) return refusal
  if (OUTPUT_QUESTION.test(lower)) {
    const prints = explanation.words.filter((w) => /^\s*print\s*\(/.test(w.code))
    return [
      'Here we don’t run the code — the goal is to **understand** it so well that you could predict the output yourself. 💪',
      ...(prints.length ? ['What the print lines do:', ...prints.map((p) => `• Line ${p.no}: ${p.sentence}`)] : []),
    ].join('\n')
  }

  const lineMatch = /\bline\s*(?:no\.?|number)?\s*(\d+)/.exec(lower)
  if (lineMatch) return lineAnswer(explanation, Number(lineMatch[1]))

  const sectionMatch = /\b(?:section|part|step)\s*(\d+)/.exec(lower)
  if (sectionMatch) {
    const section = explanation.sections[Number(sectionMatch[1]) - 1]
    if (section) return `**Part ${section.index + 1} — ${section.title}**\n${section.summary}\n💡 ${section.tip}`
  }

  if (/\b(hint|stuck|help me|next|forgot|don'?t remember|can'?t remember)\b/.test(lower) && ctx.stage === 'retype') {
    return hintAnswer(ctx)
  }

  if (/\b(error|wrong|mistake|bug|fix|correct)\b/.test(lower)) {
    if (ctx.issues.length === 0) return 'I don’t see any mistakes right now. 🎉 Every line looks like correct Python.'
    const issue = ctx.issues[0]
    return [`**Line ${issue.line}: ${issue.title}**`, issue.explain, ...(ctx.issues.length > 1 ? [`(There ${ctx.issues.length === 2 ? 'is 1 more thing' : `are ${ctx.issues.length - 1} more things`} to fix — look at the red cards.)`] : [])].join('\n')
  }

  if (/\b(remember|memori[sz]e|learn by heart|trick)\b/.test(lower)) {
    const { chain, hooks } = explanation.remember
    return [
      chain.words.length > 1 ? `Remember the order: **${chain.words.join(' → ')}** (“${chain.silly}”).` : 'Say what the code does in one sentence, then write its shape.',
      ...hooks.slice(0, 2).map((h) => `${h.icon} **${h.title}** — ${h.text}`),
    ].join('\n')
  }

  if (/\b(what does (this|the) (code|program) do|overview|summary|big picture|whole code|explain (it|this|the code))\b/.test(lower)) {
    return [explanation.overview.inShort, ...explanation.sections.map((s) => `${s.icon} ${s.title.replace(/`/g, '')}`)].join('\n')
  }

  const words = question.match(/[A-Za-z_][A-Za-z0-9_]*|==|!=|<=|>=|\+=|-=|\/\/|\*\*|[=+\-*/%]/g) ?? []
  for (const word of words) {
    const named = nameAnswer(explanation, word)
    if (named) return named
  }
  for (const word of words) {
    if (['what', 'is', 'does', 'do', 'the', 'a', 'an', 'mean', 'means', 'why', 'how'].includes(word.toLowerCase())) continue
    const meaning = tokenMeaning(word) ?? tokenMeaning(word.toLowerCase())
    if (meaning) {
      const used = explanation.words.find((w) => w.words.some((x) => x.text === word))
      return used ? `${meaning}\nIn your code it appears on **line ${used.no}**: ${firstSentence(used.sentence)}` : meaning
    }
  }
  for (const [pattern, answer] of CONCEPTS) if (pattern.test(lower)) return answer

  if (ctx.stage === 'retype' && /\b(help|hint)\b/.test(lower)) return hintAnswer(ctx)

  return 'I can help with this code. Try asking:\n• “What does line 2 do?”\n• “What is append?”\n• “Why is there a colon?”\n• “How do I remember this?”' +
    (ctx.stage === 'retype' ? '\n• “Give me a hint”' : '')
}
