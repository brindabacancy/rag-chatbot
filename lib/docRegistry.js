import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';

const registryPath = path.join(config.dataDir, 'documents.json');

async function readAll() {
  try {
    const raw = await fs.readFile(registryPath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
}

async function writeAll(registry) {
  await fs.mkdir(config.dataDir, { recursive: true });
  await fs.writeFile(registryPath, JSON.stringify(registry, null, 2));
}

export async function registerDocument(doc) {
  const registry = await readAll();
  registry[doc.docId] = doc;
  await writeAll(registry);
}

export async function removeDocument(docId) {
  const registry = await readAll();
  const doc = registry[docId];
  delete registry[docId];
  await writeAll(registry);
  return doc;
}

export async function getDocument(docId) {
  const registry = await readAll();
  return registry[docId];
}

export async function listDocumentMeta() {
  const registry = await readAll();
  return Object.values(registry);
}
