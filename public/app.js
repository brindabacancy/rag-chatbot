const API = '/api';

const els = {
  fileInput: document.getElementById('file-input'),
  uploadStatus: document.getElementById('upload-status'),
  docList: document.getElementById('doc-list'),
  messages: document.getElementById('messages'),
  emptyState: document.getElementById('empty-state'),
  form: document.getElementById('chat-form'),
  input: document.getElementById('chat-input'),
  sendBtn: document.getElementById('send-btn'),
  clearBtn: document.getElementById('clear-chat'),
};

let history = []; // [{role, content}]
let isStreaming = false;

// ---------- Documents ----------

async function loadDocuments() {
  const res = await fetch(`${API}/documents`);
  const { documents } = await res.json();
  renderDocuments(documents);
}

function renderDocuments(docs) {
  els.docList.innerHTML = '';
  if (!docs || docs.length === 0) {
    els.docList.innerHTML = '<li class="doc-empty">No documents yet</li>';
    return;
  }
  for (const doc of docs) {
    const li = document.createElement('li');
    li.className = 'doc-item';
    li.innerHTML = `
      <div>
        <div class="doc-name" title="${escapeHtml(doc.filename)}">${escapeHtml(doc.filename)}</div>
        <div class="doc-meta">${doc.chunkCount} chunks</div>
      </div>
      <button class="doc-delete" data-doc-id="${doc.docId}" title="Delete">✕</button>
    `;
    els.docList.appendChild(li);
  }
}

els.docList.addEventListener('click', async (e) => {
  const btn = e.target.closest('.doc-delete');
  if (!btn) return;
  const docId = btn.dataset.docId;
  btn.disabled = true;
  try {
    await fetch(`${API}/documents/${docId}`, { method: 'DELETE' });
    await loadDocuments();
  } catch (err) {
    console.error(err);
  }
});

els.fileInput.addEventListener('change', async () => {
  const file = els.fileInput.files[0];
  if (!file) return;

  els.uploadStatus.textContent = `Uploading "${file.name}"...`;
  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch(`${API}/documents`, { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    els.uploadStatus.textContent = `"${data.filename}" indexed (${data.chunkCount} chunks)`;
    await loadDocuments();
  } catch (err) {
    els.uploadStatus.textContent = `Error: ${err.message}`;
  } finally {
    els.fileInput.value = '';
    setTimeout(() => { els.uploadStatus.textContent = ''; }, 5000);
  }
});

// ---------- Chat ----------

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function addMessage(role, text) {
  els.emptyState?.remove();
  const row = document.createElement('div');
  row.className = `message-row ${role}`;
  row.innerHTML = `
    <div class="avatar">${role === 'user' ? '🧑' : '🤖'}</div>
    <div class="bubble"></div>
  `;
  row.querySelector('.bubble').textContent = text;
  els.messages.appendChild(row);
  els.messages.scrollTop = els.messages.scrollHeight;
  return row.querySelector('.bubble');
}

function renderSources(afterRow, sources) {
  if (!sources || sources.length === 0) return;
  const wrap = document.createElement('div');
  wrap.className = 'sources';
  const list = sources.map((s) => `
    <div class="source-card">
      <b>[${s.ref}] ${escapeHtml(s.filename)}</b> (chunk ${s.chunkIndex}, score ${s.score.toFixed(3)})<br/>
      ${escapeHtml(s.preview)}${s.preview.length >= 220 ? '…' : ''}
    </div>
  `).join('');
  wrap.innerHTML = `<button class="sources-toggle">📎 ${sources.length} source${sources.length > 1 ? 's' : ''}</button>
    <div class="sources-list" style="display:none">${list}</div>`;
  wrap.querySelector('.sources-toggle').addEventListener('click', () => {
    const el = wrap.querySelector('.sources-list');
    el.style.display = el.style.display === 'none' ? 'flex' : 'none';
  });
  afterRow.insertAdjacentElement('afterend', wrap);
  els.messages.scrollTop = els.messages.scrollHeight;
}

function autoResize() {
  els.input.style.height = 'auto';
  els.input.style.height = Math.min(els.input.scrollHeight, 200) + 'px';
}
els.input.addEventListener('input', autoResize);
els.input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    els.form.requestSubmit();
  }
});

els.clearBtn.addEventListener('click', () => {
  history = [];
  els.messages.innerHTML = '';
  const empty = document.createElement('div');
  empty.className = 'empty-state';
  empty.id = 'empty-state';
  empty.innerHTML = `<h2>Ask anything about your documents</h2>
    <p>Upload a PDF, DOCX, TXT or Markdown file on the left, then ask a question below. Answers are generated only from the content you upload.</p>`;
  els.messages.appendChild(empty);
});

els.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (isStreaming) return;

  const message = els.input.value.trim();
  if (!message) return;

  els.input.value = '';
  autoResize();
  addMessage('user', message);

  const assistantBubble = addMessage('assistant', '');
  assistantBubble.classList.add('cursor');

  isStreaming = true;
  els.sendBtn.disabled = true;

  let fullText = '';
  try {
    const res = await fetch(`${API}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history }),
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
      buffer = events.pop(); // last (possibly incomplete) chunk stays in buffer

      for (const raw of events) {
        const lines = raw.split('\n');
        const eventLine = lines.find((l) => l.startsWith('event:'));
        const dataLine = lines.find((l) => l.startsWith('data:'));
        if (!eventLine || !dataLine) continue;

        const eventName = eventLine.slice(6).trim();
        const data = JSON.parse(dataLine.slice(5).trim());

        if (eventName === 'token') {
          fullText += data.token;
          assistantBubble.textContent = fullText;
          els.messages.scrollTop = els.messages.scrollHeight;
        } else if (eventName === 'sources') {
          renderSources(assistantBubble.closest('.message-row'), data.sources);
        } else if (eventName === 'error') {
          throw new Error(data.message);
        }
      }
    }

    history.push({ role: 'user', content: message });
    history.push({ role: 'assistant', content: fullText });
  } catch (err) {
    assistantBubble.textContent = fullText || '';
    const banner = document.createElement('div');
    banner.className = 'error-banner';
    banner.textContent = `Error: ${err.message}`;
    els.messages.appendChild(banner);
  } finally {
    assistantBubble.classList.remove('cursor');
    isStreaming = false;
    els.sendBtn.disabled = false;
  }
});

loadDocuments();
