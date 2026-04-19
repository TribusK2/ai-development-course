# AI Development Course

A practical **AI Development** course written entirely **in Polish**.

The course covers 5 modules and 20 sections — from the fundamentals of large language models (LLMs), through building AI agents and RAG applications, to deploying apps and automating CI/CD pipelines with AI.

---

## Modules

| Module | Title |
|--------|-------|
| 1 | Fundamentals and Mechanisms of LLMs |
| 2 | Vibe Coding Ecosystem and AI-first IDEs |
| 3 | Building Applications and AI Agents |
| 4 | Ship Fast with Angular |
| 5 | AI Agents in CI/CD and DevOps |

The full table of contents with all section titles is available in [sections/contents.txt](sections/contents.txt).

---

## The `sections/` folder

The [`sections/`](sections/) folder contains Markdown files with theory and practical exercise topics for each course section. Files are numbered according to the course structure, e.g.:

- `1.1.md` — section 1.1: Transformer Architecture
- `2.3.md` — section 2.3: Agentic CLI Tools
- etc.

### How to create new sections

New sections can be generated automatically using the `/write-section` prompt (GitHub Copilot, Cursor, or any tool that supports `.github/prompts/`).

1. Open the repository in an editor that supports prompts (e.g. VS Code with GitHub Copilot, or Cursor).
2. Invoke the prompt with a section number as an argument, e.g.:
   ```
   /write-section 2.1
   ```
3. The AI will read the table of contents from `sections/contents.txt`, locate the matching section, and create `sections/2.1.md` with theory and practical exercise topics.

The prompt is defined in [.github/prompts/write-section.prompt.md](.github/prompts/write-section.prompt.md). You can modify it to suit your needs — e.g. change the technology stack, preferred section length, or number of exercises.

---

## Generating a PDF

The repository includes a script for generating a PDF from all course sections.

### Requirements

- [Node.js](https://nodejs.org/) (v18 or newer)

### Install dependencies

```bash
npm install
```

### Run

```bash
npm run g-pdf
```

The script (`course-pdf/generate-pdf.js`) combines all files from the `sections/` folder, renders them to HTML, and produces a PDF using Puppeteer.

---

## How to use this course

The course is designed for self-study of AI development — both for developers who want to start working with AI and for those looking to deepen their existing skills.

### Suggested approach

1. **Read sections in order** — each section builds on the previous ones. Start with module 1 and work through them sequentially.
2. **Complete the practical exercises** — each section includes 4 exercise topics (1 easy, 2 medium, 1 advanced). Work through them on your own, using AI as an assistant.
3. **Use AI as a learning partner** — ask questions about the material, request explanations, generate code examples. The course is a great starting point for a conversation with a model.
4. **Modify and extend** — if a section feels too broad or you want to go deeper, generate additional sections or modify the `write-section` prompt to tailor the material to your needs.
5. **Generate a PDF** — if you prefer reading offline or printing, use the PDF generation script.

### Technology stack

The course focuses on practical applications using:
- **JavaScript / Node.js** — backend and scripting
- **Angular + Angular Material** — frontend
- **MongoDB / MongoDB Atlas Vector Search** — database and vector search
- **AWS / AWS Lambda** — application deployment
- **GitHub Actions** — CI/CD
- **OpenAI API, Anthropic API** — LLM integration
- **LangChain, CrewAI** — agentic frameworks

---

## License and open source

This repository is **free and open source** under the [Apache 2.0](LICENSE) license.

There are no plans for active maintenance or further development — this does not mean development will never happen, but it is not guaranteed. If you want to extend the material, **fork the repository** and adapt it to your needs.

You are welcome to:
- fork the repository and create your own version of the course
- add new sections and modules
- translate it into other languages
- adapt the technology stack to your preferences
