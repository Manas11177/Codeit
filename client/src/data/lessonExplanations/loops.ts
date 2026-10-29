import type { ConceptExplainer } from './types'

export const LOOPS_EXPLAINERS: Record<string, ConceptExplainer> = {
  'Introduction to Loops': {
    simple: [
      'Sometimes you want the computer to do the same thing many times. You could copy the same line again and again. But that is slow and messy.',
      'A loop is a way to say "do this again". You write the steps once. Python repeats them for you.',
      'Python has two kinds of loops. A for loop repeats a set number of times. A while loop repeats as long as something is true.',
      'Look at this: count = 0, then while count < 3: with print("repeat") and count += 1 indented below it. The lines pushed to the right (indented) are the part that repeats.',
      'Round 1: count is 0, so it prints repeat and count becomes 1. Round 2: count becomes 2. Round 3: count becomes 3. Now 3 < 3 is false, so the loop stops. You see repeat three times.',
    ],
    realLife:
      'Think of it like running laps around a track. Your coach says "run until you finish 3 laps". You do the same thing each lap and count as you go.',
    mistake:
      'A common mistake is forgetting count += 1 inside the loop. Then count stays 0 forever and the loop never stops. Always change the counter inside the loop.',
    remember: [
      'A loop repeats code so you write it once.',
      'Indented lines are the part that repeats.',
      'Change the counter, or the loop never ends.',
    ],
  },
  'for Loop': {
    simple: [
      'A for loop runs some code once for each item in a group. The group can be numbers, letters, or a list.',
      'You write it like this: for n in range(1, 4): and then the repeated line below, pushed in with spaces. The name n is a box that holds the current item.',
      'range(1, 4) gives the numbers 1, 2, 3. It starts at 1 and stops just before 4.',
      'Round 1: n is 1, so print(n) shows 1. Round 2: n is 2. Round 3: n is 3. There are no more numbers, so the loop ends.',
    ],
    realLife:
      'Think of it like handing out cookies to kids in a line. You go to each kid, one by one, and give one cookie. When the line ends, you stop.',
    mistake:
      'Many beginners forget the colon at the end, like for n in range(1, 4) with no :. Python will show an error. Always end the for line with a colon and indent the next line.',
    remember: [
      'for runs the code once per item.',
      'End the for line with a colon.',
      'range(1, 4) gives 1, 2, 3.',
    ],
  },
  'while Loop': {
    simple: [
      'A while loop keeps going as long as a question has the answer "yes". In Python, yes is True and no is False.',
      'It looks like this: n = 1, then while n <= 3: with print(n) and n += 1 indented below. The sign <= means "less than or equal to".',
      'Before each round, Python asks: is n <= 3? If yes, it runs the indented lines. If no, it stops.',
      'Round 1: n is 1, print 1, n becomes 2. Round 2: print 2, n becomes 3. Round 3: print 3, n becomes 4. Now 4 <= 3 is false, so the loop ends.',
    ],
    realLife:
      'Think of it like eating soup. While there is still soup in the bowl, you take another spoonful. When the bowl is empty, you stop.',
    mistake:
      'The biggest mistake is forgetting n += 1. Then n stays 1, the question is always yes, and the loop runs forever. If your program freezes, check that the value changes inside the loop.',
    remember: [
      'while repeats as long as the condition is True.',
      'Set the starting value before the loop.',
      'Update the value inside the loop.',
    ],
  },
  'range() Function': {
    simple: [
      'range() makes a row of numbers for a loop to walk through. A function is a ready-made tool you use by writing its name and ().',
      'range(5) gives 0, 1, 2, 3, 4. It starts at 0 and stops just before 5.',
      'range(2, 10) starts at 2 and stops before 10. So it gives 2 up to 9.',
      'You can add a third number called the step. It means "jump by this much". range(2, 10, 2) gives 2, 4, 6, 8.',
      'So for x in range(2, 10, 2): with print(x) below prints 2, then 4, then 6, then 8. It never prints 10, because range stops before the end number.',
    ],
    realLife:
      'Think of it like climbing stairs two at a time. You start on step 2 and jump to 4, 6, 8. You stop before you reach step 10.',
    mistake:
      'Beginners often think range(1, 5) includes 5. It does not. It gives 1, 2, 3, 4. If you want to reach 5, write range(1, 6).',
    remember: [
      'range stops just before the end number.',
      'range(start, stop, step) jumps by step.',
      'range(5) starts at 0, not 1.',
    ],
  },
  'Nested Loops': {
    simple: [
      'A nested loop is a loop inside another loop. Nested means "one tucked inside the other".',
      'The outside loop is called the outer loop. The loop inside it is the inner loop. The inner loop runs all the way through for every single round of the outer loop.',
      'Example: for i in range(2): then, pushed in, for j in range(2): then, pushed in more, print(i, j).',
      'When i is 0, j goes 0 then 1. So it prints 0 0 and 0 1. When i is 1, j goes 0 then 1 again. So it prints 1 0 and 1 1. That is four lines in total.',
    ],
    realLife:
      'Think of it like a clock. The minute hand goes all the way around for each single step of the hour hand.',
    mistake:
      'A common mistake is wrong indentation. If the inner for is not pushed in under the outer for, it is not inside it. Indent the inner loop 4 spaces, and its body 8 spaces.',
    remember: [
      'Inner loop finishes fully for each outer round.',
      'Indent the inner loop inside the outer one.',
      '2 rounds times 2 rounds makes 4 lines.',
    ],
  },
  'break Statement': {
    simple: [
      'break is a word that stops a loop right away. Python jumps out of the loop and moves on.',
      'We use it when we do not need to keep going. For example, when we already found what we wanted.',
      'Example: for n in range(5): then if n == 3: with break inside it, then print(n). The == means "is equal to".',
      'n is 0, print 0. n is 1, print 1. n is 2, print 2. n is 3, so break runs and the loop ends. 3 and 4 never get printed.',
    ],
    realLife:
      'Think of it like looking for your shoe in a pile. Once you find it, you stop searching. You do not check the rest of the pile.',
    mistake:
      'A common mistake is putting print(n) before the if check. Then 3 gets printed before the loop stops. Check the condition first, then print.',
    remember: [
      'break stops the loop right away.',
      'Put the if check before the print.',
      'Use == to compare, not =.',
    ],
  },
  'continue Statement': {
    simple: [
      'continue means "skip the rest of this round and go to the next one". The loop does not stop. It only skips one turn.',
      'We use it when we want to ignore some values but keep going with the others.',
      'Example: for n in range(4): then if n == 2: with continue inside it, then print(n).',
      'n is 0, print 0. n is 1, print 1. n is 2, so continue skips the print. n is 3, print 3. The output is 0, 1, 3.',
    ],
    realLife:
      'Think of it like eating a bag of mixed candy. When you pick one you do not like, you skip it and grab the next one. You keep eating until the bag is empty.',
    mistake:
      'Beginners often mix up break and continue. break ends the whole loop. continue only skips one round. If your loop stops too early, you probably used break by mistake.',
    remember: [
      'continue skips just one round.',
      'The loop keeps going after continue.',
      'break stops; continue skips.',
    ],
  },
  'Practice Exercises': {
    simple: [
      'Now you will use what you learned. Your task: add up the numbers 1, 2 and 3 with a for loop, then print the total.',
      'First, plan it. You need a box to hold the running sum. Start it at zero: total = 0.',
      'Next, loop over the numbers. for n in range(1, 4): gives 1, 2, 3. Inside the loop, write total += n. That means "add n to total".',
      'Last, print the answer after the loop ends. Write print(total) with no indent. Round 1: total is 1. Round 2: total is 3. Round 3: total is 6. So it prints 6.',
      'Run your code and compare with the expected output. Quick recap: for walks through items, while repeats while true, range stops before the end, break stops, and continue skips.',
    ],
    realLife:
      'Think of it like putting coins in a piggy bank. The bank starts empty. You drop in 1 coin, then 2, then 3. At the end you count them all: 6 coins.',
    mistake:
      'A common mistake is indenting print(total) inside the loop. Then it prints 1, 3, 6 instead of just 6. Keep print(total) lined up with the for, not under it.',
    remember: [
      'Start total = 0 before the loop.',
      'Add inside the loop with total += n.',
      'Print once, after the loop ends.',
    ],
  },
}
