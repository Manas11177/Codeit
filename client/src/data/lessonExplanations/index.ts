import { CONDITIONS_EXPLAINERS } from './conditions'
import { DICTIONARIES_EXPLAINERS } from './dictionaries'
import { FUNCTIONS_EXPLAINERS } from './functions'
import { LISTS_EXPLAINERS } from './lists'
import { LOOPS_EXPLAINERS } from './loops'
import { OPERATORS_EXPLAINERS } from './operators'
import { PYTHON_BASICS_EXPLAINERS } from './pythonBasics'
import type { ConceptExplainer } from './types'
import { VARIABLES_EXPLAINERS } from './variables'

export type { ConceptExplainer } from './types'

const BY_LESSON: Record<string, Record<string, ConceptExplainer>> = {
  'python-basics': PYTHON_BASICS_EXPLAINERS,
  variables: VARIABLES_EXPLAINERS,
  operators: OPERATORS_EXPLAINERS,
  conditions: CONDITIONS_EXPLAINERS,
  loops: LOOPS_EXPLAINERS,
  functions: FUNCTIONS_EXPLAINERS,
  lists: LISTS_EXPLAINERS,
  dictionaries: DICTIONARIES_EXPLAINERS,
}

export function getConceptExplainer(
  lessonId: string,
  subtopic: string,
): ConceptExplainer | null {
  return BY_LESSON[lessonId]?.[subtopic] ?? null
}
