// providers/sse.js
// -----------------------------------------------------------------------------
// Small helper for reading a Server-Sent Events (SSE) stream from a fetch
// Response. All four providers stream their responses as SSE, so this avoids
// repeating the byte-decoding and line-buffering logic in every adapter.
// -----------------------------------------------------------------------------

/**
 * Read an SSE response body and invoke a callback for each "data:" payload.
 *
 * It buffers partial chunks so that an event split across two network reads is
 * reassembled correctly, then hands each complete data payload (the text after
 * "data:") to the provided callback.
 *
 * @param {Response} response - The fetch Response whose body is an SSE stream.
 * @param {(data: string) => void} onData - Called once per SSE "data:" payload.
 *   The string "[DONE]" is passed through unchanged so callers can detect the end.
 * @returns {Promise<void>} Resolves when the stream is fully consumed.
 */
export async function readSSE(response, onData) {
  // Get a streaming reader over the raw response bytes.
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  // Read chunks until the stream ends.
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    // Add the newly decoded text to whatever was left over from last time.
    buffer += decoder.decode(value, { stream: true });

    // SSE events are separated by blank lines; lines within an event start with
    // a field name like "data:". We split on newlines and process complete lines,
    // keeping the last (possibly partial) line in the buffer.
    const lines = buffer.split("\n");
    buffer = lines.pop(); // last element may be an incomplete line

    for (const rawLine of lines) {
      const line = rawLine.trim();
      // We only care about "data:" lines; ignore comments, "event:" lines, etc.
      if (!line.startsWith("data:")) continue;
      const data = line.slice("data:".length).trim();
      if (data.length === 0) continue;
      onData(data);
    }
  }

  // Flush any trailing complete "data:" line left in the buffer.
  const tail = buffer.trim();
  if (tail.startsWith("data:")) {
    const data = tail.slice("data:".length).trim();
    if (data.length > 0) onData(data);
  }
}

/**
 * Build a friendly Error from a failed (non-2xx) provider response.
 * Tries to pull a useful message out of the provider's JSON error body.
 *
 * @param {Response} response - The failed fetch Response.
 * @param {string} providerLabel - Human-readable provider name for the message.
 * @returns {Promise<Error>} An Error with a plain-language message.
 */
export async function buildHttpError(response, providerLabel) {
  let detail = "";
  try {
    const text = await response.text();
    try {
      // Most providers return { error: { message } } or similar.
      const parsed = JSON.parse(text);
      detail = parsed?.error?.message || parsed?.message || text;
    } catch {
      detail = text;
    }
  } catch {
    detail = "(no response body)";
  }

  // A couple of common, actionable hints.
  let hint = "";
  if (response.status === 401 || response.status === 403) {
    hint = " — check that your API key is correct and has access to this model.";
  } else if (response.status === 404) {
    hint = " — the model ID may be wrong for this provider.";
  } else if (response.status === 429) {
    hint = " — rate limit or quota reached; wait a moment or check your plan.";
  }

  return new Error(
    `${providerLabel} request failed (HTTP ${response.status})${hint}\n${detail}`.trim()
  );
}
