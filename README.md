# 🔍 RAG Analysis Engine

A fully client-side **Retrieval-Augmented Generation** (RAG) demo powered by the [Anthropic Claude API](https://www.anthropic.com). Paste any document, index it, and ask questions — the engine retrieves the most relevant chunks and streams a grounded answer in real time.

![RAG Engine Screenshot](docs/screenshot.png)

---

## ✨ Features

| Feature | Detail |
|---|---|
| **PDF Ingestion** | Drag-and-drop or browse to upload any text-based PDF |
| **3 Chunking Strategies** | Paragraph-based, sentence-based, fixed-size |
| **Adjustable Parameters** | Chunk size (30–200 words) and Top-K retrieval (1–6) |
| **TF-IDF Embeddings** | Client-side vector index — no embedding API needed |
| **Cosine Similarity Search** | Ranked retrieval with visual similarity scores |
| **Streaming Answers** | Token-by-token output via Anthropic SSE |
| **Pipeline Visualization** | Animated step-by-step RAG pipeline display |
| **Zero Build Step** | Vanilla JS ES modules — open in a local server and go |

---

## 🗂️ Project Structure

```
rag-engine/
├── index.html              # Main entry point
├── src/
│   ├── css/
│   │   └── style.css       # All styling (CSS variables, dark theme)
│   └── js/
│       ├── main.js         # App orchestration & event wiring
│       ├── chunker.js      # Text chunking strategies
│       ├── retriever.js    # TF-IDF index + cosine similarity
│       ├── api.js          # Anthropic streaming API client
│       ├── pdfLoader.js    # Client-side PDF text extraction (pdf.js)
│       ├── ui.js           # DOM rendering helpers
│       └── samples.js      # Demo documents
├── docs/
│   └── architecture.md     # RAG pipeline deep-dive
├── .gitignore
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- A modern browser (Chrome, Firefox, Safari, Edge)
- An [Anthropic API key](https://console.anthropic.com/)

### Running Locally

Because the app uses ES modules (`type="module"`), you need a local HTTP server — you **cannot** open `index.html` directly with `file://`.

**Option A — Python (no install needed):**
```bash
cd rag-engine
python3 -m http.server 8080
# Open http://localhost:8080
```

**Option B — Node.js `serve`:**
```bash
npx serve .
```

**Option C — VS Code Live Server:**  
Install the [Live Server extension](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) and click **Go Live**.

### First Run

1. Open the app in your browser
2. Enter your Anthropic API key when prompted (stored in memory only, never persisted)
3. Paste a document or click **Load Sample**
4. Click **⚡ Index Document**
5. Type a question and click **Ask →** (or press Enter)

---

## 🏗️ How It Works

```
Document → Chunker → TF-IDF Embedder → Vector Index
                                             ↓
Query   → TF-IDF Embedder → Cosine Similarity → Top-K Chunks
                                                      ↓
                                          Claude API (streaming)
                                                      ↓
                                              Grounded Answer
```

### Chunking
Three strategies split your document into manageable pieces:
- **Paragraph** — respects natural paragraph breaks (recommended)
- **Sentence** — groups sentences up to the target word count
- **Fixed** — sliding window over word list

### Embedding & Retrieval
Each chunk is converted to a TF-IDF vector. At query time, the query is vectorized the same way and compared to all chunks via cosine similarity. The top-K highest-scoring chunks are retrieved.

> **Note:** This uses a lexical similarity approximation. For semantic search (understanding synonyms, paraphrases), swap `retriever.js`'s `embed()` function for a real embedding API call.

### Generation
Retrieved chunks are assembled into a structured context prompt and sent to `claude-sonnet-4-20250514` with streaming enabled. The system prompt instructs Claude to answer only from provided context.

---

## ⚙️ Configuration

All tuneable parameters live in the UI, but you can also edit defaults in:

| File | What to change |
|---|---|
| `src/js/api.js` | `MODEL`, `MAX_TOKENS`, `SYSTEM_PROMPT` |
| `src/js/samples.js` | Add your own sample documents |
| `src/css/style.css` | CSS variables in `:root` for theming |

---

## 🔒 Security Note

This demo calls the Anthropic API **directly from the browser** for simplicity. This means your API key is exposed in the browser's network tab.

**For production use**, proxy API requests through your own backend server so the key stays server-side:

```
Browser → Your Backend → Anthropic API
```

---

## 🛠️ Extending the Project

### Swap in a Real Embedding Model

In `src/js/retriever.js`, replace the `embed()` function with an API call:

```js
// Example: OpenAI embeddings
async function embed(text) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
  });
  const data = await res.json();
  return data.data[0].embedding;
}
```

### Add Persistent Storage

Replace the in-memory index with IndexedDB or a vector database (e.g. Chroma, Pinecone) for documents that survive page refresh.

### Add PDF / File Upload

PDF upload is already built in via `pdfLoader.js` using [pdf.js](https://mozilla.github.io/pdf.js/). It supports drag-and-drop and file browsing for text-based PDFs with a per-page progress indicator.

For **scanned / image-only PDFs** (no extractable text), you'd need to add OCR. A straightforward approach: rasterize pages with pdf.js's `page.render()`, draw to a canvas, and send each canvas image to the Claude Vision API for text extraction before indexing.

---

## 📄 License

MIT — see [LICENSE](LICENSE) for details.

---

## 🙏 Credits

Built with [Claude](https://www.anthropic.com) by Anthropic.  
Fonts: [Space Mono](https://fonts.google.com/specimen/Space+Mono) · [Syne](https://fonts.google.com/specimen/Syne) via Google Fonts.
