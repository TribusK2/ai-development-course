---
description: "Write a section of a learning plan. Usage: /write-section"
name: "write-section"
argument-hint: "section-number"
agent: agent
---

Prepare the theory and practical exercise topics for a section of the learning plan. **All generated content must be written in Polish.** Sections are numbered in the table of contents, e.g. 1.1, 2.3, etc. Respond only about the section indicated in the argument; do not write about other sections.

## Table of contents

Read the table of contents stored in [contents](../../contents.txt).

Expected format: each line contains a section number and title, e.g. `2.1 — Section title` or `2.1. Section title`. If the format differs, try to recognise the section number at the beginning of the line.

## Section number

- Read the argument provided after `/write-section`.
- Accepted format: `^\d+(\.\d+)*$` (e.g. `2`, `2.1`, `2.1.3`).
- Find the matching section in the table of contents and record its title.
- Also read the module title that the section belongs to (e.g. `Moduł 2: Ekosystem Vibe Coding i AI-first IDE`), to establish context.
- If the argument does not match the pattern or the section is not found, respond with an error message and stop. Example: `Błąd: nieprawidłowy numer sekcji. Użyj formatu np. "2" lub "2.1".`

## Task

- Create a new Markdown file in the `sections` folder, named after the section number, e.g. `2.1.md`. Create the folder if it does not exist.
- Write the theory for the indicated section in Polish.
- Preferred length: 4–7 thematic subsections, each 200–400 words (approximately 3–6 paragraphs). The theory should be concise but complete, covering all key concepts and skills for the section.
- Where appropriate, include examples or analogies.
- Use Bash, JavaScript, Angular, Angular-Material, Node.js, MongoDB, GitHub, AWS, AWS Lambda (serverless), and Docker (development only) in examples. Use other languages or pseudocode only when none of the listed technologies can be applied practically.
- Write practical exercise topics (topics only, no solutions) for the section. Generate 4 topics: 1 easy, 2 medium, 1 advanced.
- Use a structure and formatting suitable for a study script, but in an approachable style — use headings, bullet lists, bold text, tables, etc.

## Review

- After writing the theory and exercise topics, verify that they contain no factual errors, are complete, and match the section title.
- Check for spelling and grammar errors (Polish language).
- Verify that translations of English terms are accurate and consistent throughout the material.
- If you detect any problems, fix them before finishing.
