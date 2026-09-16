import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import { config } from './config.js';
import { documentsRouter } from './routes/documents.js';
import { chatRouter } from './routes/chat.js';

fs.mkdirSync(config.uploadsDir, { recursive: true });
fs.mkdirSync(config.dataDir, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.use('/api/documents', documentsRouter);
app.use('/api/chat', chatRouter);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use(express.static(config.publicDir));

app.listen(config.port, () => {
  console.log(`RAG chatbot server running at http://localhost:${config.port}`);
  if (!config.anthropicApiKey) {
    console.warn('WARNING: ANTHROPIC_API_KEY is not set. Chat requests will fail until it is configured in server/.env');
  }
});
