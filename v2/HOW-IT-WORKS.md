# How Scion works — in plain language

A short, non-technical tour of what Scion v2 is and how it's put together.

## The big picture

Scion is a **single web page**. There is no server behind it — nothing runs in
a data centre we own. Everything happens **inside your browser**. When you open
the page, you're running the whole app on your own computer. This keeps it free
to host, private, and simple, but it shapes everything below.

## API keys (how Scion talks to an AI)

Scion doesn't come with its own AI built in. Instead, **you paste in your own API
key** — a password-like string from an AI company that lets you use their models
(and bills you for what you use).

- Your key is **typed into the sidebar** and, by default, kept only in memory —
  it disappears when you close the tab. If you tick *"Remember key,"* it's saved
  in your browser's local storage (only on your machine).
- When you send a message, your browser talks **directly** to the AI company.
  The key never passes through any server we control, because there isn't one.
- **Why it matters:** there are no shared accounts and no central key to leak,
  but it does mean each person needs their own key, and a remembered key sits in
  the browser as plain text — so leave it unticked on shared computers.

## Model selection (which AI answers)

You choose a **provider** (the AI company) and a **model** (the specific brain):

| Provider | In a browser | Good to know |
|---|---|---|
| **Anthropic (Claude)** | Works cleanly | The most reliable choice here. |
| **OpenRouter** | Works cleanly | One key gives you Claude, OpenAI *and* Google models; best web search. |
| **Google Gemini** | Works cleanly | Uses a Google AI Studio key. |
| **OpenAI (direct)** | Often fails | Browser security (called "CORS") frequently blocks it. If so, use OpenRouter and pick an OpenAI model there instead. |

The model is a **free text box** with a sensible default, because model names
change often. You can type any model the provider offers.

**One important setting:** Scion asks the model for a generous amount of room to
reply (about 16,000 words' worth of "tokens"). Modern "reasoning" models think
privately before they answer, and that hidden thinking eats into the same budget
— set it too low and the model can burn through it and return *nothing*. A
roomy default avoids that.

## The trade-offs (what we gained and gave up)

Because Scion is browser-only:

- ✅ Free to host, private by design, no logins, no infrastructure to maintain.
- ⚠️ No central place to store conversations or reflections — you **export** them
  as files yourself.
- ⚠️ OpenAI-direct is unreliable (use OpenRouter as the workaround).
- ⚠️ A remembered key lives in your browser in plain text.

## Why the instructions are split into sections

This is the heart of v2. Scion guides you through **five steps**, and the
instructions for those steps are deliberately **broken apart** rather than sent
all at once.

- There's a small, **always-on "core"**: who Scion is, who it's talking to, the
  four values it quietly protects, and its manner (warm, curious, one question at
  a time, never preachy).
- Then there's a **separate instruction block for each step**. Only the block for
  the step you're *currently* on is sent to the AI.

**Why bother?** The earlier version sent *everything* on every message, so the AI
had to juggle the whole journey at once — and tended to drift or jump ahead to a
finished proposal too early. By giving it only "you're on **this** step, do
**this**" plus the core, it stays focused on helping you *develop the idea* right
now. Crucially, this keeps all the rich, specific content — we made it
**modular, not generic**. (Generic guidelines would have made Scion blander; the
specificity is what makes it worth using.)

## What each step's prompt is for

- **Core (always on):** Scion's identity, audience, the four values, and tone.
- **1 · Orient:** Just understand the idea and where it comes from. No analysis or
  pushback yet.
- **2 · Sense:** Surface what you're *really* trying to solve and the hidden
  assumptions — quietly watching for ideas that might fragment the IB, without
  lecturing you about it.
- **3 · Develop:** Strengthen the thinking — conditions for success,
  stakeholders, risks, and whether other regions could learn from it.
- **4 · Pathway:** Decide and draft the next step — either a **Prototype Proposal**
  (if it's ready to test) or a **Discovery Plan** (if more groundwork is needed).
- **5 · Trace:** A short reflection on what this conversation teaches the wider
  system — the "Learning Trace."

## A few other things worth knowing

- **The funnel at the top** is both a map and a progress bar. It mirrors the
  Innovation Process diagram (rose squares for the open, exploratory steps; blue
  circles for the focused ones). Your current step is ringed.
- **Moving between steps is your choice** — the *Next step* / *Back* buttons. When
  you move forward, Scion is quietly nudged to open the new step with a fresh
  question, so it feels like turning a page.
- **Your place is saved.** The conversation and which step you're on are kept in
  your browser, so a reload picks up where you left off.
- **Replies stream in** word by word, rather than appearing all at once.
- **Optional extras** in the sidebar: upload documents for Scion to reference
  (read in your browser), turn on live web search (where the provider supports
  it), and export your output, full transcript, or saved reflections as files.

## In one sentence

Scion is a private, browser-only thinking partner that uses *your* AI key, walks
you through five focused steps to develop an idea, and keeps the AI sharp at each
step by showing it only what that step needs.
