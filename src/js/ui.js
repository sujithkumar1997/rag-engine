/**
 * ui.js
 * -------------------------------------------------
 * All DOM rendering and UI helper functions.
 * Keeps main.js focused on orchestration logic.
 */

// ─── Pipeline Steps ────────────────────────────────────────────────────────

/**
 * @param {number} index  - pipe step index (0–5)
 * @param {'active'|'done'|''} state
 */
export function setPipe(index, state) {
  const el = document.getElementById(`pipe${index}`);
  if (el) el.className = 'pipe-icon ' + state;
}

export function resetPipes() {
  for (let i = 0; i <= 5; i++) setPipe(i, '');
}

export function markIndexed() {
  setPipe(0, 'done');
  setPipe(1, 'done');
  setPipe(2, 'done');
}

// ─── Chunk Cards ───────────────────────────────────────────────────────────

/**
 * Render the chunk index panel.
 *
 * @param {string[]}                 chunks
 * @param {{ i:number, score:number }[]} [highlighted] - retrieved chunks
 */
export function renderChunks(chunks, highlighted = []) {
  const container = document.getElementById('chunksContainer');
  if (!container) return;

  if (!chunks.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">🗄️</div>
        No chunks indexed yet.<br/>Add a document and click Index.
      </div>`;
    return;
  }

  const highlightSet = new Set(highlighted.map(h => h.i));
  const scoreMap     = Object.fromEntries(highlighted.map(h => [h.i, h.score]));

  const cards = chunks.map((text, i) => {
    const isHL    = highlightSet.has(i);
    const score   = scoreMap[i] ?? 0;
    const pct     = isHL ? Math.round(score * 100) : 0;
    const words   = text.split(/\s+/).length;
    const preview = text.length > 200 ? text.slice(0, 200) + '…' : text;

    return `
      <div class="chunk-card${isHL ? ' highlighted' : ''}">
        <div class="chunk-meta">
          <span>CHUNK #${i + 1}</span>
          <span>${words} words</span>
          ${isHL ? `<span class="sim-score">sim: ${score.toFixed(3)}</span>` : ''}
        </div>
        <div class="chunk-text">${escapeHtml(preview)}</div>
        ${isHL ? `<div class="sim-bar"><div class="sim-fill" style="width:${pct}%"></div></div>` : ''}
      </div>`;
  }).join('');

  container.innerHTML = `<div class="chunks-wrap">${cards}</div>`;
}

// ─── Stats Bar ─────────────────────────────────────────────────────────────

/**
 * Update the stats row with current index metrics.
 *
 * @param {string[]} chunks
 * @param {number}   retrieved
 * @param {number|null} avgSim
 */
export function updateStats(chunks, retrieved, avgSim) {
  const statsRow = document.getElementById('statsRow');
  if (!statsRow) return;

  const totalWords = chunks.reduce((s, c) => s + c.split(/\s+/).length, 0);

  document.getElementById('statChunks').textContent = chunks.length;
  document.getElementById('statWords').textContent  = totalWords;
  document.getElementById('statK').textContent      = retrieved;
  document.getElementById('statSim').textContent    = avgSim != null ? avgSim.toFixed(2) : '—';
  statsRow.style.display = 'flex';
}

// ─── Answer Box ────────────────────────────────────────────────────────────

export function answerStreaming() {
  const box = document.getElementById('answerBox');
  box.innerHTML  = '<span class="cursor"></span>';
  box.className  = 'answer-box streaming';
}

export function appendAnswerToken(token, fullText) {
  const box = document.getElementById('answerBox');
  box.textContent = fullText;
  box.scrollTop   = box.scrollHeight;
}

export function answerDone() {
  const box = document.getElementById('answerBox');
  box.className = 'answer-box';
}

export function answerError() {
  const box = document.getElementById('answerBox');
  box.innerHTML = '<span class="placeholder">Error generating answer.</span>';
  box.className = 'answer-box';
}

export function answerReset() {
  const box = document.getElementById('answerBox');
  box.innerHTML = '<span class="placeholder">Answer will appear here after you run a query...</span>';
  box.className = 'answer-box';
}

// ─── Status / Errors ───────────────────────────────────────────────────────

export function showIndexStatus(message) {
  const el = document.getElementById('indexStatus');
  if (el) el.innerHTML = `<div class="success-msg">✓ ${escapeHtml(message)}</div>`;
}

export function clearIndexStatus() {
  const el = document.getElementById('indexStatus');
  if (el) el.innerHTML = '';
}

export function showError(message) {
  const el = document.getElementById('errorBox');
  if (el) el.innerHTML = `<div class="error-msg">⚠ ${escapeHtml(message)}</div>`;
}

export function clearError() {
  const el = document.getElementById('errorBox');
  if (el) el.innerHTML = '';
}

// ─── Modal ─────────────────────────────────────────────────────────────────

export function showApiModal() {
  document.getElementById('apiModal').style.display = 'flex';
}

export function hideApiModal() {
  document.getElementById('apiModal').style.display = 'none';
}

// ─── Utilities ─────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
