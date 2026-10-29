import type { ConceptExplainer } from './types'

export const CONDITIONS_EXPLAINERS: Record<string, ConceptExplainer> = {
  'Introduction to Conditions': {
    simple: [
      'A condition is a yes-or-no question your program asks. Python answers it with True (yes) or False (no).',
      'We need conditions so programs can make choices. Without them, a program does the same thing every time.',
      'A condition often uses a comparison, like temperature > 30. It asks "is the temperature bigger than 30?"',
      'Try temperature = 35, then print(temperature > 30). 35 is bigger than 30, so Python prints True.',
      'Soon you will use these answers to decide which code runs. For now, just see the True or False.',
    ],
    realLife:
      'Think of it like checking the sky before school. If it is raining, you take an umbrella. "Is it raining?" is the condition.',
    mistake:
      'Beginners sometimes put quotes around the test, like print("temperature > 30"). That prints the words, not the answer. Leave out the quotes so Python checks it.',
    remember: [
      'A condition is a yes-or-no question.',
      'Python answers with True or False.',
      'Comparisons like > make conditions.',
    ],
  },
  'if Statement': {
    simple: [
      'An if statement lets Python decide whether to run some code. The code runs only when the condition is True.',
      'You write the word if, then the condition, then a colon :. Like this: if temperature > 30:',
      'On the next line, you push the code to the right with 4 spaces. This push is called indenting. It shows which code belongs to the if.',
      'Example: temperature = 32, then if temperature > 30: and below it, indented, print("Hot day").',
      '32 is bigger than 30, so the condition is True. Python runs the indented line and prints Hot day. If it were False, Python would skip it.',
    ],
    realLife:
      'Think of it like a door with a guard. If you have a pass, the guard lets you in. If not, you skip that room and walk on.',
    mistake:
      'The most common mistake is forgetting the colon : at the end of the if line, or not indenting the next line. Both give an error. Always end with : and indent 4 spaces below.',
    remember: [
      'if runs code only when True.',
      'End the if line with a colon :.',
      'Indent the code inside by 4 spaces.',
    ],
  },
  'if-else Statement': {
    simple: [
      'An if runs code when the condition is True. But what if it is False? That is where else comes in.',
      'else means "otherwise". It gives Python a backup plan. Exactly one of the two parts runs, never both.',
      'You write else: on its own line, lined up with the if. The code under it is indented, just like under if.',
      'Example: age = 15. if age >= 18: print("Adult"). else: print("Minor").',
      '15 is not 18 or more, so the if test is False. Python skips Adult and runs the else part. It prints Minor.',
    ],
    realLife:
      'Think of it like a fork in a road. If the sign says go left, you go left. Otherwise, you go right. You can never walk both ways at once.',
    mistake:
      'Beginners often indent else so it sits under the print line. else must line up exactly with its if. Also, do not write a condition after else, just else:.',
    remember: [
      'else runs when the if is False.',
      'Only one part runs, never both.',
      'Line up else with its if.',
    ],
  },
  'if-elif-else': {
    simple: [
      'Sometimes there are more than two choices. elif lets you add more checks. elif is short for "else if".',
      'Python checks each test from top to bottom. It stops at the first one that is True and runs only that part.',
      'else at the end catches everything that did not match. It is the "none of the above" choice.',
      'Example: score = 75. if score >= 90: print("A"). elif score >= 60: print("Pass"). else: print("Fail").',
      '75 is not 90 or more, so Python skips A. 75 is 60 or more, so it prints Pass and stops there.',
    ],
    realLife:
      'Think of it like sorting mail into boxes. Is it for Mom? Put it in her box. Else, is it for Dad? His box. Otherwise, the "other" box. Each letter goes in one box only.',
    mistake:
      'Beginners often put the smaller test first, like score >= 60 before score >= 90. Then a 95 would print Pass and stop. Check the highest number first.',
    remember: [
      'elif means "else if".',
      'Python stops at the first True test.',
      'Put the biggest number check first.',
    ],
  },
  'Nested Conditions': {
    simple: [
      'Nested means one thing inside another. A nested condition is an if inside another if.',
      'The inner if is only checked when the outer if is True. If the outer one is False, Python skips everything inside.',
      'Each level is pushed further right. The outer if body uses 4 spaces. The inner if body uses 8 spaces.',
      'Example: logged_in = True and role = "admin". if logged_in: then inside it, if role == "admin": then inside that, print("Full access").',
      'logged_in is True, so Python goes in. role is "admin", so the inner test is True too. Python prints Full access.',
    ],
    realLife:
      'Think of it like a building with two doors. First you must get through the front door. Only then can you try the door to the special room inside.',
    mistake:
      'Beginners often get the spaces wrong, so the inner print is not inside the inner if. Use 4 spaces for each new level, and keep them the same every time.',
    remember: [
      'Inner if runs only if outer is True.',
      'Each level adds 4 more spaces.',
      'Use == to compare, not =.',
    ],
  },
  'Conditional Expressions': {
    simple: [
      'Sometimes you just want to pick one of two values. A conditional expression does this in one short line.',
      'The pattern is: value_if_true if condition else value_if_false.',
      'Example: age = 20, then status = "Adult" if age >= 18 else "Minor". It reads almost like English.',
      'Python checks age >= 18 first. 20 is 18 or more, so it is True. status gets "Adult".',
      'Then print(status) shows Adult. If age were 15, status would be "Minor" instead.',
    ],
    realLife:
      'Think of it like choosing a drink. "I will have hot chocolate if it is cold, else lemonade." One sentence, two choices, and you pick one.',
    mistake:
      'Beginners often swap the order and write the condition first, like status = if age >= 18 "Adult" else "Minor". That is an error. The True value comes first, then if, then else.',
    remember: [
      'One line, two possible values.',
      'True value first, then if, then else.',
      'No colons in this short form.',
    ],
  },
  'Practice Exercises': {
    simple: [
      'Now you will put it all together with if, elif, and else.',
      'Read the task first: set n = 0. If n > 0 print "positive", elif n == 0 print "zero", else print "negative".',
      'Plan before typing. Ask: is 0 bigger than 0? No. Is 0 equal to 0? Yes. So you expect to see zero.',
      'Write it step by step. Each if, elif, and else line ends with a colon, and each print is indented. Then run it and check that it shows zero.',
      'Quick recap: conditions are True or False, if runs code when True, else is the backup, elif adds more checks, and indenting shows what belongs where.',
    ],
    realLife:
      'Think of it like a thermometer with three colors. Above zero is warm, exactly zero is the freezing point, and below zero is cold. Every number fits only one group.',
    mistake:
      'Beginners often write elif n = 0 with one =. That gives an error. To check "is equal to", always use two: n == 0.',
    remember: [
      'Guess the output before you run.',
      'Only one branch prints.',
      'Use == to check equal.',
    ],
  },
}
