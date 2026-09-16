# RAG Chatbot

A full end-to-end Retrieval-Augmented Generation chatbot built as a single
Next.js app (frontend + backend together): upload documents, ask questions
about them in a ChatGPT/Claude-style chat UI, and get answers generated only
from the content you uploaded (with cited sources).

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
│  Browser   │ ─────────────────────▶│ POST /api/documents             │
│  (React,   │                       │  1. parse   (pdf-parse/mammoth) │
│  app/*.jsx)│                       │  2. chunk   (recursive splitter)│
│            │                       │  3. embed   (MiniLM, local)     │
│            │                       │  4. store   (vectra vector DB)  │
│            │                       └───────────────────────────────┘
│            │        ask question   ┌───────────────────────────────┐
│            │ ─────────────────────▶│ POST /api/chat (SSE stream)     │
│            │                       │  1. embed the question          │
│            │                       │  2. top-K similarity search     │
│            │◀─────────────────────  │  3. build grounded prompt       │
│  streamed  │   token / sources /   │  4. stream answer from Claude   │
│  answer    │   done events         └───────────────────────────────┘
└────────────┘
```

Everything — UI and API — lives in a single Next.js app (App Router). There is
no separate backend server or build step to coordinate.

| Concern | Implementation |
|---|---|
| Frontend | React client component (`app/page.jsx`) — sidebar for uploading/managing documents, chat pane with token-by-token streamed answers and an expandable "sources" panel per answer |
| API | Next.js Route Handlers (`app/api/**/route.js`), running in the Node.js runtime |
| File parsing | `pdf-parse` (PDF), `mammoth` (DOCX), native read (TXT/MD) |
| Chunking | Custom recursive, separator-aware splitter (`lib/chunker.js`) — splits on paragraph → line → sentence → word boundaries with configurable overlap, so chunks stay coherent instead of being cut mid-sentence |
| Embeddings | `@xenova/transformers` running `Xenova/all-MiniLM-L6-v2` fully locally (ONNX runtime, CPU) — no external API, no extra cost |
| Vector store | `vectra` — a lightweight, file-based local vector index (cosine similarity + metadata filtering), persisted under `data/` |
| Generation | `@anthropic-ai/sdk` (Claude), streamed via Server-Sent Events so the UI shows the answer as it's generated |
| Document registry | Small JSON file tracking per-document metadata (filename, size, chunk count, upload time) so the sidebar can list/delete documents |

Why these choices: everything runs as a single `next dev`/`next start` process
with no external services to stand up (no Docker, no hosted vector DB) —
install deps, set one API key, run. Embeddings are local so ingestion has no
external dependency or per-chunk cost; only the final answer generation calls
out to Claude.

## Setup

**Requirements:** Node.js 20.9+, an [Anthropic API key](https://console.anthropic.com/).

```bash
npm install
cp .env.example .env
# edit .env and set ANTHROPIC_API_KEY=sk-ant-...
npm run dev
```

Then open **http://localhost:3000**.

The first document you upload will trigger a one-time download (~90MB) of the
local embedding model, cached under `node_modules/@xenova/transformers/.cache`.

For a production build: `npm run build && npm start`.

### Configuration (`.env`)

| Variable | Default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | **required** |
| `ANTHROPIC_MODEL` | `claude-sonnet-5` | Model used to generate answers |
| `CHUNK_SIZE` | `900` | Target characters per chunk |
| `CHUNK_OVERLAP` | `150` | Overlap between consecutive chunks |
| `TOP_K` | `5` | Number of chunks retrieved per question |

## Project layout

```
rag_chatbot/
├── app/
│   ├── layout.jsx
│   ├── globals.css
│   ├── page.jsx           # Chat UI (client component)
│   └── api/
│       ├── documents/
│       │   ├── route.js       # GET (list) / POST (upload)
│       │   └── [docId]/route.js  # DELETE
│       └── chat/route.js      # SSE streaming chat endpoint
├── lib/
│   ├── config.js
│   ├── documentParser.js
│   ├── chunker.js
│   ├── embeddings.js
│   ├── vectorStore.js
│   ├── docRegistry.js
│   ├── llm.js
│   └── ragPipeline.js         # orchestrates the full pipeline
└── data/                   # vector index + doc registry (gitignored)
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
  user; swap `lib/vectorStore.js` for a hosted vector DB (e.g. Pinecone,
  Qdrant, pgvector) to scale to multiple concurrent users or large corpora.
- Answers are explicitly instructed to rely only on retrieved context and to
  say so when the documents don't contain the answer, to reduce hallucination.
