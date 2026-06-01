// providers/openai.js
// -----------------------------------------------------------------------------
// Adapter for OpenAI-compatible chat APIs. This single module covers BOTH:
//   - OpenAI direct  (https://api.openai.com/v1/chat/completions)
//   - OpenRouter     (https://openrouter.ai/api/v1/chat/completions)
// because they share the same request/response shape.
//
// NOTE on OpenAI direct: browser calls to api.openai.com frequently fail CORS.
// We send only standard headers (no SDK headers) to give it the best chance,
// but if it fails the user should switch the provider to OpenRouter.
// -----------------------------------------------------------------------------

import { readSSE, buildHttpError } from "./sse.js";

/**
 * Send a chat request to an OpenAI-compatible endpoint and stream the reply.
 *
 * @param {Object} options
 * @param {"openai"|"openrouter"} options.provider - Which compatible backend.
 * @param {string} options.model - Model ID (e.g. "gpt-5.4" or "anthropic/claude-opus-4-8").
 * @param {string} options.apiKey - The user's API key for this provider.
 * @param {string} options.systemPrompt - System instructions (Scion's prompt).
 * @param {Array<{role: string, content: string}>} options.messages - Chat history.
 * @param {number} options.maxTokens - Generous output-token ceiling.
 * @param {boolean} options.webSearch - Whether to enable live web search.
 * @param {(token: string) => void} options.onToken - Called for each streamed text delta.
 * @returns {Promise<string>} The full assistant text once the stream completes.
 */
export async function send({
  provider,
  model,
  apiKey,
  systemPrompt,
  messages,
  maxTokens,
  webSearch,
  onToken,
}) {
  // Pick the endpoint and label based on which compatible backend we're using.
  const isOpenRouter = provider === "openrouter";
  const url = isOpenRouter
    ? "https://openrouter.ai/api/v1/chat/completions"
    : "https://api.openai.com/v1/chat/completions";
  const label = isOpenRouter ? "OpenRouter" : "OpenAI";

  // Build the message list: a leading system message, then the conversation.
  const requestMessages = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];

  // Base request body shared by both backends.
  const body = {
    model,
    messages: requestMessages,
    max_tokens: maxTokens,
    stream: true,
  };

  // Web search: OpenRouter supports a clean "web" plugin. OpenAI's Chat
  // Completions endpoint has no first-class web search, so we only enable it
  // for OpenRouter and otherwise leave the request unchanged.
  if (webSearch && isOpenRouter) {
    body.plugins = [{ id: "web" }];
  }

  // Standard headers only. We deliberately avoid any SDK-specific headers,
  // which is what tends to trip OpenAI's CORS preflight in the browser.
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  // OpenRouter likes (optionally) knowing which app is calling.
  if (isOpenRouter) {
    headers["X-Title"] = "Scion";
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw await buildHttpError(response, label);
  }

  // Parse the SSE stream. Each "data:" payload is a JSON chunk whose
  // choices[0].delta.content holds the next piece of text.
  let full = "";
  await readSSE(response, (data) => {
    if (data === "[DONE]") return;
    try {
      const chunk = JSON.parse(data);
      const delta = chunk?.choices?.[0]?.delta?.content;
      if (typeof delta === "string" && delta.length > 0) {
        full += delta;
        onToken(delta);
      }
    } catch {
      // Ignore non-JSON keep-alive lines.
    }
  });

  return full;
}
