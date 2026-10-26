const assert = require('node:assert/strict');
const { test } = require('node:test');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { loadTypeScript } = require('./helpers.cjs');

function renderPage(path, contactEmail = '') {
  const { default: Page } = loadTypeScript(path, { process: { env: { MAPKWETU_CONTACT_EMAIL: contactEmail } } }, {
    'next/link': ({ children, ...props }) => React.createElement('a', props, children),
  });
  return renderToStaticMarkup(React.createElement(Page));
}

test('the homepage offers the atlas and a truthful local brief flow when no inbox is configured', () => {
  const html = renderPage('app/page.tsx');
  assert.ok(html.includes('MapKwetu'));
  assert.ok(html.includes('href="/atlas"'));
  assert.ok(html.includes('href="/sources"'));
  assert.ok(html.includes('Download project brief'));
  assert.ok(html.includes('does not submit an enquiry'));
  assert.ok(html.includes('name="email"'));
  assert.ok(html.includes('name="question"'));
  assert.ok(!html.includes('mailto:'));
});

test('a configured business inbox offers a visitor-reviewed email draft', () => {
  const html = renderPage('app/page.tsx', 'business@example.com');
  assert.ok(html.includes('Prepare email &amp; download brief'));
  assert.ok(html.includes('review and send the enquiry in your email app'));
});

test('source notes identify dataset totals, historical coverage and the absence of a live feed', () => {
  const html = renderPage('app/sources/page.tsx');
  assert.ok(html.includes('2017'));
  assert.ok(html.includes('not a complete current inventory'));
  assert.ok(html.includes('no continuous live feed'));
  assert.ok(html.includes('href="/atlas"'));
});
