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

// If the script lives in course-pdf/, compute project root accordingly so
// references to `sections/` and `node_modules` continue to work after moving.
const isInCoursePdfDir = path.basename(__dirname) === 'course-pdf';
const projectRoot = isInCoursePdfDir ? path.resolve(__dirname, '..') : __dirname;

const katexDir = path.join(projectRoot, 'node_modules', 'katex', 'dist');
const katexCssHref = 'file:///' + katexDir.replace(/\\/g, '/') + '/katex.min.css';

// Load local stylesheet (course-pdf/styles.css) if present so we don't inline
// a very large CSS block inside the JS template. This keeps the HTML readable
// and ensures styles are available when Puppeteer opens the file:// URL.
const localCssPath = path.join(__dirname, 'styles.css');
let localCss = '';
try {
  localCss = fs.readFileSync(localCssPath, 'utf8');
} catch (err) {
  console.warn('Warning: could not read course-pdf/styles.css:', err.message);
}

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

function extractTitle(mdContent) {
  const match = mdContent.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : 'Rozdział';
}

function getModules() {
  const seen = new Set();
  return sections.filter(s => {
    if (seen.has(s.module)) return false;
    seen.add(s.module);
    return true;
  }).map(s => ({ id: s.module, title: s.moduleTitle }));
}

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

marked.setOptions({
  gfm: true,
  breaks: false,
});

const renderer = new marked.Renderer();

// Preprocess LaTeX math before marked parsing.
// marked mangles LaTeX: treats _k as italic, \frac etc. as escape sequences.
// Strategy: extract math strings, replace with unique placeholders, restore after parse.
//
// Code blocks (fenced ``` and inline `) are protected first so that $ signs
// inside JS template literals, MongoDB operators, etc. are never treated as
// LaTeX delimiters, preventing garbled output and spurious red KaTeX errors.
function preprocessMath(md) {
  const mathBlocks = [];
  const codeBlocks = [];

  // Protect fenced code blocks (must run before inline-code regex).
  // Backreference ensures matching fence length; closing fence must be on its own line
  // to prevent \`\`\`diff mid-line in template literals from terminating the block.
  md = md.replace(/(`{3,})[^\n]*\n[\s\S]*?\n\1[ \t]*(?:\n|$)/g, (match) => {
    codeBlocks.push(match);
    return `%%CODEBLOCK${codeBlocks.length - 1}%%`;
  });
  // Protect inline code spans (` ... `) – single backtick, no newlines.
  md = md.replace(/`[^`\n]+`/g, (match) => {
    codeBlocks.push(match);
    return `%%CODEBLOCK${codeBlocks.length - 1}%%`;
  });

  // Process LaTeX math on the now-code-free text.
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

  // Restore code blocks so marked.parse() sees the original fenced syntax.
  md = md.replace(/%%CODEBLOCK(\d+)%%/g, (_, idx) => codeBlocks[parseInt(idx, 10)]);

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

const sectionsDir = path.join(projectRoot, 'sections');
const sectionsWithTitles = sections.map(s => {
  const content = fs.readFileSync(path.join(sectionsDir, s.file), 'utf-8');
  const title = extractTitle(content);
  return { ...s, content, chapterTitle: title };
});

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
${localCss}
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

fs.writeFileSync(path.join(__dirname, 'output.html'), fullHtml, 'utf-8');
console.log('HTML written to output.html (course-pdf/)');

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
  //         (only if the element is short ≤120 chars, to avoid pushing a large
  //         wrapper entirely to the next page).
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
    const MAX_INTRO_CHARS = 120;   // Only short captions — avoids pulling long paragraphs into wrappers
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

      // Collect up to 2 short intro elements
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
