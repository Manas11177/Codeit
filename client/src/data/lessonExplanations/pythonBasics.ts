import type { ConceptExplainer } from './types'

export const PYTHON_BASICS_EXPLAINERS: Record<string, ConceptExplainer> = {
  'What is Python?': {
    simple: [
      'A computer cannot guess what you want. You must tell it exactly what to do. The instructions you give it are called code.',
      'Python is a language for writing code. It is like English, but with simple, strict rules. That makes it great for beginners.',
      'You write Python lines one under another. The computer reads them from top to bottom, one line at a time.',
      'Your very first tool is print. It shows a message on the screen. For example, print("I am learning Python!") shows: I am learning Python!',
      'The message goes inside the round brackets ( ). Text also needs quotes " " around it, so Python knows it is a message.',
    ],
    realLife:
      'Think of it like giving a friend a recipe. You write each step clearly, in order. Your friend follows the steps exactly, from the first to the last.',
    mistake:
      'Many beginners forget the quotes and write print(I am learning Python!). Python gets confused. Always put text inside quotes, like print("I am learning Python!").',
    remember: [
      'Python is a language to give the computer instructions.',
      'Lines run from top to bottom.',
      'print("...") shows a message on the screen.',
    ],
  },
  'Features of Python': {
    simple: [
      'A feature is a good thing about something. Python has a few big features that make it popular.',
      'First, Python is easy to read. It uses plain words and few strange symbols. Second, it works on Windows, Mac, and Linux. Third, it has many ready-made tools you can use.',
      'Python can also remember things for you. You give a value a name, like feature = "easy to read". This named box is called a variable.',
      'You can print words and a variable together. Put a comma between them: print("Python is", feature).',
      'The comma adds a space for you. So Python shows: Python is easy to read.',
    ],
    realLife:
      'Think of it like a friendly bicycle with training wheels. It is easy to start riding. But it is still a real bike that can take you far.',
    mistake:
      'Some beginners put quotes around the variable, like print("Python is", "feature"). That prints the word feature, not its value. Leave the variable name without quotes.',
    remember: [
      'Python is easy to read and works everywhere.',
      'A variable is a name that holds a value.',
      'A comma in print adds a space between parts.',
    ],
  },
  'Applications of Python': {
    simple: [
      'An application is a way something is used. Python is used in many places in the real world.',
      'People use Python to build websites, study data, make AI, play with games, and do boring jobs automatically.',
      'Data science means looking at lots of numbers and facts to find useful answers. Python is a favorite tool for this.',
      'In code, you can store a field name in a variable: field = "data science". Then print it with a label: print("Python is used in", field).',
      'Python shows: Python is used in data science. The basics you learn now are the same ones experts use.',
    ],
    realLife:
      'Think of it like a pencil. The same pencil can write a story, draw a picture, or solve math. Python is one tool that does many different jobs.',
    mistake:
      'A common slip is spelling the variable differently in two places, like field and Field. Python treats them as different names. Type the name exactly the same each time.',
    remember: [
      'Python is used for websites, data, AI, games, and more.',
      'Store a value once in a variable, then reuse it.',
      'The basics you learn today grow into big projects.',
    ],
  },
  'Installing Python': {
    simple: [
      'To run Python on your own computer, you install it. Installing means putting the program on your computer.',
      'You can get Python for free from the website python.org. After that, your computer can understand Python code.',
      'On this website, you do not need to install anything. Python is already ready for you here.',
      'You type code in the editor box. Then you click the Run button. Your code runs right away.',
      'The output panel shows what your program printed. Try print("Ready to code") and you will see: Ready to code.',
    ],
    realLife:
      'Think of it like a game console. At home, you must buy and set it up first. At a friend\'s house, it is already plugged in, so you just press play.',
    mistake:
      'Beginners often type code but forget to click Run, then wonder why nothing shows. Always click Run and then look at the output panel.',
    remember: [
      'Python is free at python.org.',
      'Here, just type your code and click Run.',
      'The output panel shows what your code printed.',
    ],
  },
  'Python Syntax': {
    simple: [
      'Syntax means the rules for writing code. Just like English has grammar, Python has syntax.',
      'Rule one: names like print are all lowercase. Rule two: text goes inside quotes. Text inside quotes is called a string.',
      'Rule three: each instruction goes on its own line. You do not need a semicolon ; at the end.',
      'You can join two strings with a plus sign +. For example, greeting = "Hello" and then print(greeting + ", World!").',
      'The + sticks the two pieces together with no extra space. So Python shows: Hello, World!',
    ],
    realLife:
      'Think of it like the rules of a board game. If you move a piece the wrong way, the game stops. If you follow the rules, everything works smoothly.',
    mistake:
      'Writing Print with a capital P is a very common mistake. Python only knows print in lowercase, so always write print.',
    remember: [
      'Use lowercase print, and put text in quotes.',
      'One instruction per line, no semicolons needed.',
      '+ joins strings with no extra space.',
    ],
  },
  'Your First Python Program': {
    simple: [
      'A program is a list of instructions for the computer. Your first program can be just one line.',
      'Almost every coder starts by printing "Hello, World!". It is a small test to check that everything works.',
      'Type print, then an open bracket (. Then type the message inside quotes. Then close the quote and the bracket ).',
      'Your full line is print("Hello, World!"). Click Run, and Python shows: Hello, World!',
      'Check that your output matches exactly. Capital letters, the comma, and the ! all matter.',
    ],
    realLife:
      'Think of it like saying your very first word as a baby. It is small, but it shows you can talk. Hello, World! is your first word in Python.',
    mistake:
      'Beginners often forget to close the bracket or a quote, like print("Hello, World!". Python then shows an error. Every ( needs a ) and every " needs a matching ".',
    remember: [
      'print("Hello, World!") is the classic first program.',
      'Every opening bracket and quote needs a closing one.',
      'Output must match exactly, even capitals and commas.',
    ],
  },
  'Comments in Python': {
    simple: [
      'A comment is a note you write for people, not for the computer.',
      'In Python, a comment starts with the # symbol. Python skips everything after # on that line.',
      'For example, # My first comment is a comment. Python does not run it at all.',
      'Your code goes on its own line without #. Like this: print("Comments work!"). Only this line runs, and it shows: Comments work!',
      'Use comments to explain why you did something. They help you and others understand the code later.',
    ],
    realLife:
      'Think of it like sticky notes in your school book. They help you remember things. But they are not part of the story printed in the book.',
    mistake:
      'Some beginners put # in front of their print line by accident. Then Python skips it and nothing is shown. Only put # before notes, never before code you want to run.',
    remember: [
      'Comments start with #.',
      'Python ignores comments; they are notes for humans.',
      'Do not put # before code you want to run.',
    ],
  },
  'Practice Exercises': {
    simple: [
      'Now you will mix what you learned. In this lesson you met print, strings, variables, and comments.',
      'First, read the task slowly. Here it says: create name = "Coder", then print Welcome, Coder using the variable.',
      'Next, make a plan. Step one: store the value. Step two: print a message with the variable.',
      'Now write it line by line. Line one: name = "Coder". Line two: print("Welcome,", name). The comma adds the space for you.',
      'Finally, click Run. Compare your output with Welcome, Coder. If it is different, check spelling, quotes, and commas.',
    ],
    realLife:
      'Think of it like packing your school bag. First you put the book inside (store the value). Then you take it out in class to show it (print it).',
    mistake:
      'A common mistake is typing print("Welcome, Coder") directly. It shows the right words, but the task asks you to use the variable. Use print("Welcome,", name) instead.',
    remember: [
      'Read, plan, write, run, then compare.',
      'Store first, then print.',
      'Use the variable name without quotes.',
    ],
  },
}
