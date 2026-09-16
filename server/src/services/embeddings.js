import { pipeline } from '@xenova/transformers';
import { config } from '../config.js';

let extractorPromise = null;

function getExtractor() {
  if (!extractorPromise) {
    // Lazy-loaded singleton: downloads/caches the ONNX model on first use so
    // requests before that point don't each trigger their own model load.
    extractorPromise = pipeline('feature-extraction', config.embeddingModel);
  }
  return extractorPromise;
}

/**
 * Embeds one or more strings into normalized dense vectors (384-dim for
 * all-MiniLM-L6-v2), suitable for cosine-similarity search.
 * @param {string|string[]} input
 * @returns {Promise<number[][]>}
 */
export async function embed(input) {
  const texts = Array.isArray(input) ? input : [input];
  const extractor = await getExtractor();

  const output = await extractor(texts, { pooling: 'mean', normalize: true });
  const dims = output.dims; // [batch, seqLen? no -> [batch, hiddenSize] after pooling
  const hiddenSize = dims[dims.length - 1];
  const data = output.data;

  const vectors = [];
  for (let i = 0; i < texts.length; i++) {
    vectors.push(Array.from(data.slice(i * hiddenSize, (i + 1) * hiddenSize)));
  }
  return vectors;
}

export async function embedOne(text) {
  const [vector] = await embed([text]);
  return vector;
}
