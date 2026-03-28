/**
 * api.js
 * -------------------------------------------------
 * Thin wrapper around the Anthropic Messages API.
 * Supports streaming responses via Server-Sent Events.
 *
 * NOTE: This calls the Anthropic API directly from the browser.
 * For production deployments, proxy requests through your own
 * backend to keep the API key secret.
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL             = 'claude-sonnet-4-20250514';
const MAX_TOKENS        = 1000;

const SYSTEM_PROMPT = `You are a precise question-answering assistant.
Answer the user's question using ONLY the provided context chunks.
If the answer isn't present in the context, say so clearly.
Be concise, accurate, and cite which chunk supports your answer when relevant.`;

/**
 * Send a RAG query to the Anthropic API and stream the response.
 *
 * @param {object}   opts
 * @param {string}   opts.apiKey          - Anthropic API key (sk-ant-...)
 * @param {string}   opts.query           - User's question
 * @param {string[]} opts.contextChunks   - Retrieved text chunks used as grounding context
 * @param {function} opts.onToken         - Called with each streamed text delta
 * @param {function} [opts.onDone]        - Called when streaming completes
 * @param {function} [opts.onError]       - Called on error with an Error object
 */
export async function streamRagAnswer({ apiKey, query, contextChunks, onToken, onDone, onError }) {
  const context = contextChunks
    .map((text, n) => `[Chunk ${n + 1}]:\n${text}`)
    .join('\n\n');

  const body = {
    model:      MODEL,
    max_tokens: MAX_TOKENS,
    stream:     true,
    system:     SYSTEM_PROMPT,
    messages: [{
      role:    'user',
      content: `Context:\n${context}\n\nQuestion: ${query}`,
    }],
  };

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method:  'POST',
      headers: {
        'Content-Type':         'application/json',
        'x-api-key':            apiKey,
        'anthropic-version':    '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${response.status}`);
    }

    const reader  = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;

        try {
          const event = JSON.parse(data);
          if (event.type === 'content_block_delta' && event.delta?.text) {
            onToken(event.delta.text);
          }
        } catch {
          // Ignore malformed SSE frames
        }
      }
    }

    onDone?.();
  } catch (err) {
    onError?.(err);
  }
}
