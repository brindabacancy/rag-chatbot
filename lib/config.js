import path from 'node:path';

export const config = {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
  embeddingModel: process.env.EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2',
  chunkSize: Number(process.env.CHUNK_SIZE) || 900,
  chunkOverlap: Number(process.env.CHUNK_OVERLAP) || 150,
  topK: Number(process.env.TOP_K) || 5,
  dataDir: path.join(process.cwd(), 'data'),
};
