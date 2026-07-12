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

## 6. Messages API Design *(Feature 3)*

### Endpoints

| Method | Path | Purpose | Success | Failure |
|---|---|---|---|---|
| `POST` | `/api/messages` | Create a message | `201` + `{success, data: <message>}` | `400 VALIDATION_ERROR` with per-field `details[]` |
| `GET` | `/api/messages` | Paginated history (chronological) | `200` + `{success, data: {messages, hasMore, nextCursor}}` | `400 INVALID_CURSOR` on malformed `?before` |

Query params on `GET`: `limit?` (1..100, default 50), `before?` (ISO 8601 cursor).

### Layered request flow

For a `POST /api/messages`:

```
Request
   ↓
app-level middleware   →  helmet, cors, express.json, morgan
   ↓
route-level middleware →  validateBody(MESSAGE_BODY_SCHEMA)
   ↓
controller             →  messageController.create   (thin, no logic)
   ↓
service                →  messageService.createMessage
   ↓
model                  →  Message.create
   ↓
MongoDB
   ↓
Response  ←  { success: true, data: <message.toJSON()> }
```

Each layer has one responsibility. Any future change — rate limiting, profanity filtering, per-user quotas — has one obvious home.

### Response envelope

Consistent shape across every endpoint, success or failure:

```json
{ "success": true,  "data": ... }
{ "success": false, "error": { "code": "...", "message": "...", "details": [...] } }
```

Frontend can branch on `success` without endpoint-specific parsing. `details` is included only when field-level info exists (validation errors).

### Pagination — cursor over offset

Chose cursor pagination (`?before=<ISO date>`) over offset (`?page=N&limit=50`).

- **Stable during concurrent writes.** The cursor is anchored to a specific message; new messages arriving mid-scroll don't shift what previous requests would return. Offset would cause duplicates or gaps.
- **O(log N) at any depth** thanks to the `{createdAt: -1}` index. Offset requires the DB to scan and discard `N` documents.
- **Natural fit for infinite-scroll UIs.** The browser only needs to remember the oldest visible cursor.

The DB query orders newest-first (fastest with our index) then the service `.reverse()`s in memory so the response array reads chronologically (oldest → newest). Frontend appends new incoming messages to the tail with no special handling.

**Trade-offs acknowledged:**
- No random-page access — irrelevant for a chat feed
- Single-field timestamp cursor could theoretically collide on same-millisecond writes. A production version would use a composite `(createdAt, _id)` cursor as a tie-breaker — flagged as a future improvement.

The `limit + 1` trick reports `hasMore` without a separate `countDocuments()` call — one round-trip to Mongo instead of two.

### Validation — hand-rolled, not zod/joi

Rolled a minimal `validateBody(schema)` middleware factory instead of adopting zod, joi, or express-validator.

- Our surface is 2 endpoints × 2 fields — a library's abstractions are wasted
- Zero extra deps stays consistent with the "minimal in-house logger" precedent
- Returns **all** field errors at once (not fail-fast) — the client sees every problem in one round-trip

**Defense in depth.** The middleware is the first line at the HTTP boundary. The Mongoose schema (`required`, `minLength`, `maxLength`, `trim`) is the second at the DB boundary. Either can fail closed and the other still catches it.

**Swap candidate:** if the schema surface grows (many endpoints, nested shapes, conditional rules), migrate `validate.js` to **zod**. The middleware boundary means only that one file changes — controllers and routes see the same `req.body` contract.

### Message model — persistence design

- **Embedded `readBy` subdoc** (not a separate collection) — receipts are small, only accessed with the parent, and don't need their own lifecycle. Single-query reads.
- **`deliveredAt` defaults to `Date.now()` at create** — in this architecture, persistence and broadcast are effectively atomic, so `deliveredAt ≈ createdAt`. A queue-based fanout system would move this to the socket layer post-broadcast.
- **`toJSON` transforms `_id → id` and drops `__v`** — the REST response is clean and Mongoose-implementation-agnostic.
- **Index on `{ createdAt: -1 }`** — required for the cursor pagination query to be efficient.

---

## 7. Sections Reserved for Later Features

- **State management strategy** *(Feature 5–7)*
- **Socket.io architecture — event catalog, room usage, connection lifecycle** *(Feature 4, 7–10)*
- **Read receipt update patterns** *(Feature 10)* — the Message schema and pagination live in §6; only the receipt-write flow remains
- **Reconnection UX** *(Feature 7)*
- **Deployment topology — Render + Vercel + Atlas** *(Feature 11)*
- **Trade-offs table (final summary)** *(Feature 11)*
- **Future improvements** *(Feature 11)*

Each of these becomes a first-class section as its feature lands.
