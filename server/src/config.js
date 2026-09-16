import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, '..');

export const config = {
  port: Number(process.env.PORT) || 3000,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
  embeddingModel: process.env.EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2',
  chunkSize: Number(process.env.CHUNK_SIZE) || 900,
  chunkOverlap: Number(process.env.CHUNK_OVERLAP) || 150,
  topK: Number(process.env.TOP_K) || 5,
  uploadsDir: path.join(serverRoot, 'uploads'),
  dataDir: path.join(serverRoot, 'data'),
  publicDir: path.resolve(serverRoot, '..', 'public'),
};
