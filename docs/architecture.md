# RAG Pipeline — Architecture Notes

## Overview

This document explains the technical design decisions in the RAG Analysis Engine.

---

## 1. Chunking

**Why chunk at all?**  
Language models have a context window limit. Chunking lets us index arbitrarily long documents and only pass the *relevant* portions to the model at query time.

**Strategy comparison:**

| Strategy | Best for | Trade-off |
|---|---|---|
| Paragraph | Well-structured prose, articles | Uneven chunk sizes |
| Sentence | Dense technical text | May split mid-thought |
| Fixed | Uniform datasets, code | Ignores semantic boundaries |

**Overlap (not yet implemented):**  
Production RAG systems often use overlapping chunks (e.g. 20% overlap) to prevent information loss at boundaries. This is a straightforward extension in `chunker.js`.

---

## 2. Embedding

The current implementation uses **TF-IDF** (Term Frequency–Inverse Document Frequency):

```
TF(t, d)  = count of term t in document d
IDF(t)    = log((N+1) / (df(t)+1)) + 1   [smoothed]
weight    = TF × IDF
vector    = L2-normalized weight vector over vocabulary
```

**Pros:** No external API, instant, deterministic.  
**Cons:** Purely lexical — misses synonyms, paraphrases, and semantic meaning.

**Upgrading to semantic embeddings:**  
Replace `embed()` in `retriever.js` with a call to an embedding model API. The rest of the pipeline (cosine similarity, top-K retrieval) stays identical.

---

## 3. Retrieval

Cosine similarity measures the angle between two vectors:

```
cos(A, B) = (A · B) / (|A| × |B|)
```

Since vectors are already L2-normalised, this reduces to a dot product — making retrieval O(n × d) where n = number of chunks and d = vocabulary size.

For large corpora, replace the brute-force scan with an approximate nearest-neighbour index (e.g. FAISS, HNSWlib).

---

## 4. Generation

Retrieved chunks are assembled into a structured prompt:

```
[Chunk 1]:
<text of most relevant chunk>

[Chunk 2]:
<text of second most relevant chunk>

...

Question: <user query>
```

The system prompt instructs Claude to answer *only from context*, which:
- Reduces hallucination
- Makes answers verifiable (you can see which chunk supported the answer)
- Keeps responses concise

---

## 5. Streaming

The Anthropic API supports Server-Sent Events (SSE). Each `data:` frame carries a JSON event:

```json
{ "type": "content_block_delta", "delta": { "text": "Hello" } }
```

Tokens are appended to the answer box as they arrive, giving the user real-time feedback.

---

## 6. File Organization Rationale

| Module | Responsibility |
|---|---|
| `main.js` | Event wiring, state, orchestration only |
| `chunker.js` | Pure functions — text in, chunks out |
| `retriever.js` | Index state + pure retrieval logic |
| `api.js` | Network I/O, streaming parser |
| `ui.js` | All DOM mutations in one place |
| `samples.js` | Static data, easily extensible |

This separation makes each module independently testable and replaceable.
