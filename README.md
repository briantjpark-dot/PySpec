# PySpec

## Quick Summary

Modern LLMS are extremely capable at programming. However, I find it a bit uneasy to simply prompt these tools and give a go ahead to whatever they produce without understanding any syntax. I feel there is a gap between tools like Claude, Codex, or Lovable placed in the hands of experienced developers who’ve programmed without these AI tools and beginners or intermediates who have only a basic understanding. I fall in this second camp.

This tool is intended for people like myself to still take the lead in designing and creating programs without having to pour over resources in syntax. I’ve designed this pseudo-syntax system to outline the basic variables, functions, and datatypes to be used for various programs. Once finished, a markdown, test function, and spec model package will be created to then be handed to a coding agent for better context and strict direction of what should be created. 

Again, this tool is only meant to provide a foundation for the coding agent to build and iterate on top of!

## How it Works/Syntax Guide

There are only two rules to writing this spec: nouns and functions.

### Nouns: 

A noun is a thing your program works with, described by its fields, where fields are the pieces of information a noun would hold. For example, a to-do list app could have “task” as a noun and therefore structured by:

```yaml
nouns:
    task:
        name: text
        priority: whole number
        done: yes/no	
```

You can read that as "a task has a name, priority, and done status"

Each of these fields (like name, priority, and done from above) has a type indicated by the ": text/whole number/ yes/no". These are the current valid types:

| Write this      | For values like…                | Meaning                          |
|-----------------|---------------------------------|----------------------------------|
| `text`          | `Alice`, `hello@mail.com`       | words, names, any text           |
| `whole number`  | `0`, `5`, `42`                  | counting numbers, no decimal point |
| `decimal`       | `3.14`, `19.99`                 | numbers that can have a decimal point |
| `number`        | `3.14`                          | same as `decimal`                |
| `yes/no`        | `true`, `false`                 | a simple true-or-false value     |
| `true/false`    | `true`, `false`                 | same as `yes/no`                 |
| `date`          | `2024-03-15`                    | a calendar date (written as text) |

If you don't use one of these types, the program won't run.

### Lists

When a field holds many of something rather than one, put list of in front of the type:

```yaml
nouns:
  task:
    title: text
    priority: whole number
    done: yes/no

  project_board:
    name: text
    tasks: list of task
```
Here `tasks: list of task` means "a project_board holds **many tasks**." Notice two things:

- You can use `list of` with any type: `list of text`, `list of whole number`,
  or `list of task`.
- **Use the singular form after `list of`** — write `list of task`, not
  `list of tasks`. SpecForge adds the "many" for you. In fact, a good mental model to think about this is that after any "list of" you should name the explicit noun you are trying to use

### Nouns inside nouns

You may have noticed something in that last example: `project_board` has a field
whose type is `task` — another noun you defined. That's allowed and encouraged!
Nouns can be built out of other nouns, as deeply as you like. A `project_board`
contains `task`s; a `task` could contain something else; and so on. This is how
you describe richly structured data.

### Functions

A function is an action your program performs. Each one describes what goes in, what comes out, and what it does. Functions are written as a list:

```yaml
functions:
  - name: is_high_priority
    does: Return whether a task is high priority (priority 1).
    input:
      task: task
    output: yes/no
```

Reading that top to bottom:

- **`name`** — what the function is called. (Use lowercase words joined by
  underscores, like `is_high_priority`.)
- **`does`** — a plain-language description of what it does. This becomes the
  function's documentation, so write it for a human.
- **`input`** — the information the function needs, each as `name: type` (just
  like a noun's fields). A function can take several inputs.
- **`output`** — the single type the function produces.

The types in `input` and `output` use the **exact** same vocabulary as nouns — so
`text`, `whole number`, `list of task`, or any noun name all work here too.

Here is an example function with a list input and ouput:

```yaml
- name: unfinished_tasks
    does: Return only the tasks that are not yet done.
    input:
      tasks: list of task
    output: list of task
```

### Examples

Space to write examples are provided at the end of each function. These not only give your coding agent more context but also write a test file in python that you can later use to automatically check the functions you choose to create. 

Here is how examples can be used in our previous function:

```yaml
- name: count_unfinished
    does: Count how many tasks are not yet done.
    input:
      tasks: list of task
    output: whole number
    examples:
      - given:
          tasks:
            - {title: Email, priority: 2, done: false}
            - {title: Report, priority: 1, done: false}
            - {title: Lunch, priority: 3, done: true}
        returns: 2
```

### Two Styles of Notation:

Like the example above, you can write out multiple examples for a single input. This will likely be the case for managing lists. Here is that notation here:

```yaml
examples:
      - given:
          tasks:
            - {title: Email, priority: 2, done: false}
            - {title: Report, priority: 1, done: false}
            - {title: Lunch, priority: 3, done: true}
        returns: 2
```

But let's suppose you have multiple input variables or only want to write out a single example. You may do so like this:

```yaml
examples:
      - given:
            profile_a: {name: Sam, age: 30, verified: true}
            profile_b: {name: Alex, age: 28, verified: true}
        returns: true
```

A few things to notice:

- Under `given`, you name each input and provide a value shaped like its type.
  For a `task`, that's its fields: `{title: Email, priority: 2, done: false}`.
- The `{ }` braces are a compact YAML way to write a thing's fields on one line.
- You can provide **several** examples for one function — just add more `-`
  entries under `examples`.

### Examples are optional

You do **not** have to write examples. A function without them still generates
correctly — it just won't have an automatic test. This is useful when you want
to sketch out the shape of your whole program first and add tests later, or when
a function's example would be tedious to write by hand. Write examples where they
earn their keep; skip them where they don't.

## A complete spec

Here's everything above, assembled into one working spec you can paste in and
build:

```yaml
project: TaskManager
overview: |
  A simple task manager that keeps track of tasks and tells you
  how many are still left to do.

nouns:
  task:
    title: text
    priority: whole number
    done: yes/no

  project_board:
    name: text
    tasks: list of task

functions:
  - name: is_high_priority
    does: Return whether a task is high priority (priority 1).
    input:
      task: task
    output: yes/no

  - name: count_unfinished
    does: Count how many tasks are not yet done.
    input:
      tasks: list of task
    output: whole number
    examples:
      - given:
          tasks:
            - {title: Email, priority: 2, done: false}
            - {title: Report, priority: 1, done: false}
            - {title: Lunch, priority: 3, done: true}
        returns: 2

  - name: unfinished_tasks
    does: Return only the tasks that are not yet done.
    input:
      tasks: list of task
    output: list of task
```

---

## Quick reference

```yaml
project: MyProgram              # a name
overview: |                     # a short description
  What this program is for.

nouns:                          # your "things"
  thing_name:
    field_name: text            # field: type
    another_field: list of text # a list of something

functions:                      # your "actions"
  - name: do_something          # lowercase_with_underscores
    does: What it does.         # plain-language description
    input:                      # what goes in (can be several)
      some_input: thing_name
    output: yes/no              # what comes out (exactly one type)
    examples:                   # optional — each becomes a test
      - given:
          some_input: {field_name: hi, another_field: [a, b]}
        returns: true
```

**Types:** `text` · `whole number` · `decimal` (or `number`) · `yes/no` (or
`true/false`) · `date` · `list of <type>` · any noun you've defined.

---

## Common mistakes

- **Plural after `list of`.** Write `list of task`, not `list of tasks`.
- **A type SpecForge doesn't know.** Use `whole number`, not `integer` or `int`;
  use `yes/no`, not `boolean`. Stick to the vocabulary above.
- **Inconsistent indentation.** Everything inside a section must be indented
  underneath it, using spaces (not tabs), the same amount at each level.
- **Forgetting the `-` before a function.** Functions are a list; each one starts
  with a `-`.
- **A missing field in an example.** If a `task` has three fields, every `task`
  in your examples must include all three.

If your spec has a problem, SpecForge won't crash — it will tell you in plain
language what to fix.

---

## Future iterations

I plan to keep working on this further! For example I plan to
add areas to search for libraries related to your intentions (like pandas or numpy) and have a section to store these desired libraries.

If you have any suggestions, comments, feedback, or criticism I'll buy you a coffee! 😁😁😁
