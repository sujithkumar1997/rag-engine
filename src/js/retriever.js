/**
 * retriever.js
 * -------------------------------------------------
 * TF-IDF vector embeddings + cosine similarity retrieval.
 *
 * This is a client-side approximation of semantic search:
 *   - TF-IDF scores weight terms by local frequency and global rarity
 *   - Cosine similarity measures vector alignment between query and chunks
 *
 * For production use, swap embed() with a real embedding API
 * (e.g. OpenAI text-embedding-3-small or Anthropic's future embeddings).
 */

// ─── Module State ──────────────────────────────────────────────────────────
let _chunks     = [];
let _embeddings = [];
let _vocab      = [];
let _idf        = {};

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Build the in-memory index from an array of text chunks.
 *
 * @param {string[]} chunks
 */
export function buildIndex(chunks) {
  _chunks     = chunks;
  _idf        = computeIDF(chunks);
  _vocab      = Object.keys(_idf);
  _embeddings = chunks.map(c => embed(c, _idf, _vocab));
}

/**
 * Retrieve the top-k most similar chunks for a query.
 *
 * @param {string} query
 * @param {number} k
 * @returns {{ i: number, score: number }[]}
 */
export function retrieve(query, k) {
  const qVec = embed(query, _idf, _vocab);
  const scores = _embeddings.map((vec, i) => ({
    i,
    score: cosine(qVec, vec),
  }));
  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, k);
}

/**
 * Return the current chunks array (read-only reference).
 * @returns {string[]}
 */
export function getChunks() { return _chunks; }

/**
 * Clear the index.
 */
export function clearIndex() {
  _chunks = []; _embeddings = []; _vocab = []; _idf = {};
}

// ─── Internal Helpers ──────────────────────────────────────────────────────

/**
 * Lowercase + strip punctuation tokeniser.
 * @param {string} text
 * @returns {string[]}
 */
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Compute inverse document frequency for every term in the corpus.
 * Uses smoothed IDF: log((N+1)/(df+1)) + 1
 *
 * @param {string[]} chunks
 * @returns {Record<string, number>}
 */
function computeIDF(chunks) {
  const N  = chunks.length;
  const df = {};

  for (const chunk of chunks) {
    const terms = new Set(tokenize(chunk));
    for (const term of terms) {
      df[term] = (df[term] || 0) + 1;
    }
  }

  const idf = {};
  for (const term in df) {
    idf[term] = Math.log((N + 1) / (df[term] + 1)) + 1;
  }
  return idf;
}

/**
 * Produce a normalised TF-IDF vector for a piece of text.
 *
 * @param {string}                text
 * @param {Record<string,number>} idf
 * @param {string[]}              vocab
 * @returns {number[]}
 */
function embed(text, idf, vocab) {
  const tf  = {};
  const tokens = tokenize(text);
  for (const t of tokens) tf[t] = (tf[t] || 0) + 1;

  const vec  = vocab.map(t => (tf[t] || 0) * (idf[t] || 0));
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map(v => v / norm);
}

/**
 * Cosine similarity between two equal-length vectors.
 *
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number} similarity in [0, 1]
 */
function cosine(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}
