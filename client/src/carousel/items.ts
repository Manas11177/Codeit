export type CarouselItem = {
  id: string;
  label: string;
  chapter: string;
  description: string;
  level: string;
  exercises: number;
  progress: number;
  color: string;
  image: string;
  snippet: string[];
};

/** Static carousel metadata — progress is filled in at runtime from user stats. */
export const CAROUSEL_META: Omit<CarouselItem, 'progress'>[] = [
  {
    id: "python-basics",
    chapter: "01",
    label: "Introduction to Python Basics",
    description: "Core Concepts for Absolute Beginners",
    level: "Beginner",
    exercises: 8,
    color: "#00A99D",
    image: "/lessons/python-basics.jpg?v=2",
    snippet: ["# your first program", "print(\"Hello, World!\")"],
  },
  {
    id: "variables",
    chapter: "02",
    label: "Variables & Data Types",
    description: "Learn how Python stores and manages data",
    level: "Beginner",
    exercises: 9,
    color: "#2563EB",
    image: "/lessons/variables.jpg?v=2",
    snippet: ["name = \"Ada\"", "age = 12"],
  },
  {
    id: "operators",
    chapter: "03",
    label: "Operators",
    description: "Master arithmetic, comparison and logical operators",
    level: "Beginner",
    exercises: 9,
    color: "#7C3AED",
    image: "/lessons/operators.jpg?v=2",
    snippet: ["total = 7 + 3", "print(total >= 10)"],
  },
  {
    id: "conditions",
    chapter: "04",
    label: "Conditional Statements",
    description: "Make decisions using if, elif and else",
    level: "Beginner",
    exercises: 7,
    color: "#E11D48",
    image: "/lessons/conditions.jpg?v=2",
    snippet: ["if score >= 50:", "    print(\"Pass\")"],
  },
  {
    id: "loops",
    chapter: "05",
    label: "Loops",
    description: "Repeat tasks using for and while loops",
    level: "Beginner",
    exercises: 8,
    color: "#EA580C",
    image: "/lessons/loops.jpg?v=2",
    snippet: ["for i in range(3):", "    print(i)"],
  },
  {
    id: "functions",
    chapter: "06",
    label: "Functions",
    description: "Create reusable blocks of Python code",
    level: "Intermediate",
    exercises: 8,
    color: "#0891B2",
    image: "/lessons/functions.jpg?v=2",
    snippet: ["def greet(name):", "    return \"Hi \" + name"],
  },
  {
    id: "lists",
    chapter: "07",
    label: "Lists & Tuples",
    description: "Store and manage collections of data",
    level: "Intermediate",
    exercises: 9,
    color: "#16A34A",
    image: "/lessons/lists.jpg?v=2",
    snippet: ["fruits = [\"apple\", \"kiwi\"]", "fruits.append(\"mango\")"],
  },
  {
    id: "dictionaries",
    chapter: "08",
    label: "Dictionaries",
    description: "Work with Python key-value data structures",
    level: "Intermediate",
    exercises: 9,
    color: "#CA8A04",
    image: "/lessons/dictionaries.jpg?v=2",
    snippet: ["user = {\"name\": \"Ada\"}", "print(user[\"name\"])"],
  },
];

/** @deprecated Use buildCarouselItems() for live progress */
export const ITEMS: CarouselItem[] = CAROUSEL_META.map((item) => ({
  ...item,
  progress: 0,
}));
