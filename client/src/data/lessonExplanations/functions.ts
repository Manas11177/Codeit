import type { ConceptExplainer } from './types'

export const FUNCTIONS_EXPLAINERS: Record<string, ConceptExplainer> = {
  'What are Functions?': {
    simple: [
      'A function is a group of steps that has a name. You can run all of those steps just by using the name.',
      'Why do we need it? Without functions, you would copy the same lines again and again. With a function, you write the steps once and reuse them.',
      'In Python you make a function with the word def. Example: def show(): and then, pushed in below, print("Functions reuse code").',
      'Making the function does not run it yet. To run it, you write its name with round brackets: show(). This is called calling the function.',
      'When Python reaches show(), it jumps into the function and runs print("Functions reuse code"). So you see that sentence on the screen.',
    ],
    realLife:
      'Think of it like a button on a toy. Someone builds the button once. After that, every time you press it, the toy plays the same song.',
    mistake:
      'Many beginners write def show(): but never call show(). Then nothing appears on the screen. Remember to call the function after you make it.',
    remember: [
      'A function is named steps you can reuse.',
      'def makes the function.',
      'name() runs the function.',
    ],
  },
  'Defining a Function': {
    simple: [
      'Defining a function means creating it. You tell Python its name and what steps it should do.',
      'Start with def, then the name, then (), then a colon. Example: def say_hi():',
      'On the next line, push the code in with 4 spaces. This pushed-in part is called the body. Example: print("Hi there!").',
      'Then, on a new line with no spaces in front, call it: say_hi(). Python runs the body and shows Hi there!',
    ],
    realLife:
      'Think of it like writing a recipe card. Writing the card does not make the cake. You only get cake when someone follows the card.',
    mistake:
      'A common mistake is forgetting to indent the body. If print("Hi there!") is not pushed in under def, Python gives an error. Always indent the lines that belong to the function.',
    remember: [
      'def name(): with a colon at the end.',
      'Indent the body with 4 spaces.',
      'Call it with name() after defining.',
    ],
  },
  'Calling Functions': {
    simple: [
      'Calling a function means telling it to run. You write its name and then round brackets, like ping().',
      'The brackets are important. They are the signal that says "go now".',
      'You can call a function as many times as you like. Each call runs the whole body again from the top.',
      'Example: def ping(): with print("pong") inside. Then write ping() on one line and ping() again on the next line. You see pong two times.',
    ],
    realLife:
      'Think of it like a doorbell. Each time you press it, it rings. Press it twice, and you hear it ring twice.',
    mistake:
      'Beginners often write ping without the brackets. Python does not run the function then, so nothing prints. Always add () to call a function.',
    remember: [
      'Call a function with name().',
      'Each call runs the body again.',
      'Define the function before you call it.',
    ],
  },
  'Function Parameters': {
    simple: [
      'Sometimes a function needs some information to do its job. A parameter is a named empty box in the def line that will hold that information.',
      'Example: def greet(name): Here, name is the parameter. Inside the function you can use name like any other variable.',
      'When you call the function, you put a real value in the brackets. That value is called an argument. Example: greet("Sam").',
      'Python puts "Sam" into the name box. Then print("Hello,", name) shows Hello, Sam. The comma in print adds a space between the two parts.',
    ],
    realLife:
      'Think of it like a name sticker machine. The machine has a blank spot for a name. You type "Sam", and it prints a sticker that says Hello, Sam.',
    mistake:
      'A common mistake is forgetting to pass a value, like greet() with empty brackets. Python gives an error because name has nothing in it. Give one value for each parameter.',
    remember: [
      'Parameter: the empty box in def.',
      'Argument: the real value you pass in.',
      'One value for each parameter.',
    ],
  },
  'Return Statement': {
    simple: [
      'Some functions work out an answer. The word return sends that answer back to the place that called the function.',
      'Example: def double(n): and inside, return n * 2. The * sign means multiply.',
      'When you write double(5), n becomes 5. The function works out 5 * 2, which is 10, and sends 10 back.',
      'Now double(5) is the same as 10. So print(double(5)) shows 10 on the screen.',
      'After return runs, the function stops. Any lines below return inside the function are skipped.',
    ],
    realLife:
      'Think of it like a vending machine. You put in a coin, and it gives you back a snack. return is the machine handing the snack back to you.',
    mistake:
      'Beginners often use print instead of return inside the function, or forget return. Then the answer is not sent back, and you get None. Use return to send the value out.',
    remember: [
      'return sends an answer back.',
      'The function stops at return.',
      'Print the result outside the function.',
    ],
  },
  'Default Arguments': {
    simple: [
      'A default is a backup value. If you do not give a value, Python uses the backup.',
      'You set it in the def line with an equals sign. Example: def power(base, exp=2):',
      'Inside, return base ** exp. The ** sign means "to the power of". So 3 ** 2 means 3 times 3.',
      'Now call power(3). You gave base, but not exp. So exp uses its backup value 2. The answer is 3 ** 2, which is 9.',
      'If you call power(3, 3), exp becomes 3 instead. Then the answer is 27.',
    ],
    realLife:
      'Think of it like ordering a pizza. If you do not pick a size, you get a medium. If you say "large", you get a large.',
    mistake:
      'A common mistake is putting the default first, like def power(exp=2, base). Python does not allow this. Put parameters with defaults after the ones without.',
    remember: [
      'A default is a backup value.',
      'Set it with = in the def line.',
      'Defaults go after normal parameters.',
    ],
  },
  'Keyword Arguments': {
    simple: [
      'Normally, values go into parameters in order. The first value goes to the first parameter, and so on.',
      'With keyword arguments, you say which box each value goes into. You write the name, an equals sign, and the value. Example: b=2.',
      'Example: def divide(a, b): and inside, return a / b. The / sign means divide.',
      'Now call divide(b=2, a=10). The order is mixed up, but the names tell Python where each value goes. So a is 10 and b is 2.',
      'The answer is 10 / 2, which is 5.0. Dividing with / in Python always gives a number with a decimal point.',
    ],
    realLife:
      'Think of it like labeled boxes when you move house. Because each box says "kitchen" or "bedroom", it does not matter which order they come off the truck.',
    mistake:
      'Beginners sometimes misspell the name, like divide(c=2, a=10). Python gives an error because there is no c box. Use the exact names from the def line.',
    remember: [
      'Keyword arguments use name=value.',
      'With names, order does not matter.',
      'Names must match the def line exactly.',
    ],
  },
  'Practice Exercises': {
    simple: [
      'Time to practice! Your task: make a function add(a, b) that returns a + b. Then print add(4, 6).',
      'First, plan it. You need two inputs, so you need two parameters: a and b. The function should send back their sum.',
      'Write it step by step. Line 1: def add(a, b): Line 2, indented: return a + b. Line 3, not indented: print(add(4, 6)).',
      'Run it. a becomes 4 and b becomes 6. The function returns 10, and print shows 10. Compare it with the expected output.',
      'Quick recap: def makes a function, name() calls it, parameters take inputs, return sends an answer back, and defaults and keyword names give you extra choices.',
    ],
    realLife:
      'Think of it like a calculator button you build yourself. You type in two numbers, press the button, and it hands you the sum.',
    mistake:
      'A common mistake is calling add(4, 6) without print. The function returns 10, but nothing shows on the screen. Wrap the call in print() to see the answer.',
    remember: [
      'Two inputs means two parameters.',
      'Use return to send the sum back.',
      'Use print() to show the result.',
    ],
  },
}
