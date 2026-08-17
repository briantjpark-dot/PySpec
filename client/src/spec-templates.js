// Starter doc the editor loads with, and what "Load guide template" restores.
export const starterSpecTemplate = `project: DateMatch  # The name of your project
overview: |
# Just as you'd prompt Claude Code with an overview of what you're building,
# give some general context here.
# Ex. A simple dating app that scores compatibility between two user profiles.

nouns:
  profile:  # Nouns are the objects or "things" your code works with
    # Fields can be sub-details of the noun. A dating profile might have:
    name: text
    age: whole number
    verified: true/false

functions:
  - name: is_match  # What your function is called
    does: Return whether two profiles are a compatible match.  # What it does, semantically
    input:
      profile_a: profile
      profile_b: profile
    output: true/false
    examples:
      # Examples become tests — give sample inputs and their expected output.
      # Examples are entirely optional but recommended!
      - given:
          profile_a: {name: Sam, age: 30, verified: true}
          profile_b: {name: Alex, age: 28, verified: true}
        returns: true
# You can hit enter twice at the end of functions to create a new function block!
`;

// What "Insert blank template" replaces the doc with.
export const blankSpecTemplate = `project:
overview:


nouns:
  noun1:
    field1:
    field2:

functions:
  - name:
    does:
    input:
    output:
    examples:
      - given:
          - {}
          - {}
        returns:`;
