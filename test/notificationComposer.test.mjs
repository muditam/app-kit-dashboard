import test from 'node:test';
import assert from 'node:assert/strict';
import { blank, parsePhones, buildPayload, formFrom, campaignCsv } from '../src/notificationComposer.js';
test('CSV imports normalize +91 numbers, remove duplicates and reject extra columns', () => {
  assert.deepEqual(parsePhones('Phone\n"+91 98765 43210"\n9876543210\n9123456789'), ['9876543210','9123456789']);
  assert.throws(() => parsePhones('Name,Phone\nAarav,9876543210'));
  assert.throws(() => parsePhones('12345678901'));
});
test('drafts may be incomplete but sent campaigns must have content and recipients', () => {
  assert.equal(buildPayload(blank(), { draft: true }).title, '');
  assert.throws(() => buildPayload(blank()));
  assert.throws(() => buildPayload({ ...blank(), title: 'Hello', message: 'Message', phones: '9876543210', scheduleOption: 'schedule', scheduledAt: '2020-01-01T09:00' }));
});
test('test messages do not inherit campaign schedule or selected phone list', () => {
  const body = buildPayload({ ...blank(), title: 'Hello', message: 'Message', phones: 'invalid-list', scheduleOption: 'schedule', scheduledAt: '2020-01-01T09:00' }, { test: true });
  assert.equal(body.scheduleOption, 'now'); assert.equal(body.scheduledAt, null); assert.deepEqual(body.phoneNumbers, []);
});
test('duplicating campaigns clears old schedule without losing segment', () => {
  const form = formFrom({ title: 'Hi', audienceType: 'segment', segmentKey: 'hindi', scheduleOption: 'schedule', scheduledAt: '2026-11-01T09:00Z', phoneNumbers: [] }, true);
  assert.equal(form.scheduleOption, 'now'); assert.equal(form.scheduledAt, ''); assert.equal(form.segmentKey, 'hindi');
});
test('export escapes spreadsheet formulas and does not export private phone numbers', () => {
  const csv = campaignCsv([{ title: '=1+1', audienceType: 'phones', phoneNumbers: ['9876543210'], status: 'sent' }]);
  assert.ok(csv.includes("'=1+1")); assert.ok(!csv.includes('9876543210'));
});
