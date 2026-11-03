export const segments = { customers: 'Users with a purchase', prospects: 'Users without a purchase', new_users: 'Joined in the last 7 days', english: 'English preference', hindi: 'Hindi preference' };
export const destinations = { '': 'Open the app', 'muditam://vitalDashboard': 'Home', 'muditam://classes': 'Classes', 'muditam://shop': 'Shop', 'muditam://smartReminders': 'Reminders', 'muditam://bloodSugarReadings': 'Blood sugar tracker', 'muditam://chat': 'Care chat' };
export const templates = [
  { name: 'A fresh start', category: 'WELCOME', title: 'Welcome, {{firstName}}', message: 'Small steps make a difference. Explore your Muditam app and find your next step.', url: 'muditam://vitalDashboard' },
  { name: 'Time to move', category: 'CLASSES', title: 'Make a little time for yourself', message: 'Explore a class and move at your own pace today.', url: 'muditam://classes' },
  { name: 'Stay consistent', category: 'ROUTINE', title: 'Your routine, your pace', message: 'Hi {{firstName}}, set a reminder for the healthy habits you want to keep.', url: 'muditam://smartReminders' },
  { name: 'A helpful check-in', category: 'CARE', title: 'Need a little guidance?', message: 'Your care team is a message away. Open the app whenever you need support.', url: 'muditam://chat' },
];
export const blank = () => ({ title: '', message: '', url: '', audienceType: 'phones', segmentKey: 'new_users', phones: '', scheduleOption: 'now', scheduledAt: '' });
export function parsePhones(value) {
  const rows = String(value).replace(/^\uFEFF/, '').split(/[,;\r\n]+/).map((v) => v.trim().replace(/^"|"$/g, '')).filter(Boolean);
  if (/^(phone|phone number|mobile|mobile number)$/i.test(rows[0] || '')) rows.shift();
  const numbers = rows.map((v) => v.replace(/[\s()+-]/g, ''));
  if (numbers.some((v) => !/^(?:91)?\d{10}$/.test(v))) throw new Error('Use a single column of 10-digit phone numbers, optionally with +91.');
  const unique = [...new Set(numbers.map((v) => v.slice(-10)))];
  if (unique.length > 1000) throw new Error('Import up to 1,000 phone numbers at a time.');
  return unique;
}
export function buildPayload(form, { draft = false, test = false } = {}) {
  const phoneNumbers = !test && form.audienceType === 'phones' ? parsePhones(form.phones) : [];
  if (!draft && !test && form.audienceType === 'phones' && !phoneNumbers.length) throw new Error('Add at least one recipient.');
  if (!draft && (!form.title.trim() || !form.message.trim())) throw new Error('Add a title and message first.');
  if (form.title.length > 100 || form.message.length > 500) throw new Error('Use a title up to 100 characters and message up to 500.');
  const url = form.url.trim();
  if (url) { let parsed; try { parsed = new URL(url); } catch { throw new Error('Enter a valid link.'); } if (!['https:', 'muditam:'].includes(parsed.protocol)) throw new Error('Use an HTTPS or muditam:// link.'); }
  let scheduledAt = null;
  if (!test && form.scheduleOption === 'schedule' && form.scheduledAt) {
    const time = new Date(form.scheduledAt); if (!Number.isFinite(time.getTime())) throw new Error('Choose a valid schedule time.'); scheduledAt = time.toISOString();
  }
  if (!draft && !test && form.scheduleOption === 'schedule' && (!scheduledAt || new Date(scheduledAt) <= new Date())) throw new Error('Choose a future date and time.');
  return { title: form.title.trim(), message: form.message.trim(), url, audienceType: form.audienceType, segmentKey: form.audienceType === 'segment' ? form.segmentKey : '', phoneNumbers, scheduleOption: test ? 'now' : form.scheduleOption, scheduledAt };
}
export const audienceLabel = (value) => value.audienceType === 'all' ? 'All app users' : value.audienceType === 'segment' ? segments[value.segmentKey] || value.segmentKey : `${value.phoneNumbers?.length || 0} selected numbers`;
export const localDate = (value) => { const d = new Date(value); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
export const formFrom = (value, copy = false) => ({ ...blank(), ...value, phones: (value.phoneNumbers || []).join('\n'), scheduleOption: copy ? 'now' : value.scheduleOption, scheduledAt: !copy && value.scheduledAt ? localDate(value.scheduledAt) : '' });
export function campaignCsv(rows) {
  const cell = (value) => { const text = String(value ?? ''); return '"' + (/^[=+@\-\t\r]/.test(text) ? "'" : '') + text.replace(/"/g, '""') + '"'; };
  return [['Title', 'Status', 'Audience', 'Accepted', 'Errors', 'Created UTC'], ...rows.map((c) => [c.title, c.status, audienceLabel(c), c.sent || 0, c.failed || 0, c.createdAt])].map((row) => row.map(cell).join(',')).join('\r\n');
}
