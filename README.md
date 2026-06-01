# Scion — CEI Prototype Design Agent

A single-page, browser-only chatbot that hosts **Scion**, a strategic thinking
partner for IB staff and regional leaders. Scion guides a user through five
conversational phases and helps them produce either a **Prototype Proposal** or a
**Discovery Plan**, plus a short **CEI Learning Trace** reflection.

This is an **internal prototype**. The page is "live" but does nothing useful
without an API key — each user pastes their own key into the sidebar.

## How it works (the important bit)

GitHub Pages is **static** — there is no backend server. Everything runs in the
browser:

- You paste an API key in the left sidebar. It is stored **only in your browser**
  and is sent **directly** to the provider you choose (OpenAI, Anthropic, Gemini,
  or OpenRouter). It never passes through a server we control, because there isn't
  one.
- No login, no accounts, no central key.

### Supported providers

| Provider | Browser support | Notes |
|----------|----------------|-------|
| **Anthropic (Claude)** | ✅ Clean | The most reliable choice for this app. |
| **OpenRouter** | ✅ Clean | One key for OpenAI / Claude / Gemini models. Best web search. |
| **Google Gemini** | ✅ Clean | Use a Google AI Studio key. |
| **OpenAI (direct)** | ⚠️ Fragile | Browser calls to OpenAI often fail (CORS). If it doesn't work, select **OpenRouter** and use an OpenAI model slug there instead. |

### Capabilities (sidebar toggles)

- **Document grounding** — upload `.txt`, `.md`, `.csv`, `.json` (and optionally
  `.pdf`) files; their text is added as background context for Scion. Done
  entirely in your browser.
- **Web search** — live search for providers that support it from the browser
  (OpenRouter, Gemini, Anthropic). Not available on OpenAI-direct.
- **Export** — download the latest output or full transcript as Markdown, or use
  **Print / Save as PDF**.
- **Learning Trace capture** — save Scion's Phase-5 reflection. Because the site
  is static with no backend, traces are stored in your browser and can be
  exported as files (no central aggregation).

## Running it locally

ES modules require `http://` (not opening the file directly), so serve the folder:

```bash
# from the project root
python -m http.server 8000
# then open http://localhost:8000 in a browser
```

## Deploying to GitHub Pages

1. Push the repo to GitHub (already wired to `trgallagher-research`).
2. In the repo: **Settings → Pages → Build and deployment → Deploy from a branch**,
   choose branch `main`, folder `/ (root)`, and save.
3. After a minute the site is live at
   `https://trgallagher-research.github.io/innovation-SCION/`.

## Security notes

- **No secrets are committed.** API keys are entered at runtime and live only in
  your browser. `.gitignore` already excludes `.env`, `*.key`, `*.pem`, etc.
- If you tick **"Remember key in this browser"**, the key is stored in
  `localStorage` in plain text on your own machine. Leave it unticked on shared
  computers. **Clear key** and **Clear all stored data** remove it.
- Since the page is public, treat the repo as internal-trust: only people who can
  edit it should be able to change what the page does with keys.

## Project structure

```
index.html              Page layout (sidebar + chat), loads CDN libs + app.js
styles.css              Styling, including print CSS for PDF export
js/
  config.js             Scion system prompt, greeting, default model IDs
  state.js              Settings + conversation, localStorage persistence
  ui.js                 Renders messages (Markdown) and the status line
  app.js                Wires the UI to state, providers, and features
  providers/
    index.js            Routes a request to the right provider adapter
    openai.js           OpenAI + OpenRouter (shared OpenAI-compatible shape)
    anthropic.js        Anthropic Messages API (browser header, top-level system)
    gemini.js           Gemini generateContent (systemInstruction, alt=sse)
    sse.js              Shared Server-Sent Events stream reader
  features/
    documents.js        Upload + inject reference documents
    websearch.js        Per-provider web-search availability
    export.js           Markdown export + print-to-PDF
    trace.js            Save/export CEI Learning Traces
```

## Status / limitations (v1)

- No backend or proxy, so OpenAI-direct is best-effort (use OpenRouter if it fails).
- No central database of Learning Traces — export and share manually.
- No authentication or multi-user history.
