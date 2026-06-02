// app.js  (SCION v2 — phase-scoped)
// -----------------------------------------------------------------------------
// Bootstrap and event wiring. This is the "controller" that connects the UI
// (index.html elements), the persisted state (state.js), the provider adapters
// (providers/index.js), and the capability features (features/*).
//
// What's new in v2: the conversation moves through explicit STEPS. The system
// prompt for each turn is assembled as SCION_CORE + the CURRENT step's block
// (see config.js), instead of one giant prompt holding every step at once. The
// user advances steps with the stepper controls; advancing forward nudges Scion
// to open the new step.
// -----------------------------------------------------------------------------

import { SCION_CORE, PHASES, GREETING, PROVIDERS, DEFAULT_MAX_TOKENS } from "./config.js";
import * as state from "./state.js";
import * as ui from "./ui.js";
import { sendChat } from "./providers/index.js";
import { webSearchSupport } from "./features/websearch.js";
import * as documents from "./features/documents.js";
import * as exporter from "./features/export.js";
import * as trace from "./features/trace.js";

// ---- Grab all the DOM controls we need. -------------------------------------
const el = {
  providerSelect: document.getElementById("provider-select"),
  providerNote: document.getElementById("provider-note"),
  apiKey: document.getElementById("api-key"),
  rememberKey: document.getElementById("remember-key"),
  modelInput: document.getElementById("model-input"),

  toggleDocs: document.getElementById("toggle-docs"),
  toggleWebSearch: document.getElementById("toggle-websearch"),
  toggleTrace: document.getElementById("toggle-trace"),
  webSearchNote: document.getElementById("websearch-note"),

  docsArea: document.getElementById("docs-area"),
  docFile: document.getElementById("doc-file"),
  docList: document.getElementById("doc-list"),

  traceArea: document.getElementById("trace-area"),

  // Step navigation (new in v2).
  phaseStepper: document.getElementById("phase-stepper"),
  phaseBlurb: document.getElementById("phase-blurb"),
  btnPhaseBack: document.getElementById("btn-phase-back"),
  btnPhaseNext: document.getElementById("btn-phase-next"),

  btnNew: document.getElementById("btn-new"),
  btnExportOutput: document.getElementById("btn-export-output"),
  btnExportTranscript: document.getElementById("btn-export-transcript"),
  btnPrint: document.getElementById("btn-print"),
  btnSaveTrace: document.getElementById("btn-save-trace"),
  btnExportTraces: document.getElementById("btn-export-traces"),
  btnClearKey: document.getElementById("btn-clear-key"),
  btnClearAll: document.getElementById("btn-clear-all"),

  chatForm: document.getElementById("chat-form"),
  chatInput: document.getElementById("chat-input"),
  sendBtn: document.getElementById("send-btn"),
};

// Guard against double-sends while a response is streaming.
let isSending = false;

/**
 * Render the conversation, always showing Scion's fixed greeting first followed
 * by the real conversation turns held in state.messages (which may include
 * display-only "note" step dividers). The greeting is display-only and is never
 * sent to the model.
 */
function renderConversation() {
  // Hidden messages (e.g. the kickoff nudge sent when a step is opened) are kept
  // in history for the provider but never shown in the chat.
  const visible = state.state.messages.filter((m) => !m.hidden);
  ui.renderAll([{ role: "assistant", content: GREETING }, ...visible]);
}

/**
 * Reflect the current settings into the sidebar controls and provider-specific
 * notes (model default, browser-support warning, web-search availability).
 */
function syncSidebarToSettings() {
  const s = state.state.settings;

  el.providerSelect.value = s.provider;
  el.modelInput.value = s.model;
  el.apiKey.value = state.getCurrentKey();
  el.rememberKey.checked = s.rememberKey;
  el.toggleDocs.checked = s.docsEnabled;
  el.toggleWebSearch.checked = s.webSearchEnabled;
  el.toggleTrace.checked = s.traceEnabled;

  // Provider note (includes the OpenAI-direct fragility warning from config).
  const provider = PROVIDERS[s.provider];
  el.providerNote.textContent = provider ? provider.note : "";

  // Web search availability for this provider.
  const support = webSearchSupport(s.provider);
  el.webSearchNote.textContent = support.note;
  el.toggleWebSearch.disabled = !support.supported;
  if (!support.supported) {
    el.toggleWebSearch.checked = false;
    s.webSearchEnabled = false;
  }

  // Show/hide the document upload area and trace area based on toggles.
  el.docsArea.hidden = !s.docsEnabled;
  el.traceArea.hidden = !s.traceEnabled;
}

/**
 * Render the step stepper: one pill per step, with the current one highlighted
 * and earlier ones marked as done. Also updates the caption and enables/disables
 * the Back/Next buttons at the ends of the sequence.
 */
function renderStepper() {
  const current = state.state.currentPhase;

  el.phaseStepper.innerHTML = "";
  PHASES.forEach((phase, index) => {
    const pill = document.createElement("span");
    pill.className = "step-pill";
    if (index === current) pill.classList.add("step-current");
    if (index < current) pill.classList.add("step-done");
    pill.textContent = phase.short;
    el.phaseStepper.appendChild(pill);
  });

  // Caption describing the current step.
  el.phaseBlurb.textContent = PHASES[current].blurb;

  // Disable Back on the first step and Next on the last step.
  el.btnPhaseBack.disabled = current <= 0;
  el.btnPhaseNext.disabled = current >= PHASES.length - 1;
}

/**
 * Build the system prompt for this turn: Scion's always-on core, the CURRENT
 * step's instruction block, and a reference documents block if document
 * grounding is enabled and files are loaded.
 * @returns {string}
 */
function buildSystemPrompt() {
  const phase = PHASES[state.state.currentPhase];
  let systemPrompt = SCION_CORE + "\n\n" + phase.instructions;

  if (state.state.settings.docsEnabled) {
    const block = documents.buildContextBlock();
    if (block) {
      systemPrompt += "\n\n" + block;
    }
  }
  return systemPrompt;
}

/**
 * The conversation as the provider should see it: only real user/assistant turns
 * (display-only "note" step dividers are stripped, and each message reduced to
 * the plain {role, content} the adapters expect).
 * @returns {Array<{role: string, content: string}>}
 */
function conversationForProvider() {
  return state.state.messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: m.content }));
}

/**
 * Render the list of uploaded documents with remove buttons.
 */
function renderDocList() {
  const docs = documents.getDocuments();
  el.docList.innerHTML = "";
  docs.forEach((doc, index) => {
    const row = document.createElement("div");
    row.className = "doc-row";

    const name = document.createElement("span");
    name.textContent = doc.name;

    const remove = document.createElement("button");
    remove.textContent = "✕";
    remove.title = "Remove document";
    remove.addEventListener("click", () => {
      documents.removeDocument(index);
      renderDocList();
    });

    row.appendChild(name);
    row.appendChild(remove);
    el.docList.appendChild(row);
  });
}

/**
 * Stream one Scion reply into a fresh assistant bubble. Shared by normal user
 * sends and by step kickoffs.
 *
 * @param {{kickoff?: boolean}} [options] - When kickoff is true, a HIDDEN user
 *   turn ("I'm ready to move on…") is persisted so Scion has something to respond
 *   to and opens the new step. It is not displayed (renderConversation skips
 *   hidden messages), but it is kept in history so the stored conversation keeps
 *   valid user/assistant alternation for strict providers (e.g. Anthropic).
 */
async function streamScionReply({ kickoff = false } = {}) {
  // A key is required to talk to any provider.
  const apiKey = state.getCurrentKey();
  if (!apiKey) {
    ui.setStatus("Please paste an API key in the sidebar first.", "error");
    return;
  }

  // For a kickoff, record the (hidden) nudge before building the provider list.
  if (kickoff) {
    state.state.messages.push({
      role: "user",
      content: "(I'm ready to move on to this next step.)",
      hidden: true,
    });
    state.saveConversation();
  }

  // Build the message list for the provider (notes stripped; hidden turns kept).
  const providerMessages = conversationForProvider();

  // Create an empty assistant bubble to stream into.
  const contentEl = ui.appendMessage("assistant", "");
  let full = "";

  // Lock the UI while streaming.
  isSending = true;
  el.sendBtn.disabled = true;
  ui.setStatus("Scion is thinking…", "info");

  try {
    const support = webSearchSupport(state.state.settings.provider);
    full = await sendChat({
      provider: state.state.settings.provider,
      model: state.state.settings.model,
      apiKey,
      systemPrompt: buildSystemPrompt(),
      messages: providerMessages,
      maxTokens: DEFAULT_MAX_TOKENS,
      webSearch: state.state.settings.webSearchEnabled && support.supported,
      onToken: (token) => {
        full += token;
        ui.updateBubble(contentEl, full);
      },
    });

    // Persist the completed assistant turn.
    state.state.messages.push({ role: "assistant", content: full });
    state.saveConversation();
    ui.setStatus("", "info");
  } catch (error) {
    // Show a readable error in the bubble and the status line.
    ui.updateBubble(contentEl, `*(error)*\n\n${error.message}`);
    ui.setStatus(error.message, "error");
  } finally {
    isSending = false;
    el.sendBtn.disabled = false;
    el.chatInput.focus();
  }
}

/**
 * Handle the user submitting a chat message: validate, append, and stream the
 * reply via streamScionReply().
 *
 * @param {Event} event - The form submit event.
 */
async function handleSend(event) {
  event.preventDefault();
  if (isSending) return;

  const text = el.chatInput.value.trim();
  if (text.length === 0) return;

  // Record and show the user's message before we stream the reply.
  state.state.messages.push({ role: "user", content: text });
  ui.appendMessage("user", text);
  state.saveConversation();
  el.chatInput.value = "";

  await streamScionReply({ kickoff: false });
}

/**
 * Move to a different step. Forward moves drop a divider into the chat and nudge
 * Scion to open the new step; backward moves just rewind the step (so the user
 * can revisit) without generating a new reply.
 *
 * @param {number} direction - +1 to advance, -1 to go back.
 */
async function changePhase(direction) {
  if (isSending) return;

  const target = state.state.currentPhase + direction;
  // Stay within the valid range of steps.
  if (target < 0 || target > PHASES.length - 1) return;

  state.state.currentPhase = target;
  state.savePhase();

  // Drop a visible (display-only) divider marking the new step.
  const phase = PHASES[target];
  const divider = { role: "note", content: `${phase.short} — ${phase.blurb}` };
  state.state.messages.push(divider);
  ui.appendMessage("note", divider.content);
  state.saveConversation();

  renderStepper();

  // Going forward, ask Scion to open the new step. Going back, let the user lead.
  if (direction > 0) {
    await streamScionReply({ kickoff: true });
  }
}

/**
 * Save the most recent Scion message as a CEI Learning Trace. Prompts the user
 * for a short summary label and stamps it with the current time.
 */
function handleSaveTrace() {
  const lastAssistant = [...state.state.messages]
    .reverse()
    .find((m) => m.role === "assistant");

  if (!lastAssistant) {
    alert("There's no Scion reflection to save yet.");
    return;
  }

  const summary = prompt("Short label for this Learning Trace (e.g. the idea discussed):", "");
  // prompt() returns null if cancelled.
  if (summary === null) return;

  trace.saveTrace({
    summary: summary.trim(),
    reflection: lastAssistant.content,
    // Timestamp generated here in the browser (allowed in client JS).
    savedAt: new Date().toISOString(),
  });
  ui.setStatus("Learning Trace saved in this browser.", "info");
}

/**
 * Wire up every event listener once at startup.
 */
function attachEventListeners() {
  // Provider change: switch default model and refresh notes/keys.
  el.providerSelect.addEventListener("change", () => {
    const provider = el.providerSelect.value;
    state.state.settings.provider = provider;
    // Reset the model to that provider's default suggestion.
    state.state.settings.model = PROVIDERS[provider].defaultModel;
    state.saveSettings();
    syncSidebarToSettings();
  });

  // Model text field.
  el.modelInput.addEventListener("input", () => {
    state.state.settings.model = el.modelInput.value.trim();
    state.saveSettings();
  });

  // API key field (stored per provider; persisted only if "remember" is on).
  el.apiKey.addEventListener("input", () => {
    state.setCurrentKey(el.apiKey.value.trim());
  });

  // Remember-key checkbox.
  el.rememberKey.addEventListener("change", () => {
    state.state.settings.rememberKey = el.rememberKey.checked;
    state.saveSettings();
    state.saveKeys(); // writes or clears stored keys depending on the choice
  });

  // Capability toggles.
  el.toggleDocs.addEventListener("change", () => {
    state.state.settings.docsEnabled = el.toggleDocs.checked;
    state.saveSettings();
    syncSidebarToSettings();
  });
  el.toggleWebSearch.addEventListener("change", () => {
    state.state.settings.webSearchEnabled = el.toggleWebSearch.checked;
    state.saveSettings();
  });
  el.toggleTrace.addEventListener("change", () => {
    state.state.settings.traceEnabled = el.toggleTrace.checked;
    state.saveSettings();
    syncSidebarToSettings();
  });

  // Document upload.
  el.docFile.addEventListener("change", async () => {
    if (el.docFile.files.length === 0) return;
    ui.setStatus("Reading document(s)…", "info");
    await documents.addFiles(el.docFile.files);
    el.docFile.value = ""; // allow re-selecting the same file later
    renderDocList();
    ui.setStatus("", "info");
  });

  // Step navigation.
  el.btnPhaseBack.addEventListener("click", () => changePhase(-1));
  el.btnPhaseNext.addEventListener("click", () => changePhase(+1));

  // Action buttons.
  el.btnNew.addEventListener("click", () => {
    if (!confirm("Start a new conversation? The current one will be cleared.")) return;
    state.resetConversation();
    renderConversation();
    renderStepper();
    ui.setStatus("", "info");
  });
  el.btnExportOutput.addEventListener("click", () =>
    exporter.exportLatestOutput(state.state.messages)
  );
  el.btnExportTranscript.addEventListener("click", () =>
    exporter.exportTranscript(state.state.messages)
  );
  el.btnPrint.addEventListener("click", () => exporter.printToPdf());
  el.btnSaveTrace.addEventListener("click", handleSaveTrace);
  el.btnExportTraces.addEventListener("click", () => trace.exportTracesMarkdown());

  el.btnClearKey.addEventListener("click", () => {
    state.setCurrentKey("");
    el.apiKey.value = "";
    ui.setStatus("API key cleared for this provider.", "info");
  });
  el.btnClearAll.addEventListener("click", () => {
    if (!confirm("Erase ALL Scion data in this browser (settings, keys, conversation, traces)?")) {
      return;
    }
    state.clearAllStoredData();
    // Reload to start completely fresh.
    location.reload();
  });

  // Chat form submit.
  el.chatForm.addEventListener("submit", handleSend);

  // Enter sends; Shift+Enter makes a newline.
  el.chatInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      el.chatForm.requestSubmit();
    }
  });
}

/**
 * Application entry point: load saved state, render, and attach listeners.
 */
function init() {
  state.loadFromStorage();
  syncSidebarToSettings();
  renderConversation();
  renderStepper();
  renderDocList();
  attachEventListeners();
  ui.setStatus("", "info");
}

// Kick everything off.
init();
