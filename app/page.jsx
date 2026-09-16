'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return idCounter;
}

export default function Home() {
  const [documents, setDocuments] = useState([]);
  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingId, setStreamingId] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');

  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const loadDocuments = useCallback(async () => {
    const res = await fetch('/api/documents');
    const data = await res.json();
    setDocuments(data.documents || []);
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  async function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    setUploadStatus(`Uploading "${file.name}"...`);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/documents', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setUploadStatus(`"${data.filename}" indexed (${data.chunkCount} chunks)`);
      await loadDocuments();
    } catch (err) {
      setUploadStatus(`Error: ${err.message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setUploadStatus(''), 5000);
    }
  }

  async function handleDeleteDoc(docId) {
    await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
    await loadDocuments();
  }

  function handleClear() {
    setMessages([]);
    setHistory([]);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    await submit();
  }

  async function submit() {
    if (isStreaming) return;
    const trimmed = input.trim();
    if (!trimmed) return;

    setInput('');
    const assistantId = nextId();
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: 'user', content: trimmed },
      { id: assistantId, role: 'assistant', content: '', sources: null },
    ]);
    setIsStreaming(true);
    setStreamingId(assistantId);

    let fullText = '';
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split('\n\n');
        buffer = events.pop();

        for (const raw of events) {
          const lines = raw.split('\n');
          const eventLine = lines.find((l) => l.startsWith('event:'));
          const dataLine = lines.find((l) => l.startsWith('data:'));
          if (!eventLine || !dataLine) continue;

          const eventName = eventLine.slice(6).trim();
          const data = JSON.parse(dataLine.slice(5).trim());

          if (eventName === 'token') {
            fullText += data.token;
            const text = fullText;
            setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: text } : m)));
          } else if (eventName === 'sources') {
            setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, sources: data.sources } : m)));
          } else if (eventName === 'error') {
            throw new Error(data.message);
          }
        }
      }

      setHistory((prev) => [
        ...prev,
        { role: 'user', content: trimmed },
        { role: 'assistant', content: fullText },
      ]);
    } catch (err) {
      setMessages((prev) => [...prev, { id: nextId(), role: 'error', content: err.message }]);
    } finally {
      setIsStreaming(false);
      setStreamingId(null);
    }
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>📚 RAG Chatbot</h1>
          <p className="subtitle">Chat with your documents</p>
        </div>

        <label className="upload-btn" htmlFor="file-input">
          <span>＋ Upload document</span>
        </label>
        <input
          id="file-input"
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt,.md"
          hidden
          onChange={handleFileChange}
        />
        <div className="upload-status">{uploadStatus}</div>

        <div className="doc-list-header">Documents</div>
        <ul className="doc-list">
          {documents.length === 0 && <li className="doc-empty">No documents yet</li>}
          {documents.map((doc) => (
            <li key={doc.docId} className="doc-item">
              <div>
                <div className="doc-name" title={doc.filename}>
                  {doc.filename}
                </div>
                <div className="doc-meta">{doc.chunkCount} chunks</div>
              </div>
              <button className="doc-delete" title="Delete" onClick={() => handleDeleteDoc(doc.docId)}>
                ✕
              </button>
            </li>
          ))}
        </ul>

        <button className="clear-btn" onClick={handleClear}>
          Clear conversation
        </button>
      </aside>

      <main className="chat-area">
        <div className="messages">
          {messages.length === 0 && (
            <div className="empty-state">
              <h2>Ask anything about your documents</h2>
              <p>
                Upload a PDF, DOCX, TXT or Markdown file on the left, then ask a question below.
                Answers are generated only from the content you upload.
              </p>
            </div>
          )}

          {messages.map((m) =>
            m.role === 'error' ? (
              <div key={m.id} className="error-banner">
                Error: {m.content}
              </div>
            ) : (
              <div key={m.id}>
                <div className={`message-row ${m.role}`}>
                  <div className="avatar">{m.role === 'user' ? '🧑' : '🤖'}</div>
                  <div className={`bubble ${m.id === streamingId ? 'cursor' : ''}`}>{m.content}</div>
                </div>
                {m.sources && m.sources.length > 0 && <Sources sources={m.sources} />}
              </div>
            )
          )}
          <div ref={messagesEndRef} />
        </div>

        <form className="chat-form" onSubmit={handleSubmit}>
          <textarea
            id="chat-input"
            ref={textareaRef}
            rows={1}
            placeholder="Ask a question about your documents..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button type="submit" id="send-btn" aria-label="Send" disabled={isStreaming}>
            ➤
          </button>
        </form>
      </main>
    </div>
  );
}

function Sources({ sources }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="sources">
      <button className="sources-toggle" onClick={() => setOpen((o) => !o)}>
        📎 {sources.length} source{sources.length > 1 ? 's' : ''}
      </button>
      {open && (
        <div className="sources-list">
          {sources.map((s) => (
            <div className="source-card" key={s.ref}>
              <b>
                [{s.ref}] {s.filename}
              </b>{' '}
              (chunk {s.chunkIndex}, score {s.score.toFixed(3)})
              <br />
              {s.preview}
              {s.preview.length >= 220 ? '…' : ''}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
