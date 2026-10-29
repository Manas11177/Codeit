import type { ConceptExplainer } from './types'

export const LISTS_EXPLAINERS: Record<string, ConceptExplainer> = {
  'Introduction to Lists': {
    simple: [
      'So far, one variable held one thing. A list lets one variable hold many things.',
      'A list is a group of items kept in a line. The order stays the same. First stays first.',
      'In Python, we wrap the items in square brackets [ ]. We put commas between them. Like this: nums = [1, 2, 3].',
      'When you run print(nums), Python shows the whole list: [1, 2, 3]. The brackets show too.',
      'You can change a list later. You can add, remove, or swap items.',
    ],
    realLife:
      'Think of it like a shopping list on paper. One sheet holds many things, written in order from top to bottom.',
    mistake:
      'Some beginners use ( ) or { } to make a list. Lists always use square brackets, like [1, 2, 3].',
    remember: [
      'A list holds many items in one variable.',
      'Use square brackets [ ] and commas.',
      'The order of items is kept.',
    ],
  },
  'Creating Lists': {
    simple: [
      'To make a list, first pick a name. For example: colors.',
      'Then write = and open a square bracket [. Put your items inside, with commas between them.',
      'Words (text) need quotes around them. So we write colors = ["red", "green", "blue"].',
      'Numbers do not need quotes. So nums = [1, 2, 3] works fine.',
      'Run print(colors) and Python shows [\'red\', \'green\', \'blue\']. Python shows text with single quotes. That is normal.',
    ],
    realLife:
      'Think of it like a pencil box with a label on top. The label is the name. The pencils inside are the items, lined up in order.',
    mistake:
      'Forgetting quotes around words, like [red, green, blue], gives an error. Python thinks red is a variable. Write "red" with quotes.',
    remember: [
      'name = [item1, item2, item3]',
      'Words need quotes. Numbers do not.',
      'print(name) shows the whole list.',
    ],
  },
  'Accessing List Elements': {
    simple: [
      'Each item in a list has a position number. This number is called an index.',
      'Python starts counting at 0, not 1. So the first item is at index 0.',
      'To get one item, write the list name, then the index in square brackets. With items = ["a", "b", "c"], items[0] gives "a".',
      'You can also count from the end with minus numbers. items[-1] is the last item, "c".',
      'So print(items[0]) shows a on the screen.',
    ],
    realLife:
      'Think of it like seats in a row at the cinema. But in Python, the very first seat is called seat 0.',
    mistake:
      'Many beginners write items[1] to get the first item. That gives the second item. The first item is always items[0].',
    remember: [
      'Counting starts at 0.',
      'list[0] is the first item.',
      'list[-1] is the last item.',
    ],
  },
  'List Slicing': {
    simple: [
      'Sometimes you want a few items, not just one. Taking a piece of a list is called slicing.',
      'You write list[start:stop]. Python starts at the start index. It stops just before the stop index.',
      'With nums = [10, 20, 30, 40], nums[1:3] takes index 1 and index 2. That is [20, 30].',
      'Index 3 (the number 40) is not included. The stop number is like a fence you do not cross.',
      'Slicing gives you a new, smaller list. The old list stays the same.',
    ],
    realLife:
      'Think of it like cutting slices from a loaf of bread. You choose where to start cutting and where to stop.',
    mistake:
      'Beginners expect nums[1:3] to include index 3. It does not. The stop index is always left out, so add 1 if you need it.',
    remember: [
      'list[start:stop] takes a piece.',
      'The stop index is NOT included.',
      'Slicing makes a new list.',
    ],
  },
  'Adding and Removing Elements': {
    simple: [
      'Lists can grow and shrink. You can add new items and take items out.',
      'To add an item at the end, use append. You write bag.append("pen").',
      'A method is an action that belongs to something. append is a list method. You call it with a dot: list.append(item).',
      'If bag = ["book"], then after bag.append("pen"), bag is ["book", "pen"].',
      'To remove the last item, use bag.pop(). It takes the last item out of the list.',
    ],
    realLife:
      'Think of it like a school bag. You can put a pen in, and later take something out. The bag is still the same bag.',
    mistake:
      'Some beginners write bag = bag.append("pen"). This makes bag become None. Just write bag.append("pen") on its own line.',
    remember: [
      'append adds one item to the end.',
      'pop removes the last item.',
      'Use a dot: bag.append("pen").',
    ],
  },
  'List Methods': {
    simple: [
      'Lists come with built-in helpers called methods. A method is an action a list can do.',
      'You use a method with a dot: list.method(). For example nums.count(2).',
      'count tells you how many times something appears. With nums = [1, 2, 2, 3], nums.count(2) gives 2.',
      'Other helpers: sort() puts items in order. reverse() flips the order. index(x) tells where x first appears.',
      'So print(nums.count(2)) shows 2 on the screen.',
    ],
    realLife:
      'Think of it like buttons on a remote control. Each button does one job, like count, sort, or flip.',
    mistake:
      'Beginners sometimes write count(nums, 2). That is wrong. The list comes first, then a dot: nums.count(2).',
    remember: [
      'Methods use a dot: list.method().',
      'count(x) tells how many times x appears.',
      'sort() and reverse() change the order.',
    ],
  },
  'Introduction to Tuples': {
    simple: [
      'A tuple is like a list, but it cannot be changed. Once made, it stays the same forever.',
      'Tuples use round brackets ( ) instead of square brackets. Like this: point = (3, 4).',
      'You get items the same way as lists, with an index. point[0] gives 3.',
      'You cannot append, remove, or swap items in a tuple. This keeps the data safe.',
      'Tuples are great for things that should not change, like a map point or a date.',
    ],
    realLife:
      'Think of it like words carved in stone. You can read them any time, but you cannot rub them out or add more.',
    mistake:
      'Trying point[0] = 5 or point.append(5) gives an error. Tuples cannot be changed. Use a list if you need to change items.',
    remember: [
      'Tuples use round brackets ( ).',
      'Tuples cannot be changed.',
      'Read items with an index, like point[0].',
    ],
  },
  'Tuple Operations': {
    simple: [
      'You cannot change a tuple. But you can join two tuples to make a new one.',
      'Use + to join them. With a = (1, 2) and b = (3,), a + b gives (1, 2, 3).',
      'Look at b = (3,). A tuple with one item needs a comma at the end. Without it, (3) is just the number 3.',
      'You can also repeat a tuple with *. (1, 2) * 2 gives (1, 2, 1, 2).',
      'You can unpack too. x, y = (3, 4) puts 3 in x and 4 in y.',
    ],
    realLife:
      'Think of it like joining train carriages. You hook two short trains together and get one longer train.',
    mistake:
      'Writing b = (3) without a comma makes a number, not a tuple. Then a + b gives an error. Write b = (3,) instead.',
    remember: [
      'Use + to join tuples.',
      'One-item tuple needs a comma: (3,).',
      'Joining makes a new tuple.',
    ],
  },
  'Practice Exercises': {
    simple: [
      'Now you will use lists in one small program. The task: start with tasks = ["read"], append "code", then print len(tasks).',
      'First, read the task slowly. Make a plan: make the list, add an item, then count the items.',
      'Write it one step at a time. tasks.append("code") adds the item. len(tasks) counts how many items there are.',
      'Run your code. The list has 2 items now, so you should see 2. Compare it with the expected output.',
      'Quick recap: lists use [ ] and can change. Indexes start at 0. Tuples use ( ) and cannot change.',
    ],
    realLife:
      'Think of it like a to-do list on the fridge. You start with one job, add another, then count how many jobs you have.',
    mistake:
      'Some beginners print len(tasks) before the append, and get 1. Always do the append first, then count.',
    remember: [
      'Read, plan, write, run, compare.',
      'append adds, len counts.',
      'Lists change; tuples do not.',
    ],
  },
}
