---
description: "Generate a Markdown presentation from a section file. Usage: /generate-presentation"
name: "generate-presentation"
argument-hint: "section-number"
agent: agent
---

Read the section file from the `sections` folder and generate a slide presentation in Markdown format. **The entire presentation must be written in Polish.**

## Input validation

- Read the argument as the section number. Accepted format: `^\d+(\.\d+)*$` (e.g. `2`, `2.1`, `2.1.3`).
- If the argument does not match, respond with exactly: `Error: incorrect section number. Use format e.g. "2" or "2.1".` and stop.
- Locate `sections/<SECTION>.md`. If it does not exist, respond with exactly: `Error: section file not found: sections/<SECTION>.md` and stop.
- Read the entire source file.
- Read `package.json` and extract the `"author"` field value.

## Stage 1 — Markdown generation

Generate the presentation in Markdown with slides separated by `\n---\n`. Do not include practical exercises — focus on theory and key concepts.

**Title slide (first slide):**

Use this exact structure, taking values from the source file header and `package.json`:

```markdown
# <SECTION> <TITLE>

**Moduł X: Module Name**

<AUTHOR> · <YEAR>
```

- `# <SECTION> <TITLE>` — copy the H1 verbatim from `sections/<SECTION>.md`
- `**Moduł X: Module Name**` — copy the content of the `> **...**` blockquote from the source file header, rendered as a plain paragraph (without `>`)
- `<AUTHOR>` — value of the `"author"` field from `package.json`
- `<YEAR>` — current year

**Slide length limits (strict, enforced per slide):**

- Continuous text: ≤ 100 words
- Bullet or numbered list: ≤ 80 words
- Slide with a code block: ≤ 40 words of explanatory text (code itself excluded)
- At most one code block per slide; exception: multiple blocks allowed only if each is ≤ 10 words
- Skip code blocks longer than 10 lines; replace with descriptive text (≤ 40 words)
- When content exceeds a limit, split it across multiple slides while preserving logical flow
- These limits take priority over the slide count guideline below

**Content requirements:**

- Cover **at least 70% of the information** from the source: every significant concept, definition, explanation, analogy, and example must appear.
- Each slide must contain descriptive sentences or well-developed bullet fragments — not just headings and bare labels.
- Include explanations of _why_ something works or _what it means in practice_ when the source provides them.
- Dedicate a separate slide to each definition, formula, or diagram with a concrete example or intuitive explanation.
- Reproduce source tables using Markdown table syntax.
- Use an active tone — write informative sentences, not bare noun phrases.
- Each slide must be self-contained enough for a reader unfamiliar with the source to understand the concept.
- Slide count: usually 10–18; generate more slides when word limits require it.

**Output:** Write the result to `presentations/<SECTION>/<SECTION>.md`, creating the folder if needed. Replace the file if it already exists.

**Review before saving:** verify coverage of all key concepts, word limits on all slides, Polish spelling and grammar, and consistent use of English term names.

## Stage 2 — PDF generation

Run immediately after Stage 1 completes:

```
node presentations/presentation-generator/generate.js <SECTION>
```

This script reads `presentations/<SECTION>/<SECTION>.md` and produces `presentations/<SECTION>/<SECTION>.pdf`.
