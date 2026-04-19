// Copyright 2026 Krzysztof Rytlewski
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const puppeteer = require('puppeteer');
const { marked } = require('marked');
const fs = require('fs');
const path = require('path');

const katexDir = path.join(__dirname, 'node_modules', 'katex', 'dist');
const katexCssHref = 'file:///' + katexDir.replace(/\\/g, '/')+ '/katex.min.css';

// Course structure
const sections = [
  { module: 1, moduleTitle: 'Fundamenty i Mechanizmy LLM', chapter: 1, file: '1.1.md' },
  { module: 1, moduleTitle: 'Fundamenty i Mechanizmy LLM', chapter: 2, file: '1.2.md' },
  { module: 1, moduleTitle: 'Fundamenty i Mechanizmy LLM', chapter: 3, file: '1.3.md' },
  { module: 1, moduleTitle: 'Fundamenty i Mechanizmy LLM', chapter: 4, file: '1.4.md' },
  { module: 2, moduleTitle: 'Ekosystem Vibe Coding i AI-first IDE', chapter: 1, file: '2.1.md' },
  { module: 2, moduleTitle: 'Ekosystem Vibe Coding i AI-first IDE', chapter: 2, file: '2.2.md' },
  { module: 2, moduleTitle: 'Ekosystem Vibe Coding i AI-first IDE', chapter: 3, file: '2.3.md' },
  { module: 2, moduleTitle: 'Ekosystem Vibe Coding i AI-first IDE', chapter: 4, file: '2.4.md' },
  { module: 3, moduleTitle: 'Budowa Aplikacji i Agenty AI', chapter: 1, file: '3.1.md' },
  { module: 3, moduleTitle: 'Budowa Aplikacji i Agenty AI', chapter: 2, file: '3.2.md' },
  { module: 3, moduleTitle: 'Budowa Aplikacji i Agenty AI', chapter: 3, file: '3.3.md' },
  { module: 3, moduleTitle: 'Budowa Aplikacji i Agenty AI', chapter: 4, file: '3.4.md' },
  { module: 4, moduleTitle: 'Szybkie Wdrażanie (Ship Fast) w oparciu o Angular', chapter: 1, file: '4.1.md' },
  { module: 4, moduleTitle: 'Szybkie Wdrażanie (Ship Fast) w oparciu o Angular', chapter: 2, file: '4.2.md' },
  { module: 4, moduleTitle: 'Szybkie Wdrażanie (Ship Fast) w oparciu o Angular', chapter: 3, file: '4.3.md' },
  { module: 4, moduleTitle: 'Szybkie Wdrażanie (Ship Fast) w oparciu o Angular', chapter: 4, file: '4.4.md' },
  { module: 5, moduleTitle: 'Agenty AI w procesach CI/CD i DevOps', chapter: 1, file: '5.1.md' },
  { module: 5, moduleTitle: 'Agenty AI w procesach CI/CD i DevOps', chapter: 2, file: '5.2.md' },
  { module: 5, moduleTitle: 'Agenty AI w procesach CI/CD i DevOps', chapter: 3, file: '5.3.md' },
  { module: 5, moduleTitle: 'Agenty AI w procesach CI/CD i DevOps', chapter: 4, file: '5.4.md' },
];

// Extract chapter title from first H1 in markdown file
function extractTitle(mdContent) {
  const match = mdContent.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : 'Rozdział';
}

// Get unique modules
function getModules() {
  const seen = new Set();
  return sections.filter(s => {
    if (seen.has(s.module)) return false;
    seen.add(s.module);
    return true;
  }).map(s => ({ id: s.module, title: s.moduleTitle }));
}

// Build TOC HTML
function buildTOC(sectionsWithTitles) {
  const modules = getModules();
  let html = '';

  for (const mod of modules) {
    html += `<div class="toc-module">
      <a href="#module-${mod.id}" class="toc-module-link">Moduł ${mod.id}: ${mod.title}</a>
    </div>`;
    const modSections = sectionsWithTitles.filter(s => s.module === mod.id);
    for (const s of modSections) {
      const chapterId = `chapter-${s.module}-${s.chapter}`;
      html += `<div class="toc-chapter">
        <a href="#${chapterId}" class="toc-chapter-link">${s.module}.${s.chapter} &nbsp;${s.chapterTitle}</a>
      </div>`;
    }
  }
  return html;
}

// Configure marked
marked.setOptions({
  gfm: true,
  breaks: false,
});

// Custom renderer to handle heading IDs etc.
const renderer = new marked.Renderer();

// Preprocess LaTeX math before marked parsing.
// marked mangles LaTeX: treats _k as italic, \frac etc. as escape sequences.
// Strategy: extract math strings, replace with unique placeholders, restore after parse.
function preprocessMath(md) {
  const mathBlocks = [];
  // Display math first (double-dollar), to avoid matching the inner $ of $$
  md = md.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
    mathBlocks.push({ type: 'display', content: math.trim() });
    return `%%MATHBLOCK${mathBlocks.length - 1}%%`;
  });
  // Inline math (single-dollar, no newlines)
  md = md.replace(/\$([^\n$]+?)\$/g, (_, math) => {
    mathBlocks.push({ type: 'inline', content: math.trim() });
    return `%%MATHBLOCK${mathBlocks.length - 1}%%`;
  });
  return { processed: md, mathBlocks };
}

function restoreMath(html, mathBlocks) {
  return html.replace(/%%MATHBLOCK(\d+)%%/g, (_, idx) => {
    const block = mathBlocks[parseInt(idx, 10)];
    const escaped = block.content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    const cls = block.type === 'display'
      ? 'math-placeholder math-display'
      : 'math-placeholder math-inline';
    return `<span class="${cls}" data-math="${escaped}"></span>`;
  });
}

// Read and process all sections
const sectionsDir = path.join(__dirname, 'sections');
const sectionsWithTitles = sections.map(s => {
  const content = fs.readFileSync(path.join(sectionsDir, s.file), 'utf-8');
  const title = extractTitle(content);
  return { ...s, content, chapterTitle: title };
});


// Build body HTML
let bodyHtml = '';
let currentModule = null;

for (const s of sectionsWithTitles) {
  const chapterId = `chapter-${s.module}-${s.chapter}`;

  if (s.module !== currentModule) {
    currentModule = s.module;
    bodyHtml += `
<div class="module-cover page-break" id="module-${s.module}">
  <div class="module-cover-inner">
    <div class="module-number">Moduł ${s.module}</div>
    <div class="module-title">${s.moduleTitle}</div>
    <div class="module-chapters-list">
      ${sections.filter(x => x.module === s.module).map(x => {
        const st = sectionsWithTitles.find(y => y.file === x.file);
        // chapterTitle already starts with "M.C Title", so strip the "M.C " prefix to avoid duplication
        let t = st ? st.chapterTitle : x.file;
        // Remove leading "N.N " prefix from the chapter title (e.g. "1.1 Architektura..." → "Architektura...")
        t = t.replace(/^\d+\.\d+\s+/, '');
        return `<div class="module-chapter-item">${s.module}.${x.chapter} &mdash; ${t}</div>`;
      }).join('')}
    </div>
  </div>
</div>`;
  }

  // Process markdown content — strip the module indicator line (blockquote or plain bold)
  let mdContent = s.content;
  mdContent = mdContent.replace(/^>\s*\*\*Moduł[^*]*\*\*\s*\n+/m, '');
  mdContent = mdContent.replace(/^\*\*Moduł[^*]*\*\*\s*\n*/m, '');

  const { processed: mdProcessed, mathBlocks } = preprocessMath(mdContent);
  let htmlContent = marked.parse(mdProcessed);
  htmlContent = restoreMath(htmlContent, mathBlocks);

  bodyHtml += `
<div class="chapter page-break" id="${chapterId}">
  <div class="chapter-header">
    <span class="chapter-module-label">Moduł ${s.module} · ${s.moduleTitle}</span>
    <h1 class="chapter-title">${s.chapterTitle}</h1>
  </div>
  <div class="chapter-content">
    ${htmlContent}
  </div>
</div>`;
}

const tocHtml = buildTOC(sectionsWithTitles);

const fullHtml = `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Praktyczny Kurs AI Development</title>
<style>
  /* ─── Base ─────────────────────────────────────────────────────── */
  @import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,600&display=swap');

  :root {
    --accent: #6C47FF;
    --accent-light: #EDE9FF;
    --accent-mid: #8B6AFF;
    --dark: #1A1A2E;
    --text: #2D2D3A;
    --text-muted: #6B6B8A;
    --border: #E5E5F0;
    --surface: #F8F8FC;
    --code-bg: #1E1E3A;
    --code-text: #E8E8F8;
    --green: #00C896;
    --orange: #FF8C42;
    --red: #FF4D6D;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  html, body {
    font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
    font-size: 10.5pt;
    line-height: 1.7;
    color: var(--text);
    background: #fff;
  }

  /* ─── Page breaks ───────────────────────────────────────────────── */
  .page-break {
    page-break-before: always;
  }
  .title-page {
    page: cover-page;
    width: 100%;
    height: 100vh;
    min-height: 900px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #1A1A2E 0%, #16213E 40%, #0F3460 100%);
    color: #fff;
    text-align: center;
    padding: 60px 80px;
    position: relative;
    overflow: hidden;
  }

  .title-page::before {
    content: '';
    position: absolute;
    top: -200px; left: -200px;
    width: 600px; height: 600px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(108,71,255,0.3) 0%, transparent 70%);
  }

  .title-page::after {
    content: '';
    position: absolute;
    bottom: -150px; right: -150px;
    width: 500px; height: 500px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(0,200,150,0.2) 0%, transparent 70%);
  }

  .title-logo {
    font-size: 11pt;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.5);
    margin-bottom: 48px;
    font-weight: 500;
  }

  .title-badge {
    display: inline-block;
    background: rgba(108,71,255,0.3);
    border: 1px solid rgba(108,71,255,0.6);
    color: #C4B5FF;
    font-size: 9pt;
    font-weight: 600;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    padding: 6px 20px;
    border-radius: 50px;
    margin-bottom: 36px;
  }

  .title-main {
    font-size: 32pt;
    font-weight: 800;
    line-height: 1.15;
    margin-bottom: 24px;
    background: linear-gradient(135deg, #FFFFFF 0%, #C4B5FF 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    max-width: 800px;
  }

  .title-subtitle {
    font-size: 13pt;
    font-weight: 300;
    color: rgba(255,255,255,0.65);
    max-width: 640px;
    line-height: 1.6;
    margin-bottom: 64px;
  }

  .title-divider {
    width: 60px;
    height: 3px;
    background: linear-gradient(90deg, var(--accent), var(--green));
    border-radius: 2px;
    margin: 0 auto 48px;
  }

  .title-meta {
    display: flex;
    gap: 48px;
    justify-content: center;
    flex-wrap: wrap;
  }

  .title-meta-item {
    text-align: center;
  }

  .title-meta-label {
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: rgba(255,255,255,0.4);
    margin-bottom: 4px;
  }

  .title-meta-value {
    font-size: 11pt;
    font-weight: 600;
    color: rgba(255,255,255,0.9);
  }

  .title-modules-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 12px;
    margin-top: 64px;
    width: 100%;
    max-width: 900px;
  }

  .title-module-chip {
    background: rgba(255,255,255,0.07);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 10px;
    padding: 12px 10px;
    font-size: 7.5pt;
    color: rgba(255,255,255,0.7);
    text-align: center;
    line-height: 1.4;
  }

  .title-module-chip-num {
    display: block;
    font-size: 14pt;
    font-weight: 700;
    color: var(--accent-mid);
    margin-bottom: 4px;
  }

  /* ─── TOC Page ──────────────────────────────────────────────────── */
  .toc-page {
    padding: 50px 80px 60px;
    min-height: 100vh;
  }

  .toc-page-header {
    margin-bottom: 48px;
    padding-bottom: 24px;
    border-bottom: 2px solid var(--border);
  }

  .toc-page-label {
    font-size: 9pt;
    font-weight: 600;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--accent);
    margin-bottom: 8px;
  }

  .toc-page-title {
    font-size: 24pt;
    font-weight: 800;
    color: var(--dark);
  }

  .toc-module {
    margin-top: 28px;
    margin-bottom: 6px;
  }

  .toc-module-link {
    text-decoration: none;
    display: block;
    font-size: 11pt;
    font-weight: 700;
    color: var(--dark);
    padding: 12px 16px;
    background: var(--accent-light);
    border-left: 4px solid var(--accent);
    border-radius: 0 8px 8px 0;
    transition: all 0.2s;
  }

  .toc-chapter {
    padding-left: 24px;
    margin: 2px 0;
  }

  .toc-chapter-link {
    text-decoration: none;
    display: block;
    font-size: 9.5pt;
    color: var(--text);
    padding: 6px 12px;
    border-radius: 6px;
    transition: background 0.2s;
  }

  /* ─── Module Cover ──────────────────────────────────────────────── */
  .module-cover {
    page: module-cover-page;
    page-break-before: auto;
    break-before: auto;
    width: 100%;
    height: 100vh;
    min-height: 800px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--dark) 0%, #0F3460 100%);
    position: relative;
    overflow: hidden;
  }

  .module-cover::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 50px,
      rgba(255,255,255,0.02) 50px,
      rgba(255,255,255,0.02) 51px
    );
  }

  .module-cover-inner {
    position: relative;
    text-align: center;
    color: #fff;
    padding: 60px 80px;
    max-width: 700px;
  }

  .module-number {
    font-size: 10pt;
    font-weight: 600;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: var(--accent-mid);
    margin-bottom: 20px;
  }

  .module-title {
    font-size: 26pt;
    font-weight: 800;
    line-height: 1.2;
    margin-bottom: 40px;
    color: #fff;
  }

  .module-chapters-list {
    text-align: left;
    background: rgba(255,255,255,0.07);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 12px;
    padding: 24px 28px;
    margin-top: 16px;
  }

  .module-chapter-item {
    font-size: 9.5pt;
    color: rgba(255,255,255,0.7);
    padding: 6px 0;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    line-height: 1.4;
  }

  .module-chapter-item:last-child {
    border-bottom: none;
  }

  /* ─── Chapter ───────────────────────────────────────────────────── */
  .chapter {
    padding: 40px 80px 60px;
  }

  .chapter-header {
    margin-bottom: 48px;
    padding-bottom: 24px;
    border-bottom: 2px solid var(--border);
  }

  .chapter-module-label {
    display: inline-block;
    font-size: 8.5pt;
    font-weight: 600;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--accent);
    background: var(--accent-light);
    padding: 4px 12px;
    border-radius: 50px;
    margin-bottom: 16px;
  }

  .chapter-title {
    font-size: 22pt;
    font-weight: 800;
    color: var(--dark);
    line-height: 1.25;
  }

  /* ─── Content Typography ────────────────────────────────────────── */
  /* Hide only the first H1 inside chapter-content (it repeats the chapter-title).
     We do NOT hide h1 globally — module covers use h1.module-title. */
  .chapter-content > h1:first-child {
    display: none;
  }

  .chapter-content h2 {
    font-size: 14pt;
    font-weight: 700;
    color: var(--dark);
    margin-top: 36px;
    margin-bottom: 14px;
    padding-left: 12px;
    border-left: 4px solid var(--accent);
    page-break-after: avoid;
    break-after: avoid;
  }

  .chapter-content h3 {
    font-size: 11.5pt;
    font-weight: 700;
    color: var(--dark);
    margin-top: 24px;
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    gap: 8px;
    page-break-after: avoid;
    break-after: avoid;
  }

  .chapter-content h3::before {
    content: '';
    display: inline-block;
    width: 4px;
    height: 16px;
    background: var(--accent);
    border-radius: 2px;
    flex-shrink: 0;
  }

  .chapter-content h4 {
    font-size: 10.5pt;
    font-weight: 600;
    color: var(--text);
    margin-top: 18px;
    margin-bottom: 8px;
    page-break-after: avoid;
    break-after: avoid;
  }

  .chapter-content h2 + *,
  .chapter-content h3 + *,
  .chapter-content h4 + * {
    page-break-before: avoid;
    break-before: avoid;
  }

  .no-break-heading {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .chapter-content p {
    margin-bottom: 14px;
    font-size: 10.5pt;
    line-height: 1.75;
    color: var(--text);
  }

  .chapter-content ul, .chapter-content ol {
    margin: 12px 0 16px 24px;
    padding: 0;
  }

  .chapter-content li {
    margin-bottom: 6px;
    font-size: 10.5pt;
    line-height: 1.65;
  }

  .chapter-content li::marker {
    color: var(--accent);
  }

  .chapter-content strong {
    font-weight: 700;
    color: var(--dark);
  }

  .chapter-content em {
    font-style: italic;
    color: var(--text-muted);
  }

  /* ─── Blockquote / Callout ──────────────────────────────────────── */
  .chapter-content blockquote {
    margin: 16px 0;
    padding: 14px 18px;
    background: var(--accent-light);
    border-left: 4px solid var(--accent);
    border-radius: 0 8px 8px 0;
    font-size: 10pt;
    color: var(--text);
    page-break-inside: avoid;
  }

  /* ─── Code ──────────────────────────────────────────────────────── */
  .chapter-content code {
    font-family: Consolas, 'Courier New', monospace;
    font-size: 8.5pt;
    background: var(--surface);
    border: 1px solid var(--border);
    padding: 2px 5px;
    border-radius: 4px;
    color: #7B3FEE;
    word-break: break-word;
  }

  .chapter-content pre {
    margin: 16px -38px;
    background: var(--code-bg);
    border-radius: 6px;
    overflow: hidden;
    position: relative;
    page-break-inside: avoid;
  }

  .chapter-content pre code {
    display: block;
    padding: 14px 20px;
    font-family: Consolas, 'Courier New', monospace;
    font-size: 7.5pt;
    line-height: 1.5;
    color: var(--code-text);
    background: transparent;
    border: none;
    white-space: pre-wrap;
    word-break: normal;
    overflow-wrap: break-word;
  }

  /* ─── Tables ────────────────────────────────────────────────────── */
  .chapter-content table {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
    font-size: 9.5pt;
    border: 1px solid var(--border);
    page-break-inside: avoid;
  }

  .chapter-content thead {
    background: var(--dark);
    color: #fff;
  }

  .chapter-content thead th {
    padding: 9px 13px;
    text-align: left;
    font-weight: 600;
    font-size: 9pt;
    letter-spacing: 0.03em;
  }

  .chapter-content tbody tr:nth-child(even) {
    background: var(--surface);
  }

  .chapter-content td {
    padding: 8px 13px;
    border-bottom: 1px solid var(--border);
    vertical-align: top;
    line-height: 1.5;
    word-break: break-word;
  }

  /* ─── Horizontal rule ───────────────────────────────────────────── */
  .chapter-content hr {
    border: none;
    border-top: 2px solid var(--border);
    margin: 32px 0;
  }

  /* ─── KaTeX Math ────────────────────────────────────────────────── */
  .math-display {
    display: block;
    margin: 20px 0;
    text-align: center;
  }
  .math-inline {
    display: inline;
  }

  /* ─── Module cover title — must stay visible and styled correctly ─ */
  .module-cover .module-title {
    font-size: 26pt;
    font-weight: 800;
    line-height: 1.2;
    margin-bottom: 40px;
    color: #fff !important;
    display: block !important;
    border: none !important;
    padding: 0 !important;
    background: none !important;
    -webkit-text-fill-color: #fff !important;
  }

  /* ─── License Page ────────────────────────────────────────────── */
  .license-page {
    padding: 60px 80px 80px;
    min-height: 100vh;
  }

  .license-page-header {
    margin-bottom: 48px;
    padding-bottom: 24px;
    border-bottom: 2px solid var(--border);
  }

  .license-page-label {
    font-size: 9pt;
    font-weight: 600;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--accent);
    margin-bottom: 8px;
  }

  .license-page-title {
    font-size: 24pt;
    font-weight: 800;
    color: var(--dark);
  }

  .license-copyright {
    background: var(--accent-light);
    border-left: 4px solid var(--accent);
    border-radius: 0 8px 8px 0;
    padding: 18px 22px;
    margin-bottom: 36px;
    font-size: 11pt;
    font-weight: 600;
    color: var(--dark);
  }

  .license-body {
    font-size: 9.5pt;
    color: var(--text);
    line-height: 1.75;
    margin-bottom: 32px;
  }

  .license-body p {
    margin-bottom: 12px;
  }

  .license-url {
    color: var(--accent);
    font-weight: 600;
    word-break: break-all;
  }

  .license-notice-title {
    font-size: 12pt;
    font-weight: 700;
    color: var(--dark);
    margin: 36px 0 16px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border);
  }

  .license-notice-item {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 14px 18px;
    margin-bottom: 12px;
    font-size: 9pt;
    line-height: 1.6;
  }

  .license-notice-item strong {
    display: block;
    font-size: 10pt;
    color: var(--dark);
    margin-bottom: 4px;
  }

  .license-notice-item .notice-license-badge {
    display: inline-block;
    background: var(--accent-light);
    color: var(--accent);
    font-size: 7.5pt;
    font-weight: 700;
    letter-spacing: 0.1em;
    padding: 2px 8px;
    border-radius: 4px;
    margin-right: 6px;
  }

  /* ─── Page layout ───────────────────────────────────────────────── */
  @page {
    size: A4;
    margin: 18mm 18mm 22mm 18mm;
  }

  @page cover-page {
    size: A4;
    margin: 0;
  }

  @page module-cover-page {
    size: A4;
    margin: 0;
  }

  /* Print-specific */
  @media print {
    .toc-page {
      page-break-after: always;
    }
    .chapter {
      page-break-before: always;
    }
    body {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .chapter-content pre,
    .chapter-content table,
    .chapter-content blockquote {
      page-break-inside: avoid;
    }
  }
</style>
<link rel="stylesheet" href="${katexCssHref}">
</head>
<body>

<!-- ═══════════════════════════════════════════════════════════════════ -->
<!-- TITLE PAGE                                                          -->
<!-- ═══════════════════════════════════════════════════════════════════ -->
<div class="title-page">
  <div class="title-logo">Materiały edukacyjne · Kurs AI</div>

  <div class="title-badge">Kurs zaawansowany · 2026</div>

  <h1 class="title-main">Praktyczny Kurs<br>AI Development</h1>

  <p class="title-subtitle">
    Od fundamentów architektury Transformer, przez budowę agentów AI i aplikacji RAG,
    po wdrożenia serverless i automatyzację DevOps z&nbsp;wykorzystaniem modeli językowych.
  </p>

  <div class="title-divider"></div>

  <div class="title-meta">
    <div class="title-meta-item">
      <div class="title-meta-label">Autor</div>
      <div class="title-meta-value">Krzysztof Rytlewski</div>
    </div>
    <div class="title-meta-item">
      <div class="title-meta-label">Wygenerowano z użyciem</div>
      <div class="title-meta-value">Claude Sonnet 4.6</div>
    </div>
    <div class="title-meta-item">
      <div class="title-meta-label">Rok wydania</div>
      <div class="title-meta-value">2026</div>
    </div>
  </div>

  <div class="title-modules-grid">
    <div class="title-module-chip"><span class="title-module-chip-num">01</span>Fundamenty<br>i Mechanizmy LLM</div>
    <div class="title-module-chip"><span class="title-module-chip-num">02</span>Vibe Coding<br>i AI-first IDE</div>
    <div class="title-module-chip"><span class="title-module-chip-num">03</span>Budowa Aplikacji<br>i Agenty AI</div>
    <div class="title-module-chip"><span class="title-module-chip-num">04</span>Ship Fast<br>z Angularem</div>
    <div class="title-module-chip"><span class="title-module-chip-num">05</span>CI/CD<br>i DevOps AI</div>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════════════ -->
<!-- TABLE OF CONTENTS                                                   -->
<!-- ═══════════════════════════════════════════════════════════════════ -->
<div class="toc-page page-break">
  <div class="toc-page-header">
    <div class="toc-page-label">Spis treści</div>
    <h1 class="toc-page-title">Zawartość kursu</h1>
  </div>
  ${tocHtml}
</div>

<!-- ═══════════════════════════════════════════════════════════════════ -->
<!-- BODY                                                                -->
<!-- ═══════════════════════════════════════════════════════════════════ -->
${bodyHtml}

<!-- ═══════════════════════════════════════════════════════════════════ -->
<!-- LICENSE & COPYRIGHT PAGE                                            -->
<!-- ═══════════════════════════════════════════════════════════════════ -->
<div class="license-page page-break">
  <div class="license-page-header">
    <div class="license-page-label">Informacje prawne</div>
    <h1 class="license-page-title">Licencja i prawa autorskie</h1>
  </div>

  <div class="license-copyright">
    Copyright &copy; 2026 Krzysztof Rytlewski. Wszelkie prawa zastrzeżone.
  </div>

  <div class="license-body">
    <p>
      Niniejszy materiał edukacyjny jest udostępniany na warunkach
      <strong>Apache License, Version 2.0</strong> (dalej: &bdquo;Licencja&rdquo;).
      Kopiowanie, użytkowanie, modyfikowanie i dystrybucja tego materiału są dozwolone
      wyłącznie zgodnie z postanowieniami Licencji.
    </p>
    <p>
      Pełny tekst Licencji dostępny jest pod adresem:<br>
      <span class="license-url">http://www.apache.org/licenses/LICENSE-2.0</span>
    </p>
    <p>
      O ile obowiązujące prawo nie stanowi inaczej lub nie zostało to uzgodnione
      na piśmie, oprogramowanie i materiały rozpowszechniane na podstawie Licencji
      są udostępniane na zasadzie <strong>&bdquo;TAK JAK JEST&rdquo;</strong>,
      bez żadnych gwarancji &mdash; jawnych ani dorozumianych.
      Szczegółowy zakres uprawnień i ograniczeń określa Licencja.
    </p>
    <p>
      Autorstwo i prawa autorskie są chronione. Zabrania się przypisywania sobie
      autorstwa tego materiału, usuwania lub modyfikowania not o prawach autorskich
      oraz używania nazwy autora w celu promowania produktów pochodnych
      bez uprzedniej, pisemnej zgody.
    </p>
  </div>

  <div class="license-notice-title">Informacje o komponentach zewnętrznych (NOTICE)</div>

  <div class="license-notice-item">
    <strong>KaTeX &mdash; Khan Academy and other contributors</strong>
    <span class="notice-license-badge">MIT</span>
    Copyright &copy; 2013&ndash;2020 Khan Academy and other contributors.
    Niniejszym udziela się bezpłatnego prawa do użytkowania, kopiowania, modyfikowania
    i dystrybucji oprogramowania, pod warunkiem zachowania powyższej noty copyright
    we wszystkich kopiach lub istotnych częściach oprogramowania.
  </div>

  <div class="license-notice-item">
    <strong>Inter &mdash; The Inter Project Authors</strong>
    <span class="notice-license-badge">OFL-1.1</span>
    Copyright &copy; 2020 The Inter Project Authors (https://github.com/rsms/inter).<br>
    Font ten jest osadzony w wygenerowanych plikach PDF i dystrybuowany na warunkach
    SIL Open Font License, wersja 1.1.
    Pełny tekst licencji: <span class="license-url">https://scripts.sil.org/OFL</span>
  </div>

  <div class="license-notice-item">
    <strong>puppeteer &mdash; The Chromium Authors</strong>
    <span class="notice-license-badge">Apache-2.0</span>
    Copyright &copy; The Chromium Authors.
    Licencja Apache, wersja 2.0: <span class="license-url">http://www.apache.org/licenses/LICENSE-2.0</span>
  </div>

  <div class="license-notice-item">
    <strong>marked &mdash; MarkedJS / Christopher Jeffrey</strong>
    <span class="notice-license-badge">MIT</span>
    Copyright &copy; 2018+, MarkedJS (https://github.com/markedjs/).<br>
    Copyright &copy; 2011&ndash;2018, Christopher Jeffrey (https://github.com/chjj/).
    Niniejszym udziela się bezpłatnego prawa do użytkowania, kopiowania, modyfikowania
    i dystrybucji oprogramowania, pod warunkiem zachowania powyższej noty copyright
    we wszystkich kopiach lub istotnych częściach oprogramowania.
  </div>

  <div class="license-notice-item">
    <strong>pdf-lib &mdash; Andrew Dillon</strong>
    <span class="notice-license-badge">MIT</span>
    Copyright &copy; 2019 Andrew Dillon.
    Niniejszym udziela się bezpłatnego prawa do użytkowania, kopiowania, modyfikowania
    i dystrybucji oprogramowania, pod warunkiem zachowania powyższej noty copyright
    we wszystkich kopiach lub istotnych częściach oprogramowania.
  </div>
</div>

</body>
</html>`;

// Write HTML for debugging
fs.writeFileSync(path.join(__dirname, 'output.html'), fullHtml, 'utf-8');
console.log('HTML written to output.html');

// Generate PDF
(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'],
  });

  const page = await browser.newPage();

  console.log('Loading HTML content...');
  const outputHtmlUrl = 'file:///' + path.join(__dirname, 'output.html').replace(/\\/g, '/');
  await page.goto(outputHtmlUrl, {
    waitUntil: 'networkidle0',
    timeout: 60000,
  });

  // Wait for fonts to finish loading
  await page.evaluate(() => document.fonts.ready);
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Render KaTeX math formulas
  console.log('Rendering math formulas...');
  await page.addScriptTag({ path: path.join(katexDir, 'katex.min.js') });
  await page.evaluate(() => {
    document.querySelectorAll('.math-placeholder').forEach(el => {
      const tex = el.getAttribute('data-math');
      const displayMode = el.classList.contains('math-display');
      try {
        katex.render(tex, el, { displayMode, throwOnError: false, output: 'html' });
      } catch (e) {
        el.textContent = tex;
      }
    });
  });

  // DOM post-processing: fix page-break issues.
  //
  // Step 0: Hide the leading <hr> at the start of each .chapter-content.
  //         This <hr> is generated from "---" separators in markdown between
  //         the (now-stripped) module indicator and "## Teoria". Leaving it
  //         adds ~64px of margin and pushes "Teoria" off the first page in
  //         chapters with long titles (e.g. 5.1).
  //
  // Step 1: Allow large <pre> blocks (>30 lines) to paginate freely.
  //         Without this, a large pre has page-break-inside:avoid from CSS,
  //         so it jumps whole to the next page leaving a blank gap.
  //
  // Pass 1: Wrap each non-first heading with its immediately following element
  //         (only if the element is short ≤120 chars, to avoid huge wrappers
  //         that get pushed entire to the next page — issue 2).
  //         Small/medium blocks after the heading are included; large pre excluded.
  //
  // Pass 2: Walk backward from every still-unwrapped block, collect preceding
  //         short caption elements (≤120 chars, up to 3) into a wrapper.
  //         For large pre blocks: instead of wrapping (which re-introduces the
  //         blank-space problem), set break-after:avoid on the directly preceding
  //         element so the caption stays glued to the start of the code block.
  await page.evaluate(() => {
    const BLOCK_TAGS = new Set(['table', 'pre', 'blockquote']);
    const INTRO_TAGS = new Set(['p', 'ul', 'ol']);
    const MAX_INTRO_CHARS = 120;   // Only short caption labels; avoids pulling long
                                   // content paragraphs into wrappers (issue 2)
    const MAX_PRE_LINES = 30;

    function countPreLines(pre) {
      return (pre.textContent.match(/\n/g) || []).length;
    }

    function isLargePre(el) {
      return el.tagName.toLowerCase() === 'pre' && countPreLines(el) > MAX_PRE_LINES;
    }

    function makeWrapper(parent, nodes) {
      const wrapper = document.createElement('div');
      wrapper.className = 'no-break-heading';
      parent.insertBefore(wrapper, nodes[0]);
      for (const n of nodes) wrapper.appendChild(n);
    }

    // ── Step 0: Hide leading <hr> in each chapter-content ────────────────
    for (const div of document.querySelectorAll('.chapter-content')) {
      for (const child of div.children) {
        const tag = child.tagName.toLowerCase();
        if (tag === 'h1') continue;          // skip hidden h1
        if (tag === 'hr') {
          child.style.display = 'none';
          child.style.margin = '0';
        }
        break;                               // stop at any other element
      }
    }

    // ── Step 1: Allow large pre blocks to split across pages ─────────────
    for (const pre of document.querySelectorAll('.chapter-content pre')) {
      if (isLargePre(pre)) {
        pre.style.pageBreakInside = 'auto';
        pre.style.breakInside = 'auto';
      }
    }

    // ── Pass 1: headings ──────────────────────────────────────────────────
    const firstInChapter = new Set();
    for (const div of document.querySelectorAll('.chapter-content')) {
      const first = div.querySelector('h2, h3, h4');
      if (first) firstInChapter.add(first);
    }

    for (const heading of document.querySelectorAll(
      '.chapter-content h2, .chapter-content h3, .chapter-content h4'
    )) {
      if (firstInChapter.has(heading)) continue;

      const toWrap = [heading];
      let el = heading.nextElementSibling;

      // Collect up to 2 short intro elements (strict 120-char limit)
      let introCount = 0;
      while (
        el && introCount < 2 &&
        INTRO_TAGS.has(el.tagName.toLowerCase()) &&
        el.textContent.length <= MAX_INTRO_CHARS
      ) {
        toWrap.push(el);
        el = el.nextElementSibling;
        introCount++;
      }

      // Include following block only if it is NOT a large pre
      if (el && BLOCK_TAGS.has(el.tagName.toLowerCase()) && !isLargePre(el)) {
        toWrap.push(el);
      }

      if (toWrap.length > 1) makeWrapper(heading.parentNode, toWrap);
    }

    // ── Pass 2: orphaned captions before blocks ───────────────────────────
    for (const block of document.querySelectorAll(
      '.chapter-content table, .chapter-content pre, .chapter-content blockquote'
    )) {
      if (block.closest('.no-break-heading')) continue;

      if (isLargePre(block)) {
        // For large pre: do NOT wrap (would re-introduce the blank-space problem).
        // Instead, mark the directly preceding element with break-after:avoid so it
        // stays glued to the first line of the code block on the same page.
        const prev = block.previousElementSibling;
        if (prev) {
          prev.style.pageBreakAfter = 'avoid';
          prev.style.breakAfter = 'avoid';
        }
        continue;
      }

      // Small/medium block: backward-walk and collect preceding short captions
      const toWrap = [block];
      let el = block.previousElementSibling;
      let count = 0;

      while (
        el && count < 3 &&
        INTRO_TAGS.has(el.tagName.toLowerCase()) &&
        el.textContent.length <= MAX_INTRO_CHARS &&
        !el.closest('.no-break-heading')
      ) {
        toWrap.unshift(el);
        el = el.previousElementSibling;
        count++;
      }

      if (toWrap.length > 1) makeWrapper(block.parentNode, toWrap);
    }
  });

  console.log('Generating PDF...');
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: `
      <div style="width:100%; font-family:'Helvetica Neue','Arial',sans-serif; font-size:8pt; color:#9999BB; text-align:center; padding:0 0 6px 0;">
        <span class="pageNumber"></span>
      </div>`,
    margin: {
      top: '18mm',
      bottom: '20mm',
      left: '18mm',
      right: '18mm',
    },
  });

  await browser.close();
  console.log('Browser closed.');

  const outputPath = path.join(__dirname, 'Praktyczny_Kurs_AI_Development.pdf');
  fs.writeFileSync(outputPath, pdfBuffer);
  console.log('PDF generated: Praktyczny_Kurs_AI_Development.pdf');
})();
