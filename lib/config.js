import path from 'node:path';

export const config = {
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3-flash-lite',
  embeddingModel: process.env.EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2',
  chunkSize: Number(process.env.CHUNK_SIZE) || 900,
  chunkOverlap: Number(process.env.CHUNK_OVERLAP) || 150,
  topK: Number(process.env.TOP_K) || 5,
  dataDir: path.join(process.cwd(), 'data'),
};
