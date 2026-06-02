// providers/gemini.js
// -----------------------------------------------------------------------------
// Adapter for Google's Gemini (Generative Language API).
//
// Endpoint pattern:
//   POST https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse
//
// Key differences from the OpenAI shape:
//   - Auth uses the "x-goog-api-key" header (keeps the key out of the URL).
//   - The system prompt goes in a top-level "systemInstruction" field.
//   - Conversation turns use "contents" with roles "user" and "model"
//     (Gemini calls the assistant role "model", not "assistant").
//   - "?alt=sse" is required to get clean SSE instead of a JSON array stream.
//   - Web search grounding is enabled with the "google_search" tool.
// -----------------------------------------------------------------------------

import { readSSE, buildHttpError } from "./sse.js";

/**
 * Convert our internal message list (user/assistant) into Gemini's "contents"
 * format (user/model with a parts array).
 *
 * @param {Array<{role: string, content: string}>} messages
 * @returns {Array<{role: string, parts: Array<{text: string}>}>}
 */
function toGeminiContents(messages) {
  return messages.map((message) => ({
    // Gemini uses "model" where the rest of the world uses "assistant".
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));
}

/**
 * Send a chat request to Gemini and stream the reply.
 *
 * @param {Object} options
 * @param {string} options.model - Model ID (e.g. "gemini-2.5-pro").
 * @param {string} options.apiKey - The user's Google AI Studio API key.
 * @param {string} options.systemPrompt - System instructions (Scion's prompt).
 * @param {Array<{role: string, content: string}>} options.messages - Chat history.
 * @param {number} options.maxTokens - Output-token ceiling (maxOutputTokens).
 * @param {boolean} options.webSearch - Whether to enable Google Search grounding.
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
  // The model ID is part of the path. encodeURIComponent guards odd characters.
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;

  // Build the request body in Gemini's shape.
  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: toGeminiContents(messages),
    generationConfig: { maxOutputTokens: maxTokens },
  };

  // Google Search grounding is a declared tool; the model decides when to use it.
  if (webSearch) {
    body.tools = [{ google_search: {} }];
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw await buildHttpError(response, "Gemini");
  }

  // Each SSE "data:" payload is a GenerateContentResponse. Text deltas live at
  // candidates[0].content.parts[*].text (there can be more than one part).
  let full = "";
  await readSSE(response, (data) => {
    if (data === "[DONE]") return;
    try {
      const chunk = JSON.parse(data);
      const parts = chunk?.candidates?.[0]?.content?.parts;
      if (Array.isArray(parts)) {
        for (const part of parts) {
          if (typeof part?.text === "string" && part.text.length > 0) {
            full += part.text;
            onToken(part.text);
          }
        }
      }
    } catch {
      // Ignore non-JSON lines.
    }
  });

  return full;
}
