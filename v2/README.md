# Scion v2 — phase-scoped prototype

This is an experimental rebuild of Scion that keeps **all** of v1's rich,
IB-specific content but changes **how** it is delivered to the model.

## What changed from v1

**v1:** one large "Agent Instructions" prompt (every phase, both output
templates, all the pattern lists) was sent on *every* turn. The model had to hold
the whole five-phase journey in its head at once, which made it easy to drift or
race ahead to a proposal.

**v2:** the same content is split into two parts (see `js/config.js`):

1. **`SCION_CORE`** — a short, always-on foundation: identity, the four values,
   who Scion is talking to, tone, and the behavioural meta-rules (one question at
   a time, don't name tensions, treat patterns as hypotheses). Sent every turn.
2. **`PHASES`** — one self-contained instruction block per step. Only the
   **current** step's block is added to the system prompt.

So on any given turn the model sees *"you are in **this** step — do **this**"*
plus the core, instead of the entire journey. This is the trade you asked about:
**modular, not generic.** The specific IB content (credential drift, scale
without depth, the two output templates, etc.) is fully preserved — it's just
scoped to the step where it matters.

## The stepped experience

- A **step bar** at the top of the chat shows the five steps (Orient → Sense →
  Develop → Pathway → Trace), highlights the current one, and marks completed
  ones.
- **Next step ›** / **‹ Back** move between steps. Moving forward drops a small
  divider into the chat and nudges Scion to open the new step with one question;
  moving back just rewinds so you can revisit, and lets you lead.
- The current step is persisted, so reloading resumes where you were.

## Everything else is unchanged

Providers (Anthropic / OpenRouter / Gemini / OpenAI), document grounding, web
search, Learning Trace capture, and Markdown / PDF export all work exactly as in
v1. The only behavioural differences are the per-step prompting and the step
navigation. (One small bump: `DEFAULT_MAX_TOKENS` is raised to 16384 so reasoning
models have room for hidden reasoning plus a visible answer.)

## Running it

Same as v1 — ES modules need `http://`, so serve the folder:

```bash
# from this v2/ directory
python -m http.server 8000
# then open http://localhost:8000
```

Or, if deployed to GitHub Pages from the repo root, v2 is live at
`https://trgallagher-research.github.io/innovation-SCION/v2/` alongside the
original at the root.
