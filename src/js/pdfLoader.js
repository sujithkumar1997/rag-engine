/**
 * pdfLoader.js
 * -------------------------------------------------
 * Client-side PDF text extraction using pdf.js (Mozilla).
 * Loaded via CDN in index.html.
 *
 * Supports:
 *   - Text-based PDFs (native extraction, very fast)
 *   - Multi-page documents (all pages concatenated)
 *
 * Does NOT support scanned/image-only PDFs without OCR.
 * For those, the user should use an OCR tool first and paste the text.
 */

// pdf.js exposes itself as a global `pdfjsLib` when loaded via CDN script tag.
// We wait for it to be available rather than importing directly,
// since it's loaded as a classic script (not an ES module from CDN in this version).

const PDFJS_WORKER_SRC =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';

/**
 * Extract all text from a PDF File object.
 *
 * @param {File}     file            - The PDF File from an <input type="file"> or drop event
 * @param {function} [onProgress]    - Optional callback(currentPage, totalPages)
 * @returns {Promise<string>}        - Full extracted text, pages separated by double newlines
 * @throws {Error}                   - If pdf.js is unavailable or extraction fails
 */
export async function extractTextFromPDF(file, onProgress) {
  const pdfjsLib = await getPdfjsLib();

  // Convert File → ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();

  // Load PDF document
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  const totalPages = pdf.numPages;
  const pageTexts  = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    onProgress?.(pageNum, totalPages);

    const page        = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Join text items, preserving line breaks by checking vertical position shifts
    let lastY   = null;
    let lines   = [];
    let current = '';

    for (const item of textContent.items) {
      // item.transform[5] is the Y position on the page
      const y = item.transform?.[5] ?? 0;

      if (lastY !== null && Math.abs(y - lastY) > 5) {
        // New line detected
        if (current.trim()) lines.push(current.trim());
        current = '';
      }

      current += item.str;
      lastY = y;
    }

    if (current.trim()) lines.push(current.trim());

    pageTexts.push(lines.join('\n'));
  }

  // Join pages with clear separator
  const fullText = pageTexts
    .filter(t => t.trim().length > 0)
    .join('\n\n');

  if (!fullText.trim()) {
    throw new Error(
      'No extractable text found. This PDF may be scanned or image-based. ' +
      'Try running it through an OCR tool first, then paste the text.'
    );
  }

  return fullText;
}

/**
 * Get (or wait for) the pdfjsLib global loaded via CDN script tag.
 * Retries up to 3 seconds before throwing.
 *
 * @returns {Promise<object>} pdfjsLib
 */
async function getPdfjsLib() {
  // Dynamic import path for the CDN module version
  const pdfjs = await import(
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs'
  );

  // Configure the worker
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;

  return pdfjs;
}

/**
 * Format file size for display.
 * @param {number} bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
