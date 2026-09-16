import { LocalIndex } from 'vectra';
import { config } from './config.js';

const index = new LocalIndex(config.dataDir);

let ready = null;
async function ensureIndex() {
  if (!ready) {
    ready = (async () => {
      if (!(await index.isIndexCreated())) {
        await index.createIndex();
      }
    })();
  }
  return ready;
}

/**
 * Adds chunks for a document to the index.
 * @param {{docId: string, filename: string, chunks: string[], vectors: number[][]}} params
 */
export async function addDocumentChunks({ docId, filename, chunks, vectors }) {
  await ensureIndex();
  const items = chunks.map((text, i) => ({
    vector: vectors[i],
    metadata: {
      docId,
      filename,
      chunkIndex: i,
      text,
    },
  }));
  await index.batchInsertItems(items);
}

/**
 * Finds the topK chunks most similar to the query vector.
 * @param {number[]} queryVector
 * @param {number} topK
 * @returns {Promise<{text: string, score: number, metadata: object}[]>}
 */
export async function queryChunks(queryVector, topK = 5) {
  await ensureIndex();
  const results = await index.queryItems(queryVector, '', topK);
  return results.map((r) => ({
    text: r.item.metadata.text,
    score: r.score,
    metadata: r.item.metadata,
  }));
}

export async function deleteDocument(docId) {
  await ensureIndex();
  const items = await index.listItemsByMetadata({ docId: { '$eq': docId } });
  for (const item of items) {
    await index.deleteItem(item.id);
  }
  return items.length;
}

export async function listDocuments() {
  await ensureIndex();
  const items = await index.listItems();
  const docs = new Map();
  for (const item of items) {
    const { docId, filename } = item.metadata;
    if (!docs.has(docId)) {
      docs.set(docId, { docId, filename, chunkCount: 0 });
    }
    docs.get(docId).chunkCount += 1;
  }
  return Array.from(docs.values());
}
