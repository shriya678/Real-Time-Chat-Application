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

## 7. Socket.io Architecture *(Feature 4)*

### Connection lifecycle

```
Client connects (HTTP upgrade → WebSocket)
   ↓
Socket.io CORS check (env.CORS_ORIGIN)
   ↓
Server logs 'socket connected' with socket.id
   ↓
Register per-domain handlers on this socket:
   • registerChatHandlers(io, socket)     → F4
   • registerPresenceHandlers(io, socket) → F9
   ↓
Handlers process events until:
   ↓
Client disconnects (transport close or explicit disconnect)
   ↓
Server logs 'socket disconnected' with reason
```

Disconnect mid-event is safe — Socket.io propagates the disconnect through the same emitter chain, and Node's event model tolerates handlers on a closed socket.

### Event catalog (Feature 4 scope)

| Direction | Event | Payload | Purpose |
|---|---|---|---|
| client → server | `message:send` | `{ username, content }` (+ optional ack callback) | Send a new message |
| server → all | `message:new` | Full message object (same shape as REST response) | Broadcast newly persisted message |
| server → sender | `message:error` | `{ code, message, details? }` | Validation or persistence failure |
| server → sender (ack) | *(no event name — via callback)* | `{ success: true, data }` or `{ success: false, error }` | Direct response to the sender's specific emit |

Feature 8 will add `typing:*`, Feature 9 adds `presence:*`, Feature 10 adds `message:ack`, `message:read`, `message:read-update`.

### Handler pipeline

The chat handler mirrors the REST pipeline — validate → service → respond:

```
message:send  →  validate(MESSAGE_BODY_SCHEMA, payload)
                       ↓  (valid)
                 messageService.createMessage(sanitized)
                       ↓
                 io.emit('message:new', message)         (broadcast to all)
                 ack({ success: true, data: message })   (respond to sender)

                       ↓  (invalid or persist failure)
                 socket.emit('message:error', payload)
                 ack({ success: false, error: payload })
```

Response envelope is identical to REST — `{ success, data | error }` — so a single client-side helper parses either channel.

### Broadcast strategy — `io.emit` vs rooms

Currently `io.emit(...)` sends to every connected socket. Simplest model for a single global lobby.

Path to multi-room support (documented but not built):
1. Clients emit `room:join { roomId }` on entry
2. Server does `socket.join(roomId)`
3. Replace `io.emit(NEW, msg)` with `io.to(roomId).emit(NEW, msg)`

Handler shape stays identical — only the emit target changes.

### Validation reuse across transports

The pure `validate(schema, data)` function in `middleware/validate.js` is called from:
- `validateBody(schema)` — Express middleware wrapper for REST routes
- `chatHandler.registerChatHandlers` — directly in the socket handler

Both consume `MESSAGE_BODY_SCHEMA` from `models/Message.js`, so the two transports cannot drift on what a valid message body looks like. This was the small refactor bundled into F4.2 — one schema, one validator, two transports.

### Ack callback pattern

Socket.io supports "acknowledgements" — the client passes a callback as the last argument to `emit`, and the server invokes it. Semantically equivalent to a request/response, but stays on the same socket connection with no extra round-trip.

We fire **both** the ack AND the `message:error` event on failure:
- Some clients wait for the ack (per-request response pattern)
- Some clients listen for a global `message:error` handler (broadcast-style)
- Firing both means either pattern works

### Graceful shutdown ordering

`server.js` shuts down in this order on SIGINT/SIGTERM:
1. `io.close()` — refuse new upgrades, close existing sockets
2. `httpServer.close()` — finish any in-flight REST requests
3. `disconnectDB()` — Mongo connection down
4. `process.exit(0)`

A 10-second `setTimeout(...).unref()` force-exits if any step hangs. The `.unref()` prevents the timer from keeping the event loop alive on a normal (fast) shutdown.

### Trade-offs and future improvements

| Now (F4) | Future |
|---|---|
| `io.emit` — everyone gets everything | Room-scoped `io.to(roomId).emit` for multi-room chat |
| Username sent in every payload | Auth handshake sets `socket.data.username`; handlers validate sender identity |
| No message deduplication on client tempIds | F10 introduces `tempId` + `message:ack` correlation |
| Single-process socket layer | `@socket.io/redis-adapter` for horizontally-scaled backends |
| No rate limiting on socket events | `socket.use((packet, next) => …)` middleware with per-user token bucket |

---

## 8. State Management Strategy *(Feature 5)*

### Overall approach

React Context + custom hooks. No Redux, no Zustand, no Jotai. The app's state graph is small (auth in F5, chat in F7, presence in F9, typing in F8) and every piece is naturally scoped to one Provider. A state library here would be net-negative — more surface area, more boilerplate, less obvious flow.

**Convention applied to every context in this app:**
- One Context per domain (`AuthContext`, `ChatContext`, `PresenceContext`)
- Provider owns the state and every side effect
- A companion custom hook (`useAuth`, `useChat`, `usePresence`) is the **only** way consumers touch the context — it wraps `useContext` and throws if the provider is missing

### AuthContext — the anchor

Shape: `{ user, login, logout, isAuthenticated }`. Placed at the root (`main.jsx`) so any component in the tree can call `useAuth()`.

**Persistence via `localStorage`.** Username survives refresh without any auth handshake. Read once at mount via `useState(readStoredUser)` initialiser — synchronous, no flash of unauthed content. All storage access wrapped in `try/catch` so Safari private mode / corporate policy failures degrade gracefully to in-memory-only.

**Namespaced key `chatapp:user`.** Prevents collision with any other app on the same origin.

**Client-side validation mirrors backend rules** (trim, non-empty, ≤50 chars). Defense in depth — the server still validates every socket/REST payload authoritatively.

### Optimisation pattern — memoise the context value

Every provider in this app follows the same shape:

```jsx
const login = useCallback(...);
const logout = useCallback(...);

const value = useMemo(
  () => ({ user, login, logout, isAuthenticated: user !== null }),
  [user, login, logout],
);

return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
```

Without `useMemo`, `value` is a fresh object every render, and every consumer re-renders whether or not the underlying data changed. This is the most common Context perf trap; the pattern is applied consistently everywhere we ship a provider.

### Custom hooks as the public API

Consumers **never** import `AuthContext` directly — they import `useAuth`. Three benefits:

- **Fail-loud on missing provider.** `useAuth` throws with a clear message if called outside `<AuthProvider>`. Silent `undefined` errors deep in a subtree are prevented at the source.
- **Refactor freedom.** If we ever swap Context for a store, only the hook body changes. Consumers stay identical.
- **Discoverable.** `useAuth` in a component immediately signals "this component depends on auth state" — grep-friendly and reviewer-friendly.

### Pattern reuse across later features

The same shape lands three more times:

| Feature | Context | Hook | State it exposes |
|---|---|---|---|
| F7 | `ChatContext` | `useChat` | `messages`, `sendMessage`, `hasMore`, `loadOlder`, connection status |
| F8 | *(local to input)* | `useTyping` | Debounced typing signal — no provider needed |
| F9 | `PresenceContext` | `usePresence` | `onlineUsers` roster |

Each provider uses the same `useCallback` + `useMemo` discipline. Each hook uses the same throw-if-missing-provider pattern.

### Alternatives rejected

| Alternative | Why not |
|---|---|
| **Redux Toolkit** | Excellent library, wrong scale. Our state is 3 slices, no complex derived selectors, no time-travel-debugging need, no cross-cutting middleware. Setup cost is real; benefits don't materialise. |
| **Zustand** | Great when Context perf becomes an issue at large scale — not here. Also skipped for consistency ("one state approach, applied everywhere"). |
| **A single "AppContext"** | Would couple auth, chat, and presence changes into one re-render blast radius. Small contexts keep updates localised. |
| **Prop drilling** | Would work today (small tree) but breaks the moment we need `useAuth` inside a nested `MessageInput`. Setting up the Context pattern early avoids the migration. |

### Auth gate placement

The auth check lives in `App.jsx`, not in individual screens:

```jsx
if (!isAuthenticated) return <LoginScreen />;
return <AuthenticatedShell />;
```

Single decision point. Adding a new authenticated screen means composing it inside the shell, not remembering to sprinkle auth guards. Per-component `useAuth` guards are a maintenance trap; centralising the gate keeps the responsibility in one obvious place.

---

## 9. Sections Reserved for Later Features

- **Read receipt update patterns** *(Feature 10)* — the Message schema and pagination live in §6; only the receipt-write flow remains
- **Reconnection UX** *(Feature 7)*
- **Deployment topology — Render + Vercel + Atlas** *(Feature 11)*
- **Trade-offs table (final summary)** *(Feature 11)*
- **Future improvements** *(Feature 11)*

Each of these becomes a first-class section as its feature lands.
