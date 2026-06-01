// ui.js
// -----------------------------------------------------------------------------
// All DOM rendering for the chat pane and status indicator. This module knows
// how to turn message text into safe HTML (Markdown via the global `marked`,
// sanitised with the global `DOMPurify`, both loaded from CDN in index.html) and
// how to append/update message bubbles as tokens stream in.
//
// It intentionally does NOT know about providers or state — app.js wires those
// together and calls into here.
// -----------------------------------------------------------------------------

// Cache the key DOM elements once.
const messagesEl = document.getElementById("messages");
const statusEl = document.getElementById("status");

/**
 * Convert Markdown text to sanitised HTML for safe rendering.
 * Uses the globally loaded `marked` and `DOMPurify` libraries. If for some
 * reason they failed to load, fall back to plain escaped text.
 *
 * @param {string} text - Markdown source.
 * @returns {string} Safe HTML.
 */
function renderMarkdown(text) {
  if (window.marked && window.DOMPurify) {
    const rawHtml = window.marked.parse(text);
    return window.DOMPurify.sanitize(rawHtml);
  }
  // Fallback: escape and preserve line breaks.
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped.replace(/\n/g, "<br>");
}

/**
 * Append a new message bubble to the chat pane.
 *
 * @param {"user"|"assistant"} role - Who is speaking.
 * @param {string} text - The (initial) message text. May be "" for a streaming
 *   assistant message that will be filled in via updateBubble().
 * @returns {HTMLElement} The bubble's content element, so the caller can update
 *   it as more tokens arrive.
 */
export function appendMessage(role, text) {
  // Wrapper carries the role class for styling (left/right, colours).
  const wrapper = document.createElement("div");
  wrapper.className = `message message-${role}`;

  const label = document.createElement("div");
  label.className = "message-label";
  label.textContent = role === "assistant" ? "Scion" : "You";

  const content = document.createElement("div");
  content.className = "message-content";
  content.innerHTML = renderMarkdown(text);

  wrapper.appendChild(label);
  wrapper.appendChild(content);
  messagesEl.appendChild(wrapper);

  scrollToBottom();
  return content;
}

/**
 * Replace the rendered content of an existing bubble (used while streaming).
 *
 * @param {HTMLElement} contentEl - The element returned by appendMessage().
 * @param {string} fullText - The full text so far.
 */
export function updateBubble(contentEl, fullText) {
  contentEl.innerHTML = renderMarkdown(fullText);
  scrollToBottom();
}

/**
 * Render an entire message list from scratch (used on page load to restore a
 * saved conversation).
 *
 * @param {Array<{role: string, content: string}>} messages
 */
export function renderAll(messages) {
  messagesEl.innerHTML = "";
  for (const message of messages) {
    appendMessage(message.role, message.content);
  }
}

/**
 * Show a status message below/above the input (idle, streaming, or error).
 *
 * @param {string} text - The message to show (empty string clears it).
 * @param {"info"|"error"} [kind="info"] - Controls styling.
 */
export function setStatus(text, kind = "info") {
  statusEl.textContent = text;
  statusEl.className = `status status-${kind}`;
}

/** Scroll the chat pane to the most recent message. */
function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
