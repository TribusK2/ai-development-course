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

// Split into individual slides on ---
const slideTexts = mdNormalised.split(/\n---\n/);

// Convert each slide to HTML and wrap in <section class="slide">
const slidesHtml = slideTexts
  .map(slideText => `<section class="slide">\n${marked.parse(slideText.trim())}\n</section>`)
  .join('\n');

// Read template and inject slides + inlined CSS
let template = fs.readFileSync(templatePath, 'utf8');

// Inline CSS to avoid file:// loading timing issues in Puppeteer
const cssContent = fs.readFileSync(stylesPath, 'utf8');
template = template.replace(
  '<link rel="stylesheet" href="STYLES_PLACEHOLDER">',
  `<style>\n${cssContent}\n</style>`
);

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
