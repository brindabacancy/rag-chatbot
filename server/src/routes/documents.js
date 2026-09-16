import { Router } from 'express';
import multer from 'multer';
import { ingestDocument, deleteDocument, listDocuments } from '../services/ragPipeline.js';
import { SUPPORTED_EXTENSIONS } from '../services/documentParser.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

export const documentsRouter = Router();

documentsRouter.get('/', async (_req, res) => {
  const docs = await listDocuments();
  res.json({ documents: docs });
});

documentsRouter.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Use the "file" form field.' });
  }
  try {
    const result = await ingestDocument({
      buffer: req.file.buffer,
      filename: req.file.originalname,
      size: req.file.size,
    });
    res.status(201).json(result);
  } catch (err) {
    const isUnsupported = /Unsupported file type/.test(err.message);
    res.status(isUnsupported ? 415 : 500).json({
      error: err.message,
      supportedTypes: isUnsupported ? SUPPORTED_EXTENSIONS : undefined,
    });
  }
});

documentsRouter.delete('/:docId', async (req, res) => {
  const removed = await deleteDocument(req.params.docId);
  if (!removed) {
    return res.status(404).json({ error: 'Document not found' });
  }
  res.json({ ok: true });
});
