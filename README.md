# Say-Do Gap Self-Assessment

A self-contained, zero-dependency web app implementing the workshop pre-work brief: an anonymous
SAY (multi-select) → DO (ranking) flow that routes each participant to a private result screen
based on their #1-ranked item, plus a facilitator dashboard that groups and analyzes all
responses.

No `npm install` needed — it only uses Node's built-in `http` and `fs` modules, so it will run
anywhere Node 18+ is installed, including offline.

## How it maps to the brief

| Requirement | How it's implemented |
|---|---|
| Anonymous | No name, email, login, or device fingerprint is ever collected. Each response is just `{ timestamp, sayAnswers, doRanking }` with a random id used only in-memory client-side. |
| Ranking statements | Screen 3 shows all 6 DO statements with up/down controls to reorder them from "most true of me" to "least true of me." (See "Why arrows instead of drag" below.) |
| Results screen | Screen 4 shows one of 6 private result screens, chosen purely client-adjacent by the server's response — nothing is shown to the room, and the participant's #2-ranked category is inserted into the text automatically. |
| Required logic ("if A ranked highest, show result A") | The server computes `primary = doRanking[0]` and returns which result screen to show; a ranking can't produce ties, so there's no tie-break edge case. |
| Grouping / analysis for the facilitator | `/facilitator.html` shows live counts grouped by primary (#1) and secondary (#2) category, flags any category with 0–1 people at #1 (the brief's "empty-category rule"), and offers a CSV export of the raw anonymous rankings. |

### Why arrows instead of literal drag-and-drop

The brief calls for a "drag-ranking." True drag-and-drop reordering is unreliable on touch
devices without a JS library (which would break the zero-dependency, offline-friendly design), so
this build uses tap-friendly up/down arrows on each item instead. Functionally it's identical — the
participant ends up with a strict order of all 6 items, and the #1 item drives the same logic a
drag interaction would. If you'd rather have literal drag gestures, say so and I can wire in a
small drag library (this will need internet access at the venue, since it'd load from a CDN).

## Running it

```bash
cd say-do-gap
node server.js
```

Then open:
- Participants: `http://localhost:3000/` (or your machine's LAN IP, e.g. `http://192.168.1.23:3000/`, so phones on the same Wi-Fi can reach it — put that URL in a QR code)
- Facilitator: `http://localhost:3000/facilitator.html`

To password-protect the facilitator dashboard and data endpoints, set an env var before starting:

```bash
FACILITATOR_KEY=berlin2026 node server.js
```

Then open the dashboard with `http://localhost:3000/facilitator.html` and enter that key when
prompted (it's remembered in the browser after that). Without a key set, anyone with the
`/facilitator.html` link can see the dashboard — fine if only you have that link on your laptop,
but set a key if you're worried about it leaking.

Responses are stored in `data/responses.json` on whatever machine runs the server. There's a
"Reset all" button on the dashboard for clearing test data before the real workshop — don't use it
mid-session.

## Running it for the actual workshop

Since it's a small single-room session, the simplest options are:

1. **Run it on your own laptop**, connect it to the venue Wi-Fi, and share your laptop's local IP
   (e.g. `http://192.168.1.23:3000`) via a QR code. Works fully offline from any external
   service — the only requirement is that participants' phones are on the same network as your
   laptop. This is the most robust option for a small group and needs no setup beyond installing
   Node.js once.
2. **Deploy it to a free host** (Render, Railway, Fly.io, Replit) if you want a stable public URL
   you can reuse across multiple workshops. Any of these can run a plain Node app with `node
   server.js` as the start command — no database setup required, since it just needs a small
   persistent disk for `data/responses.json` (Render/Railway both offer this on free/cheap tiers;
   confirm the specific plan you pick still includes persistent storage before the event).

Given the group size, option 1 (your own laptop + local Wi-Fi) is the easiest and most dependable —
no external dependency to fail on the day.

## Files

```
say-do-gap/
├── server.js          # zero-dependency Node server: serves the app + JSON API
├── content.js          # server-side copy of all statements/categories/result text
├── package.json
├── data/
│   └── responses.json  # anonymous response store (created automatically)
└── public/
    ├── index.html       # participant flow shell
    ├── app.js            # participant flow logic (screens, ranking, result render)
    ├── style.css
    ├── fonts.css         # @font-face rules for the self-hosted Proxima Nova files
    ├── fonts/            # Proxima Nova .woff2 files (brand typeface)
    ├── content.js        # browser copy of the same content model
    ├── facilitator.html  # dashboard shell
    ├── facilitator.js    # dashboard logic (fetch, charts, CSV link, reset)
    └── facilitator.css
```

## Editing the content

All statement text, category labels/colors, and result-screen copy live in **two** files that
should be kept in sync: `content.js` (used by the server) and `public/content.js` (used by the
browser). Both are plain JS objects — no build step, just edit the text and refresh.

## Customizing the look

Colors, fonts, and spacing are all in `public/style.css` (participant flow) and
`public/facilitator.css` (dashboard) — nothing is hardcoded into the HTML/JS, so restyling doesn't
require touching the logic.

If you'd rather have Lovable (or another AI builder) restyle this further, you can hand it this
whole folder and ask it to "restyle the frontend only, keep `server.js` and the API contract in
`app.js`'s `fetch('/api/submit', ...)` call unchanged."
