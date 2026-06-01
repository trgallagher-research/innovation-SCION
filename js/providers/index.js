// providers/index.js
// -----------------------------------------------------------------------------
// Provider registry and dispatcher. The rest of the app calls a single function,
// sendChat(), and this module routes the request to the right adapter based on
// the selected provider. This keeps provider-specific quirks out of the UI code.
// -----------------------------------------------------------------------------

import * as openai from "./openai.js";
import * as anthropic from "./anthropic.js";
import * as gemini from "./gemini.js";

/**
 * Send a chat request to whichever provider the user selected and stream the
 * reply token-by-token. All adapters share the same option shape and return the
 * full assistant text.
 *
 * @param {Object} options
 * @param {"anthropic"|"openrouter"|"gemini"|"openai"} options.provider
 * @param {string} options.model
 * @param {string} options.apiKey
 * @param {string} options.systemPrompt
 * @param {Array<{role: string, content: string}>} options.messages
 * @param {number} options.maxTokens
 * @param {boolean} options.webSearch
 * @param {(token: string) => void} options.onToken
 * @returns {Promise<string>} The full assistant reply text.
 */
export async function sendChat(options) {
  switch (options.provider) {
    case "anthropic":
      return anthropic.send(options);
    case "gemini":
      return gemini.send(options);
    case "openai":
    case "openrouter":
      // Both use the OpenAI-compatible adapter; it branches on provider internally.
      return openai.send(options);
    default:
      throw new Error(`Unknown provider: ${options.provider}`);
  }
}
