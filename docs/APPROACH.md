# APPROACH

Living design document. Each feature PR that introduces a new architectural decision appends its rationale here. Locked sections (marked *stable*) will not change unless a scope change requires it.

---

## 1. Overall Implementation Strategy *(stable)*

Deliver the application feature-by-feature, one branch and one PR per feature. Every feature is small enough to be reviewed in isolation and passes its acceptance criteria before merge. This produces a Git history that reads like the story of the build.

The order is bottom-up: backend skeleton → REST → sockets → frontend shell → frontend chat → integration → bonuses → deploy + docs. Each layer is stable before the next lands on top of it.

---

## 2. Tech Stack *(stable)*

### Backend
| Choice | Why | Rejected alternative |
|---|---|---|
| **Node.js 20 (LTS)** | Mature ES module support without flags; required by the assessment. | Node 18: functional but older; Node 22: not yet LTS. |
| **Express 4** | Minimal, well-known, widest documentation; still the industry default. | Fastify: faster but adds a learning curve reviewers may not follow. Express 5: newer but less battle-tested. |
| **Socket.io** | Assessment mandates it. Also gives us rooms, ack semantics, automatic reconnection. | Raw WebSocket: too primitive; the assessment explicitly excludes alternatives. |
| **Mongoose + MongoDB Atlas** | Fast to model, schema validation built-in, hosted free tier. | Sqlite: no cloud persistence on ephemeral Render disks. Postgres: heavier setup without benefit for this data shape. |
| **helmet, cors, morgan** | Production hygiene: security headers, CORS control, request logs. Cheap to include, expensive to forget. | Rolling own: pointless reinvention. |
| **Minimal in-house logger** | ~30 lines, level-aware, swappable. Enough for a take-home. | pino / winston: better in production but extra deps + config we don't need yet. |

### Frontend
| Choice | Why | Rejected alternative |
|---|---|---|
| **React 18** | My strongest stack; widest interview vocabulary. | Vue / Svelte: no prior hands-on experience → higher risk on a 24-hour clock. |
| **Vite** | Instant HMR, native ESM, minimal config. | Create React App: deprecated. Next.js: overkill for a client-rendered chat UI. |
| **axios** | Interceptors, defaults, easy timeout handling. | fetch: fine for one call, cumbersome for a shared client. |
| **socket.io-client** | Direct pair with the server. | Custom WebSocket wrapper: reinvention. |
| **Context + custom hooks** | Fits the scope; no Redux boilerplate. | Redux / Zustand: over-engineered for this state graph. |

### Rejected at top level
| Rejection | Reason |
|---|---|
| React Native | Zero prior exposure on my side; APK build + toolchain would eat 4–6 hours I cannot spare. Web deploy is one command. |
| TypeScript | Adds ~1h of config and typing friction. JavaScript with disciplined naming keeps interview signal without dragging the schedule. |
| A test framework | No time budget; documented smoke tests cover the assessment surface. |

---

## 3. Folder Structure *(stable)*

```
Real-Time-Chat-Application/
├── .github/
│   └── PULL_REQUEST_TEMPLATE.md
├── backend/
│   ├── .env.example
│   ├── package.json
│   └── src/
│       ├── config/          # env, db — read once, exported frozen
│       ├── middleware/      # notFound, errorHandler, validation, asyncHandler
│       ├── models/          # Mongoose schemas (Feature 3+)
│       ├── controllers/     # HTTP handlers — thin, delegate to services
│       ├── services/        # business logic — no req/res, pure I/O
│       ├── routes/          # Express routers, one per resource
│       ├── sockets/         # Socket.io handlers (Feature 4+)
│       ├── utils/           # logger, small pure helpers
│       ├── app.js           # Express instance (importable, testable)
│       └── server.js        # HTTP lifecycle, DB connect, graceful shutdown
├── frontend/
│   ├── .env.example
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── api/             # axios client + resource-specific calls
│       ├── socket/          # singleton client + typed emit helpers
│       ├── context/         # AuthContext, ChatContext
│       ├── hooks/           # useAuth, useSocket, useChat, useTyping, usePresence, useReadReceipts
│       ├── components/      # LoginScreen, ChatWindow, MessageList, MessageBubble, etc.
│       ├── utils/           # formatTime, receiptIcons
│       ├── styles/          # chat.css
│       ├── App.jsx          # top-level composition
│       └── main.jsx         # React DOM entry
├── docs/
│   ├── REQUIREMENTS.md
│   ├── APPROACH.md
│   └── TECHNICAL_DESIGN.md  # (added in Feature 11)
└── README.md
```

**Why layered?** Each layer has one reason to change. Routes shouldn't need editing when the DB schema changes; services shouldn't care about HTTP status codes. This is the same shape reviewers ship in production Node code, so it reads as fluent architecture.

---

## 4. Configuration Strategy *(stable)*

- **Single source of truth:** `backend/src/config/env.js` reads `process.env` once at startup, validates every required var, and exports a frozen object. Any code that needs a config value imports from this module. Nothing in the codebase touches `process.env` directly.
- **Fail-fast on missing config:** Missing required vars → process exits with a helpful error. Prevents the "app runs but silently uses `undefined`" trap.
- **Environment tiers:** `NODE_ENV=development` (verbose logs, dev CORS) vs `production` (combined access logs, prod CORS). Vite's `import.meta.env` mirrors this on the client, gated to `VITE_` prefix.

---

## 5. Error-Handling Strategy *(stable)*

- **REST:** All controllers wrap with `asyncHandler(fn)` — any thrown or rejected promise flows into the central `errorHandler` middleware, which shapes it into `{ success: false, error: { code, message } }`. No try/catch spam per route.
- **Unknown routes:** A `notFound` middleware returns a 404 JSON body instead of Express's default HTML.
- **Production vs development:** Stack traces are only included in log output during development. Response bodies never leak stacks.
- **Sockets:** Each handler emits a `message:error` (or similar) event back to the sender on failure. Broadcasts are only fired on success.

---

## 6. Sections Reserved for Later Features

- **State management strategy** *(Feature 5–7)*
- **Socket.io architecture — event catalog, room usage, connection lifecycle** *(Feature 4, 7–10)*
- **Persistence patterns — pagination, indexing, read receipt updates** *(Feature 3, 10)*
- **Reconnection UX** *(Feature 7)*
- **Deployment topology — Render + Vercel + Atlas** *(Feature 11)*
- **Trade-offs table (final summary)** *(Feature 11)*
- **Future improvements** *(Feature 11)*

Each of these becomes a first-class section as its feature lands.
