const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadTypeScript } = require('./helpers.cjs');
const { formatEnquiryBrief, enquiryMailto } = loadTypeScript('lib/enquiry.ts');

const brief = {
  name: '  Amina Example  ', email: 'amina@example.com', organisation: '',
  service: 'Location comparison', geography: 'Nairobi & Mombasa',
  question: 'Compare power & fibre context.\nWhat remains unknown?',
};

test('downloaded briefs retain project context and identify scope as unagreed', () => {
  const text = formatEnquiryBrief(brief);
  assert.ok(text.includes('Name: Amina Example\n'));
  assert.ok(text.includes('Organisation: Not specified'));
  assert.ok(text.includes('Nairobi & Mombasa'));
  assert.ok(text.includes(brief.question));
  assert.ok(text.includes('scope, availability, fees, and delivery'));
});

test('email drafts preserve ampersands, newlines, and user text without adding email headers', () => {
  const hostile = { ...brief, question: 'Question &bcc=other@example.com?\nA second line #details' };
  const link = enquiryMailto('owner@example.com', hostile);
  const query = new URLSearchParams(link.slice(link.indexOf('?') + 1));
  assert.equal(query.size, 2);
  assert.equal(query.get('subject'), 'MapKwetu enquiry: Location comparison');
  assert.equal(query.get('body'), formatEnquiryBrief(hostile));
  assert.equal(query.get('bcc'), null);
});
