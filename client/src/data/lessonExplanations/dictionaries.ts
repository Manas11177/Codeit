import type { ConceptExplainer } from './types'

export const DICTIONARIES_EXPLAINERS: Record<string, ConceptExplainer> = {
  'What is a Dictionary?': {
    simple: [
      'A dictionary stores information in pairs. Each pair has a label and some data.',
      'The label is called a key. The data is called a value. You use the key to find the value.',
      'In Python, a dictionary uses curly braces { }. Like this: cap = {"India": "New Delhi"}.',
      'Here, "India" is the key. "New Delhi" is the value. A colon : joins them.',
      'To find the value, write the key in square brackets. print(cap["India"]) shows New Delhi.',
    ],
    realLife:
      'Think of it like a real dictionary book. You look up a word (the key) and find its meaning (the value).',
    mistake:
      'Keys must match exactly. cap["india"] with a small i will fail, because "India" has a capital I.',
    remember: [
      'A dictionary stores key: value pairs.',
      'Use curly braces { }.',
      'Find a value with dict[key].',
    ],
  },
  'Creating Dictionaries': {
    simple: [
      'To make a dictionary, pick a name. Then write = and open a curly brace {.',
      'Inside, write each pair as key: value. Put commas between the pairs.',
      'For example: pet = {"animal": "dog", "age": 3}. This has two pairs.',
      'Text keys and text values need quotes. Numbers like 3 do not.',
      'To get one value, use its key. print(pet["animal"]) shows dog.',
    ],
    realLife:
      'Think of it like a pet\'s ID card. It has labels like Animal and Age, and next to each label is the answer.',
    mistake:
      'Beginners often forget the colon, like {"animal" "dog"}. Each pair needs a colon in the middle: "animal": "dog".',
    remember: [
      'Write pairs as key: value.',
      'Put commas between pairs.',
      'Text needs quotes, numbers do not.',
    ],
  },
  'Accessing Values': {
    simple: [
      'There are two ways to get a value from a dictionary.',
      'Way one: square brackets. scores["math"] gives the value for "math". But if the key is missing, you get an error called KeyError.',
      'Way two: the get method. A method is an action with a dot. scores.get("math") also gives 90.',
      'The nice thing about get: if the key is missing, there is no crash. You can even give a backup value. scores.get("art", 0) gives 0.',
      'So with scores = {"math": 90}, print(scores.get("math")) shows 90.',
    ],
    realLife:
      'Think of it like asking a friend for a phone number. If they do not have it, get politely says "I don\'t know" instead of panicking.',
    mistake:
      'Using scores["art"] when "art" is not in the dictionary causes a KeyError. Use scores.get("art", 0) when a key might be missing.',
    remember: [
      'dict[key] gets a value.',
      'Missing key with [ ] gives KeyError.',
      'dict.get(key, backup) is safer.',
    ],
  },
  'Adding and Updating Items': {
    simple: [
      'Dictionaries can change. You can add new pairs and change old ones.',
      'To add a new pair, write dict[new_key] = value. With user = {"name": "Ana"}, write user["score"] = 10.',
      'Now user has two pairs: name and score.',
      'To update, use a key that is already there. user["score"] = 20 would change 10 to 20.',
      'So after adding, print(user["score"]) shows 10.',
    ],
    realLife:
      'Think of it like a contact on your phone. You can add a new field, like a birthday, or change an old phone number.',
    mistake:
      'Some beginners try user.append("score", 10). Dictionaries have no append. Just write user["score"] = 10.',
    remember: [
      'dict[key] = value adds or updates.',
      'New key adds a pair.',
      'Old key changes its value.',
    ],
  },
  'Removing Items': {
    simple: [
      'Sometimes you need to take a pair out of a dictionary.',
      'One way is del. del data["a"] removes the pair with key "a".',
      'Another way is pop. data.pop("a") removes the pair and also gives you back its value.',
      'You can save that value in a variable. With data = {"a": 1, "b": 2}, removed = data.pop("a") puts 1 in removed.',
      'Then print(removed) shows 1. Now data is just {"b": 2}.',
    ],
    realLife:
      'Think of it like taking a labelled jar off a shelf. The jar is gone from the shelf, but you are now holding what was inside.',
    mistake:
      'Popping a key that does not exist, like data.pop("z"), gives a KeyError. Check the key name first.',
    remember: [
      'del removes a pair.',
      'pop removes it and gives back the value.',
      'The key must exist.',
    ],
  },
  'Dictionary Methods': {
    simple: [
      'Dictionaries have helpful methods. A method is an action you call with a dot.',
      'keys() gives all the keys. values() gives all the values. items() gives all the pairs.',
      'With info = {"x": 1, "y": 2}, info.keys() gives the keys x and y.',
      'Python shows this in a special form. Wrap it in list() to see a normal list: list(info.keys()).',
      'So print(list(info.keys())) shows [\'x\', \'y\'].',
    ],
    realLife:
      'Think of it like a class register. You can read just the names, just the marks, or each name with its mark.',
    mistake:
      'Forgetting the brackets, like info.keys without (), does not run the method. Always add (): info.keys().',
    remember: [
      'keys() gives keys, values() gives values.',
      'items() gives key-value pairs.',
      'Wrap in list() to print neatly.',
    ],
  },
  'Looping Through Dictionaries': {
    simple: [
      'A loop repeats code for each thing in a group. You can loop over a dictionary too.',
      'for key in d: visits each key, one by one.',
      'To get both the key and the value, use items(). Write for k, v in pairs.items():',
      'Each time round the loop, k holds the key and v holds the value.',
      'With pairs = {"a": 1}, the loop runs once. print(k, v) shows a 1.',
    ],
    realLife:
      'Think of it like a teacher reading the register. For each student, she reads the name and then the mark.',
    mistake:
      'Writing for k, v in pairs: without .items() gives an error. Add .items() to get both key and value. Also indent the print line.',
    remember: [
      'for k, v in d.items(): gives both.',
      'Indent the code inside the loop.',
      'for key in d: gives only keys.',
    ],
  },
  'Nested Dictionaries': {
    simple: [
      'A value inside a dictionary can be another dictionary. This is called nesting.',
      'For example: user = {"profile": {"city": "Pune"}}. The value of "profile" is a small dictionary.',
      'To reach deep data, use two sets of square brackets, one after the other.',
      'user["profile"] opens the inner dictionary. Then ["city"] gets "Pune" from it.',
      'So print(user["profile"]["city"]) shows Pune.',
    ],
    realLife:
      'Think of it like a box inside a box. Open the big box (profile), then open the small box inside to find the city.',
    mistake:
      'Writing user["city"] fails with KeyError. "city" lives inside "profile". Go step by step: user["profile"]["city"].',
    remember: [
      'A value can be a dictionary too.',
      'Use one [ ] for each level.',
      'Open the outer box first.',
    ],
  },
  'Practice Exercises': {
    simple: [
      'Now you will mix what you learned. The task: start with cfg = {"theme": "dark"}, change theme to "light", then loop and print each pair.',
      'First, read the task slowly. Make a plan: make the dictionary, update the value, then loop.',
      'Write it step by step. cfg["theme"] = "light" updates the value. Then for k, v in cfg.items(): with print(k, v) indented below.',
      'Run your code. You should see theme light. Compare it with the expected output.',
      'Quick recap: dictionaries store key: value pairs in { }. Use d[key] to read or change. Use items() to loop over pairs.',
    ],
    realLife:
      'Think of it like the settings on a game. You switch the theme from dark to light, then check every setting on the list.',
    mistake:
      'Some beginners put the update after the loop. Then the loop prints theme dark. Always update first, then loop.',
    remember: [
      'Read, plan, write, run, compare.',
      'd[key] = value updates a value.',
      'Loop with for k, v in d.items():',
    ],
  },
}
