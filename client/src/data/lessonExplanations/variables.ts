import type { ConceptExplainer } from './types'

export const VARIABLES_EXPLAINERS: Record<string, ConceptExplainer> = {
  'What are Variables?': {
    simple: [
      'A variable is a box with a name on it. You put a value inside the box. Later, you use the name to get the value back.',
      'We need variables because programs must remember things. A score, a name, or an age can all be kept in variables.',
      'In Python, you write the name, then =, then the value. For example: answer = 42. The = sign means "put this value in the box".',
      'To see what is inside, use print with the name: print(answer). Python looks inside the box and shows: 42.',
    ],
    realLife:
      'Think of it like a labeled jar in the kitchen. The label says "sugar", and the sugar is inside. When you need sugar, you look for the label.',
    mistake:
      'Beginners often write print("answer") with quotes. That prints the word answer, not 42. Write print(answer) with no quotes to see the value.',
    remember: [
      'A variable is a named box for a value.',
      'Use = to put a value in the box.',
      'print(name) without quotes shows the value.',
    ],
  },
  'Creating Variables': {
    simple: [
      'Creating a variable takes just one line. Name on the left, = in the middle, value on the right.',
      'Pick a clear name that tells what is inside, like age or city.',
      'Numbers are written as they are: age = 14. Text needs quotes around it: city = "Mumbai". Text in quotes is called a string.',
      'Now Python remembers it. When you write print(city), Python shows: Mumbai.',
      'You can make as many variables as you like. Each one gets its own line.',
    ],
    realLife:
      'Think of it like naming your pet. Once your dog is called Bruno, you just say "Bruno" and everyone knows who you mean.',
    mistake:
      'Forgetting the quotes, like city = Mumbai, is a common mistake. Python thinks Mumbai is another variable and shows an error. Always write city = "Mumbai".',
    remember: [
      'Pattern: name = value.',
      'Text needs quotes; numbers do not.',
      'One variable per line keeps things clear.',
    ],
  },
  'Variable Naming Rules': {
    simple: [
      'Python has a few rules for variable names. If you break them, your code will not run.',
      'A name must start with a letter or an underscore _. It can use letters, numbers, and underscores. It cannot have spaces.',
      'A name cannot start with a number. So 2name is wrong, but name2 is fine.',
      'If you need two words, join them with an underscore: user_name = "Ravi". This style is called snake_case.',
      'Capital letters matter too. user_name and User_Name are two different boxes. So print(user_name) shows: Ravi.',
    ],
    realLife:
      'Think of it like labeling folders at school. You write clear labels without odd symbols. If two folders look almost the same, you might grab the wrong one.',
    mistake:
      'Beginners often put a space in the name, like user name = "Ravi". Python shows an error. Use an underscore instead: user_name.',
    remember: [
      'Start with a letter or _, never a number.',
      'No spaces; use underscores like user_name.',
      'Capital letters matter: Name and name differ.',
    ],
  },
  Numbers: {
    simple: [
      'Python knows two main kinds of numbers. Whole numbers like 8 are called integers. Numbers with a dot like 2.5 are called floats.',
      'You write numbers without quotes: width = 8 and height = 6.',
      'Python can do math for you. + adds, - subtracts, * multiplies, and / divides.',
      'To multiply, use the star sign *. So print(width * height) works out 8 times 6.',
      'Python does the math first, then shows the answer: 48.',
    ],
    realLife:
      'Think of it like a calculator inside your code. You type the numbers and the sign, and it gives you the answer.',
    mistake:
      'Some beginners use x for multiply, like width x height. Python does not understand that. Always use * to multiply.',
    remember: [
      'Numbers have no quotes.',
      'Use * to multiply, not x.',
      'Integers are whole; floats have a dot.',
    ],
  },
  Strings: {
    simple: [
      'A string is text. It can be a letter, a word, or a whole sentence.',
      'Strings always go inside quotes, like "Code" or "Mentor". The quotes tell Python this is text.',
      'You can join strings with +. Joining strings is called concatenation, a big word for "sticking together".',
      'If word = "Code", then print(word + "Mentor") sticks them together. Python shows: CodeMentor.',
      'Notice there is no space between them. + adds nothing extra. If you want a space, put it inside the quotes yourself.',
    ],
    realLife:
      'Think of it like snapping LEGO bricks together. One brick says "Code", another says "Mentor". Snap them and you get one longer piece.',
    mistake:
      'A common mistake is forgetting the quotes on the second part, like print(word + Mentor). Python thinks Mentor is a variable. Write "Mentor" with quotes.',
    remember: [
      'Strings are text inside quotes.',
      '+ sticks strings together with no space.',
      'Add a space inside quotes if you need one.',
    ],
  },
  Booleans: {
    simple: [
      'A boolean is a value that can only be True or False. It is like a yes or no answer.',
      'Booleans help programs make choices later. For example: is the user a student? Yes or no.',
      'You store one like this: is_student = True. Notice there are no quotes around True.',
      'Then print(is_student) shows: True.',
      'True and False must start with a capital letter. They are special words in Python.',
    ],
    realLife:
      'Think of it like a light switch. It can only be ON or OFF. True is ON and False is OFF.',
    mistake:
      'Writing true with a small t is a very common mistake. Python does not know that word and shows an error. Always write True or False with a capital letter.',
    remember: [
      'Only two values: True and False.',
      'Capital T and capital F.',
      'No quotes around True or False.',
    ],
  },
  'Type Conversion': {
    simple: [
      'Every value has a type. 15 is a number. "15" in quotes is a string, which means text.',
      'Python will not join text and a number with +. It does not know how to mix them.',
      'So we change the type first. str() turns a number into text. int() turns text into a whole number. float() turns it into a decimal number.',
      'With age = 15, str(age) gives "15" as text. Now print("Age: " + str(age)) can join them.',
      'Python shows: Age: 15. The space after the colon comes from inside the quotes.',
    ],
    realLife:
      'Think of it like changing money when you travel. Shops in another country want their own money. You swap it first, then you can buy.',
    mistake:
      'Writing print("Age: " + age) causes a TypeError, because age is a number. Wrap it in str(): print("Age: " + str(age)).',
    remember: [
      'str() turns a number into text.',
      'int() and float() turn text into numbers.',
      'Convert before joining text and numbers with +.',
    ],
  },
  'Input and Output': {
    simple: [
      'Output means what your program shows. In Python, print() gives output on the screen.',
      'Input means what the user types in. In Python, input() waits for the user to type and press Enter.',
      'For example, name = input("Your name? ") stores what the user types in the variable name.',
      'Here we pretend the user already typed it. So we write name = "Alex" instead.',
      'Then print("Hello,", name) greets them. The comma adds a space, so Python shows: Hello, Alex.',
    ],
    realLife:
      'Think of it like ordering at a cafe. You tell the waiter your order (input). Later, the waiter brings you your food (output).',
    mistake:
      'Beginners often forget the comma and write print("Hello," name). Python shows an error. Put a comma between each part inside print.',
    remember: [
      'print() shows output.',
      'input() reads what the user types.',
      'Commas in print separate parts and add spaces.',
    ],
  },
  'Practice Exercises': {
    simple: [
      'Time to mix what you learned. You know variables, numbers, strings, booleans, and type conversion.',
      'First, read the task: set item = "book" and price = 12, then print both on one line.',
      'Next, plan. item is text, so it needs quotes. price is a number, so no quotes.',
      'Now write it. The two variables are ready. Add print(item, price). Commas let you print text and numbers together without str().',
      'Click Run and compare. Your output should be: book 12. If not, check spelling and commas.',
    ],
    realLife:
      'Think of it like a price tag in a shop. One part is the name of the thing. The other part is the number it costs.',
    mistake:
      'A common mistake is print(item + price). That mixes text and a number with + and gives an error. Use a comma instead: print(item, price).',
    remember: [
      'Read, plan, write, run, then compare.',
      'Text gets quotes; numbers do not.',
      'Commas in print can mix text and numbers.',
    ],
  },
}
