'use strict';

const path = require('path');
const fs = require('fs');
const { marked } = require('marked');
const puppeteer = require('puppeteer');

const section = process.argv[2];
if (!section) {
  console.error('Usage: node generate.js <SECTION>');
  process.exit(1);
}

const root = path.resolve(__dirname, '..', '..');
const mdPath = path.join(root, 'presentations', section, `${section}.md`);
const htmlOutputPath = path.join(root, 'presentations', section, `${section}.html`);
const pdfOutputPath = path.join(root, 'presentations', section, `${section}.pdf`);
const templatePath = path.join(__dirname, 'template.html');
const stylesPath = path.join(__dirname, 'styles.css');

// Read the Markdown source
if (!fs.existsSync(mdPath)) {
  console.error(`Error: Markdown file not found: ${mdPath}`);
  process.exit(1);
}

const mdContent = fs.readFileSync(mdPath, 'utf8');

// Normalise line endings (Windows CRLF → LF) before splitting
const mdNormalised = mdContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

// Server-side math rendering via katex.renderToString
// Pre-process BEFORE marked so that backslashes/underscores inside $...$ are
// not mangled by the Markdown parser.
const katexNode = require(path.resolve(root, 'node_modules', 'katex'));

function applyMath(slideText) {
  const rendered = [];

  // 1. Block display math  $$...$$  (must come before inline to avoid double-match)
  let out = slideText.replace(/\$\$([\s\S]+?)\$\$/g, (_, formula) => {
    rendered.push(katexNode.renderToString(formula.trim(), { displayMode: true, throwOnError: false }));
    return `KATEXDISPLAY${rendered.length - 1}END`;
  });

  // 2. Inline math  $...$  (single-line formulas only)
  out = out.replace(/\$([^$\n]+?)\$/g, (_, formula) => {
    rendered.push(katexNode.renderToString(formula.trim(), { throwOnError: false }));
    return `KATEXINLINE${rendered.length - 1}END`;
  });

  // Run markdown → HTML on the placeholder-substituted source
  let html = marked.parse(out);

  // Restore rendered math HTML
  html = html.replace(/KATEXDISPLAY(\d+)END/g, (_, i) => rendered[+i]);
  html = html.replace(/KATEXINLINE(\d+)END/g,  (_, i) => rendered[+i]);
  return html;
}

// Split into individual slides on ---
const slideTexts = mdNormalised.split(/\n---\n/);

// Convert each slide to HTML and wrap in <section class="slide">
const slidesHtml = slideTexts
  .map(slideText => `<section class="slide">\n${applyMath(slideText.trim())}\n</section>`)
  .join('\n');

// Read template and inject slides + inlined CSS
let template = fs.readFileSync(templatePath, 'utf8');

// Inline CSS to avoid file:// loading timing issues in Puppeteer
const cssContent = fs.readFileSync(stylesPath, 'utf8');
template = template.replace(
  '<link rel="stylesheet" href="STYLES_PLACEHOLDER">',
  `<style>\n${cssContent}\n</style>`
);

// Inline KaTeX CSS from local node_modules (fix font URLs to absolute file:// paths)
// JS is not needed since math is pre-rendered server-side.
const katexRoot = path.resolve(root, 'node_modules', 'katex', 'dist');
const katexFontsUrl = 'file:///' + path.join(katexRoot, 'fonts').replace(/\\/g, '/') + '/';
let katexCss = fs.readFileSync(path.join(katexRoot, 'katex.min.css'), 'utf8');
katexCss = katexCss.replace(/url\(fonts\//g, `url(${katexFontsUrl}`);
template = template.replace('<!-- KATEX_CSS -->', `<style>\n${katexCss}\n</style>`);
template = template.replace('<!-- KATEX_JS -->', ''); // No browser-side KaTeX JS needed

// Inject slides
template = template.replace('<!-- SLIDES -->', slidesHtml);

// Write HTML output
fs.mkdirSync(path.dirname(htmlOutputPath), { recursive: true });
fs.writeFileSync(htmlOutputPath, template, 'utf8');
console.log(`HTML written to: ${htmlOutputPath}`);

// Generate PDF via Puppeteer
(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();

  const htmlFileUrl = 'file:///' + htmlOutputPath.replace(/\\/g, '/');
  await page.goto(htmlFileUrl, { waitUntil: 'networkidle0', timeout: 60000 });

  await page.pdf({
    path: pdfOutputPath,
    format: 'A4',
    landscape: true,
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
    preferCSSPageSize: true,
  });

  await browser.close();
  console.log(`PDF written to: ${pdfOutputPath}`);
})().catch(err => {
  console.error('PDF generation failed:', err);
  process.exit(1);
});
