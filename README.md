# RAG Chatbot

A full end-to-end Retrieval-Augmented Generation chatbot: upload documents, ask
questions about them in a ChatGPT/Claude-style chat UI, and get answers
generated only from the content you uploaded (with cited sources).

## Features

- 📄 Upload PDF, DOCX, TXT or Markdown files
- ✂️ Automatic parsing + recursive, overlap-aware chunking
- 🧠 Local embeddings (no API key or cost) via `all-MiniLM-L6-v2`
- 🔍 Vector similarity search over a local, on-disk vector database
- 💬 Streaming chat UI (token-by-token) grounded strictly in retrieved chunks
- 📎 Inline source citations `[1] [2]` with the excerpt shown to the user
- 🗂️ Document manager (list / delete uploaded files, chunks removed with them)

## Architecture

```
┌────────────┐        upload         ┌───────────────────────────────┐
│  Browser   │ ─────────────────────▶│ POST /api/documents            │
│  (public/) │                       │  1. parse   (pdf-parse/mammoth)│
│            │                       │  2. chunk   (recursive splitter)│
│            │                       │  3. embed   (MiniLM, local)    │
│            │                       │  4. store   (vectra vector DB) │
│            │                       └───────────────────────────────┘
│            │        ask question   ┌───────────────────────────────┐
│            │ ─────────────────────▶│ POST /api/chat (SSE stream)    │
│            │                       │  1. embed the question         │
│            │                       │  2. top-K similarity search    │
│            │◀─────────────────────  │  3. build grounded prompt      │
│  streamed  │   token / sources /   │  4. stream answer from Claude  │
│  answer    │   done events         └───────────────────────────────┘
└────────────┘
```

**Backend** — Node.js + Express (`server/`)
| Concern | Implementation |
|---|---|
| File parsing | `pdf-parse` (PDF), `mammoth` (DOCX), native read (TXT/MD) |
| Chunking | Custom recursive, separator-aware splitter (`server/src/services/chunker.js`) — splits on paragraph → line → sentence → word boundaries with configurable overlap, so chunks stay coherent instead of being cut mid-sentence |
| Embeddings | `@xenova/transformers` running `Xenova/all-MiniLM-L6-v2` fully locally (ONNX runtime, CPU) — no external API, no extra cost |
| Vector store | `vectra` — a lightweight, file-based local vector index (cosine similarity + metadata filtering), persisted under `server/data/` |
| Generation | `@anthropic-ai/sdk` (Claude), streamed via Server-Sent Events so the UI shows the answer as it's generated |
| Document registry | Small JSON file tracking per-document metadata (filename, size, chunk count, upload time) so the sidebar can list/delete documents |

**Frontend** — plain HTML/CSS/JS (`public/`), no build step. A sidebar for
uploading/managing documents, and a main chat pane that renders the streamed
answer live and an expandable "sources" panel under each answer.

Why these choices: everything runs as a single local process with no external
services to stand up (no Docker, no hosted vector DB) — install deps, set one
API key, run. Embeddings are local so ingestion has no external dependency or
per-chunk cost; only the final answer generation calls out to Claude.

## Setup

**Requirements:** Node.js 20+, an [Anthropic API key](https://console.anthropic.com/).

```bash
cd server
npm install
cp .env.example .env
# edit .env and set ANTHROPIC_API_KEY=sk-ant-...
npm start
```

Then open **http://localhost:3000**.

The first document you upload will trigger a one-time download (~90MB) of the
local embedding model, cached under `server/node_modules/@xenova/transformers/.cache`.

### Configuration (`server/.env`)

| Variable | Default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | **required** |
| `ANTHROPIC_MODEL` | `claude-sonnet-5` | Model used to generate answers |
| `PORT` | `3000` | Server port |
| `CHUNK_SIZE` | `900` | Target characters per chunk |
| `CHUNK_OVERLAP` | `150` | Overlap between consecutive chunks |
| `TOP_K` | `5` | Number of chunks retrieved per question |

## Project layout

```
rag_chatbot/
├── public/              # Frontend: index.html, style.css, app.js
└── server/
    ├── src/
    │   ├── index.js         # Express app entry
    │   ├── config.js
    │   ├── routes/
    │   │   ├── documents.js # upload / list / delete
    │   │   └── chat.js      # SSE streaming chat endpoint
    │   └── services/
    │       ├── documentParser.js
    │       ├── chunker.js
    │       ├── embeddings.js
    │       ├── vectorStore.js
    │       ├── docRegistry.js
    │       ├── llm.js
    │       └── ragPipeline.js  # orchestrates the full pipeline
    ├── uploads/          # raw uploaded files (gitignored)
    └── data/             # vector index + doc registry (gitignored)
```

## API

| Endpoint | Description |
|---|---|
| `POST /api/documents` | multipart `file` upload → parses, chunks, embeds, indexes |
| `GET /api/documents` | list uploaded documents with chunk counts |
| `DELETE /api/documents/:docId` | remove a document and its chunks from the index |
| `POST /api/chat` | `{ message, history }` → Server-Sent Events: `token`, `sources`, `done`/`error` |

## Notes / limitations

- The vector index is a single local file store — fine for a demo / single
  user; swap `vectorStore.js` for a hosted vector DB (e.g. Pinecone, Qdrant,
  pgvector) to scale to multiple concurrent users or large corpora.
- Answers are explicitly instructed to rely only on retrieved context and to
  say so when the documents don't contain the answer, to reduce hallucination.
