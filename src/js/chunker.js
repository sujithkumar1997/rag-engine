/**
 * chunker.js
 * -------------------------------------------------
 * Text chunking strategies for the RAG pipeline.
 * Supports: paragraph-based, sentence-based, fixed-size.
 */

/**
 * Split text into chunks using the selected strategy.
 *
 * @param {string} text       - Raw document text
 * @param {string} strategy   - 'paragraph' | 'sentence' | 'fixed'
 * @param {number} size       - Target chunk size in words
 * @returns {string[]}        - Array of text chunks
 */
export function chunkText(text, strategy, size) {
  text = text.trim();
  if (!text) return [];

  switch (strategy) {
    case 'paragraph': return chunkByParagraph(text, size);
    case 'sentence':  return chunkBySentence(text, size);
    case 'fixed':
    default:          return chunkByFixed(text, size);
  }
}

/**
 * Split by double newlines (paragraphs), then sub-split large paragraphs.
 */
function chunkByParagraph(text, size) {
  const paras = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const result = [];

  for (const para of paras) {
    const words = para.split(/\s+/);
    if (words.length <= size * 1.5) {
      result.push(para);
    } else {
      // Paragraph too large — split by fixed size
      for (let i = 0; i < words.length; i += size) {
        result.push(words.slice(i, i + size).join(' '));
      }
    }
  }

  return result;
}

/**
 * Group sentences until the target word count is reached.
 */
function chunkBySentence(text, size) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const result = [];
  let buffer = [];
  let count = 0;

  for (const sentence of sentences) {
    const wordCount = sentence.split(/\s+/).length;
    if (count + wordCount > size && buffer.length) {
      result.push(buffer.join(' ').trim());
      buffer = [];
      count = 0;
    }
    buffer.push(sentence.trim());
    count += wordCount;
  }

  if (buffer.length) result.push(buffer.join(' ').trim());
  return result;
}

/**
 * Slide a fixed-size window over the word list.
 */
function chunkByFixed(text, size) {
  const words = text.split(/\s+/);
  const result = [];

  for (let i = 0; i < words.length; i += size) {
    result.push(words.slice(i, i + size).join(' '));
  }

  return result;
}
