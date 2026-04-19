---
description: "Generate a Markdown presentation from a section file. Usage: /generate-presentation"
name: "generate-presentation"
argument-hint: "section-number"
agent: agent
---

Read the section file from the `sections` folder and generate a slide presentation in Markdown format. **The entire presentation must be written in Polish.**

## Input validation

- Read the argument provided after `/generate-presentation` as the section number. Accepted format: `^\d+(\.\d+)*$` (e.g. `2`, `2.1`, `2.1.3`).
- If the argument does not match the pattern, respond with exactly: `Błąd: nieprawidłowy numer sekcji. Użyj formatu np. "2" lub "2.1".` and stop.
- Locate `sections/<SECTION>.md`. If it does not exist, respond with exactly: `Błąd: nie znaleziono pliku sekcji: sections/<SECTION>.md` and stop.
- Load the entire file as the authoritative source.

## Stage 1 — Markdown generation

Generate the presentation in Markdown with slides separated by `\n---\n`. Do not include practical exercises — focus on theory and key concepts.

**Content requirements:**

- Cover **at least 70 % of the information** from the source: every significant concept, definition, explanation, analogy, and example must appear.
- Each slide must contain descriptive sentences and short explanations — not just headings and bare bullet labels.
- Bullet points must be full sentences or well-developed fragments. Aim for 3–6 bullets per slide.
- If the source explains _why_ something works or _what it means in practice_, include that explanation.
- Match slide count to content (usually 10–18 slides). Split long paragraphs across multiple slides with sub-headings.
- Dedicate a separate slide to each definition, formula, or diagram, including a concrete example or intuitive explanation.
- Reproduce source tables using Markdown table syntax.
- Use an active tone — write informative sentences, not bare noun phrases.
- Each slide must be self-contained enough for a reader unfamiliar with the source to understand the concept.

**Output:** Write the result to `presentations/<SECTION>/<SECTION>.md`, creating the folder if needed. Replace the file if it already exists.

**Review before saving:** verify coverage of all key concepts, Polish spelling and grammar, and consistent use of English term names. Fix any issues found.

## Stage 2 — PDF generation

Run immediately after Stage 1 completes:

```
node presentations/presentation-generator/generate.js <SECTION>
```

This script reads `presentations/<SECTION>/<SECTION>.md` and produces `presentations/<SECTION>/<SECTION>.pdf` using the shared generator in `presentations/presentation-generator/`.
