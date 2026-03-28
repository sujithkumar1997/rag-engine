/**
 * main.js
 * -------------------------------------------------
 * Application entry point — wires together all modules:
 *   chunker   → text splitting strategies
 *   retriever → TF-IDF index + cosine similarity search
 *   api       → Anthropic streaming messages API
 *   ui        → all DOM rendering helpers
 *   samples   → demo documents
 */

import { chunkText }       from './chunker.js';
import { buildIndex, retrieve, getChunks, clearIndex } from './retriever.js';
import { streamRagAnswer } from './api.js';
import { SAMPLES }         from './samples.js';
import { extractTextFromPDF, formatFileSize } from './pdfLoader.js';
import {
  setPipe, resetPipes, markIndexed,
  renderChunks, updateStats,
  answerStreaming, appendAnswerToken, answerDone, answerError, answerReset,
  showIndexStatus, clearIndexStatus,
  showError, clearError,
  showApiModal, hideApiModal,
} from './ui.js';

// ─── State ─────────────────────────────────────────────────────────────────
let apiKey     = '';
let isStreaming = false;
let sampleIdx  = 0;

// ─── Helpers ───────────────────────────────────────────────────────────────
const $  = id => document.getElementById(id);
const $v = id => $(id).value;

// ─── API Key Flow ──────────────────────────────────────────────────────────
function ensureApiKey() {
  if (!apiKey) showApiModal();
}

$('saveKeyBtn').addEventListener('click', () => {
  const key = $v('apiKeyInput').trim();
  if (!key.startsWith('sk-ant-')) {
    alert('That doesn\'t look like a valid Anthropic API key (should start with sk-ant-).');
    return;
  }
  apiKey = key;
  hideApiModal();
});

// ─── Range Inputs ──────────────────────────────────────────────────────────
$('topK').addEventListener('input',      () => $('topKVal').textContent     = $v('topK'));
$('chunkSize').addEventListener('input', () => $('chunkSizeVal').textContent = $v('chunkSize'));

// ─── PDF Upload ────────────────────────────────────────────────────────────
const dropZone    = $('pdfDropZone');
const fileInput   = $('pdfFileInput');
const pdfStatusEl = $('pdfStatus');

/** Handle a dropped or selected PDF File */
async function handlePDFFile(file) {
  if (!file || file.type !== 'application/pdf') {
    pdfStatusEl.innerHTML = `<div class="pdf-status error">⚠ Please select a valid PDF file.</div>`;
    return;
  }

  const sizeLabel = formatFileSize(file.size);
  pdfStatusEl.innerHTML = `
    <div class="pdf-status loading">⏳ Reading ${file.name} (${sizeLabel})…</div>
    <div class="pdf-progress-bar"><div class="pdf-progress-fill" id="pdfProgressFill" style="width:0%"></div></div>`;
  dropZone.classList.remove('loaded');

  try {
    const text = await extractTextFromPDF(file, (current, total) => {
      const pct = Math.round((current / total) * 100);
      const fill = $('pdfProgressFill');
      if (fill) fill.style.width = pct + '%';
    });

    // Populate the textarea
    $('docInput').value = text;

    const wordCount = text.split(/\s+/).filter(Boolean).length;
    pdfStatusEl.innerHTML = `
      <div class="pdf-status done">✓ ${file.name} — ${wordCount.toLocaleString()} words extracted</div>`;
    dropZone.classList.add('loaded');

    clearError();
  } catch (err) {
    pdfStatusEl.innerHTML = `<div class="pdf-status error">⚠ ${err.message}</div>`;
    dropZone.classList.remove('loaded');
  }
}

// Click to browse
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) handlePDFFile(fileInput.files[0]);
});

// Drag-and-drop
dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) handlePDFFile(file);
});

// ─── Index Button ──────────────────────────────────────────────────────────
$('indexBtn').addEventListener('click', () => {
  const text = $v('docInput').trim();
  if (!text) { showError('Please enter document text first.'); return; }

  clearError();
  clearIndexStatus();
  resetPipes();
  setPipe(0, 'active');

  // Animate pipeline steps with short delays for visual feedback
  setTimeout(() => {
    setPipe(0, 'done');
    setPipe(1, 'active');

    const chunks = chunkText(text, $v('chunkStrategy'), parseInt($v('chunkSize')));

    setTimeout(() => {
      if (!chunks.length) {
        showError('Could not chunk document. Try a different strategy or smaller chunk size.');
        resetPipes();
        return;
      }

      buildIndex(chunks);
      setPipe(1, 'done');
      setPipe(2, 'active');

      setTimeout(() => {
        setPipe(2, 'done');
        renderChunks(chunks);
        updateStats(chunks, 0, null);
        $('queryBtn').disabled = false;
        showIndexStatus(`Indexed ${chunks.length} chunks from ${text.split(/\s+/).length} words`);
      }, 300);
    }, 300);
  }, 200);
});

// ─── Query Button ──────────────────────────────────────────────────────────
$('queryBtn').addEventListener('click', async () => {
  const query = $v('queryInput').trim();
  if (!query || isStreaming) return;

  ensureApiKey();
  if (!apiKey) return;   // modal opened, user must enter key first

  clearError();
  const k = parseInt($v('topK'));

  // Retrieval
  resetPipes();
  markIndexed();
  setPipe(3, 'active');

  const results = retrieve(query, k);
  const chunks  = getChunks();
  renderChunks(chunks, results);

  const avgSim = results.reduce((s, r) => s + r.score, 0) / results.length;
  updateStats(chunks, results.length, avgSim);

  setPipe(3, 'done');
  setPipe(4, 'active');

  // Generation
  const contextChunks = results.map(r => chunks[r.i]);
  isStreaming = true;
  $('queryBtn').disabled = true;
  answerStreaming();

  let fullText = '';

  await streamRagAnswer({
    apiKey,
    query,
    contextChunks,
    onToken: token => {
      fullText += token;
      appendAnswerToken(token, fullText);
    },
    onDone: () => {
      setPipe(4, 'done');
      setPipe(5, 'done');
      answerDone();
    },
    onError: err => {
      answerError();
      showError('API error: ' + err.message);
      resetPipes();
      markIndexed();
    },
  });

  isStreaming = false;
  $('queryBtn').disabled = false;
});

// Enter key submits query
$('queryInput').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !$('queryBtn').disabled) $('queryBtn').click();
});

// ─── Load Sample ───────────────────────────────────────────────────────────
$('loadSampleBtn').addEventListener('click', () => {
  const sample = SAMPLES[sampleIdx % SAMPLES.length];
  $('docInput').value = sample.text;
  sampleIdx++;
  clearError();
});

// ─── Clear ─────────────────────────────────────────────────────────────────
$('clearBtn').addEventListener('click', () => {
  $('docInput').value    = '';
  $('queryInput').value  = '';
  $('pdfStatus').innerHTML = '';
  $('pdfFileInput').value  = '';
  dropZone.classList.remove('loaded');
  clearIndex();
  renderChunks([]);
  document.getElementById('statsRow').style.display = 'none';
  $('queryBtn').disabled = true;
  clearIndexStatus();
  clearError();
  answerReset();
  resetPipes();
});
