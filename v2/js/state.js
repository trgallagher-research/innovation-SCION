// state.js
// -----------------------------------------------------------------------------
// Application state plus localStorage persistence. Holds the current settings
// (provider, model, toggles, optionally the API key) and the conversation
// messages. Provides simple load/save/clear helpers so the rest of the app
// doesn't touch localStorage directly.
//
// Security note: if the user opts to "remember" their key, it is stored in
// localStorage in plain text. This is acceptable for an internal prototype where
// each user supplies their own key on their own machine, and is documented in
// the README. Otherwise the key is held only in memory for the session.
// -----------------------------------------------------------------------------

import { PROVIDERS } from "./config.js";

// localStorage keys.
const SETTINGS_KEY = "scion.settings";
const CONVERSATION_KEY = "scion.conversation";
const PHASE_KEY = "scion.phase"; // which step (0-based index into PHASES)
const KEYS_KEY = "scion.apiKeys"; // only written when "remember" is on

/**
 * The live application state. Mutated in place by the helpers below and by app.js.
 * @type {{
 *   settings: {
 *     provider: string,
 *     model: string,
 *     rememberKey: boolean,
 *     docsEnabled: boolean,
 *     webSearchEnabled: boolean,
 *     traceEnabled: boolean
 *   },
 *   apiKeys: Object<string, string>,
 *   messages: Array<{role: string, content: string}>
 * }}
 */
export const state = {
  settings: {
    provider: "anthropic",
    model: PROVIDERS.anthropic.defaultModel,
    rememberKey: false,
    docsEnabled: false,
    webSearchEnabled: false,
    traceEnabled: false,
  },
  // API keys are stored per-provider so switching providers keeps each key.
  apiKeys: {},
  messages: [],
  // Which step the conversation is currently on (index into config.PHASES).
  // 0 = Orientation. Persisted so a reloaded conversation resumes on its step.
  currentPhase: 0,
};

/**
 * Get the API key for the currently selected provider (or "" if none set).
 * @returns {string}
 */
export function getCurrentKey() {
  return state.apiKeys[state.settings.provider] || "";
}

/**
 * Set the API key for the currently selected provider and persist if remembering.
 * @param {string} key
 */
export function setCurrentKey(key) {
  state.apiKeys[state.settings.provider] = key;
  saveKeys();
}

/**
 * Load settings, remembered keys, and any saved conversation from localStorage
 * into the live state object. Safe to call once at startup.
 */
export function loadFromStorage() {
  // Settings.
  try {
    const rawSettings = localStorage.getItem(SETTINGS_KEY);
    if (rawSettings) {
      Object.assign(state.settings, JSON.parse(rawSettings));
    }
  } catch {
    // Ignore corrupt settings and keep the defaults.
  }

  // Remembered API keys (only present if the user previously opted in).
  try {
    const rawKeys = localStorage.getItem(KEYS_KEY);
    if (rawKeys) {
      state.apiKeys = JSON.parse(rawKeys);
    }
  } catch {
    state.apiKeys = {};
  }

  // Conversation.
  try {
    const rawConvo = localStorage.getItem(CONVERSATION_KEY);
    if (rawConvo) {
      state.messages = JSON.parse(rawConvo);
    }
  } catch {
    state.messages = [];
  }

  // Current step. Falls back to 0 (Orientation) if missing or corrupt.
  try {
    const rawPhase = localStorage.getItem(PHASE_KEY);
    if (rawPhase !== null) {
      const parsed = parseInt(rawPhase, 10);
      if (!Number.isNaN(parsed)) {
        state.currentPhase = parsed;
      }
    }
  } catch {
    state.currentPhase = 0;
  }
}

/** Persist the current settings to localStorage. */
export function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}

/**
 * Persist API keys only if the user has chosen to remember them; otherwise make
 * sure no key is left behind in storage.
 */
export function saveKeys() {
  if (state.settings.rememberKey) {
    localStorage.setItem(KEYS_KEY, JSON.stringify(state.apiKeys));
  } else {
    localStorage.removeItem(KEYS_KEY);
  }
}

/** Persist the current conversation to localStorage. */
export function saveConversation() {
  localStorage.setItem(CONVERSATION_KEY, JSON.stringify(state.messages));
}

/** Persist the current step index to localStorage. */
export function savePhase() {
  localStorage.setItem(PHASE_KEY, String(state.currentPhase));
}

/**
 * Start a new conversation: clear messages and reset to the first step, in both
 * memory and storage.
 */
export function resetConversation() {
  state.messages = [];
  state.currentPhase = 0;
  localStorage.removeItem(CONVERSATION_KEY);
  localStorage.removeItem(PHASE_KEY);
}

/**
 * Wipe ALL Scion data from this browser: settings, keys, conversation, and
 * saved Learning Traces. Used by the "Clear all stored data" button.
 */
export function clearAllStoredData() {
  localStorage.removeItem(SETTINGS_KEY);
  localStorage.removeItem(KEYS_KEY);
  localStorage.removeItem(CONVERSATION_KEY);
  localStorage.removeItem(PHASE_KEY);
  localStorage.removeItem("scion.traces");
}
