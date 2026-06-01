// providers/anthropic.js
// -----------------------------------------------------------------------------
// Adapter for Anthropic's Messages API (https://api.anthropic.com/v1/messages).
//
// Anthropic is the cleanest provider for a pure-browser app: it officially
// supports cross-origin browser calls when you send the
// "anthropic-dangerous-direct-browser-access: true" header.
//
// Key differences from the OpenAI shape:
//   - Auth uses "x-api-key" (NOT "Authorization: Bearer").
//   - The system prompt is a TOP-LEVEL "system" field, not a message.
//   - "max_tokens" is REQUIRED.
//   - Streaming uses typed SSE events; text lives in content_block_delta events.
// -----------------------------------------------------------------------------

import { readSSE, buildHttpError } from "./sse.js";

/**
 * Send a chat request to Anthropic and stream the reply.
 *
 * @param {Object} options
 * @param {string} options.model - Model ID (e.g. "claude-opus-4-8").
 * @param {string} options.apiKey - The user's Anthropic API key.
 * @param {string} options.systemPrompt - System instructions (Scion's prompt).
 * @param {Array<{role: string, content: string}>} options.messages - Chat history
 *   using "user"/"assistant" roles (no system role — that goes in the system field).
 * @param {number} options.maxTokens - Required output-token ceiling.
 * @param {boolean} options.webSearch - Whether to enable Anthropic's server-side web search.
 * @param {(token: string) => void} options.onToken - Called for each streamed text delta.
 * @returns {Promise<string>} The full assistant text once the stream completes.
 */
export async function send({
  model,
  apiKey,
  systemPrompt,
  messages,
  maxTokens,
  webSearch,
  onToken,
}) {
  const url = "https://api.anthropic.com/v1/messages";

  // Build the request. The system prompt is separate from the messages.
  const body = {
    model,
    system: systemPrompt,
    messages,
    max_tokens: maxTokens,
    stream: true,
  };

  // Web search is a server-side tool Anthropic runs for us; just declare it.
  if (webSearch) {
    body.tools = [{ type: "web_search_20260209", name: "web_search" }];
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      // This header is what makes direct browser calls allowed.
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw await buildHttpError(response, "Anthropic");
  }

  // Anthropic streams typed events. We only need the text deltas, which arrive
  // as {"type":"content_block_delta","delta":{"type":"text_delta","text":"..."}}.
  let full = "";
  await readSSE(response, (data) => {
    try {
      const event = JSON.parse(data);
      if (
        event?.type === "content_block_delta" &&
        event?.delta?.type === "text_delta" &&
        typeof event.delta.text === "string"
      ) {
        full += event.delta.text;
        onToken(event.delta.text);
      }
    } catch {
      // Ignore anything that isn't a JSON event line.
    }
  });

  return full;
}
