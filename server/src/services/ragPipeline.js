import { v4 as uuidv4 } from 'uuid';
import { config } from '../config.js';
import { parseDocument } from './documentParser.js';
import { chunkText } from './chunker.js';
import { embed, embedOne } from './embeddings.js';
import { addDocumentChunks, queryChunks, deleteDocument as deleteFromIndex } from './vectorStore.js';
import { registerDocument, removeDocument, listDocumentMeta } from './docRegistry.js';
import { streamAnswer } from './llm.js';

/**
 * Ingests an uploaded file: parse -> chunk -> embed -> store.
 */
export async function ingestDocument({ buffer, filename, size }) {
  const text = await parseDocument(buffer, filename);
  const chunks = chunkText(text, {
    chunkSize: config.chunkSize,
    chunkOverlap: config.chunkOverlap,
  });

  if (chunks.length === 0) {
    throw new Error('No extractable text was found in this document.');
  }

  const vectors = await embed(chunks);
  const docId = uuidv4();

  await addDocumentChunks({ docId, filename, chunks, vectors });
  await registerDocument({
    docId,
    filename,
    size,
    chunkCount: chunks.length,
    uploadedAt: new Date().toISOString(),
  });

  return { docId, filename, chunkCount: chunks.length };
}

export async function deleteDocument(docId) {
  await deleteFromIndex(docId);
  return removeDocument(docId);
}

export async function listDocuments() {
  return listDocumentMeta();
}

/**
 * Retrieves relevant chunks for a query and streams a grounded answer.
 * @param {{message: string, history: Array}} params
 * @param {(token: string) => void} onToken
 * @returns {Promise<{answer: string, sources: Array}>}
 */
export async function answerQuestion({ message, history = [] }, onToken) {
  const queryVector = await embedOne(message);
  const chunks = await queryChunks(queryVector, config.topK);

  const answer = await streamAnswer({ message, history, chunks }, onToken);

  const sources = chunks.map((c, i) => ({
    ref: i + 1,
    filename: c.metadata.filename,
    chunkIndex: c.metadata.chunkIndex,
    score: c.score,
    preview: c.text.slice(0, 220),
  }));

  return { answer, sources };
}
