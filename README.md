# Containment Breach

A live, navigable reactor-control-room scenario built on Reactor's
LingBot World 2 model. Plain HTML/CSS/JS frontend, one tiny Express
route as a backend. No React, no build-step magic beyond Vite serving
plain files.

## How it works

- `server.js` — the **only** backend piece. Holds your `REACTOR_API_KEY`
  and exchanges it for a short-lived session token on request. The
  browser never sees your raw key.
- `index.html` / `style.css` / `main.js` — the whole frontend. Vanilla
  JS talks to `@reactor-team/js-sdk` directly.
- `public/seed.jpg` — **you provide this.** It's the reference image
  LingBot World 2 anchors the world's visual identity to.

## Setup (do this first)

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Get your API key**
   Go to <https://www.reactor.inc/account/api-keys>, generate a key.

3. **Set your env var**
   ```bash
   cp .env.example .env
   ```
   Open `.env` and paste your key after `REACTOR_API_KEY=`.

4. **Add a reference image**
   Drop any interior/corridor/room photo into `public/seed.jpg`
   (exact filename matters — that's what `main.js` fetches). This is
   what LingBot World 2 uses to anchor the scene before it starts
   generating; it doesn't need to be perfect.

## Run it

One command runs both the frontend (Vite, port 5173) and the token
server (Express, port 3001) together:

```bash
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). Click
**Initiate Sequence**. You should see live video within a few seconds.

If it doesn't connect, check the terminal running `server.js` first —
almost every failure at this stage is either a missing `.env` or a
missing `public/seed.jpg`.

## Playing / demoing it

- **W A S D** — move through the space (persistent movement: it keeps
  driving until you release the key, and the current chunk has to
  finish before a new command takes effect — a beat of lag here is
  normal and part of how the model works, not a bug).
- **Event Deck buttons** — each one hot-swaps the live prompt to
  escalate the disaster (alarm → smoke → coolant leak → structural
  collapse). Each costs 25% containment integrity. At 0%, the run
  ends and shows your survival time.
- **Reset Reactor** — calls the model's `reset` command and restages
  the same scene.

## Customizing for your own concept

Everything you'd change to make this a different scenario lives in
`main.js`:

- `BASE_SCENE` — the seed prompt describing your world.
- `EVENT_CLAUSES` — the escalating prompt fragments each button
  injects. Swap these (and the button labels/icons in `index.html`)
  to retheme the whole experience without touching any connection
  logic.
- `INTEGRITY_START` / per-event cost (`data-cost` in `index.html`) —
  tune difficulty/pacing.

## Known gaps / things to verify against the docs

- The exact command name for **arrow-key look** (as opposed to WASD
  movement) isn't wired up here — I couldn't confirm the exact
  command name. Check
  `https://docs.reactor.inc/model-api-reference/lingbot-world-2/schema`
  in-browser if you want to add it; movement alone already sells the
  "world-model native" angle for a demo.
- `set_move_longitudinal` / `set_move_lateral` direction values
  (`forward` / `backward` / `left` / `right` / `idle`) are taken from
  the docs' own description of the command but worth a quick sanity
  check against the schema page above if movement doesn't behave as
  expected.

## Deploying for judges

For a hackathon demo, running locally on your laptop and screen-sharing
is usually simpler and more reliable than deploying. If you do want a
public URL, `npm run build` produces a static `dist/` you can host
anywhere — but you'll then need `server.js` reachable too (e.g. a free
Render/Railway deploy) since the token exchange must stay server-side.
