// Recursive, separator-aware text splitter: tries to break on paragraph, then
// line, then sentence, then word boundaries so chunks stay semantically coherent
// instead of cutting mid-sentence, then stitches in a trailing overlap for context continuity.

const SEPARATORS = ['\n\n', '\n', '. ', ' '];

function splitOnSeparator(text, separator) {
  if (separator === '') return text.split('');
  return text.split(separator).map((part, i, arr) => (i < arr.length - 1 ? part + separator : part));
}

function recursiveSplit(text, separators, chunkSize) {
  if (text.length <= chunkSize) return [text];

  const [sep, ...rest] = separators;
  const pieces = sep === undefined ? text.split('') : splitOnSeparator(text, sep);

  const results = [];
  let current = '';

  for (const piece of pieces) {
    if (piece.length > chunkSize) {
      if (current) {
        results.push(current);
        current = '';
      }
      if (rest.length > 0) {
        results.push(...recursiveSplit(piece, rest, chunkSize));
      } else {
        // No more separators to try: hard-split by character count.
        for (let i = 0; i < piece.length; i += chunkSize) {
          results.push(piece.slice(i, i + chunkSize));
        }
      }
      continue;
    }

    if ((current + piece).length > chunkSize) {
      if (current) results.push(current);
      current = piece;
    } else {
      current += piece;
    }
  }
  if (current) results.push(current);

  return results;
}

/**
 * Splits text into overlapping chunks.
 * @param {string} text
 * @param {{chunkSize?: number, chunkOverlap?: number}} options
 * @returns {string[]}
 */
export function chunkText(text, { chunkSize = 900, chunkOverlap = 150 } = {}) {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const rawChunks = recursiveSplit(normalized, SEPARATORS, chunkSize)
    .map((c) => c.trim())
    .filter(Boolean);

  if (chunkOverlap <= 0 || rawChunks.length <= 1) return rawChunks;

  const overlapped = [];
  for (let i = 0; i < rawChunks.length; i++) {
    if (i === 0) {
      overlapped.push(rawChunks[i]);
      continue;
    }
    const prev = rawChunks[i - 1];
    const overlapText = prev.slice(Math.max(0, prev.length - chunkOverlap));
    overlapped.push(`${overlapText} ${rawChunks[i]}`.trim());
  }
  return overlapped;
}
