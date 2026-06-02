// features/websearch.js
// -----------------------------------------------------------------------------
// "Web search" capability helper. The actual wiring of web search into each
// provider's request lives inside the provider adapters (they each enable it
// differently). This module just answers two UI questions:
//   1. Is web search even supported for the selected provider in a browser?
//   2. What note should we show the user about it?
//
// Keeping this logic here lets the sidebar grey out / annotate the toggle
// without the UI needing to know provider-specific details.
// -----------------------------------------------------------------------------

/**
 * Describes whether and how web search works for a given provider from the browser.
 *
 * @param {"anthropic"|"openrouter"|"gemini"|"openai"} provider
 * @returns {{supported: boolean, note: string}}
 *   supported: whether the toggle should be enabled for this provider.
 *   note: a short plain-language explanation to show in the UI.
 */
export function webSearchSupport(provider) {
  switch (provider) {
    case "openrouter":
      return {
        supported: true,
        note: "Live web search via OpenRouter's web plugin (adds a small per-search cost).",
      };
    case "gemini":
      return {
        supported: true,
        note: "Live web search via Google Search grounding.",
      };
    case "anthropic":
      return {
        supported: true,
        note: "Live web search via Anthropic's server-side search tool.",
      };
    case "openai":
      return {
        supported: false,
        note: "OpenAI direct doesn't support web search here — use OpenRouter for search.",
      };
    default:
      return { supported: false, note: "" };
  }
}
