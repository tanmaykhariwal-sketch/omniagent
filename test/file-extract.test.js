const test = require('node:test');
const assert = require('node:assert');
const { extractText, MAX_CHARS } = require('../server/file-extract.js');

test('extracts CSV text as-is', async () => {
  const buffer = Buffer.from('name,age\nAda,36\nGrace,85\n', 'utf8');
  const text = await extractText(buffer, 'text/csv', 'people.csv');
  assert.strictEqual(text, 'name,age\nAda,36\nGrace,85');
});

test('extracts plain text by extension when mimetype is generic', async () => {
  const buffer = Buffer.from('hello world', 'utf8');
  const text = await extractText(buffer, 'application/octet-stream', 'notes.txt');
  assert.strictEqual(text, 'hello world');
});

test('truncates text longer than MAX_CHARS', async () => {
  const buffer = Buffer.from('x'.repeat(MAX_CHARS + 500), 'utf8');
  const text = await extractText(buffer, 'text/plain', 'big.txt');
  assert.ok(text.length < MAX_CHARS + 500);
  assert.ok(text.includes('[truncated'));
});

test('rejects an empty file with a clear message', async () => {
  await assert.rejects(() => extractText(Buffer.from(''), 'text/csv', 'empty.csv'), /empty/);
});

test('rejects legacy .doc files with a clear message', async () => {
  await assert.rejects(
    () => extractText(Buffer.from('irrelevant'), 'application/msword', 'old.doc'),
    /legacy \.doc files are not supported/
  );
});

test('rejects unsupported file types by extension', async () => {
  await assert.rejects(
    () => extractText(Buffer.from('irrelevant'), 'application/zip', 'archive.zip'),
    /unsupported file type \(\.zip\)/
  );
});
