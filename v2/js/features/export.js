// features/export.js
// -----------------------------------------------------------------------------
// "Export" capability. Lets the user download Scion's output as a Markdown file
// or save it as a PDF via the browser's print dialog (zero external libraries).
//
// Two export targets:
//   - exportLatestOutput(): the most recent assistant message (typically the
//     Prototype Proposal or Discovery Plan).
//   - exportTranscript(): the whole conversation.
// -----------------------------------------------------------------------------

/**
 * Trigger a browser download of a text string as a file.
 *
 * @param {string} filename - Suggested file name (e.g. "scion-proposal.md").
 * @param {string} content - The file contents.
 * @param {string} mimeType - MIME type (e.g. "text/markdown").
 */
function downloadTextFile(filename, content, mimeType) {
  // Wrap the text in a Blob and create a temporary object URL to download it.
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  // A hidden <a> click is the standard way to start a download from JS.
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Release the object URL so we don't leak memory.
  URL.revokeObjectURL(url);
}

/**
 * Export the most recent assistant message as a Markdown file.
 *
 * @param {Array<{role: string, content: string}>} messages - The conversation.
 */
export function exportLatestOutput(messages) {
  // Walk backwards to find the last assistant message.
  const lastAssistant = [...messages]
    .reverse()
    .find((message) => message.role === "assistant");

  if (!lastAssistant) {
    alert("There's no Scion output to export yet.");
    return;
  }

  const header = "# Scion output\n\n";
  downloadTextFile("scion-output.md", header + lastAssistant.content, "text/markdown");
}

/**
 * Export the entire conversation as a Markdown transcript.
 *
 * @param {Array<{role: string, content: string}>} messages - The conversation.
 */
export function exportTranscript(messages) {
  if (messages.length === 0) {
    alert("There's nothing to export yet.");
    return;
  }

  // Render each turn with a clear speaker label. "note" entries are step
  // dividers (v2) and are rendered as a horizontal rule with the step label.
  const lines = ["# Scion conversation transcript\n"];
  for (const message of messages) {
    // Skip hidden control turns (e.g. the kickoff nudge sent when opening a step).
    if (message.hidden) continue;
    if (message.role === "note") {
      lines.push(`---\n\n_${message.content}_\n`);
      continue;
    }
    const speaker = message.role === "assistant" ? "Scion" : "You";
    lines.push(`## ${speaker}\n\n${message.content}\n`);
  }
  downloadTextFile("scion-transcript.md", lines.join("\n"), "text/markdown");
}

/**
 * Open the browser's print dialog so the user can "Save as PDF". The page's
 * print CSS (in styles.css) hides the sidebar and input bar so only the
 * conversation prints. No external PDF library is required.
 */
export function printToPdf() {
  window.print();
}
