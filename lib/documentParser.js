import path from 'node:path';
import mammoth from 'mammoth';
// pdf-parse's package entry runs a debug/test snippet when imported without a
// file argument in some versions; importing the internal lib file avoids that.
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

export const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md'];

/**
 * Extracts plain text from an uploaded file buffer based on its extension.
 * @param {Buffer} buffer
 * @param {string} filename
 * @returns {Promise<string>}
 */
export async function parseDocument(buffer, filename) {
  const ext = path.extname(filename).toLowerCase();

  switch (ext) {
    case '.pdf': {
      const { text } = await pdfParse(buffer);
      return text;
    }
    case '.docx': {
      const { value } = await mammoth.extractRawText({ buffer });
      return value;
    }
    case '.txt':
    case '.md':
      return buffer.toString('utf-8');
    default:
      throw new Error(
        `Unsupported file type "${ext}". Supported types: ${SUPPORTED_EXTENSIONS.join(', ')}`
      );
  }
}
