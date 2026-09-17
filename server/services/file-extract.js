const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');

const MAX_CHARS = 8000;
// Truncation only trims the final string -- it does nothing to stop a
// crafted PDF/DOCX (deeply nested objects, huge repeated-text streams) from
// making pdf-parse/mammoth do pathological work before that cap ever
// applies. Bound both the page count actually parsed and the wall-clock
// time, so one malicious upload can't tie up a worker.
const MAX_PDF_PAGES = 30;
const PARSE_TIMEOUT_MS = 15000;

function truncate(text) {
  const trimmed = text.trim();
  return trimmed.length > MAX_CHARS
    ? `${trimmed.slice(0, MAX_CHARS)}\n\n[truncated -- document is longer than what fits in one message]`
    : trimmed;
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} took too long to parse`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Extracts readable text from an uploaded file buffer based on its mimetype
// and/or filename extension. Throws a descriptive error for unsupported
// types rather than silently returning garbage.
async function extractText(buffer, mimetype, filename) {
  const ext = (filename || '').toLowerCase().split('.').pop();

  if (mimetype === 'application/pdf' || ext === 'pdf') {
    const parser = new PDFParse({ data: buffer });
    try {
      const { text } = await withTimeout(parser.getText({ first: MAX_PDF_PAGES }), PARSE_TIMEOUT_MS, 'this PDF');
      if (!text.trim()) throw new Error('no extractable text found in this PDF (it may be a scanned image)');
      return truncate(text);
    } finally {
      await parser.destroy();
    }
  }

  if (
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === 'docx'
  ) {
    const { value } = await withTimeout(mammoth.extractRawText({ buffer }), PARSE_TIMEOUT_MS, 'this document');
    if (!value.trim()) throw new Error('no extractable text found in this document');
    return truncate(value);
  }

  if (mimetype === 'application/msword' || ext === 'doc') {
    throw new Error('legacy .doc files are not supported -- please save as .docx and try again');
  }

  if (mimetype === 'text/csv' || ext === 'csv' || mimetype === 'text/plain' || ext === 'txt') {
    const text = buffer.toString('utf8');
    if (!text.trim()) throw new Error('this file is empty');
    return truncate(text);
  }

  throw new Error(`unsupported file type${ext ? ` (.${ext})` : ''} -- PDF, DOCX, CSV, and TXT are supported`);
}

module.exports = { extractText, MAX_CHARS };
