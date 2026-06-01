// features/trace.js
// -----------------------------------------------------------------------------
// "CEI Learning Trace" capability. At the end of a conversation Scion produces a
// reflection (Phase 5). This module lets the user SAVE that reflection and later
// EXPORT all saved traces.
//
// Honest limitation: this is a static site with no backend, so there is no
// central place to aggregate traces across users. Saved traces live in this
// browser's localStorage only and can be exported as files for sharing.
// -----------------------------------------------------------------------------

// localStorage key under which the array of saved traces is stored.
const STORAGE_KEY = "scion.traces";

/**
 * Load all saved traces from localStorage.
 * @returns {Array<{savedAt: string, summary: string, reflection: string}>}
 */
export function getTraces() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    // If the stored value is somehow corrupt, start fresh rather than crash.
    return [];
  }
}

/**
 * Save a new Learning Trace.
 *
 * @param {Object} trace
 * @param {string} trace.summary - A short label for the idea discussed.
 * @param {string} trace.reflection - The Phase-5 reflection text to capture.
 * @param {string} trace.savedAt - An ISO timestamp supplied by the caller.
 *   (Passed in rather than generated here so the storage layer stays pure.)
 * @returns {Array} The full, updated list of traces.
 */
export function saveTrace({ summary, reflection, savedAt }) {
  const traces = getTraces();
  traces.push({ savedAt, summary, reflection });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(traces));
  return traces;
}

/** Delete every saved trace from this browser. */
export function clearTraces() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Export all saved traces as a single Markdown file download.
 */
export function exportTracesMarkdown() {
  const traces = getTraces();
  if (traces.length === 0) {
    alert("No Learning Traces have been saved yet.");
    return;
  }

  const lines = ["# Scion — CEI Learning Traces\n"];
  for (const trace of traces) {
    lines.push(`## ${trace.summary || "Untitled"} (${trace.savedAt})\n`);
    lines.push(`${trace.reflection}\n`);
  }
  downloadText("scion-learning-traces.md", lines.join("\n"), "text/markdown");
}

/**
 * Export all saved traces as a JSON file download (for machine processing or
 * later aggregation by hand).
 */
export function exportTracesJson() {
  const traces = getTraces();
  if (traces.length === 0) {
    alert("No Learning Traces have been saved yet.");
    return;
  }
  downloadText(
    "scion-learning-traces.json",
    JSON.stringify(traces, null, 2),
    "application/json"
  );
}

/**
 * Small local helper to trigger a file download (kept here so this module has no
 * dependency on the export.js module).
 *
 * @param {string} filename
 * @param {string} content
 * @param {string} mimeType
 */
function downloadText(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
