// features/documents.js
// -----------------------------------------------------------------------------
// "Document grounding" capability. Lets the user upload reference files whose
// text is injected into the conversation so Scion can refer to them. Everything
// happens in the browser — no file ever leaves the user's machine except as part
// of the prompt sent to the chosen provider.
//
// Plain-text formats (.txt, .md, .csv, .json) are read directly. PDF support is
// optional and lazy-loads pdf.js from a CDN only if the user uploads a PDF, to
// keep the page light for the common case.
// -----------------------------------------------------------------------------

/**
 * A soft cap on how much document text we inject, to avoid blowing past model
 * context limits or running up cost. Roughly ~30k characters ≈ a few thousand
 * tokens. If the combined documents exceed this, we truncate and add a notice.
 * @type {number}
 */
const MAX_DOC_CHARS = 30000;

// In-memory store of uploaded documents for the current session.
// Each entry is { name: string, text: string }.
let uploadedDocuments = [];

/**
 * Read a single File object into plain text, choosing a strategy by file type.
 *
 * @param {File} file - A file from an <input type="file"> selection.
 * @returns {Promise<string>} The extracted text.
 */
async function readFileAsText(file) {
  const lowerName = file.name.toLowerCase();

  // PDFs need a parser; load pdf.js on demand.
  if (lowerName.endsWith(".pdf")) {
    return readPdf(file);
  }

  // Everything else we treat as UTF-8 text.
  return file.text();
}

/**
 * Extract text from a PDF using pdf.js, loaded lazily from a CDN the first time
 * it is needed. Returns the concatenated text of all pages.
 *
 * @param {File} file - A PDF file.
 * @returns {Promise<string>} The extracted text.
 */
async function readPdf(file) {
  // Dynamically import pdf.js (ES module build) only when actually needed.
  const pdfjs = await import(
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/build/pdf.min.mjs"
  );
  // pdf.js needs a worker; point it at the matching CDN worker file.
  pdfjs.GlobalWorkerOptions.workerSrc =
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/build/pdf.worker.min.mjs";

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

  let text = "";
  // Pages are 1-indexed in pdf.js.
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(" ");
    text += pageText + "\n\n";
  }
  return text;
}

/**
 * Add a list of selected files to the document store, reading each into text.
 *
 * @param {FileList|File[]} files - Files chosen by the user.
 * @returns {Promise<Array<{name: string, text: string}>>} The full document list.
 */
export async function addFiles(files) {
  for (const file of Array.from(files)) {
    try {
      const text = await readFileAsText(file);
      uploadedDocuments.push({ name: file.name, text });
    } catch (error) {
      // Surface a readable name so the UI can warn the user about this file.
      uploadedDocuments.push({
        name: file.name,
        text: `[Could not read this file: ${error.message}]`,
      });
    }
  }
  return getDocuments();
}

/**
 * Remove a document by index.
 * @param {number} index - Position in the document list.
 */
export function removeDocument(index) {
  uploadedDocuments.splice(index, 1);
}

/** Remove all uploaded documents. */
export function clearDocuments() {
  uploadedDocuments = [];
}

/**
 * Get the current list of uploaded documents (name + text).
 * @returns {Array<{name: string, text: string}>}
 */
export function getDocuments() {
  return uploadedDocuments.slice();
}

/**
 * Build a single "Reference documents" text block to prepend to the system
 * prompt when document grounding is enabled. Truncates if the combined text
 * exceeds the soft cap and appends a clear notice so nothing is hidden.
 *
 * @returns {string} The reference block, or "" if there are no documents.
 */
export function buildContextBlock() {
  if (uploadedDocuments.length === 0) return "";

  // Join all documents with clear headers so the model can tell them apart.
  let combined = uploadedDocuments
    .map((doc) => `--- Document: ${doc.name} ---\n${doc.text}`)
    .join("\n\n");

  // Enforce the soft cap and tell the model (and user) if we cut anything.
  let truncationNotice = "";
  if (combined.length > MAX_DOC_CHARS) {
    combined = combined.slice(0, MAX_DOC_CHARS);
    truncationNotice =
      "\n\n[Note: the reference documents were truncated to fit the context limit.]";
  }

  return (
    "The user has provided the following reference documents. " +
    "Use them as background context where relevant.\n\n" +
    combined +
    truncationNotice
  );
}
