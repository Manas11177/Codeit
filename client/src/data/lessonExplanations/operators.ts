import type { ConceptExplainer } from './types'

export const OPERATORS_EXPLAINERS: Record<string, ConceptExplainer> = {
  'Arithmetic Operators': {
    simple: [
      'An operator is a small symbol that tells Python to do a job. Arithmetic operators are the ones that do math.',
      'You already know most of them. + adds, - subtracts, * multiplies, and / divides. In Python, the star * means "times".',
      'There are two special ones. // divides and keeps only the whole number. % gives the leftover part, called the remainder.',
      'Try this: a = 10 and b = 3. Then print(a + b) shows 13, print(a * b) shows 30, and print(a // b) shows 3.',
      'Python works out the math first. Then print() shows the answer on the screen.',
    ],
    realLife:
      'Think of it like a calculator in your pocket. You type two numbers, press a button like + or x, and get the answer. In Python, the operator is that button.',
    mistake:
      'Many beginners use / when they want a whole number. 10 / 3 gives 3.3333333333333335, but 10 // 3 gives 3. Use // when you only want the whole part.',
    remember: [
      '+ add, - subtract, * multiply, / divide.',
      '// keeps the whole number only.',
      '% gives the leftover (remainder).',
    ],
  },
  'Assignment Operators': {
    simple: [
      'A variable is a box with a name that holds a value. The = sign puts a value into the box. score = 10 puts 10 into score.',
      'Often we want to change the value already in the box. For example, add 5 points to a score.',
      'Python has a short way to do this: score += 5. It means "take score, add 5, and put the new value back in score".',
      'So score += 5 is the same as score = score + 5. There are more like this: -= subtracts, and *= multiplies.',
      'If score starts at 10, after score += 5 it holds 15. Then print(score) shows 15.',
    ],
    realLife:
      'Think of it like a piggy bank. You do not throw away the old coins. You just drop 5 more coins in, and now the bank holds more.',
    mistake:
      'Some beginners write score = 5 when they mean to add 5. That throws away the old value and leaves only 5. Use score += 5 to add on top.',
    remember: [
      '= puts a value into a variable.',
      'x += 2 means x = x + 2.',
      '-= subtracts, *= multiplies, the same way.',
    ],
  },
  'Comparison Operators': {
    simple: [
      'Comparison operators compare two values. They answer a yes-or-no question.',
      'Python answers with True (yes) or False (no). A True or False value is called a boolean.',
      'Here are the symbols. == equal to, != not equal to, > bigger than, < smaller than, >= bigger or equal, <= smaller or equal.',
      'Example: a = 5 and b = 3. Then print(a > b) asks "is 5 bigger than 3?" Python prints True.',
      'With age = 18, print(age >= 18) asks "is age 18 or more?" 18 counts, so Python prints True.',
    ],
    realLife:
      'Think of it like a ride at a theme park with a sign: "You must be 120 cm or taller." The worker checks your height and says yes or no. That check is a comparison.',
    mistake:
      'Beginners often use one = to check if two things are equal. One = stores a value. Two == compares values. Use == when you ask "are these the same?"',
    remember: [
      'Comparisons always give True or False.',
      '== compares, = stores.',
      '>= means bigger than OR equal to.',
    ],
  },
  'Logical Operators': {
    simple: [
      'Logical operators join True and False answers together. There are three: and, or, not.',
      'and is True only when both sides are True. If even one side is False, the answer is False.',
      'or is True when at least one side is True. not flips the answer: not True is False, and not False is True.',
      'Example: sunny = True and warm = True. Then print(sunny and warm) shows True, because both are True.',
      'If has_ticket = True and is_adult = False, then print(has_ticket and is_adult) shows False. One side is False.',
    ],
    realLife:
      'Think of it like going to a movie. You may enter if you have a ticket AND you are old enough. If either one is missing, the guard says no.',
    mistake:
      'Beginners sometimes write && or || like in other languages. Python does not use those. Write the plain words and, or, and not.',
    remember: [
      'and: both must be True.',
      'or: at least one must be True.',
      'not: flips True and False.',
    ],
  },
  'Identity Operators': {
    simple: [
      'Sometimes a variable has nothing in it yet. Python has a special value for "nothing" called None.',
      'Identity operators check if two names point to the very same thing. They are is and is not.',
      'The most common use is checking for None. You write value is None.',
      'Example: value = None, then print(value is None). Python prints True, because value really is None.',
      'value is not None does the opposite. It is True when value holds something real.',
    ],
    realLife:
      'Think of it like checking a lunch box. You do not ask if it looks like an empty box. You ask "is this box empty right now?" Checking is None is that question.',
    mistake:
      'Beginners often write value == None. It usually works, but the clear Python way is value is None. Use is and is not when checking for None.',
    remember: [
      'None means "nothing here yet".',
      'Use is None to check for nothing.',
      'is not is the opposite of is.',
    ],
  },
  'Membership Operators': {
    simple: [
      'Membership operators check if something is inside a group. They are in and not in.',
      'The group can be a list, like colors = ["red", "blue"]. A list is just items kept together in square brackets.',
      'You write "red" in colors. Python looks through the list and answers True or False.',
      'print("red" in colors) shows True, because red is in the list. print("green" in colors) shows False.',
      'not in is the opposite. "green" not in colors would be True.',
    ],
    realLife:
      'Think of it like checking your shopping bag. You ask "Is there milk in the bag?" You look inside, and the answer is yes or no.',
    mistake:
      'Beginners sometimes forget the quotes, like green in colors. Without quotes, Python thinks green is a variable name and gives an error. Write "green" in colors.',
    remember: [
      'in checks if an item is in a group.',
      'not in checks if it is missing.',
      'Text items need quotes, like "red".',
    ],
  },
  'Bitwise Operators': {
    simple: [
      'Computers store numbers using only 0s and 1s. This is called binary. Each 0 or 1 is called a bit.',
      'Bitwise operators work on those bits, one by one. & means AND, | means OR, ^ means XOR, and << shifts bits left.',
      'Let us try &. In binary, 5 is 101 and 3 is 011. & puts them side by side and checks each column.',
      'A column becomes 1 only if both bits are 1. 101 & 011 gives 001. 001 is the number 1.',
      'So with a = 5 and b = 3, print(a & b) shows 1. You will not use this often as a beginner, and that is okay.',
    ],
    realLife:
      'Think of it like two rows of light switches. You compare them switch by switch. A light turns on only if the switch is on in both rows. That is what & does.',
    mistake:
      'Beginners often mix up & and the word and. & works on bits of numbers. and joins True and False. For this exercise, use a & b, not a and b.',
    remember: [
      'Bitwise works on 0s and 1s.',
      '& is not the same as and.',
      '5 & 3 equals 1.',
    ],
  },
  'Operator Precedence': {
    simple: [
      'When a line has many operators, Python must pick which to do first. This order is called precedence.',
      'Python uses the same rules as school math. Brackets () come first. Then ** (power). Then * / // %. Then + and -.',
      'Look at 2 + 3 * 4. You might read left to right and get 20. But Python does * first.',
      'So 3 * 4 is 12. Then 2 + 12 is 14. print(2 + 3 * 4) shows 14.',
      'If you want the + first, use brackets. (2 + 3) * 4 gives 20.',
    ],
    realLife:
      'Think of it like getting dressed. You put on socks before shoes, even if you say "shoes and socks". There is a fixed order, no matter how you say it.',
    mistake:
      'Beginners often work left to right and expect 2 + 3 * 4 to be 20. Remember that * comes before +. Add brackets when you want a different order.',
    remember: [
      'Brackets () always go first.',
      '* and / come before + and -.',
      '2 + 3 * 4 is 14, not 20.',
    ],
  },
  'Practice Exercises': {
    simple: [
      'Now you will mix two ideas: math operators and comparison operators.',
      'Read the task first: set total = 7 + 3, then print total >= 10. Say it in your own words before you type.',
      'Plan step by step. Step 1: Python works out 7 + 3, which is 10, and stores it in total. Step 2: ask "is total 10 or more?"',
      'Write one line at a time. Then run it. You should see True, because 10 >= 10 counts as yes.',
      'Quick recap: + - * / do math, += updates a variable, == and >= compare, and, or, not join answers, and () decide the order.',
    ],
    realLife:
      'Think of it like checking if you have enough money. You add your coins first: 7 + 3 is 10. Then you ask "Do I have at least 10 to buy the toy?"',
    mistake:
      'Beginners sometimes use > instead of >=. 10 > 10 is False, but 10 >= 10 is True. Read the task carefully and pick the exact symbol it asks for.',
    remember: [
      'Do the math first, then compare.',
      '>= counts the equal case as True.',
      'Run your code and check the output.',
    ],
  },
}
