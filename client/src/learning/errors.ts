import type { ErrorCategory } from '../utils/lessonProgress'

const KNOWN_ERRORS: ErrorCategory[] = [
  'IndentationError',
  'SyntaxError',
  'NameError',
  'TypeError',
  'ValueError',
  'ZeroDivisionError',
  'IndexError',
  'KeyError',
  'AttributeError',
]

export function classifyError(text: string | undefined | null): ErrorCategory | null {
  if (!text || !text.trim()) return null
  const found = KNOWN_ERRORS.find((name) => text.includes(name))
  if (found) return found
  if (/TabError|unindent|expected an indented block/i.test(text)) {
    return 'IndentationError'
  }
  if (/invalid syntax|was never closed|EOL while scanning/i.test(text)) {
    return 'SyntaxError'
  }
  return 'OtherError'
}

export const ERROR_LABELS: Record<ErrorCategory, string> = {
  SyntaxError: 'Syntax errors',
  IndentationError: 'Indentation mistakes',
  NameError: 'Undefined or misspelled names',
  TypeError: 'Mixing incompatible types',
  ValueError: 'Invalid value conversions',
  ZeroDivisionError: 'Division by zero',
  IndexError: 'Index out of range',
  KeyError: 'Missing dictionary keys',
  AttributeError: 'Wrong method or attribute',
  WrongOutput: 'Code runs but output is wrong',
  OtherError: 'Other runtime errors',
}

export const ERROR_TIPS: Record<ErrorCategory, string> = {
  SyntaxError:
    'Check colons after if/for/def, matching brackets, and quotes around text.',
  IndentationError:
    'Lines inside if, for, while, and def must be indented by the same amount.',
  NameError:
    'Python is case-sensitive. Define a variable before using it and spell it the same way every time.',
  TypeError:
    'Convert values before combining them, for example str(age) when joining with text.',
  ValueError:
    'int() and float() only work on text that looks like a number.',
  ZeroDivisionError: 'Make sure the divisor can never be 0.',
  IndexError:
    'List positions start at 0, and the last index is len(list) - 1.',
  KeyError: 'Use dict.get(key) or check "key in dict" before reading a key.',
  AttributeError:
    'Check the method belongs to that type, e.g. append works on lists, not strings.',
  WrongOutput:
    'Trace your code line by line and compare each printed value with the expected output.',
  OtherError: 'Read the last line of the error message — it names the problem.',
}
