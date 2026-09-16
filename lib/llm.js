import Anthropic from '@anthropic-ai/sdk';
import { config } from './config.js';

let client = null;
function getClient() {
  if (!client) {
    if (!config.anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set. Add it to .env');
    }
    client = new Anthropic({ apiKey: config.anthropicApiKey });
  }
  return client;
}

const SYSTEM_PROMPT = `You are a helpful assistant answering questions using ONLY the provided document excerpts (CONTEXT).
Rules:
- Base your answer strictly on the CONTEXT. Do not use outside knowledge.
- If the CONTEXT does not contain the answer, say you don't have enough information in the uploaded documents. Do not make things up.
- Cite the source(s) you used inline like [1], [2] matching the numbered excerpts.
- Be concise and direct.`;

function buildContextBlock(chunks) {
  if (chunks.length === 0) return 'No relevant excerpts were found in the uploaded documents.';
  return chunks
    .map((c, i) => `[${i + 1}] (source: ${c.metadata.filename}, chunk ${c.metadata.chunkIndex})\n${c.text}`)
    .join('\n\n');
}

/**
 * Streams a chat completion grounded in retrieved chunks.
 * @param {{message: string, history: {role: 'user'|'assistant', content: string}[], chunks: any[]}} params
 * @param {(deltaText: string) => void} onToken
 */
export async function streamAnswer({ message, history, chunks }, onToken) {
  const anthropic = getClient();
  const contextBlock = buildContextBlock(chunks);

  const messages = [
    ...history.map((h) => ({ role: h.role, content: h.content })),
    {
      role: 'user',
      content: `CONTEXT:\n${contextBlock}\n\nQUESTION: ${message}`,
    },
  ];

  const stream = anthropic.messages.stream({
    model: config.anthropicModel,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages,
  });

  stream.on('text', (delta) => onToken(delta));

  const final = await stream.finalMessage();
  const fullText = final.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return fullText;
}
