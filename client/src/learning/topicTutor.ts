import type { ConceptExplainer } from '../data/lessonExplanations'
import type { SubtopicExercise } from '../data/subtopicContent'

export type TutorTopic = {
  lessonId: string
  lessonTitle: string
  subtopic: string
  exercise: SubtopicExercise
  explainer: ConceptExplainer | null
}

export type GuardResult = { ok: true } | { ok: false; reply: string }

const OTHER_LANGUAGES =
  /\b(javascript|typescript|java|c\+\+|c#|csharp|html|css|php|ruby|rust|golang|swift|kotlin|sql|react|node\.?js|bash|powershell)\b/i
const BUILD_REQUEST =
  /\b(make|build|create|write|code|generate|develop|give)\b[^?.!]{0,40}\b(app|website|web ?site|game|bot|program|script|project|homework|assignment|calculator|software)\b/i
const GENERAL_CHAT =
  /\b(weather|news|movie|song|music|joke|cricket|football|recipe|capital of|president|prime minister|stock|crypto|bitcoin|girlfriend|boyfriend|politics|celebrity)\b/i
const SOLUTION_REQUEST =
  /\b(answer|solution|solve|full code|complete code|practice (problem|question|task)|challenge)\b/i

const LESSON_KEYWORDS: Record<string, RegExp> = {
  'python-basics': /\b(print\(?|comment|indentation|syntax|interpreter)\b/i,
  variables: /\b(variable|data ?types?|int|float|str|string|bool|boolean|type\(|casting|input\(?)\b/i,
  operators: /\b(operators?|arithmetic|modulo|floor division|precedence|bitwise|comparison|logical)\b/i,
  conditions: /\b(if statement|if-else|elif|else|conditions?|conditional|ternary)\b/i,
  loops: /\b(loops?|for loop|while loop|range\(?|break|continue|iterate|iteration|nested loop)\b/i,
  functions: /\b(functions?|def|return|parameters?|arguments?|call(ing)? a function)\b/i,
  lists: /\b(lists?|tuples?|append|slicing|slice|index(ing)?|pop|insert)\b/i,
  dictionaries: /\b(dictionar(y|ies)|dict|key-value|keys\(\)|values\(\)|items\(\))\b/i,
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'what', 'how', 'why', 'do', 'does', 'in', 'of', 'to',
  'and', 'or', 'it', 'this', 'that', 'can', 'you', 'me', 'i', 'my', 'with', 'for', 'on',
  'python', 'please', 'explain', 'tell', 'about', 'use', 'used', 'when', 'statement',
])

function topicWords(topic: TutorTopic) {
  return topic.subtopic
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word))
}

function mentionsOwnTopic(topic: TutorTopic, question: string) {
  const text = question.toLowerCase()
  if (topicWords(topic).some((word) => text.includes(word))) return true
  return LESSON_KEYWORDS[topic.lessonId]?.test(question) ?? false
}

function mentionsOtherLesson(topic: TutorTopic, question: string) {
  return Object.entries(LESSON_KEYWORDS).some(
    ([lessonId, pattern]) => lessonId !== topic.lessonId && pattern.test(question),
  )
}

export function offTopicReply(topic: TutorTopic) {
  return `I can only help with **${topic.subtopic}** on this page. Try asking something like "What is ${topic.subtopic}?" or "Can you explain the example?"`
}

/** Checks a question before it reaches any tutor. */
export function guardQuestion(topic: TutorTopic, question: string): GuardResult {
  if (OTHER_LANGUAGES.test(question) || GENERAL_CHAT.test(question) || BUILD_REQUEST.test(question)) {
    return { ok: false, reply: offTopicReply(topic) }
  }
  if (mentionsOtherLesson(topic, question) && !mentionsOwnTopic(topic, question)) {
    return {
      ok: false,
      reply: `That sounds like a different lesson. Here I can only help with **${topic.subtopic}**. You will learn the other part in its own lesson!`,
    }
  }
  return { ok: true }
}

function codeBlock(code: string) {
  return '```python\n' + code.trim() + '\n```'
}

function has(question: string, pattern: RegExp) {
  return pattern.test(question)
}

/** Built-in tutor: answers only from this topic's own lesson content. */
export function answerFromLesson(topic: TutorTopic, rawQuestion: string): string {
  const question = rawQuestion.toLowerCase()
  const { exercise, explainer, subtopic } = topic
  const simple = explainer?.simple ?? [exercise.concept]

  if (has(question, /^(hi|hello|hey|thanks|thank you|ok|okay)\b/)) {
    return `Hi! 😊 Ask me anything about **${subtopic}**. For example: "What is ${subtopic}?" or "Show me a tiny example".`
  }

  if (has(question, SOLUTION_REQUEST)) {
    return [
      `I can't give you the answer to the practice problem — you'll learn much more by trying it yourself! 💪`,
      `Small nudge: ${exercise.steps[0]}`,
      `On the practice page you can open hints one by one if you get stuck.`,
    ].join('\n\n')
  }

  if (has(question, /\b(simpl|easier|easy|don'?t understand|do not understand|confus|again|lost)\w*/)) {
    return [
      `No problem, let's go slowly. 🐢`,
      simple.slice(0, 2).join(' '),
      explainer ? `**Think of it like this:** ${explainer.realLife}` : '',
    ]
      .filter(Boolean)
      .join('\n\n')
  }

  if (has(question, /\b(example|show|sample|demo)\b/)) {
    return [`Here is a tiny example of **${subtopic}**:`, codeBlock(exercise.exampleCode), exercise.exampleNote].join(
      '\n\n',
    )
  }

  if (has(question, /\b(mistake|error|wrong|bug|avoid|problem|not working|fail)\w*/)) {
    return explainer
      ? `⚠️ **Common mistake:** ${explainer.mistake}`
      : `A common mistake is skipping a step. Follow these: ${exercise.steps.join(' → ')}`
  }

  if (has(question, /\b(real ?life|analogy|daily life|like what|compare)\b/)) {
    return explainer
      ? `🏠 ${explainer.realLife}`
      : `Think of ${subtopic} as one small tool in your Python toolbox. ${exercise.concept}`
  }

  if (has(question, /\b(summary|summari[sz]e|remember|short|recap|key points?|tl;?dr)\b/)) {
    const points = explainer?.remember ?? exercise.steps
    return `📌 **Remember:**\n${points.map((point) => `• ${point}`).join('\n')}`
  }

  if (has(question, /\bwhy\b/)) {
    return [exercise.exampleNote, simple[1] ?? ''].filter(Boolean).join('\n\n')
  }

  if (has(question, /\b(how|steps?|write|use|start)\b/)) {
    return `Here's how to do it, step by step:\n${exercise.steps
      .map((step, i) => `${i + 1}. ${step}`)
      .join('\n')}`
  }

  if (!mentionsOwnTopic(topic, rawQuestion) && !has(question, /\b(what|mean|explain|it|this)\b/)) {
    return `I'm not sure that question is about **${subtopic}**. 🤔 Try asking "What is ${subtopic}?", "Show me an example" or "What mistake should I avoid?"`
  }

  return [
    simple.slice(0, 2).join(' '),
    explainer ? `**Think of it like this:** ${explainer.realLife}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
}

export function topicContext(topic: TutorTopic) {
  return {
    concept: topic.exercise.concept,
    explanation: topic.explainer
      ? [...topic.explainer.simple, `Common mistake: ${topic.explainer.mistake}`].join('\n')
      : topic.exercise.steps.join('\n'),
    exampleCode: topic.exercise.exampleCode,
    challenge: topic.exercise.challenge,
  }
}
